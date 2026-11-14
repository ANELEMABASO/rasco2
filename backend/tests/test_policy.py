"""Offline tests for the policy engine: `python -m unittest discover -s tests` from backend/."""
import sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from policy import MEMO_TYPE_HEX, PolicyStore, check_payment, reasoning_hash  # noqa: E402

TREASURY = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
FUNERAL = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
STRANGER = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
WHY = "Approved burial invoice for member STK-042."


def tx(dest=FUNERAL, xrp=10, reasoning=WHY, **over):
    base = {
        "TransactionType": "Payment", "Account": TREASURY, "Destination": dest,
        "Amount": str(int(xrp * 1_000_000)), "Fee": "30", "Sequence": 5,
        "LastLedgerSequence": 999, "SigningPubKey": "", "Flags": 0,
        "Memos": [{"Memo": {"MemoType": MEMO_TYPE_HEX, "MemoData": reasoning_hash(reasoning)}}],
    }
    base.update(over)
    return base


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.store = PolicyStore(Path(self.dir.name) / "state.json", TREASURY)
        self.store.add_recipient(FUNERAL, "Funeral Parlour", "Test")

    def tearDown(self):
        self.dir.cleanup()

    def auth(self, t, reasoning=WHY):
        return self.store.authorize(t, reasoning, {"submittedBy": "Test", "memberId": "T-1"})

    def test_approved_payment_is_cosigned(self):
        d, rid = self.auth(tx())
        self.assertTrue(d.ok)
        self.assertIsNotNone(rid)

    def test_unapproved_recipient_blocked(self):
        d, rid = self.auth(tx(dest=STRANGER))
        self.assertEqual(d.code, "UNAPPROVED_RECIPIENT")
        self.assertIsNone(rid)
        self.assertEqual(self.store.events()[0]["type"], "BLOCKED")

    def test_per_payment_cap(self):
        d, _ = self.auth(tx(xrp=40))
        self.assertEqual(d.code, "OVER_PAYMENT_CAP")

    def test_monthly_cap_counts_reservations(self):
        self.store.set_caps(20, 30, "Test")
        self.assertTrue(self.auth(tx(xrp=15))[0].ok)
        self.assertTrue(self.auth(tx(xrp=15))[0].ok)
        self.assertEqual(self.auth(tx(xrp=1))[0].code, "OVER_MONTHLY_CAP")

    def test_failed_settlement_releases_budget(self):
        self.store.set_caps(20, 20, "Test")
        _, rid = self.auth(tx(xrp=20))
        self.assertEqual(self.auth(tx(xrp=1))[0].code, "OVER_MONTHLY_CAP")
        self.store.settle(rid, False, None, "tefBAD_SIGNATURE")
        self.assertTrue(self.auth(tx(xrp=20))[0].ok)

    def test_lowering_cap_takes_effect_immediately(self):
        self.assertTrue(self.auth(tx(xrp=15))[0].ok)
        self.store.set_caps(10, None, "Test")
        self.assertEqual(self.auth(tx(xrp=15))[0].code, "OVER_PAYMENT_CAP")

    def test_removed_recipient_blocked(self):
        self.store.remove_recipient(FUNERAL, "Test")
        self.assertEqual(self.auth(tx())[0].code, "UNAPPROVED_RECIPIENT")

    def test_non_payment_refused(self):
        d, _ = self.auth(tx(TransactionType="SignerListSet"))
        self.assertEqual(d.code, "NOT_PAYMENT")

    def test_smuggled_fields_refused(self):
        d, _ = self.auth(tx(SendMax="1000000", Paths=[[]]))
        self.assertEqual(d.code, "UNSUPPORTED_FIELDS")

    def test_iou_amount_refused(self):
        d, _ = self.auth(tx(Amount={"currency": "USD", "issuer": STRANGER, "value": "5"}))
        self.assertEqual(d.code, "NOT_XRP")

    def test_wrong_account_refused(self):
        self.assertEqual(self.auth(tx(Account=STRANGER))[0].code, "WRONG_ACCOUNT")

    def test_huge_fee_refused(self):
        self.assertEqual(self.auth(tx(Fee="1000000"))[0].code, "FEE_TOO_HIGH")

    def test_missing_expiry_refused(self):
        t = tx(); del t["LastLedgerSequence"]
        self.assertEqual(self.auth(t)[0].code, "NO_EXPIRY")

    def test_memo_must_match_reasoning(self):
        self.assertEqual(self.auth(tx(), reasoning="A different story")[0].code, "BAD_MEMO")
        t = tx(); t["Memos"] = []
        self.assertEqual(self.auth(t)[0].code, "BAD_MEMO")

    def test_success_event_carries_hash(self):
        _, rid = self.auth(tx())
        self.assertTrue(self.store.settle(rid, True, "ABC123", "tesSUCCESS"))
        ev = self.store.events()[0]
        self.assertEqual((ev["type"], ev["hash"]), ("SUCCESS", "ABC123"))
        self.assertEqual(ev["reasoningHash"], reasoning_hash(WHY))
        self.assertFalse(self.store.settle(rid, True, "ABC123", "tesSUCCESS"))  # idempotent

    def test_state_survives_restart(self):
        _, _ = self.auth(tx(xrp=12))
        again = PolicyStore(Path(self.dir.name) / "state.json", TREASURY)
        self.assertEqual(again.mandate()["spent_xrp"], 12)


if __name__ == "__main__":
    unittest.main()
