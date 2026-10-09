'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../../app/master-sync-8962.js'),'utf8');
test('shared database UI and exposed API cannot claim or transfer authority',()=>{
 assert.doesNotMatch(source,/async function (claim|transfer)\(/);
 assert.match(source,/window.masterSync8962=\{pull,push,device,recordSave,markSaved,commitState,queueDeletion,recordCreatedEntity\}/);
 const ui=source.slice(source.indexOf('  const host='));
 assert.doesNotMatch(ui,/(claimMaster|transferMaster|computerTarget|computerName)8962/);
 assert.match(ui,/Общая база/);
});
