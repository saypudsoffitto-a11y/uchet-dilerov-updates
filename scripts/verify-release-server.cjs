'use strict';
// Stable sync repair requires the server which rejects full local catalog replacement.
const compatibleServerVersion='8.9.82-sync8';
(async()=>{for(let attempt=0;attempt<60;attempt++){
 try{const r=await fetch('https://uchet-dilerov-sync-8963-test.onrender.com/health',{signal:AbortSignal.timeout(15000)});const h=await r.json();if(r.ok&&h.ok&&h.storage==='turso'&&h.inventoryProtocol===2&&h.productRevisions===true&&h.serverVersion===compatibleServerVersion){console.log('Verified live server',h.serverVersion);return}}catch{}
 await new Promise(r=>setTimeout(r,15000));
}throw new Error('Compatible server not verified; stable publication is blocked')})().catch(e=>{console.error(e.message);process.exitCode=1});
