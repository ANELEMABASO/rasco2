"""
Print the environment variables to paste into your host (Render, Railway, Fly ...).
Run after `python setup_testnet.py`. Two services, two sets of secrets, so the agent's
host never holds the policy key and the policy host never holds the human or agent key.

    python export_env.py
"""
from common import SECRETS_DIR


def block(title: str, files: list[str], extra: list[str]) -> None:
    print("=" * 70)
    print(title)
    print("=" * 70)
    for name in files:
        path = SECRETS_DIR / f"{name}.env"
        if not path.exists():
            raise SystemExit(f"{path} not found. Run `python setup_testnet.py` first.")
        for line in path.read_text().splitlines():
            if line.strip() and not line.startswith("#"):
                print(line)
    for line in extra:
        print(line)
    print()


block("SERVICE 1: stokvel-policy  (own key, owns the limits)", ["policy"],
      ["# optional: INITIAL_PER_PAYMENT_CAP=20  INITIAL_MONTHLY_CAP=100"])
block("SERVICE 2: stokvel-gateway  (agent + console API)", ["gateway", "human", "agent"],
      ["POLICY_URL=https://<your-policy-service>.onrender.com",
       "CORS_ORIGINS=https://<your-app>.vercel.app",
       "# optional: CORS_ORIGIN_REGEX=https://<your-app>-.*\\.vercel\\.app   (allows Vercel preview URLs)",
       "# optional: ANTHROPIC_API_KEY=sk-ant-...   AGENT_INTERVAL_SECONDS=300"])
print("Then in Vercel set:  VITE_API_BASE=https://<your-gateway>.onrender.com/api   and redeploy.")
