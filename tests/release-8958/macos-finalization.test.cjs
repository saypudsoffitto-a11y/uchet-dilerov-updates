'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('8.9.58 is a native Apple Silicon package with ad-hoc signature',()=>{
  const pkg=JSON.parse(read('app/package.json'));
  assert.match(pkg.version,/^8\.9\.(58|59|60|61|62)$/);
  assert.equal(pkg.build.mac.identity,null);
  assert.equal(pkg.build.afterPack,'after-pack-macos.cjs');
  const targets=pkg.build.mac.target||[];
  const byName=Object.fromEntries(targets.map(t=>[t.target,t]));
  for(const name of ['dmg','zip']){
    assert.ok(byName[name],name+' target must exist');
    assert.deepEqual(byName[name].arch,['arm64']);
  }
  assert.match(pkg.scripts['build:mac'],/--mac dmg zip --arm64/);
  assert.match(pkg.scripts['prebuild:mac'],/release-8958/);
});

test('macOS updater stays separate from the Windows updater and self-replaces from ZIP',()=>{
  const main=read('app/main.js');
  const wrapper=read('app/main-8937.js');
  assert.match(wrapper,/if \(process\.platform === 'win32'\) require\('\.\/updater-8931\.js'\)/);
  assert.match(main,/process\.platform==='darwin'\?'latest-macos\.json':'latest\.json'/);
  assert.match(main,/const downloadUrl=String\(m\.zipUrl\|\|m\.url\|\|''\)/);
  assert.match(main,/prepareMacZipInstall/);
  assert.match(main,/path\.join\(os\.homedir\(\),'Applications'/);
  assert.match(main,/xattr -dr com\.apple\.quarantine/);
});

test('Mac file picker and WhatsApp text contain no Windows-only instruction',()=>{
  const main=read('app/main.js');
  const receipt=read('app/release-8953.js');
  assert.match(main,/defaultPath:process\.platform==='win32'\?nmFolder:app\.getPath\('documents'\)/);
  assert.doesNotMatch(main,/Установи приложение WhatsApp для Windows/);
  assert.match(main,/Установи WhatsApp Desktop и повтори попытку/);
  assert.doesNotMatch(receipt,/доступна только в установленном приложении Windows/);
});

test('afterPack hook applies an ad-hoc signature before DMG/ZIP creation',()=>{
  const hook=read('app/after-pack-macos.cjs');
  assert.match(hook,/electronPlatformName!=='darwin'/);
  assert.match(hook,/execFileSync\('\/usr\/bin\/codesign'/);
  assert.match(hook,/\['--force','--deep','--sign','-','--entitlements',entitlements,appPath\]/);
  assert.match(read('app/entitlements-macos.plist'),/com.apple.security.cs.allow-jit/);
  assert.match(hook,/\['--verify','--deep','--strict',appPath\]/);
});

test('published macOS workflow verifies arm64, app version, and code signature before upload',()=>{
  const yml=read('.github/workflows/macos-release.yml');
  const verify=yml.indexOf('Verify Apple Silicon artifacts');
  const publish=yml.indexOf('Upload macOS files to GitHub Release');
  assert.ok(verify>=0&&publish>verify);
  assert.match(yml,/grep -qi 'arm64'/);
  assert.match(yml,/CFBundleShortVersionString/);
  assert.match(yml,/codesign --verify --deep --strict "\$app_path"/);
});

test('renderer reports current 8.9.59 runtime',()=>{
  const preload=read('app/preload.js');
  const productFix=read('app/release-8961.js');
  assert.match(preload,/\?runtime=89(61|62)/);
  assert.match(preload,/dataset\.uchetRuntime='8\.9\.(61|62)'/);
  assert.match(productFix,/dataset\.interfaceVersion='8\.9\.61'/);
});
