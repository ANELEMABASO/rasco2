"""Shared helpers: env-file loading, atomic JSON storage, constants."""
from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
SECRETS_DIR = Path(os.environ.get("SECRETS_DIR", ROOT / "secrets"))
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
XRPL_RPC = os.environ.get("XRPL_RPC", "https://s.altnet.rippletest.net:51234/")
EXPLORER_TX = "https://testnet.xrpl.org/transactions/"

_io_lock = threading.Lock()


def load_env(*names: str) -> None:
    """Load secrets/<name>.env files into os.environ (existing env vars win).

    Each process only loads the files it is entitled to:
      policy service -> policy
      gateway        -> gateway, human, agent
    """
    for name in names:
        path = SECRETS_DIR / f"{name}.env"
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Missing {key}. Run `python setup_testnet.py` first (or set it in the environment)."
        )
    return value


def read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return default


def write_json(path: Path, obj: Any) -> None:
    """Atomic write so a crash never leaves a half-written state file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _io_lock:
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=path.name, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as fh:
                json.dump(obj, fh, indent=2)
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)
