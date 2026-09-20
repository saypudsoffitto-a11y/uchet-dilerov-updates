'use strict';

const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');

module.exports=async context=>{
  if(context.electronPlatformName!=='darwin')return;

  const appName=fs.readdirSync(context.appOutDir).find(name=>name.endsWith('.app'));
  if(!appName)throw new Error('macOS .app bundle not found in '+context.appOutDir);

  const appPath=path.join(context.appOutDir,appName);
  // ARM64 V8 needs MAP_JIT permission even for an ad-hoc signature.
  const entitlements=path.join(__dirname,'entitlements-macos.plist');
  execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-','--entitlements',entitlements,appPath],{stdio:'inherit'});
  execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',appPath],{stdio:'inherit'});
};
