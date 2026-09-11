const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const appDir = path.resolve(__dirname, '../../app');
test('real package entry registers update handlers without a startup exception', () => {
  const handlers = new Map();
  const owners = new Map();
  const cache = new Map();
  const ready = [];
  const electron = {
    app: {on(){}, disableHardwareAcceleration(){}, requestSingleInstanceLock(){return true}, whenReady(){return {then(fn){ready.push(fn)}}}},
    ipcMain: {on(){}, handle(name, fn){assert.ok(!handlers.has(name), `Duplicate IPC handler: ${name}`); handlers.set(name,fn); owners.set(name,current);}, removeHandler(name){handlers.delete(name)}},
    BrowserWindow: {}, dialog: {}, Menu: {}, shell: {}
  };
  let current;
  function load(file) {
    if(cache.has(file))return cache.get(file).exports;
    const mod={exports:{}};cache.set(file,mod);
    const code=fs.readFileSync(file,'utf8');
    const fn=vm.runInThisContext('(function(require,module,exports,__dirname,__filename){'+code+'\n})',{filename:file});
    const previous=current;current=path.basename(file);
    try {fn(name=>name==='electron'?electron:name.startsWith('.')?load(require.resolve(path.resolve(path.dirname(file),name))):name==='process'?process:require(name),mod,mod.exports,path.dirname(file),file);} finally {current=previous;}
    return mod.exports;
  }
  const pkg=JSON.parse(fs.readFileSync(path.join(appDir,'package.json')));
  load(path.join(appDir,pkg.main));
  assert.equal(ready.length,1);
  assert.equal(owners.get('update:checkAndInstall'),'updater-8931.js');
  assert.equal(owners.get('update:installFromFile'),'updater-8931.js');
  assert.ok(handlers.has('update:saveBackup'));
  assert.ok(handlers.has('sync:request'));
});
