"""Supabase helpers over plain HTTP (Auth + PostgREST). Reads env lazily-safe: import AFTER load_env()."""
from __future__ import annotations
import os, threading, time
import requests

URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
SERVICE = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")   # server only. Never ship to the browser.
ENABLED = bool(URL and ANON and SERVICE)
_cache: dict[str, tuple[float, dict]] = {}
_last_mirror = 0.0


def rest(method: str, path: str, headers: dict | None = None, **kw):
    h = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json", **(headers or {})}
    r = requests.request(method, f"{URL}/rest/v1/{path}", headers=h, timeout=15, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"Supabase {r.status_code}: {r.text[:200]}")
    return r.json() if r.text else None


def verify(token: str) -> dict | None:
    """Validate a Supabase access token (works with any signing key) and attach the profile role."""
    if not token:
        return None
    hit = _cache.get(token)
    if hit and hit[0] > time.time():
        return hit[1]
    r = requests.get(f"{URL}/auth/v1/user", headers={"apikey": ANON, "Authorization": f"Bearer {token}"}, timeout=10)
    if r.status_code != 200:
        return None
    u = r.json()
    rows = rest("GET", f"profiles?id=eq.{u['id']}&select=role,full_name,member_code")
    p = rows[0] if rows else {}
    user = {"id": u["id"], "email": u.get("email"), "name": p.get("full_name") or u.get("email") or "Member",
            "role": p.get("role", "member"), "code": p.get("member_code")}
    if len(_cache) > 500:
        _cache.clear()
    _cache[token] = (time.time() + 30, user)
    return user


def mirror_events(events: list[dict]) -> None:
    """Copy the policy service's audit events into Postgres (throttled, idempotent, never blocks a request)."""
    global _last_mirror
    if not ENABLED or not events or time.time() - _last_mirror < 20:
        return
    _last_mirror = time.time()
    rows = [{"id": f"{e['ts']}-{e['id']}", "time": e["ts"], "type": e.get("type"), "recipient": e.get("recipient"),
             "amount": str(e.get("amount", "")), "reason": e.get("reason"), "hash": e.get("hash"),
             "code": e.get("code"), "payload": e} for e in events]

    def go():
        try:
            rest("POST", "audit_events?on_conflict=id", json=rows, headers={"Prefer": "resolution=ignore-duplicates,return=minimal"})
        except Exception as exc:  # audit mirroring must never break the app
            print(f"[supabase] audit mirror failed: {exc}")
    threading.Thread(target=go, daemon=True).start()
