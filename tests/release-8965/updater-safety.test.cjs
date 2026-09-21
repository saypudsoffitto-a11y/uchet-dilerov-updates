'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('updater never uses visible CMD tasklist/findstr wait loops',()=>{
  const updater=read('app/updater-8931.js');
  assert.doesNotMatch(updater,/tasklist\s+\/FI/i);
  assert.doesNotMatch(updater,/\|\s*findstr\b/i);
  assert.doesNotMatch(updater,/spawnCmdHelper/);
  assert.match(updater,/windowsHide:true/);
  assert.match(updater,/mode:'hidden-dual'/);
});

test('update cannot proceed when automatic backup fails',()=>{
  const html=read('app/index.html');
  assert.match(html,/let backup=await window\.updateAPI\.saveBackup\(JSON\.stringify\(state\)\)/);
  assert.match(html,/if\(!backup\|\|!backup\.ok\)\{updateStatus\.textContent='Обновление остановлено: резервная копия не создана\./);
  assert.match(html,/if\(!backup\|\|!backup\.ok\)\{updateStatus\.textContent='Установка остановлена: резервная копия не создана\./);
  const auto=html.indexOf("let backup=await window.updateAPI.saveBackup(JSON.stringify(state))");
  const install=html.indexOf("window.updateAPI.checkAndInstall(url)",auto);
  assert.ok(auto>=0 && install>auto,'backup gate must run before automatic update');
});
