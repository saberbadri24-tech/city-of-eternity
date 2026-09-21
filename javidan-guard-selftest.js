/* ANIL X — Javidan Guard self-test
 * Browser-safe invariant checks. No wallet, signing, or funds are touched.
 */
(function(){
  "use strict";
  function run(){
    const E=window.JavidanOpportunityEngine;
    if(!E)throw new Error("engine_missing");
    if(E.version!=="2.3.0")throw new Error("engine_version_mismatch");
    const bad=E.officialUrl("https://evil.example/claim");
    if(bad)throw new Error("official_domain_gate_failed");
    const good=E.officialUrl("https://airdrop.boundless.network/");
    if(!good)throw new Error("official_domain_allowlist_failed");
    const s=E.safeSummary({guard:"JAVIDAN",version:E.version,mode:"TEST",generatedAt:new Date().toISOString(),sources:{},safety:{seedPhraseRequested:false,privateKeyRequested:false,autonomousSigning:false,autonomousTrading:false,autonomousWithdrawal:false,userApprovalRequired:true},opportunities:[]});
    if(s.safety.seedPhraseRequested||s.safety.privateKeyRequested||s.safety.autonomousSigning||s.safety.autonomousTrading||s.safety.autonomousWithdrawal||!s.safety.userApprovalRequired)throw new Error("safety_invariant_failed");
    return {ok:true,version:E.version,tests:["engine","official-domain-block","official-domain-allow","safety-invariants"]};
  }
  window.JavidanGuardSelfTest=Object.freeze({run});
})();
