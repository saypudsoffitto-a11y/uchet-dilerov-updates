process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('8.9.32 updater parses',()=>{
  new vm.Script(fs.readFileSync('app/updater-8931.js','utf8'));
});

test('update flow does not call ordinary close confirmation',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.equal(s.includes('windowSafety.confirmExit'),false);
  assert.ok(s.includes('windowSafety.allowClose(win)'));
});

test('installer starts only after app process exits',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('Wait-Process -Id $p'));
  assert.ok(s.indexOf('Wait-Process -Id $p') < s.indexOf('Start-Process -FilePath $env:UCHET_UPDATE_EXE'));
});

test('ordinary manual window close safety remains present',()=>{
  const s=fs.readFileSync('app/window-safety.js','utf8');
  assert.ok(s.includes('Точно хотите закрыть «Учёт дилеров»?'));
});
