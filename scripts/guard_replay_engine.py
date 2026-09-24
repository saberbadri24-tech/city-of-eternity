#!/usr/bin/env python3
"""Deterministic replay check for safety invariants and portfolio arithmetic."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
    high=json.loads((ROOT/"guard-high-value.json").read_text(encoding="utf-8"))
    ranked=high.get("ranked",[])
    bad=[]
    for x in ranked:
        if x.get("automaticAction") is not False or x.get("ownerApprovalRequired") is not True: bad.append("ACTION_GATE")
        if x.get("expired") and x.get("highValueLane"): bad.append("EXPIRED_HV")
        if x.get("rewardType")=="prize_pool" and x.get("estimatedRewardUsd",0)>0: bad.append("PRIZE_POOL_AS_REWARD")
        if x.get("estimatedRewardUsd",0)<0: bad.append("NEGATIVE_REWARD")
    p=high.get("portfolioPlan",{})
    if p.get("potentialValueUsd",0)<0 or p.get("targetGapUsd",0)<0: bad.append("BAD_PORTFOLIO_ARITHMETIC")
    report={"status":"PASS" if not bad else "FAIL","checked":len(ranked),"violations":sorted(set(bad)),
      "replay":"deterministic safety replay; it does not execute external actions"}
    (ROOT/"guard-replay-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("REPLAY="+report["status"])
    if bad: raise SystemExit(1)
if __name__=="__main__": main()
