"""
Gateway API for the React console.

    uvicorn api:app --port 8000

* Reads the live signer list and balance from the XRP Ledger.
* Proxies the human-set mandate to the (separate) policy service with the admin token.
* Hosts the treasurer agent and the member-claims queue.
* The human's key lives here only so the demo kill switch works with one click.
  In production the human signs in a wallet (e.g. Xaman) and this key does not exist.

Mandate changes and the kill switch need a treasurer session (PIN from setup).
"""
from __future__ import annotations

import hmac
import json
import os
import re
import secrets
import threading
import time
import uuid
from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Optional

import requests
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from xrpl.wallet import Wallet

from agent import TreasuryAgent
from common import DATA_DIR, EXPLORER_TX, load_env, read_json, require_env, write_json
from policy import CLASSIC_RE, month_key, now_iso
from treasury import (QUORUM, get_balance_xrp, get_client, get_signer_list,
                      human_set_signers)

load_env("gateway", "human", "agent")
import supa  # after load_env so it sees SUPABASE_* from secrets files

POLICY_URL = os.environ.get("POLICY_URL", "http://127.0.0.1:8001").rstrip("/")
TREASURY = require_env("TREASURY_ADDRESS")
ADMIN_TOKEN = require_env("ADMIN_TOKEN")
TREASURER_PIN = os.environ.get("TREASURER_PIN") or ("" if supa.ENABLED else require_env("TREASURER_PIN"))
HUMAN = Wallet.from_seed(require_env("HUMAN_SEED"))
AGENT_WALLET = Wallet.from_seed(require_env("AGENT_SEED"))
PUBLIC = read_json(DATA_DIR / "public.json", {})  # written by setup_testnet.py; env vars win (hosted deploys)
POLICY_ADDRESS = os.environ.get("POLICY_ADDRESS") or PUBLIC.get("policy", "")
STRANGER_ADDRESS = os.environ.get("STRANGER_ADDRESS") or PUBLIC.get("stranger", "")
CLIENT = get_client()
SESSION_TTL = 8 * 3600
AGENT_INTERVAL = int(os.environ.get("AGENT_INTERVAL_SECONDS", "0"))  # 0 = only run on demand

SESSIONS: dict[str, dict] = {}


def log_event(etype: str, **fields) -> None:
    """Record a fact the policy service cannot see (kill switch, bypass attempts)."""
    try:
        requests.post(f"{POLICY_URL}/events", timeout=10, headers={"X-Admin-Token": ADMIN_TOKEN},
                      json={"type": etype, "fields": fields})
    except requests.RequestException as exc:
        print(f"[gateway] could not write audit event: {exc}")


AGENT = TreasuryAgent(treasury=TREASURY, wallet=AGENT_WALLET, client=CLIENT, policy_url=POLICY_URL,
                      agent_token=require_env("AGENT_TOKEN"), event_sink=log_event,
                      api_key=os.environ.get("ANTHROPIC_API_KEY"))


# ----------------------------------------------------------------------------- policy proxy
def policy(method: str, path: str, **kw):
    try:
        resp = requests.request(method, f"{POLICY_URL}{path}", timeout=15,
                                headers={"X-Admin-Token": ADMIN_TOKEN}, **kw)
    except requests.RequestException:
        raise HTTPException(503, f"Policy service unreachable at {POLICY_URL}. Start it with: "
                                 "uvicorn policy_service:app --port 8001")
    if resp.status_code in (401, 403):  # a gateway/policy token mismatch is not the user's login problem
        raise HTTPException(502, "Gateway is not authorised by the policy service (ADMIN_TOKEN mismatch). "
                                 "Re-run setup or copy the same tokens to both processes.")
    if resp.status_code >= 400:
        try:
            detail = resp.json().get("detail", resp.text)
        except ValueError:
            detail = resp.text
        raise HTTPException(resp.status_code, detail if isinstance(detail, str) else str(detail))
    return resp.json()


# ----------------------------------------------------------------------------- auth
class Session(BaseModel):
    name: str
    uid: str = ""


def treasurer(authorization: Optional[str] = Header(None)) -> Session:
    token = (authorization or "").removeprefix("Bearer ").strip()
    if supa.ENABLED:  # Supabase JWT + profiles.role == 'treasurer' (role can only be set in SQL)
        user = supa.verify(token)
        if not user:
            raise HTTPException(401, "Sign in required.")
        if user["role"] != "treasurer":
            raise HTTPException(403, "Treasurer role required.")
        return Session(name=user["name"], uid=user["id"])
    sess = SESSIONS.get(token)
    if not sess or sess["exp"] < time.time():
        SESSIONS.pop(token, None)
        raise HTTPException(401, "Treasurer sign-in required.")
    return Session(name=sess["name"])


def member(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """Any signed-in Supabase user. None when Supabase is not configured (legacy mode)."""
    if not supa.ENABLED:
        return None
    user = supa.verify((authorization or "").removeprefix("Bearer ").strip())
    if not user:
        raise HTTPException(401, "Sign in required.")
    return user


def optional_treasurer(authorization: Optional[str] = Header(None)) -> Optional[Session]:
    try:
        return treasurer(authorization)
    except HTTPException:
        return None


# ----------------------------------------------------------------------------- claims
class ClaimsStore:
    def __init__(self, path):
        self.path, self._lock = path, threading.RLock()
        self.items: list[dict] = read_json(path, [])

    def add(self, claim: dict) -> None:
        with self._lock:
            self.items.insert(0, claim)
            self.items = self.items[:500]
            write_json(self.path, self.items)

    def update(self, claim_id: str, **fields) -> dict:
        with self._lock:
            for c in self.items:
                if c["id"] == claim_id:
                    c.update(fields)
                    write_json(self.path, self.items)
                    return dict(c)
        raise KeyError(claim_id)

    def pending(self) -> list[dict]:
        with self._lock:
            return [dict(c) for c in self.items if c["status"] == "PENDING"]

    def list(self, member_id: Optional[str] = None) -> list[dict]:
        with self._lock:
            return [dict(c) for c in self.items if member_id is None or c["memberId"] == member_id]


class SupaClaims:
    """Same interface as ClaimsStore, persisted in Supabase Postgres (table `claims`)."""
    COLS = {"memberId": "member_id", "memberName": "member_name", "blockReason": "block_reason",
            "txHash": "tx_hash", "timestamp": "created_at"}

    def _row(self, c: dict) -> dict:
        return {self.COLS.get(k, k): v for k, v in c.items()}

    def _claim(self, r: dict) -> dict:
        inv = {v: k for k, v in self.COLS.items()}
        return {inv.get(k, k): v for k, v in r.items()}

    def add(self, claim: dict) -> None:
        supa.rest("POST", "claims", json=self._row(claim))

    def update(self, claim_id: str, **fields) -> dict:
        rows = supa.rest("PATCH", f"claims?id=eq.{claim_id}", json=self._row(fields),
                         headers={"Prefer": "return=representation"})
        if not rows:
            raise KeyError(claim_id)
        return self._claim(rows[0])

    def pending(self) -> list[dict]:
        return [self._claim(r) for r in supa.rest("GET", "claims?status=eq.PENDING&order=created_at.asc")]

    def list(self, member_id: Optional[str] = None) -> list[dict]:
        q = "claims?order=created_at.desc&limit=500" + (f"&member_id=eq.{member_id}" if member_id else "")
        return [self._claim(r) for r in supa.rest("GET", q)]


CLAIMS = SupaClaims() if supa.ENABLED else ClaimsStore(DATA_DIR / "claims.json")
MAX_ATTEMPTS = 3


def address_in(text: str) -> str:
    """Members pick 'rAddr (Label)' from a list or paste a bare address."""
    token = (text or "").strip().split()[0] if (text or "").strip() else ""
    return token


def process_claim(claim: dict) -> dict:
    dest = address_in(claim["recipient"])
    result = AGENT.handle_claim(claim, dest)
    attempts = claim.get("attempts", 0) + 1
    status = result["status"]
    if status == "PAID":
        return CLAIMS.update(claim["id"], status="APPROVED", txHash=result["txHash"],
                             blockReason=None, attempts=attempts)
    if status == "ERROR" and attempts < MAX_ATTEMPTS:
        return CLAIMS.update(claim["id"], status="PENDING", attempts=attempts,
                             blockReason=f"Retrying: {result['reason']}")
    if status == "DECLINED":
        reason = f"Agent declined: {result['reason']}"
    elif status == "LEDGER_REJECTED":
        reason = f"Rejected by the XRP Ledger ({result['code']}). Agent may have been revoked."
    else:
        reason = result["reason"]
    return CLAIMS.update(claim["id"], status="BLOCKED", blockReason=reason, attempts=attempts)


# ----------------------------------------------------------------------------- agent cycle
AGENT_STATE_PATH = DATA_DIR / "agent_state.json"
_cycle_lock = threading.Lock()


def _obligations() -> list:
    if os.environ.get("OBLIGATIONS_JSON"):
        return json.loads(os.environ["OBLIGATIONS_JSON"])
    return read_json(DATA_DIR / "obligations.json", [])


def run_cycle(force: bool = False) -> dict:
    """What the timer does: work the claim queue, then this month's obligations."""
    if not _cycle_lock.acquire(blocking=False):
        return {"skipped": "a cycle is already running"}
    try:
        summary = {"claims": [], "obligations": []}
        for claim in CLAIMS.pending():
            done = process_claim(claim)
            summary["claims"].append({"id": done["id"], "status": done["status"]})

        month = month_key()
        state = read_json(AGENT_STATE_PATH, {})
        month_state = state.setdefault(month, {})
        for ob in _obligations():
            prior = month_state.get(ob["id"])
            if prior == "PAID" or (prior and not force):
                continue
            result = AGENT.pay_obligation(ob)
            month_state[ob["id"]] = "PAID" if result["status"] == "PAID" else result.get("code", "FAILED")
            summary["obligations"].append({"id": ob["id"], "status": result["status"],
                                           "reason": result["reason"], "txHash": result.get("txHash")})
        write_json(AGENT_STATE_PATH, state)
        return summary
    finally:
        _cycle_lock.release()


def _timer() -> None:
    while True:
        time.sleep(AGENT_INTERVAL)
        try:
            run_cycle(force=False)
        except Exception as exc:
            print(f"[agent timer] {exc}")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if AGENT_INTERVAL > 0:
        threading.Thread(target=_timer, daemon=True).start()
        print(f"[agent] autonomous cycle every {AGENT_INTERVAL}s ({AGENT.mode} mode)")
    yield


app = FastAPI(title="Stokvel Console Gateway", version="1.0", lifespan=lifespan)
# CORS_ORIGINS: comma-separated exact origins, e.g. https://stokvel.vercel.app
# CORS_ORIGIN_REGEX: optional, e.g. https://stokvel-.*\.vercel\.app to also allow preview deployments
app.add_middleware(CORSMiddleware, allow_methods=["*"], allow_headers=["*"],
                   allow_origins=[o.strip().rstrip("/") for o in os.environ.get(
                       "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()],
                   allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX") or None)

# ----------------------------------------------------------------------------- ledger view (cached)
_ledger = {"ts": 0.0, "balance": None, "signers": [], "error": None}
_ledger_lock = threading.Lock()


def ledger_view(force: bool = False) -> dict:
    with _ledger_lock:
        if force or time.time() - _ledger["ts"] > 4:
            try:
                _ledger["balance"] = get_balance_xrp(CLIENT, TREASURY)
                _ledger["signers"] = get_signer_list(CLIENT, TREASURY)
                _ledger["error"] = None
            except Exception as exc:
                _ledger["error"] = f"XRPL testnet unreachable: {str(exc)[:120]}"
            _ledger["ts"] = time.time()
        return dict(_ledger)


def role_of(address: str) -> tuple[str, str]:
    if address == HUMAN.address:
        return "human", "Stokvel Treasurer (human)"
    if address == POLICY_ADDRESS:
        return "policy", "Policy Service (independent co-signer)"
    if address == AGENT_WALLET.address:
        return "agent", "AI Treasurer Agent"
    return "unknown", "Unknown signer"


# ----------------------------------------------------------------------------- routes
class LoginIn(BaseModel):
    pin: str
    name: str = "Treasurer"


_FAILS: list[float] = []  # timestamps of recent failed logins (one shared treasurer PIN)
MAX_FAILS, FAIL_WINDOW = 5, 15 * 60


@app.post("/api/auth/login")
def login(body: LoginIn) -> dict:
    if supa.ENABLED:
        raise HTTPException(404, "PIN sign-in is disabled. Sign in with Supabase.")
    now = time.time()
    _FAILS[:] = [t for t in _FAILS if now - t < FAIL_WINDOW]
    if len(_FAILS) >= MAX_FAILS:
        raise HTTPException(429, "Too many failed sign-ins. Try again in 15 minutes.")
    if not hmac.compare_digest(body.pin.encode(), TREASURER_PIN.encode()):
        _FAILS.append(now)
        time.sleep(1)  # slow down guessing
        raise HTTPException(401, "Incorrect treasurer PIN.")
    _FAILS.clear()
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = {"name": body.name[:60] or "Treasurer", "exp": time.time() + SESSION_TTL}
    return {"token": token, "expiresIn": SESSION_TTL}


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)) -> dict:
    SESSIONS.pop((authorization or "").removeprefix("Bearer ").strip(), None)
    return {"ok": True}


@app.get("/")
def root() -> dict:
    return {"service": "stokvel-gateway", "health": "/api/health"}


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "treasury": TREASURY, "agentMode": AGENT.mode}


@app.get("/api/state")
def get_state() -> dict:
    mandate = policy("GET", "/mandate")
    events = policy("GET", "/events", params={"limit": 200})
    supa.mirror_events(events)
    led = ledger_view()
    signers = []
    for s in led["signers"]:
        role, label = role_of(s["account"])
        signers.append({**s, "role": role, "label": label})
    return {
        "network": "testnet", "treasuryAddress": TREASURY, "treasuryBalance": led["balance"] or 0,
        "ledgerError": led["error"], "quorum": QUORUM, "signers": signers,
        "agentActive": any(s["account"] == AGENT_WALLET.address for s in led["signers"]),
        "agentAddress": AGENT_WALLET.address, "agentMode": AGENT.mode, "explorerTx": EXPLORER_TX,
        "mandate": {"perPaymentCap": mandate["per_payment_cap_xrp"], "monthlyCap": mandate["monthly_cap_xrp"],
                    "monthlySpent": mandate["spent_xrp"], "month": mandate["month"],
                    "approvedRecipients": mandate["approved"]},
        "logs": [{**e, "time": e["ts"]} for e in events],
        "demo": {"strangerAddress": STRANGER_ADDRESS},
    }


class CapsIn(BaseModel):
    perPaymentCap: Optional[float] = Field(None, gt=0)
    monthlyCap: Optional[float] = Field(None, gt=0)


@app.put("/api/mandate")
def set_caps(body: CapsIn, s: Session = Depends(treasurer)) -> dict:
    return policy("PUT", "/mandate", json={"per_payment_cap_xrp": body.perPaymentCap,
                                           "monthly_cap_xrp": body.monthlyCap, "actor": s.name})


class RecipientIn(BaseModel):
    address: str
    label: str = ""


@app.post("/api/mandate/recipients")
def add_recipient(body: RecipientIn, s: Session = Depends(treasurer)) -> dict:
    return policy("POST", "/mandate/recipients",
                  json={"address": body.address, "label": body.label, "actor": s.name})


@app.delete("/api/mandate/recipients/{address}")
def remove_recipient(address: str, s: Session = Depends(treasurer)) -> dict:
    if not CLASSIC_RE.match(address):
        raise HTTPException(422, "Not an XRPL address")
    return policy("DELETE", f"/mandate/recipients/{address}", params={"actor": s.name})


def _set_agent(include: bool, s: Session) -> dict:
    now_active = any(x["account"] == AGENT_WALLET.address for x in ledger_view(force=True)["signers"])
    if include == now_active:
        raise HTTPException(409, "The agent is already " + ("authorised." if include else "revoked."))
    try:
        res = human_set_signers(CLIENT, TREASURY, HUMAN, POLICY_ADDRESS, AGENT_WALLET.address, include)
    except Exception as exc:
        raise HTTPException(502, f"XRPL rejected the signer-list change: {str(exc)[:200]}")
    if res["result"] != "tesSUCCESS":
        raise HTTPException(502, f"Signer-list change failed: {res['result']}")
    log_event("SYSTEM" if include else "KILL_SWITCH", hash=res["hash"], submittedBy=s.name,
              reason=(f"{s.name} re-authorised the agent: it is back in the on-ledger signer list." if include
                      else f"{s.name} removed the agent from the on-ledger signer list. "
                           "The ledger now rejects its signatures."))
    ledger_view(force=True)
    return {"agentActive": include, "hash": res["hash"]}


@app.post("/api/agent/revoke")
def revoke(s: Session = Depends(treasurer)) -> dict:
    return _set_agent(False, s)


@app.post("/api/agent/reauthorize")
def reauthorize(s: Session = Depends(treasurer)) -> dict:
    return _set_agent(True, s)


class AttemptIn(BaseModel):
    destination: str
    amount: float = Field(gt=0)
    reason: str = "Treasurer-triggered test"
    skipPolicy: bool = False


@app.post("/api/agent/attempt")
def attempt(body: AttemptIn, s: Session = Depends(treasurer)) -> dict:
    """Scripted agent attempt for demos: same guarded path the agent uses, no LLM judgement."""
    reasoning = f"Scripted attempt triggered from the console by {s.name}: {body.reason}"
    if body.skipPolicy:
        reasoning += " (agent deliberately skips the policy service)"
    return AGENT.attempt_payment(address_in(body.destination), Decimal(str(body.amount)), reasoning,
                                 {"submittedBy": "Treasurer Agent (test)", "memberId": "AGENT"},
                                 skip_policy=body.skipPolicy)


@app.post("/api/agent/run")
def run_agent(s: Session = Depends(treasurer)) -> dict:
    return run_cycle(force=True)


class ClaimIn(BaseModel):
    memberId: str = Field(max_length=40)
    memberName: str = Field(max_length=80)
    amount: float = Field(gt=0, le=1_000_000)
    recipient: str = Field(max_length=200)
    category: str = Field(max_length=80)
    reason: str = Field(max_length=300)


@app.post("/api/claims")
def submit_claim(body: ClaimIn, u: Optional[dict] = Depends(member)) -> dict:
    data = body.model_dump()
    if u:  # identity comes from the verified token, never from the request body
        data.update(memberId=u["id"], memberName=u["name"])
    claim = {"id": f"claim-{uuid.uuid4().hex[:10]}", **data, "status": "PENDING",
             "timestamp": now_iso(), "attempts": 0, "blockReason": None, "txHash": None}
    CLAIMS.add(claim)
    return process_claim(claim)


@app.get("/api/claims")
def list_claims(memberId: Optional[str] = Query(None),
                s: Optional[Session] = Depends(optional_treasurer),
                u: Optional[dict] = Depends(member)) -> list[dict]:
    if s is not None:
        return CLAIMS.list(memberId)          # treasurers see everything
    if u:
        return CLAIMS.list(u["id"])           # members only ever see their own
    if not memberId:
        raise HTTPException(401, "Sign in as treasurer, or pass your memberId.")
    return CLAIMS.list(memberId)
