'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
test('historical clients cannot be imported by old automatic or manual callers',async()=>{
  const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
  const source=html.slice(html.indexOf('async function importBundledNewMatRosClients(manual){'),html.indexOf('function sortDealers('));
  let reads=0,alerts=0;
  const context=vm.createContext({state:{},window:{clientsAPI:{loadBundledNewMatRosClients(){reads++;throw Error('must not read');}}},alert(){alerts++;}});
  vm.runInContext(source,context);
  await vm.runInContext('autoImportBundledNewMatRosClientsOnce()',context);
  await vm.runInContext('importBundledNewMatRosClients(true)',context);
  assert.equal(reads,0);assert.equal(alerts,1);
  assert.ok(!html.includes('onclick="importBundledNewMatRosClients(true)"'));
});
test('installer and main process no longer expose historical client file',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'app/package.json'),'utf8'));
  assert.ok(!pkg.build.files.includes('newmatros_clients.json'));
  const main=fs.readFileSync(path.join(root,'app/main.js'),'utf8');
  assert.ok(!main.includes("path.join(__dirname,'newmatros_clients.json')"));
});
