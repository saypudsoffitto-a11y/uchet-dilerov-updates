process.chdir(require('node:path').resolve(__dirname,'../..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('8.9.31 updater parses',()=>{
  new vm.Script(fs.readFileSync('app/updater-8931.js','utf8'));
});

test('installer is scheduled only after app process exits',()=>{
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes('Wait-Process -Id $p'));
  assert.ok(s.indexOf('Wait-Process -Id $p') < s.indexOf('Start-Process -FilePath $env:UCHET_UPDATE_EXE'));
  assert.ok(s.includes("windowSafety.allowClose(win)"));
  assert.ok(s.includes("setImmediate(()=>app.quit())"));
});

test('hotfix overrides legacy update handlers after main.js loads',()=>{
  const main=fs.readFileSync('app/main-8927.js','utf8');
  assert.ok(main.indexOf("require('./main-8922.js')") < main.indexOf("require('./updater-8931.js')"));
  const s=fs.readFileSync('app/updater-8931.js','utf8');
  assert.ok(s.includes("ipcMain.removeHandler('update:checkAndInstall')"));
  assert.ok(s.includes("ipcMain.removeHandler('update:installFromFile')"));
});
