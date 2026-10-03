#!/usr/bin/env python3
"""Materialize the Guard temporary receiving address from a GitHub secret only."""
from __future__ import annotations
import json, os, re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
addr=(os.getenv("TON_GUARD_TEMP_WALLET") or os.getenv("TON_GUARD_TEMP_WALLET_ADDRESS") or "").strip()
valid=bool(re.fullmatch(r"(?:EQ|UQ)[A-Za-z0-9_-]{46}",addr))
if addr and not valid:
    raise SystemExit("invalid TON_GUARD_TEMP_WALLET format")
out={
  "temporaryWalletAddress": addr if valid else "",
  "mainWalletAddress": "",
  "mode": "owner-approval",
  "configured": valid,
  "privateKeysCollected": False,
  "automaticSigning": False,
  "automaticTransfer": False,
  "notes": "Temporary Guard receiving address is runtime-secret supplied; permanent/main wallet is never copied into Guard state."
}
(ROOT/"guard-wallet.json").write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"status":"TEMP_WALLET_READY" if valid else "TEMP_WALLET_WAITING","configured":valid},ensure_ascii=False))
