/* ANIL X — Javidan Trinity bridge v1
 * Three independent AI brains -> deterministic Javidan gate.
 * No seed/private key, no auto-sign, no transfer.
 */
(()=>{"use strict";
async function review(opportunity){
 const r=await fetch((window.ANILX_API_URL||"https://city-of-eternity.onrender.com")+"/api/javidan/trinity",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({opportunity})});
 const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||d.error||"trinity_failed");return d;
}
window.JavidanTrinity=Object.freeze({review});
document.addEventListener("javidan:opportunity-review",async e=>{
 try{const d=await review(e.detail||{});document.dispatchEvent(new CustomEvent("javidan:trinity-result",{detail:d}))}
 catch(err){document.dispatchEvent(new CustomEvent("javidan:trinity-result",{detail:{ok:false,error:String(err?.message||err)}}))}
});
})();