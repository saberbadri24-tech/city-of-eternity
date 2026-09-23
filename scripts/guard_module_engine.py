#!/usr/bin/env python3
"""ANIL X Immortal Guard modular core: contract checks and fail-closed health report.
This preflight does not execute claims, sign transactions, or move funds.
"""
from __future__ import annotations
import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULES = {
    "global_discovery": "scripts/global_opportunity_discovery.py",
    "source_health": "scripts/guard_source_health.py",
    "source_verification": "scripts/verify_global_discovery.py",
    "airdrop_guard": "scripts/airdrop_guard.py",
    "strict_free_token_hunter": "scripts/free_real_token_engine.py",
    "ton_receipt_monitor": "scripts/guard_ton_receipts.py",
    "opportunity_intelligence": "scripts/opportunity_intelligence.py",
    "resilience_lab": "scripts/guard_resilience_lab.py",
}
REQUIRED_STATE = (
    "guard-discovery.json", "guard-source-health.json", "guard-wallet.json",
    "guard-status.json", "guard-opportunities.json", "guard-approvals.json",
    "guard-learning.json", "guard-sources.json", "guard-opportunity-history.json",
    "guard-receipts.json", "guard-claim-adapters.json", "guard-free-real-tokens.json",
)


def validate_json(path: Path):
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return True, "valid_json", value
    except FileNotFoundError:
        return False, "missing", None
    except (UnicodeError, json.JSONDecodeError) as exc:
        return False, f"invalid_json:{type(exc).__name__}", None


def main():
    module_report = []
    for name, relative in MODULES.items():
        path = ROOT / relative
        ok = path.is_file() and path.stat().st_size > 0
        module_report.append({"module": name, "path": relative, "available": ok, "bytes": path.stat().st_size if ok else 0})

    state_report = []
    for name in REQUIRED_STATE:
        ok, detail, value = validate_json(ROOT / name)
        state_report.append({"file": name, "valid": ok, "detail": detail, "topLevelType": type(value).__name__ if value is not None else None})

    # Fail closed on broken/missing required modules. State may be absent on a fresh checkout;
    # report it explicitly without erasing or fabricating state.
    missing_modules = [x["module"] for x in module_report if not x["available"]]
    invalid_state = [x["file"] for x in state_report if not x["valid"]]
    report = {
        "engine": "ANIL X Immortal Guard Modular Core", "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "moduleCount": len(module_report), "modulesAvailable": len(module_report) - len(missing_modules),
        "requiredStateCount": len(state_report), "validStateCount": len(state_report) - len(invalid_state),
        "missingModules": missing_modules, "missingOrInvalidState": invalid_state,
        "modules": module_report, "state": state_report,
        "executionPolicy": {"claim": False, "sign": False, "walletConnect": False, "transfer": False, "ownerApprovalRequired": True},
        "status": "READY" if not missing_modules and not invalid_state else "DEGRADED",
    }
    (ROOT / "guard-module-health.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "moduleCount": report["moduleCount"], "modulesAvailable": report["modulesAvailable"], "validStateCount": report["validStateCount"], "missingModules": missing_modules, "missingOrInvalidState": invalid_state}, ensure_ascii=False))
    # Health is advisory: do not stop discovery solely because optional persisted state is absent.
    return 1 if missing_modules else 0


if __name__ == "__main__":
    raise SystemExit(main())
