'use strict';
// Appearance release 8.9.80 uses the unchanged server protocol from 8.9.79.
const compatibleServerVersion='8.9.79-sync6';
(async()=>{for(let attempt=0;attempt<60;attempt++){
 try{const r=await fetch('https://uchet-dilerov-sync-8963-test.onrender.com/health',{signal:AbortSignal.timeout(15000)});const h=await r.json();if(r.ok&&h.ok&&h.storage==='turso'&&h.inventoryProtocol===2&&h.productRevisions===true&&h.serverVersion===compatibleServerVersion){console.log('Verified live server',h.serverVersion);return}}catch{}
 await new Promise(r=>setTimeout(r,15000));
}throw new Error('Compatible server not verified; stable publication is blocked')})().catch(e=>{console.error(e.message);process.exitCode=1});
