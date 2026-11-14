"""
One-off bootstrap. Creates and funds testnet wallets, locks the treasury account
behind a 2-of-weighted multi-sig, then discards the treasury's master secret.

    python setup_testnet.py

Writes (all git-ignored):
    secrets/policy.env   policy service key + tokens     (policy service only)
    secrets/human.env    the human treasurer's key        (gateway / console)
    secrets/agent.env    the agent's key + agent token    (gateway / agent)
    secrets/gateway.env  treasurer PIN, admin token       (gateway)
    data/public.json     addresses only (safe to share)
    data/policy_state.json  starting mandate
"""
from __future__ import annotations

import json
import secrets as pysecrets
import sys
import time

from xrpl.models.transactions import AccountSet, AccountSetAsfFlag
from xrpl.transaction import submit_and_wait
from xrpl.wallet import Wallet, generate_faucet_wallet

from common import DATA_DIR, SECRETS_DIR, write_json
from policy import PolicyStore
from treasury import get_client, master_sign_signer_list

VENDORS = {
    "funeral": "Funeral Parlour",
    "hall": "Community Hall Rental",
    "groceries": "Bulk Groceries Wholesaler",
}


def main() -> None:
    if (SECRETS_DIR / "policy.env").exists() and "--force" not in sys.argv:
        sys.exit("Already set up (secrets/ exists). Delete secrets/ and data/ or pass --force to start over.")

    client = get_client()

    def fund(name: str) -> Wallet:
        for attempt in range(1, 5):
            try:
                print(f"  funding {name} from the testnet faucet ...", flush=True)
                return generate_faucet_wallet(client)
            except Exception as exc:  # the faucet rate-limits bursts
                print(f"    faucet error ({exc}); retrying in {attempt * 5}s")
                time.sleep(attempt * 5)
        sys.exit("The testnet faucet kept failing. Try again in a minute.")

    print("Creating wallets")
    treasury = fund("treasury")
    human, policy, agent = fund("human"), fund("policy"), fund("agent")
    vendors = {key: fund(key) for key in VENDORS}
    stranger = fund("stranger (never approved)")

    print("Installing signer list: human=2, policy=1, agent=1, quorum=2")
    result = master_sign_signer_list(client, treasury, human.address, policy.address, agent.address)
    print("  SignerListSet:", result)
    if result != "tesSUCCESS":
        sys.exit("Could not install the signer list")

    print("Disabling the treasury master key")
    tx = AccountSet(account=treasury.address, set_flag=AccountSetAsfFlag.ASF_DISABLE_MASTER)
    result = submit_and_wait(tx, client, treasury).result["meta"]["TransactionResult"]
    print("  AccountSet(asfDisableMaster):", result)
    if result != "tesSUCCESS":
        sys.exit("Could not disable the master key")
    # `treasury` (with its master seed) goes out of scope here and is never written to disk.

    admin_token, agent_token = pysecrets.token_urlsafe(32), pysecrets.token_urlsafe(32)
    pin = f"{pysecrets.randbelow(10**6):06d}"

    SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    seed_recipients = json.dumps([{"address": w.address, "label": VENDORS[k]} for k, w in vendors.items()])
    obligations = json.dumps([{"id": "funeral-premium", "label": "Funeral Parlour",
                               "recipient": vendors["funeral"].address, "amount": 10,
                               "reason": "Monthly burial-cover premium"}])
    (SECRETS_DIR / "policy.env").write_text(
        f"POLICY_SEED={policy.seed}\nTREASURY_ADDRESS={treasury.address}\n"
        f"ADMIN_TOKEN={admin_token}\nAGENT_TOKEN={agent_token}\nSEED_RECIPIENTS={seed_recipients}\n")
    (SECRETS_DIR / "human.env").write_text(f"HUMAN_SEED={human.seed}\n")
    (SECRETS_DIR / "agent.env").write_text(f"AGENT_SEED={agent.seed}\nAGENT_TOKEN={agent_token}\n")
    (SECRETS_DIR / "gateway.env").write_text(
        f"TREASURY_ADDRESS={treasury.address}\nADMIN_TOKEN={admin_token}\nTREASURER_PIN={pin}\n"
        f"POLICY_ADDRESS={policy.address}\nSTRANGER_ADDRESS={stranger.address}\nOBLIGATIONS_JSON={obligations}\n"
        "# ANTHROPIC_API_KEY=sk-ant-...   # optional: turns the agent into a Claude tool-calling agent\n")
    for f in SECRETS_DIR.glob("*.env"):
        f.chmod(0o600)

    write_json(DATA_DIR / "public.json", {
        "network": "testnet", "treasury": treasury.address, "human": human.address,
        "policy": policy.address, "agent": agent.address,
        "vendors": {k: {"address": w.address, "label": VENDORS[k]} for k, w in vendors.items()},
        "stranger": stranger.address,
    })
    write_json(DATA_DIR / "obligations.json", [{
        "id": "funeral-premium", "label": "Funeral Parlour", "recipient": vendors["funeral"].address,
        "amount": 10, "reason": "Monthly burial-cover premium"}])
    store = PolicyStore(DATA_DIR / "policy_state.json", treasury.address)
    for key, w in vendors.items():
        store.add_recipient(w.address, VENDORS[key], "Setup")

    print("\n" + "=" * 62)
    print(" Treasury:        ", treasury.address)
    print(f" Explorer:         https://testnet.xrpl.org/accounts/{treasury.address}")
    print(" TREASURER PIN:   ", pin, "  <- sign in to the console with this")
    print("=" * 62)
    print("Local run: uvicorn policy_service:app --port 8001   and   uvicorn api:app --port 8000")
    print("Hosted deploy: python export_env.py   (prints the env vars for each service)")


if __name__ == "__main__":
    main()
