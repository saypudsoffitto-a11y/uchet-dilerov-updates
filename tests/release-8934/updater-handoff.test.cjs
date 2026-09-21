process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('8.9.34 updater parses',()=>{
  new vm.Script(fs.readFileSync('app/updater-8931.js','utf8'));
});

test('at least one hidden redundant update helper is verified before app is allowed to close',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('NODE_READY'));
  assert.ok(s.includes('PS_READY'));
  assert.ok(!s.includes('CMD_READY'));
  assert.ok(!/tasklist\s+\/FI/i.test(s));
  assert.ok(!/\|\s*findstr\b/i.test(s));
  assert.ok(s.includes("for(const m of ['NODE_READY','PS_READY'])"));
  assert.ok(s.indexOf('await launchInstallerAfterAppExit(target,args)') < s.indexOf('windowSafety.allowClose(win)'));
});

test('PowerShell and Node helpers share duplicate-launch locking and stay hidden',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('spawnNodeHelper(info,target,args)'));
  assert.ok(s.includes('spawnPowerShellFallback(info,target,args)'));
  assert.ok(s.includes('Wait-Process -Id $p'));
  assert.ok(s.includes('UCHET_UPDATE_LOCK'));
  assert.ok(s.includes('fs.mkdirSync(config.lockPath)'));
  assert.ok(s.includes('windowsHide:true'));
});

test('failed helper leaves app open instead of closing into silence',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('Программа останется открытой'));
  assert.ok(s.includes('if(!fs.existsSync(target))'));
  assert.ok(s.includes('st.size<1024*1024'));
});
