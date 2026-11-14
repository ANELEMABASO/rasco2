"""XRPL helpers: ledger reads, multi-signed transactions, signer-list changes."""
from __future__ import annotations

import re
from typing import Optional

from xrpl.clients import JsonRpcClient
from xrpl.models.requests import AccountInfo, AccountObjects
from xrpl.models.requests.account_objects import AccountObjectType
from xrpl.models.transactions import SignerEntry, SignerListSet
from xrpl.transaction import autofill, multisign, sign, submit_and_wait
from xrpl.wallet import Wallet

from common import XRPL_RPC

QUORUM = 2
HUMAN_WEIGHT, POLICY_WEIGHT, AGENT_WEIGHT = 2, 1, 1

_CODE_RE = re.compile(r"\b(te[cfmlr][A-Z][A-Za-z_]+)\b")  # e.g. tefBAD_QUORUM, not "temporarily"


def get_client() -> JsonRpcClient:
    return JsonRpcClient(XRPL_RPC)


def engine_code(exc_or_text) -> str:
    """Pull an engine result such as tefBAD_QUORUM out of an exception message."""
    m = _CODE_RE.search(str(exc_or_text))
    return m.group(1) if m else "UNKNOWN_ERROR"


def get_balance_xrp(client, address: str) -> Optional[float]:
    resp = client.request(AccountInfo(account=address, ledger_index="validated"))
    if not resp.is_successful():
        return None
    return int(resp.result["account_data"]["Balance"]) / 1_000_000


def get_signer_list(client, address: str) -> list[dict]:
    """Read the live signer list from the ledger: [{account, weight}]."""
    resp = client.request(AccountObjects(account=address, type=AccountObjectType.SIGNER_LIST,
                                         ledger_index="validated"))
    if not resp.is_successful():
        return []
    out: list[dict] = []
    for obj in resp.result.get("account_objects", []):
        for entry in obj.get("SignerEntries", []):
            e = entry["SignerEntry"]
            out.append({"account": e["Account"], "weight": e["SignerWeight"]})
    return out


def _entries(human: str, policy: str, agent: Optional[str]) -> list[SignerEntry]:
    entries = [SignerEntry(account=human, signer_weight=HUMAN_WEIGHT),
               SignerEntry(account=policy, signer_weight=POLICY_WEIGHT)]
    if agent:
        entries.append(SignerEntry(account=agent, signer_weight=AGENT_WEIGHT))
    return entries


def master_sign_signer_list(client, treasury: Wallet, human: str, policy: str, agent: str) -> str:
    """Setup only: install the signer list using the treasury's master key."""
    tx = SignerListSet(account=treasury.address, signer_quorum=QUORUM,
                       signer_entries=_entries(human, policy, agent))
    resp = submit_and_wait(tx, client, treasury)
    return resp.result["meta"]["TransactionResult"]


def human_set_signers(client, treasury_address: str, human: Wallet, policy: str,
                      agent: str, include_agent: bool) -> dict:
    """The human acts alone (weight 2 meets the quorum of 2).

    include_agent=False is the kill switch: the agent leaves the signer list on
    the ledger, so any agent signature afterwards is rejected by rippled itself.
    """
    tx = SignerListSet(account=treasury_address, signer_quorum=QUORUM,
                       signer_entries=_entries(human.address, policy, agent if include_agent else None))
    tx = autofill(tx, client, signers_count=1)
    signed = sign(tx, human, multisign=True)
    combined = multisign(tx, [signed])
    resp = submit_and_wait(combined, client)
    return {"hash": resp.result["hash"], "result": resp.result["meta"]["TransactionResult"]}
