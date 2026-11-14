# Stokvel Treasury Agent

React console + Python backend for an AI treasurer agent that pays a stokvel's vendors from an XRPL Testnet
multi-sig treasury, within limits the agent cannot change.

```
Vercel (static React)  ──VITE_API_BASE──▶  Gateway (Render, FastAPI)  ──tokens──▶  Policy service (Render, FastAPI)
                                              agent loop, ledger reads,              own key, owns the limits,
                                              human kill-switch key (demo)           co-signs or refuses
                                                          └───────────── XRPL Testnet ◀─────────────┘
```

## Two ways to deploy

### A. Frontend only, in 2 minutes: DEMO MODE
Push to GitHub, import in Vercel, deploy. Leave every environment variable empty.
The site builds and runs with an in-browser **simulation** (a banner says so, hashes are `DEMO-…` and are not linked to the explorer).
Good for showing the UI; no XRPL transactions are made.

### B. Real system: Vercel + Render
1. **Create the testnet treasury** (locally, once):
   ```bash
   cd backend && python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python setup_testnet.py     # ~1 min. Prints your TREASURER PIN. Keep backend/secrets/ private.
   python export_env.py        # prints the env vars for each service
   ```
2. **Render**: New → Blueprint → select this repo (`render.yaml` creates two services).
   Paste the variables from `export_env.py` into each service.
   After the policy service is live, set the gateway's `POLICY_URL` to its URL.
3. **Vercel**: Settings → Environment Variables → `VITE_API_BASE = https://<gateway>.onrender.com/api` → redeploy.
4. **CORS**: on the gateway set `CORS_ORIGINS = https://<your-app>.vercel.app`
   (optional `CORS_ORIGIN_REGEX = https://<your-app>-.*\.vercel\.app` for preview URLs).
5. Open the site, sign in as an officer with the **treasurer PIN** from step 1.

Free-tier notes: Render free services sleep after ~15 min idle (first request takes up to ~1 min; the UI shows a banner)
and have no persistent disk, so the audit log, caps edits and claims reset when a service restarts.
Wallets and the starting approved list come from env vars, so they survive. Add a Render disk (`DATA_DIR`) for persistence.

## Run locally
```bash
# backend (two terminals, same venv)
cd backend && uvicorn policy_service:app --port 8001
cd backend && uvicorn api:app --port 8000
# frontend
npm install && npm run dev          # http://localhost:3000, /api is proxied to :8000
```
Optional: `ANTHROPIC_API_KEY` in `backend/secrets/gateway.env` makes member claims go through Claude tool calling.

## What was fixed in this version

| Problem found | Fix |
|---|---|
| Every API failure silently returned fake data, so on Vercel (no `/api`) the app looked alive but nothing was real | Explicit **live** vs **demo** mode (`src/api.ts`, `src/demoApi.ts`). Live mode never fakes: errors are shown. Demo mode is labelled |
| If the PIN check failed or the backend was down, login **fell back to a fake session**; any password worked | Treasurer sign-in succeeds only when the backend verifies the PIN and issues a token (5 failures lock login for 15 min) |
| One-click staff login, "Switch user" and the Register tab (default role: treasurer, password `pass1234`) granted officer access with no check | Officers need the PIN. Register creates members only. Unknown usernames can never become officers. Saved officer sessions without a token are dropped |
| Fake `active-session-*` tokens were stored for members, which made member claims never load | Tokens exist only for real treasurer sessions |
| Error/connection banners had been removed, so `setActionError` and backend errors were invisible | Banners restored (backend unreachable, ledger error, action error, demo mode) |
| Invented numbers (48,750 XRP, caps 5000/30000) shown before data loaded | Zeros until the server answers |
| No backend in the repo, nothing deployable | `backend/` (FastAPI policy service + gateway + agent), `render.yaml`, env-var configuration |
| Overlapping polls on a slow backend, no request timeouts | One poll at a time; 20 s / 90 s timeouts with readable messages |
| Dead weight: unused deps (`express`, `@google/genai`, `dotenv`, `motion`, `tsx`), 2 MB of unused images and a zip inside `public/` | Removed; `vercel.json` added |

## Tests
```bash
cd backend && python -m unittest discover -s tests    # 25 tests (policy rules, agent flow with a simulated ledger)
```

## Known limits (be upfront about these)
* Member sign-in is a placeholder: members are identified by the browser, not authenticated. Add wallet or OTP login before real use.
* All officers share one treasurer PIN (the name is recorded in the audit log).
* The gateway holds the human's key so the demo kill switch is one click; production should sign in a wallet (e.g. Xaman).
* The ZAR figures in the UI use a fixed 22.4 rate.
* Never commit `backend/secrets/` or `backend/data/` (both are git-ignored).

## Supabase (auth + database)

Set the Supabase env vars and the app switches from the shared PIN to real accounts; leave them unset and nothing changes.

1. Create a Supabase project, then run `supabase/schema.sql` in the SQL Editor (tables, row-level security, new users always start as `member`).
2. Authentication → Providers → Email. For a hackathon demo you can turn off "Confirm email".
3. **Frontend** (Vercel): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE` (see `.env.example`).
4. **Gateway** (Render): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secret, server only). `TREASURER_PIN` is no longer needed.
5. Sign up in the app, then promote your officer with the SQL at the bottom of `schema.sql`.

What moves where: **identity** (Supabase Auth, the backend verifies the bearer token and reads `profiles.role`), **claims** (`claims` table; the member is taken from the token, never from the request body), **audit log** (mirrored into `audit_events`). **Limits and approved payees stay in the policy service on purpose**, so a compromised app database cannot raise the agent's limits. Give the policy service a `DATA_DIR` disk so its mandate survives restarts.
