/* ANIL X — Javidan independent safety-engine bridge v2
 * First-party source verification and calldata risk analysis.
 * No seed/private key, no auto-sign, no transfer.
 */
(()=>{"use strict";
async function review(opportunity){
 const r=await fetch((window.ANILX_API_URL||"https://anil-x-live.onrender.com")+"/api/javidan/trinity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunity})});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||d.error||"review_unavailable");return d;
}
window.JavidanTrinity=Object.freeze({review});
document.addEventListener("javidan:opportunity-review",async e=>{
 try{const d=await review(e.detail||{});document.dispatchEvent(new CustomEvent("javidan:trinity-result",{detail:d}))}
 catch(err){document.dispatchEvent(new CustomEvent("javidan:trinity-result",{detail:{ok:false,error:"review_unavailable"}}))}
});
})();