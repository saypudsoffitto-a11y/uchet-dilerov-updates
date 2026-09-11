process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('8.9.34 updater parses',()=>{
  new vm.Script(fs.readFileSync('app/updater-8931.js','utf8'));
});

test('update helper is verified before app is allowed to close',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('CMD_READY'));
  assert.ok(s.includes('tasklist /FI "PID eq %UCHET_UPDATE_PID%"'));
  assert.ok(s.includes("await waitForMarker(info.logPath,'CMD_READY'"));
  assert.ok(s.indexOf('await launchInstallerAfterAppExit(target,args)') < s.indexOf('windowSafety.allowClose(win)'));
});

test('PowerShell remains only as guarded fallback and duplicate launch is locked',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('spawnCmdHelper(info)'));
  assert.ok(s.includes('spawnPowerShellFallback(info,target,args)'));
  assert.ok(s.includes('Wait-Process -Id $p'));
  assert.ok(s.includes('UCHET_UPDATE_LOCK'));
  assert.ok(s.includes('mkdir "%UCHET_UPDATE_LOCK%"'));
});

test('failed helper leaves app open instead of closing into silence',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('Программа останется открытой'));
  assert.ok(s.includes('if(!fs.existsSync(target))'));
  assert.ok(s.includes('st.size<1024*1024'));
});
