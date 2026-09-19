const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const manifest='https://raw.githubusercontent.com/saypudsoffitto-a11y/uchet-dilerov-updates/main/latest.json';

test('8.9.52 updater has built-in manifest URL and needs no user input',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  const html=read('app/index.html');
  const updater=read('app/updater-8931.js');
  assert.match(pkg.version,/^8\.9\.(52|53)$/);
  assert.match(updater,/const DEFAULT_MANIFEST_URL=/);
  assert.ok(updater.includes(manifest));
  assert.match(updater,/String\(manifestUrl\|\|''\)\.trim\(\)\|\|DEFAULT_MANIFEST_URL/);
  assert.ok(html.includes('id="updateManifestUrl" type="hidden"'));
  assert.ok(html.includes(manifest));
  assert.doesNotMatch(html,/Адрес нужно указать один раз/);
  assert.doesNotMatch(html,/if\(!url\)return alert\('Укажи адрес сервера обновлений'\)/);
});

test('8.9.52 keeps one-button backup then updater flow',()=>{
  const html=read('app/index.html');
  assert.match(html,/checkForUpdate\(\)/);
  assert.match(html,/saveBackup/);
  assert.match(html,/checkAndInstall\(url\)/);
  assert.match(html,/Проверить и установить обновление/);
});
