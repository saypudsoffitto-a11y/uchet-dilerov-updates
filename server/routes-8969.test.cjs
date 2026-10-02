'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function wait(base,child){for(let i=0;i<80;i++){if(child.exitCode!=null)throw new Error('server exited '+child.exitCode);try{const r=await fetch(base+'/health');if(r.ok)return;}catch(_){}await new Promise(r=>setTimeout(r,75));}throw new Error('health timeout');}
test('8.9.69 server root explains status and API routes without exposing state',async t=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-routes-'));const port=await freePort(),base='http://127.0.0.1:'+port;const env={...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:tmp,SYNC_TOKEN:'secret'};delete env.TURSO_DATABASE_URL;delete env.TURSO_AUTH_TOKEN;const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:'ignore'});t.after(()=>{try{child.kill()}catch(_){};fs.rmSync(tmp,{recursive:true,force:true});});await wait(base,child);let r=await fetch(base+'/');let d=await r.json();assert.equal(r.status,200);assert.equal(d.ok,true);assert.match(d.message,/работает/);assert.equal(d.api,'/api/state');assert.equal(d.health,'/health');assert.equal(d.state,undefined);r=await fetch(base+'/health/');assert.equal(r.status,200);r=await fetch(base+'/api/state/');assert.equal(r.status,401);r=await fetch(base+'/unknown');d=await r.json();assert.equal(r.status,404);assert.equal(d.api,'/api/state');});
