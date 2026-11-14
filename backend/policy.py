"""
Pure policy engine. No XRPL or web imports, so it is easy to unit-test.

The policy service calls `PolicyStore.authorize()` with the *unsigned* transaction
the agent wants to send. If every rule passes the service co-signs exactly that
transaction; otherwise it refuses and the reason is written to the audit log.

Everything the agent controls (destination, amount, fee, memo) is re-checked here.
The agent cannot raise its own limits: the mandate is only writable with the
admin token, which the agent never holds.
"""
from __future__ import annotations

import hashlib
import re
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Optional

from common import read_json, write_json

DROPS_PER_XRP = 1_000_000
CLASSIC_RE = re.compile(r"^r[1-9A-HJ-NP-Za-km-z]{24,34}$")
MEMO_TYPE_TEXT = "stokvel/reasoning-sha256"
MEMO_TYPE_HEX = MEMO_TYPE_TEXT.encode().hex().upper()
MAX_FEE_DROPS = 5_000  # 0.005 XRP. Multi-signed fees are a few dozen drops.
ALLOWED_TX_FIELDS = {
    "TransactionType", "Account", "Destination", "Amount", "Fee", "Sequence",
    "LastLedgerSequence", "SigningPubKey", "Memos", "Flags", "NetworkID",
}
MAX_EVENTS = 500


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def month_key(ts: Optional[datetime] = None) -> str:
    return (ts or datetime.now(timezone.utc)).strftime("%Y-%m")


def reasoning_hash(text: str) -> str:
    """SHA-256 of the agent's reasoning, upper-case hex. Goes in the XRPL memo."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest().upper()


def xrp_to_drops(value: Any) -> int:
    try:
        d = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError("Amount is not a number") from exc
    if not d.is_finite() or d <= 0:
        raise ValueError("Amount must be greater than zero")
    drops = d * DROPS_PER_XRP
    if drops != drops.to_integral_value():
        raise ValueError("Amount has more than 6 decimal places")
    return int(drops)


def drops_to_xrp(drops: int) -> float:
    return float(Decimal(drops) / DROPS_PER_XRP)


def fmt_xrp(drops: int) -> str:
    text = f"{Decimal(drops) / DROPS_PER_XRP:f}".rstrip("0").rstrip(".")
    return f"{text or '0'} XRP"


@dataclass
class Decision:
    ok: bool
    code: str = "OK"
    reason: str = ""
    drops: int = 0
    destination: str = ""


def check_payment(
    tx: dict,
    mandate: dict,
    spent_drops: int,
    treasury: str,
    reasoning: str,
) -> Decision:
    """Apply every rule to an unsigned Payment. First failure wins."""

    def no(code: str, reason: str, drops: int = 0, dest: str = "") -> Decision:
        return Decision(False, code, reason, drops, dest)

    if not isinstance(tx, dict):
        return no("BAD_REQUEST", "Transaction is not an object.")

    # --- Structure: only a plain XRP Payment from the treasury can be co-signed.
    ttype = tx.get("TransactionType")
    if ttype != "Payment":
        return no("NOT_PAYMENT", f"Only Payment transactions can be co-signed (got {ttype}).")
    if tx.get("Account") != treasury:
        return no("WRONG_ACCOUNT", "Transaction is not from the treasury account.")
    extra = sorted(set(tx) - ALLOWED_TX_FIELDS)
    if extra:
        return no("UNSUPPORTED_FIELDS", f"Unsupported transaction fields: {', '.join(extra)}.")
    if tx.get("SigningPubKey", "") != "":
        return no("BAD_SIGNING_KEY", "Transaction must be prepared for multi-signing.")

    amount = tx.get("Amount")
    if not isinstance(amount, str) or not amount.isdigit() or int(amount) <= 0:
        return no("NOT_XRP", "Only positive XRP amounts (in drops) are allowed.")
    drops = int(amount)

    dest = tx.get("Destination", "")
    if not isinstance(dest, str) or not CLASSIC_RE.match(dest):
        return no("BAD_DESTINATION", "Destination is not a valid XRPL address.", drops, str(dest))
    if dest == treasury:
        return no("SELF_PAYMENT", "Destination is the treasury itself.", drops, dest)

    fee = tx.get("Fee", "0")
    if not isinstance(fee, str) or not fee.isdigit() or int(fee) > MAX_FEE_DROPS:
        return no("FEE_TOO_HIGH", f"Fee exceeds the {MAX_FEE_DROPS} drop ceiling.", drops, dest)

    # Without LastLedgerSequence a co-signed transaction could be held and
    # submitted much later, so it is mandatory.
    if not isinstance(tx.get("LastLedgerSequence"), int):
        return no("NO_EXPIRY", "LastLedgerSequence is required so the signature expires.", drops, dest)

    # --- Mandate rules, in the order a treasurer would explain them.
    approved = {r["address"] for r in mandate["approved"]}
    if dest not in approved:
        return no("UNAPPROVED_RECIPIENT",
                  "Unapproved recipient (not on the stokvel's approved list).", drops, dest)

    per_cap = xrp_to_drops(mandate["per_payment_cap_xrp"])
    if drops > per_cap:
        return no("OVER_PAYMENT_CAP",
                  f"Exceeds per-payment cap ({fmt_xrp(per_cap)}).", drops, dest)

    monthly_cap = xrp_to_drops(mandate["monthly_cap_xrp"])
    if spent_drops + drops > monthly_cap:
        return no("OVER_MONTHLY_CAP",
                  f"Exceeds monthly budget cap ({fmt_xrp(monthly_cap)}). "
                  f"Already committed this month: {fmt_xrp(spent_drops)}.", drops, dest)

    # --- Audit trail: the memo must be the hash of the reasoning we will log.
    if not reasoning or not reasoning.strip():
        return no("NO_REASONING", "The agent must supply its reasoning.", drops, dest)
    memos = tx.get("Memos") or []
    expected = reasoning_hash(reasoning)
    found = False
    for item in memos:
        memo = item.get("Memo", {}) if isinstance(item, dict) else {}
        if memo.get("MemoType", "").upper() == MEMO_TYPE_HEX and memo.get("MemoData", "").upper() == expected:
            found = True
    if not found:
        return no("BAD_MEMO",
                  "Audit memo missing or does not match the hash of the supplied reasoning.", drops, dest)

    return Decision(True, "OK", "Within mandate.", drops, dest)


def default_state() -> dict:
    return {
        "mandate": {"per_payment_cap_xrp": 20, "monthly_cap_xrp": 100, "approved": []},
        "reservations": [],
        "events": [],
        "next_event_id": 1,
    }


class PolicyStore:
    """Mandate + spend ledger + audit log, persisted to one JSON file."""

    def __init__(self, path: Path, treasury: str):
        self.path = Path(path)
        self.treasury = treasury
        self._lock = threading.RLock()
        self._state = read_json(self.path, None) or default_state()
        self._save()

    # -- persistence -------------------------------------------------------
    def _save(self) -> None:
        self._state["events"] = self._state["events"][-MAX_EVENTS:]
        write_json(self.path, self._state)

    # -- mandate -----------------------------------------------------------
    def mandate(self) -> dict:
        with self._lock:
            m = self._state["mandate"]
            month = month_key()
            return {
                "per_payment_cap_xrp": m["per_payment_cap_xrp"],
                "monthly_cap_xrp": m["monthly_cap_xrp"],
                "approved": [dict(a) for a in m["approved"]],
                "month": month,
                "spent_xrp": drops_to_xrp(self._spent_drops(month)),
            }

    def _spent_drops(self, month: str) -> int:
        # Pending reservations count too: failing closed is the safe direction.
        return sum(r["drops"] for r in self._state["reservations"]
                   if r["month"] == month and r["status"] in ("pending", "confirmed"))

    def set_caps(self, per_payment: Optional[float], monthly: Optional[float], actor: str) -> dict:
        with self._lock:
            m = self._state["mandate"]
            changes = []
            if per_payment is not None:
                xrp_to_drops(per_payment)
                changes.append(f"per-payment cap {m['per_payment_cap_xrp']} -> {per_payment} XRP")
                m["per_payment_cap_xrp"] = per_payment
            if monthly is not None:
                xrp_to_drops(monthly)
                changes.append(f"monthly cap {m['monthly_cap_xrp']} -> {monthly} XRP")
                m["monthly_cap_xrp"] = monthly
            if changes:
                self._event("SYSTEM", reason=f"{actor} changed the mandate: " + "; ".join(changes) + ".",
                            submittedBy=actor)
            self._save()
            return self.mandate()

    def add_recipient(self, address: str, label: str, actor: str) -> dict:
        if not CLASSIC_RE.match(address):
            raise ValueError("Not a valid XRPL classic address")
        with self._lock:
            approved = self._state["mandate"]["approved"]
            label = (label or "").strip() or "Approved vendor"
            for r in approved:
                if r["address"] == address:
                    r["label"] = label
                    break
            else:
                approved.append({"address": address, "label": label})
                self._event("SYSTEM", recipient=f"{address} ({label})",
                            reason=f"{actor} added a vendor to the approved list.", submittedBy=actor)
            self._save()
            return self.mandate()

    def remove_recipient(self, address: str, actor: str) -> dict:
        with self._lock:
            approved = self._state["mandate"]["approved"]
            kept = [r for r in approved if r["address"] != address]
            if len(kept) != len(approved):
                self._state["mandate"]["approved"] = kept
                self._event("SYSTEM", recipient=address,
                            reason=f"{actor} removed a vendor from the approved list.", submittedBy=actor)
            self._save()
            return self.mandate()

    # -- authorisation -----------------------------------------------------
    def authorize(self, tx: dict, reasoning: str, context: dict) -> tuple[Decision, Optional[str]]:
        with self._lock:
            month = month_key()
            decision = check_payment(tx, self._state["mandate"], self._spent_drops(month),
                                     self.treasury, reasoning)
            ctx = {"submittedBy": str(context.get("submittedBy") or "Treasurer Agent")[:80],
                   "memberId": str(context.get("memberId") or "AGENT")[:40],
                   "claimId": context.get("claimId")}
            if not decision.ok:
                self._event("BLOCKED", recipient=self._label_for(decision.destination),
                            amount=fmt_xrp(decision.drops) if decision.drops else "0 XRP",
                            reason=decision.reason, code=decision.code, reasoning=reasoning,
                            reasoningHash=reasoning_hash(reasoning or ""), **ctx)
                self._save()
                return decision, None
            rid = uuid.uuid4().hex
            self._state["reservations"].append({
                "id": rid, "month": month, "drops": decision.drops, "destination": decision.destination,
                "status": "pending", "created": now_iso(), "reasoning": reasoning, **ctx,
            })
            self._save()
            return decision, rid

    def settle(self, reservation_id: str, success: bool, tx_hash: Optional[str],
               engine_result: Optional[str]) -> bool:
        with self._lock:
            for r in self._state["reservations"]:
                if r["id"] != reservation_id or r["status"] != "pending":
                    continue
                r["status"] = "confirmed" if success else "released"
                r["tx_hash"] = tx_hash
                r["engine_result"] = engine_result
                common = dict(recipient=self._label_for(r["destination"]), amount=fmt_xrp(r["drops"]),
                              reasoning=r["reasoning"], reasoningHash=reasoning_hash(r["reasoning"]),
                              submittedBy=r["submittedBy"], memberId=r["memberId"], claimId=r.get("claimId"))
                if success:
                    self._event("SUCCESS", hash=tx_hash, code="tesSUCCESS",
                                reason=_first_line(r["reasoning"]), **common)
                else:
                    code = engine_result or "UNKNOWN"
                    ledger = code.startswith(("te", "tec"))
                    self._event("BLOCKED", code=code,
                                reason=(f"Co-signed, but the XRP Ledger rejected it ({code})." if ledger
                                        else f"Co-signed, but the payment did not complete ({code})."),
                                **common)
                self._save()
                return True
            return False

    # -- audit log ---------------------------------------------------------
    def _label_for(self, address: str) -> str:
        for r in self._state["mandate"]["approved"]:
            if r["address"] == address:
                return f"{address} ({r['label']})"
        return address

    def _event(self, etype: str, **fields: Any) -> dict:
        ev = {"id": self._state["next_event_id"], "ts": now_iso(), "type": etype,
              "recipient": "N/A", "amount": "0 XRP", "reason": "", "hash": None,
              "submittedBy": "System", "memberId": "N/A"}
        ev.update({k: v for k, v in fields.items() if v is not None})
        self._state["next_event_id"] += 1
        self._state["events"].append(ev)
        return ev

    def add_event(self, etype: str, **fields: Any) -> dict:
        """Used by the gateway for facts the policy service cannot see
        (kill switch, ledger-level rejections of a bypass attempt)."""
        if etype not in ("SUCCESS", "BLOCKED", "KILL_SWITCH", "SYSTEM"):
            raise ValueError("Unknown event type")
        with self._lock:
            ev = self._event(etype, **fields)
            self._save()
            return ev

    def events(self, limit: int = 200) -> list[dict]:
        with self._lock:
            return list(reversed(self._state["events"][-limit:]))


def _first_line(text: str) -> str:
    line = (text or "").strip().splitlines()[0] if (text or "").strip() else ""
    return line[:240]
