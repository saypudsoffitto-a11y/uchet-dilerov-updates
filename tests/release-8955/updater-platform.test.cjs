'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const appDir=path.join(root,'app');

test('updater chooses platform manifest and has GitHub fallbacks',()=>{
  const main=fs.readFileSync(path.join(appDir,'main.js'),'utf8');
  assert.doesNotThrow(()=>new Function(main));
  assert.match(main,/process\.platform==='darwin'\?'latest-macos\.json':'latest\.json'/);
  assert.match(main,/releases\/latest\/download/);
  assert.match(main,/api\.github\.com\/repos\/saypudsoffitto-a11y\/uchet-dilerov-updates\/releases\/latest/);
});

test('macOS updater installs ZIP and relaunches app',()=>{
  const main=fs.readFileSync(path.join(appDir,'main.js'),'utf8');
  assert.match(main,/m\.zipUrl\|\|m\.url/);
  assert.match(main,/prepareMacZipInstall/);
  assert.match(main,/\/usr\/bin\/ditto/);
  assert.match(main,/\/usr\/bin\/open/);
  assert.match(main,/Applications/);
});

test('macOS release manifest publishes ZIP URL and checksum',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/macos-release.yml'),'utf8');
  assert.match(workflow,/zipUrl:/);
  assert.match(workflow,/zipSha256:/);
  assert.match(workflow,/shasum -a 256 "\$zip"/);
});

test('update screen displays actual platform',()=>{
  const html=fs.readFileSync(path.join(appDir,'index.html'),'utf8');
  assert.match(html,/id="updatePlatform"/);
  assert.match(html,/latest-macos\.json/);
  assert.match(html,/info\?\.platform==='darwin'\?'macOS':'Windows'/);
});
