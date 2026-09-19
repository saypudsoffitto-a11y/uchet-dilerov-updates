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

test('8.9.59 prefers native Windows helpers before Electron-as-Node',()=>{
  const src=read('app/updater-8931.js');
  const start=src.indexOf('async function launchInstallerAfterAppExit');
  const end=src.indexOf('async function closeForUpdateAndLaunch',start);
  const block=src.slice(start,end);
  const ps=block.indexOf('spawnPowerShellFallback');
  const cmd=block.indexOf('spawnCmdHelper');
  const node=block.indexOf('spawnNodeHelper');
  assert.ok(ps>=0&&cmd>ps&&node>cmd);
  assert.match(block,/PS_READY',8000/);
  assert.match(block,/CMD_READY',8000/);
});

test('8.9.59 keeps downloaded installer in userData instead of temporary storage',()=>{
  const src=read('app/updater-8931.js');
  assert.match(src,/path\.join\(app\.getPath\('userData'\),'updates'\)/);
  assert.match(src,/fs\.mkdirSync\(updateDir,\{recursive:true\}\)/);
});

test('package version is 8.9.59',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.equal(pkg.version,'8.9.59');
  assert.match(pkg.scripts['prebuild:win'],/release-8959/);
});
