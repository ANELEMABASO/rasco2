"""
Agent <-> policy store flow with a *simulated* XRP Ledger.

xrpl-py and the network are replaced by tiny fakes, so this checks OUR control flow
(co-sign request, bypass attempt, revoked agent, budget release) and nothing about
real rippled behaviour. The real thing is verified by running the demo on testnet.
"""
import sys, tempfile, types, unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HUMAN, POLICY, AGENT = "rHumanHumanHumanHumanHumanHum1", "rPolicyPolicyPolicyPolicyPolicy1", "rAgentAgentAgentAgentAgentAg1"
TREASURY = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
FUNERAL = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
STRANGER = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
LEDGER = {"signers": {}, "quorum": 2, "submitted": []}


class FakeTx:
    def __init__(self, d, signers=None):
        self.d, self.signers = dict(d), list(signers or [])

    def to_xrpl(self):
        out = dict(self.d)
        if self.signers:
            out["Signers"] = [{"Signer": {"Account": a}} for a in self.signers]
        return out

    @classmethod
    def from_xrpl(cls, d):
        d = dict(d)
        signers = [s["Signer"]["Account"] for s in d.pop("Signers", [])]
        return cls(d, signers)


def install_fakes():
    def mod(name, **attrs):
        m = types.ModuleType(name)
        m.__dict__.update(attrs)
        sys.modules[name] = m
        return m

    from policy import CLASSIC_RE

    class Payment(FakeTx):
        def __init__(self, account, destination, amount, memos):
            super().__init__({"TransactionType": "Payment", "Account": account, "Destination": destination,
                              "Amount": amount, "SigningPubKey": "", "Flags": 0,
                              "Memos": [{"Memo": {"MemoType": m.memo_type, "MemoData": m.memo_data}} for m in memos]})

    class Memo:
        def __init__(self, memo_type, memo_data):
            self.memo_type, self.memo_data = memo_type, memo_data

    def autofill(tx, client, signers_count=None):
        return _fill(tx)

    def _fill(tx):
        tx.d.update({"Fee": "30", "Sequence": 7, "LastLedgerSequence": 1000})
        return tx

    def sign(tx, wallet, multisign=False):
        return FakeTx(tx.d, [wallet.address])

    def multisign(tx, tx_list):
        return FakeTx(tx.d, [s for t in tx_list for s in t.signers])

    def submit_and_wait(tx, client):
        weight = 0
        for s in tx.signers:
            if s not in LEDGER["signers"]:
                raise Exception("Transaction failed, tefBAD_SIGNATURE: Signer not in list.")
            weight += LEDGER["signers"][s]
        if weight < LEDGER["quorum"]:
            raise Exception("Transaction failed, tefBAD_QUORUM: Signers do not meet the quorum.")
        LEDGER["submitted"].append(tx.d)
        return types.SimpleNamespace(result={"meta": {"TransactionResult": "tesSUCCESS"},
                                             "hash": f"HASH{len(LEDGER['submitted'])}"})

    mod("xrpl"); mod("xrpl.core"); mod("xrpl.models")
    mod("xrpl.core.addresscodec", is_valid_classic_address=lambda a: bool(CLASSIC_RE.match(a or "")))
    mod("xrpl.models.transactions", Memo=Memo, Payment=Payment, SignerEntry=object, SignerListSet=object)
    mod("xrpl.models.transactions.transaction", Transaction=FakeTx)
    mod("xrpl.transaction", autofill=autofill, multisign=multisign, sign=sign, submit_and_wait=submit_and_wait)
    mod("xrpl.wallet", Wallet=object)
    mod("xrpl.clients", JsonRpcClient=object)
    mod("xrpl.models.requests", AccountInfo=object, AccountObjects=object)
    mod("xrpl.models.requests.account_objects", AccountObjectType=types.SimpleNamespace(SIGNER_LIST="signer_list"))


install_fakes()
from agent import TreasuryAgent  # noqa: E402
from policy import PolicyStore   # noqa: E402


class Resp:
    def __init__(self, code, body):
        self.status_code, self._b, self.text = code, body, str(body)

    def json(self):
        return self._b


class FlowTests(unittest.TestCase):
    def setUp(self):
        LEDGER.update(signers={HUMAN: 2, POLICY: 1, AGENT: 1}, submitted=[])
        self.tmp = tempfile.TemporaryDirectory()
        self.store = PolicyStore(Path(self.tmp.name) / "s.json", TREASURY)
        self.store.add_recipient(FUNERAL, "Funeral Parlour", "Test")
        self.sink_events = []

        def fake_request(method, url, timeout=0, headers=None, json=None, params=None):
            path = url.replace("http://policy", "")
            if path == "/cosign":
                d, rid = self.store.authorize(json["tx"], json["reasoning"], json["context"])
                if not d.ok:
                    return Resp(403, {"detail": {"code": d.code, "reason": d.reason}})
                signed = FakeTx.from_xrpl(json["tx"])
                signed.signers = [POLICY]
                return Resp(200, {"reservation_id": rid, "signed": signed.to_xrpl()})
            if path == "/settle":
                return Resp(200, {"ok": self.store.settle(json["reservation_id"], json["success"],
                                                          json["tx_hash"], json["engine_result"])})
            raise AssertionError(path)

        patcher = mock.patch("agent.requests.request", side_effect=fake_request)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)
        self.agent = TreasuryAgent(
            treasury=TREASURY, wallet=types.SimpleNamespace(address=AGENT), client=None,
            policy_url="http://policy", agent_token="t",
            event_sink=lambda etype, **f: (self.sink_events.append((etype, f)),
                                           self.store.add_event(etype, **f)))

    def pay(self, dest=FUNERAL, xrp=10, **kw):
        return self.agent.attempt_payment(dest, xrp, "Burial cover for STK-042", {"submittedBy": "T"}, **kw)

    def test_1_approved_payment_succeeds_and_is_logged(self):
        r = self.pay()
        self.assertEqual((r["status"], r["txHash"]), ("PAID", "HASH1"))
        ev = self.store.events()[0]
        self.assertEqual((ev["type"], ev["hash"]), ("SUCCESS", "HASH1"))
        self.assertEqual(len(LEDGER["submitted"]), 1)
        self.assertEqual(self.store.mandate()["spent_xrp"], 10)

    def test_2_unapproved_recipient_blocked_before_ledger(self):
        r = self.pay(dest=STRANGER)
        self.assertEqual((r["status"], r["code"]), ("POLICY_BLOCKED", "UNAPPROVED_RECIPIENT"))
        self.assertEqual(LEDGER["submitted"], [])

    def test_3_over_cap_blocked(self):
        r = self.pay(xrp=40)
        self.assertEqual(r["code"], "OVER_PAYMENT_CAP")

    def test_4_bypass_rejected_by_ledger_quorum(self):
        r = self.pay(skip_policy=True)
        self.assertEqual((r["status"], r["code"]), ("LEDGER_REJECTED", "tefBAD_QUORUM"))
        self.assertEqual(LEDGER["submitted"], [])
        self.assertEqual(self.sink_events[0][0], "BLOCKED")
        self.assertIn("Bypass attempt", self.store.events()[0]["reason"])

    def test_5_revoked_agent_rejected_by_ledger_and_budget_released(self):
        del LEDGER["signers"][AGENT]  # what the kill switch does on-ledger
        r = self.pay()
        self.assertEqual((r["status"], r["code"]), ("LEDGER_REJECTED", "tefBAD_SIGNATURE"))
        self.assertEqual(self.store.mandate()["spent_xrp"], 0)  # reservation released
        self.assertIn("rejected it (tefBAD_SIGNATURE)", self.store.events()[0]["reason"])

    def test_6_lowered_cap_blocks_next_attempt(self):
        self.assertEqual(self.pay(xrp=15)["status"], "PAID")
        self.store.set_caps(10, None, "Human")
        self.assertEqual(self.pay(xrp=15)["code"], "OVER_PAYMENT_CAP")

    def test_7_monthly_cap_blocks(self):
        self.store.set_caps(20, 25, "Human")
        self.assertEqual(self.pay(xrp=15)["status"], "PAID")
        self.assertEqual(self.pay(xrp=15)["code"], "OVER_MONTHLY_CAP")

    def test_8_invalid_address_blocked_locally(self):
        r = self.pay(dest="not-an-address")
        self.assertEqual(r["code"], "BAD_DESTINATION")

    def test_9_memo_hash_matches_logged_reasoning(self):
        self.pay()
        memo = LEDGER["submitted"][0]["Memos"][0]["Memo"]["MemoData"]
        self.assertEqual(memo, self.store.events()[0]["reasoningHash"])


if __name__ == "__main__":
    unittest.main()
