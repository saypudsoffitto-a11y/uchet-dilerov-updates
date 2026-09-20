'use strict';
const {execFileSync}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const appPath=process.argv[2];
if(process.platform!=='darwin'||process.arch!=='arm64')throw new Error('Native Apple Silicon runner required for launch validation');
const binary=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleExecutable',path.join(appPath,'Contents/Info.plist')],{encoding:'utf8'}).trim();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uchet-launch-'));
const report=path.join(dir,'report.json');
try {
  execFileSync(path.join(appPath,'Contents/MacOS',binary),['--uchet-smoke-test','--enable-logging=stderr'],{env:{...process.env,ELECTRON_ENABLE_LOGGING:'1',UCHET_SMOKE_REPORT:report},stdio:'inherit',timeout:45000});
} catch(error) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000);
  const crashDir=path.join(os.homedir(),'Library/Logs/DiagnosticReports');
  if(fs.existsSync(crashDir)){
    const files=fs.readdirSync(crashDir).map(n=>path.join(crashDir,n)).filter(p=>fs.statSync(p).isFile()).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
    for(const p of files.slice(0,3))console.error('CRASH REPORT',p,fs.readFileSync(p,'utf8').slice(0,40000));
  }
  if(fs.existsSync(report))console.error(fs.readFileSync(report,'utf8'));
  throw error;
}
const state=JSON.parse(fs.readFileSync(report,'utf8'));
if(!state.ok)throw new Error('Packaged app failed launch check');
console.log('Native packaged macOS launch passed:',JSON.stringify(state));
