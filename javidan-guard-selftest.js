/* ANIL X — Javidan Guard self-test v2.7
 * Deterministic browser-safe invariant/fuzz checks.
 * No wallet, signing, network write, private key or funds are touched.
 */
(function(){
  "use strict";
  function must(v,msg){if(!v)throw new Error(msg)}
  function run(){
    const E=window.JavidanOpportunityEngine;
    must(E,"engine_missing");
    must(E.version==="2.6.0","engine_version_mismatch");

    const tests=[];
    const bad=E.officialUrl("https://evil.example/claim");
    must(!bad,"official_domain_gate_failed"); tests.push("official-domain-block");
    const good=E.officialUrl("https://airdrop.boundless.network/");
    must(good,"official_domain_allowlist_failed"); tests.push("official-domain-allow");
    const sub=E.officialUrl("https://x.airdrop.boundless.network/");
    must(sub,"official_subdomain_allow_failed"); tests.push("official-subdomain-allow");

    const blocked=E.preSignReview({officialVerified:false,decoded:{flags:["unlimited_approval"]}});
    must(blocked.blocked&&!blocked.allowedToPresentForUser,"presign_block_failed"); tests.push("presign-block");
    const safe=E.preSignReview({officialVerified:true,decoded:{flags:[]}});
    must(!safe.blocked&&safe.allowedToPresentForUser&&safe.requiresUserApproval&&!safe.autoSign,"presign-safe-invariant");
    tests.push("presign-safe");

    const unlimited="0x095ea7b3"+"0".repeat(64)+"f".repeat(64);
    const decoded=E.decodeEvmCalldata(unlimited);
    must(decoded.flags.includes("unlimited_approval"),"approval_decode_failed"); tests.push("approval-decoder");
    const malformed=E.decodeEvmCalldata("not-hex");
    must(!malformed.decodable&&malformed.flags.includes("undecodable_calldata"),"malformed-calldata-failed");
    tests.push("malformed-calldata");

    const safety=E.safeSummary({
      guard:"JAVIDAN",version:E.version,mode:"TEST",generatedAt:new Date().toISOString(),
      sources:{},
      safety:{seedPhraseRequested:false,privateKeyRequested:false,autonomousSigning:false,autonomousTrading:false,autonomousWithdrawal:false,userApprovalRequired:true},
      opportunities:[]
    });
    must(!safety.safety.seedPhraseRequested&&!safety.safety.privateKeyRequested&&!safety.safety.autonomousSigning&&!safety.safety.autonomousTrading&&!safety.safety.autonomousWithdrawal&&safety.safety.userApprovalRequired,"safety_invariant_failed");
    tests.push("safety-invariants");

    const blockedFlags=[
      "seed_phrase_request","private_key_request","official_domain_unverified",
      "unlimited_approval","arbitrary_recipient","undecodable_calldata","unknown_contract_function"
    ];
    for(let i=0;i<blockedFlags.length;i++){
      const r=E.preSignReview({officialVerified:true,flags:[blockedFlags[i]],decoded:{flags:[blockedFlags[i]]}});
      must(r.blocked&&r.requiresUserApproval&&!r.autoSign,"failure_rule_"+blockedFlags[i]);
    }
    tests.push("failure-rule-matrix");

    // 2,000 deterministic adversarial inputs: reproducible and wallet-safe.
    let fuzz=0;
    for(let i=0;i<2000;i++){
      const selector=(i%5===0)?"095ea7b3":(i%5===1?"a9059cbb":"deadbeef");
      // Every approval case carries an explicit max uint256 allowance so the
      // decoder must classify it as unlimited_approval rather than relying on
      // malformed/short calldata behavior.
      const body=(selector==="095ea7b3")
        ? "0".repeat(64)+"f".repeat(64)
        : "0".repeat((i%3)*64);
      const data="0x"+selector+body;
      const d=E.decodeEvmCalldata(data);
      must(d&&typeof d.decodable==="boolean","fuzz_decode_contract");
      const review=E.preSignReview({officialVerified:(i%7)!==0,decoded:d});
      must(review&&review.requiresUserApproval===true&&review.autoSign===false,"fuzz_safety_contract");
      if(selector==="095ea7b3")must(review.blocked,"fuzz_approval_block");
      if((i%7)===0)must(review.blocked,"fuzz_unverified_domain_block");
      fuzz++;
    }
    tests.push("deterministic-fuzz-2000");

    for(let i=0;i<500;i++){
      const score=E.rankOpportunity({
        score:i%151,
        type:i%2?"defi_yield":"airdrop",
        officialVerified:i%3===0,
        claimLive:i%4===0,
        riskFlags:i%11===0?["capital_required"]:[]
      });
      must(Number.isFinite(score)&&score>=0&&score<=100,"score_bounds_failed");
    }
    tests.push("score-bounds-500");

    must(E.validTonAddress===undefined || typeof E.validTonAddress==="function","ton-validator-contract");
    if(typeof E.validTonAddress==="function"){
      must(E.validTonAddress("UQA-G0xsCW5MaWtE4JC16Y2Mj_y6u9f6MHOSK2UDgJ5N6ciW"),"ton-valid-address-contract");
      must(!E.validTonAddress("not-a-ton-address"),"ton-invalid-address-contract");
    }
    tests.push("ton-address-safety-contract");

    return {ok:true,version:E.version,tests,caseCount:2515};
  }
  window.JavidanGuardSelfTest=Object.freeze({run});
})();