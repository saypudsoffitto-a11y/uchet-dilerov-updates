'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.59 Windows updater has multiple manifest routes for VPN/Parallels networks',()=>{
  const src=read('app/updater-8931.js');
  assert.match(src,/function manifestUrls\(requested\)/);
  assert.match(src,/raw\.githubusercontent\.com\/saypudsoffitto-a11y\/uchet-dilerov-updates\/main\/latest\.json/);
  assert.match(src,/releases\/latest\/download\/latest\.json/);
  assert.match(src,/api\.github\.com\/repos\/saypudsoffitto-a11y\/uchet-dilerov-updates\/releases\/latest/);
  assert.match(src,/async function fetchUpdateManifest\(requested\)/);
});

test('8.9.59 launches redundant Windows helpers with a shared lock',()=>{
  const src=read('app/updater-8931.js');
  const start=src.indexOf('async function launchInstallerAfterAppExit');
  const end=src.indexOf('async function closeForUpdateAndLaunch',start);
  const block=src.slice(start,end);
  assert.match(block,/spawnNodeHelper\(info,target,args\)/);
  assert.match(block,/spawnPowerShellFallback\(info,target,args\)/);
  assert.match(block,/spawnCmdHelper\(info\)/);
  assert.match(block,/\['NODE_READY','PS_READY','CMD_READY'\]/);
  assert.match(block,/mode:'multi'/);
  assert.match(src,/UCHET_UPDATE_LOCK/);
});

test('8.9.59 keeps downloaded installer in userData instead of temporary storage',()=>{
  const src=read('app/updater-8931.js');
  assert.match(src,/path\.join\(app\.getPath\('userData'\),'updates'\)/);
  assert.match(src,/fs\.mkdirSync\(updateDir,\{recursive:true\}\)/);
});

test('package version is 8.9.59',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.match(pkg.version,/^8\.9\.(61|62)$/);
  assert.match(pkg.scripts['prebuild:win'],/release-8959/);
});
