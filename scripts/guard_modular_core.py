#!/usr/bin/env python3
"""Immortal Guard Modular Core — deterministic, auditable orchestration.

This module coordinates existing Guard engines without executing claims,
wallet signatures, transfers, KYC/CAPTCHA, or other owner-only actions.
It is intentionally dependency-free and safe to run offline.
"""
from __future__ import annotations
import json, hashlib, time
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 1

# Add modules here as they become real, independently testable capabilities.
# A missing module is reported, never silently treated as healthy.
MODULES = {
    "discovery": "guard-discovery.json",
    "source_health": "guard-source-health.json",
    "opportunities": "guard-opportunities.json",
    "history": "guard-opportunity-history.json",
    "strict_free_tokens": "guard-free-real-tokens.json",
    "intelligence": "guard-intelligence.json",
    "receipts": "guard-receipts.json",
    "approvals": "guard-approvals.json",
    "learning": "guard-learning.json",
    "unlock_value": "guard-unlock-value.json",
    "auto_claim": "guard-auto-claim.json",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_json(path: Path) -> tuple[Any | None, str | None]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f), None
    except FileNotFoundError:
        return None, "missing"
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return None, f"invalid:{type(exc).__name__}"


def stable_id(item: dict[str, Any]) -> str:
    """Identity is based on normalized project/chain/contract/url, not title."""
    parts = [str(item.get(k, "")).strip().lower() for k in
             ("project", "chain", "contractAddress", "url")]
    raw = "|".join(parts).strip("|")
    if not raw:
        raw = json.dumps(item, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:20]


def inspect_state(root: Path = ROOT) -> dict[str, Any]:
    modules: dict[str, Any] = {}
    for name, filename in MODULES.items():
        value, error = load_json(root / filename)
        if error:
            modules[name] = {"state": "unavailable", "reason": error}
            continue
        if not isinstance(value, (dict, list)):
            modules[name] = {"state": "degraded", "reason": "unexpected-root-type"}
            continue
        modules[name] = {"state": "readable", "rootType": type(value).__name__}
    states = [v["state"] for v in modules.values()]
    overall = "healthy" if all(s == "readable" for s in states) else "degraded"
    return {"schemaVersion": SCHEMA_VERSION, "generatedAt": utc_now(),
            "engine": "Immortal Guard Modular Core", "overall": overall,
            "modules": modules,
            "safety": {"autoClaim": False, "autoSign": False,
                       "autoTransfer": False, "ownerApprovalRequired": True}}


def merge_opportunities(*collections: Any) -> list[dict[str, Any]]:
    """Conservative stable-ID merge; preserves provenance and all source records."""
    merged: dict[str, dict[str, Any]] = {}
    for collection in collections:
        if isinstance(collection, dict):
            candidates = collection.get("opportunities", collection.get("items", []))
        elif isinstance(collection, list):
            candidates = collection
        else:
            continue
        if not isinstance(candidates, list):
            continue
        for item in candidates:
            if not isinstance(item, dict):
                continue
            key = str(item.get("id") or stable_id(item))
            if key not in merged:
                merged[key] = dict(item)
                merged[key]["id"] = key
                merged[key]["provenance"] = list(item.get("provenance", []))
            else:
                current = merged[key]
                for field, value in item.items():
                    if field in ("provenance", "sources"):
                        old = current.get(field, [])
                        incoming = value if isinstance(value, list) else [value]
                        if not isinstance(old, list): old = [old]
                        current[field] = list(dict.fromkeys(old + incoming))
                    elif field not in current or current[field] in (None, "", [], {}):
                        current[field] = value
                current["provenance"] = list(dict.fromkeys(
                    current.get("provenance", []) + item.get("provenance", [])))
    return sorted(merged.values(), key=lambda x: x["id"])


def build_report(root: Path = ROOT) -> dict[str, Any]:
    state = inspect_state(root)
    sources = []
    for filename in ("guard-discovery.json", "guard-opportunities.json",
                     "guard-free-real-tokens.json", "guard-opportunity-history.json"):
        value, err = load_json(root / filename)
        if not err: sources.append(value)
    opportunities = merge_opportunities(*sources)
    state["opportunityCount"] = len(opportunities)
    state["opportunityIds"] = [x["id"] for x in opportunities]
    state["deduplication"] = "stable-id; source records retained"
    state["limitations"] = [
        "Readable JSON is not proof of fresh data or a successful upstream scan.",
        "Discovery coverage depends on configured sources and network/API access.",
        "No automated claim, signature, KYC/CAPTCHA, or asset transfer is performed."]
    return state


def run_leverage_engines(root: Path = ROOT) -> dict[str, Any]:
    """Run the independent leverage layer immediately before the modular report.
    Fail closed: a missing/failed optional engine is recorded, never treated as success.
    """
    import subprocess, sys
    engines = (
        ("opportunity_graph", "guard_opportunity_graph.py"),
        ("novelty", "guard_novelty_engine.py"),
        ("action_planner", "guard_action_planner.py"),
        ("unlock_value", "guard_unlock_value_engine.py"),
    )
    results = {}
    for name, filename in engines:
        script = root / "scripts" / filename
        if not script.exists():
            results[name] = {"state": "missing"}
            continue
        try:
            p = subprocess.run([sys.executable, str(script)], cwd=str(root),
                               capture_output=True, text=True, timeout=120)
            results[name] = {
                "state": "healthy" if p.returncode == 0 else "failed",
                "returncode": p.returncode,
                "stdout": p.stdout[-2000:],
                "stderr": p.stderr[-2000:],
            }
        except Exception as exc:
            results[name] = {"state": "failed", "error": type(exc).__name__}
    return results

def main() -> int:
    leverage = run_leverage_engines()
    report = build_report()
    report["leverageEngines"] = leverage
    target = ROOT / "guard-modular-core.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overall": report["overall"], "modules": report["modules"],
                       "opportunityCount": report["opportunityCount"]}, ensure_ascii=False))
    # Degraded state is reported in the artifact; hard failures are handled by JSON validation.
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
