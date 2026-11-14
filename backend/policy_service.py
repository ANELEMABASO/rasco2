"""
Stokvel policy service: the independent co-signer.

Run it as its own process with its own key:

    uvicorn policy_service:app --port 8001

It holds (1) the policy signing key, (2) the human-set mandate, (3) the spend
ledger and (4) the audit log. The agent can only ask it to co-sign; it cannot
change any of the above because writes need ADMIN_TOKEN, which the agent never
receives.
"""
from __future__ import annotations

import hmac
import json
import os
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from xrpl.core.addresscodec import is_valid_classic_address
from xrpl.models.transactions.transaction import Transaction
from xrpl.transaction import sign
from xrpl.wallet import Wallet

from common import DATA_DIR, load_env, require_env
from policy import PolicyStore

load_env("policy")  # only this process reads secrets/policy.env

POLICY_WALLET = Wallet.from_seed(require_env("POLICY_SEED"))
TREASURY = require_env("TREASURY_ADDRESS")
ADMIN_TOKEN = require_env("ADMIN_TOKEN")
AGENT_TOKEN = require_env("AGENT_TOKEN")
_FIRST_BOOT = not (DATA_DIR / "policy_state.json").exists()
STORE = PolicyStore(DATA_DIR / "policy_state.json", TREASURY)
if _FIRST_BOOT and os.environ.get("SEED_RECIPIENTS"):
    # Hosts with ephemeral disks start empty: SEED_RECIPIENTS=[{"address":"r...","label":"..."}]
    for item in json.loads(os.environ["SEED_RECIPIENTS"]):
        STORE.add_recipient(item["address"], item.get("label", ""), "Setup")
if _FIRST_BOOT:
    STORE.set_caps(float(os.environ.get("INITIAL_PER_PAYMENT_CAP", 20)),
                   float(os.environ.get("INITIAL_MONTHLY_CAP", 100)), "Setup")

# The policy service is machine-to-machine only: no public API docs.
app = FastAPI(title="Stokvel Policy Service", version="1.0", docs_url=None, redoc_url=None, openapi_url=None)


def _eq(a: Optional[str], b: str) -> bool:
    return a is not None and hmac.compare_digest(a.encode(), b.encode())


def admin(x_admin_token: Optional[str] = Header(None)) -> None:
    if not _eq(x_admin_token, ADMIN_TOKEN):
        raise HTTPException(401, "Admin token required")


def agent_or_admin(x_agent_token: Optional[str] = Header(None),
                   x_admin_token: Optional[str] = Header(None)) -> None:
    if not (_eq(x_agent_token, AGENT_TOKEN) or _eq(x_admin_token, ADMIN_TOKEN)):
        raise HTTPException(401, "Token required")


def agent_only(x_agent_token: Optional[str] = Header(None)) -> None:
    if not _eq(x_agent_token, AGENT_TOKEN):
        raise HTTPException(401, "Agent token required")


class CosignRequest(BaseModel):
    tx: dict
    reasoning: str
    context: dict = Field(default_factory=dict)


class SettleRequest(BaseModel):
    reservation_id: str
    success: bool
    tx_hash: Optional[str] = None
    engine_result: Optional[str] = None


class CapsRequest(BaseModel):
    per_payment_cap_xrp: Optional[float] = Field(None, gt=0, le=1_000_000)
    monthly_cap_xrp: Optional[float] = Field(None, gt=0, le=10_000_000)
    actor: str = "Treasurer"


class RecipientRequest(BaseModel):
    address: str
    label: str = ""
    actor: str = "Treasurer"


class EventRequest(BaseModel):
    type: str
    fields: dict = Field(default_factory=dict)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "policy_address": POLICY_WALLET.address, "treasury": TREASURY}


@app.post("/cosign", dependencies=[Depends(agent_only)])
def cosign(req: CosignRequest) -> dict:
    decision, reservation_id = STORE.authorize(req.tx, req.reasoning, req.context)
    if not decision.ok:
        raise HTTPException(403, {"code": decision.code, "reason": decision.reason})
    try:
        signed = sign(Transaction.from_xrpl(req.tx), POLICY_WALLET, multisign=True)
        return {"reservation_id": reservation_id, "signed": signed.to_xrpl(),
                "policy_address": POLICY_WALLET.address}
    except Exception as exc:  # could not sign: release the reserved budget
        STORE.settle(reservation_id, False, None, "POLICY_SIGN_ERROR")
        raise HTTPException(400, {"code": "SIGN_ERROR", "reason": str(exc)})


@app.post("/settle", dependencies=[Depends(agent_only)])
def settle(req: SettleRequest) -> dict:
    return {"ok": STORE.settle(req.reservation_id, req.success, req.tx_hash, req.engine_result)}


@app.get("/mandate", dependencies=[Depends(agent_or_admin)])
def get_mandate() -> dict:
    return STORE.mandate()


@app.put("/mandate", dependencies=[Depends(admin)])
def put_mandate(req: CapsRequest) -> dict:
    try:
        return STORE.set_caps(req.per_payment_cap_xrp, req.monthly_cap_xrp, req.actor)
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.post("/mandate/recipients", dependencies=[Depends(admin)])
def add_recipient(req: RecipientRequest) -> dict:
    address = req.address.strip()
    if not is_valid_classic_address(address):
        raise HTTPException(422, "Not a valid XRPL address (checksum failed).")
    return STORE.add_recipient(address, req.label, req.actor)


@app.delete("/mandate/recipients/{address}", dependencies=[Depends(admin)])
def remove_recipient(address: str, actor: str = "Treasurer") -> dict:
    return STORE.remove_recipient(address, actor)


@app.get("/events", dependencies=[Depends(agent_or_admin)])
def events(limit: int = 200) -> list[dict]:
    return STORE.events(min(max(limit, 1), 500))


@app.post("/events", dependencies=[Depends(admin)])
def add_event(req: EventRequest) -> dict:
    try:
        return STORE.add_event(req.type, **req.fields)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
