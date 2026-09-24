'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('8.9.46 interface includes NewMatRos cancel, receipt context menu and dealer status colors',()=>{
  const js=fs.readFileSync(path.resolve(__dirname,'../../app/interface-8945.js'),'utf8');
  const css=fs.readFileSync(path.resolve(__dirname,'../../app/interface-8945.css'),'utf8');
  assert.match(js,/nmDraftCancel8926/);
  assert.match(js,/cancelNewMatRosDraft8946/);
  assert.match(js,/dealerReceiptContextMenu8946/);
  assert.match(js,/archiveReceipt/);
  assert.match(js,/dealerMetricDebt8946/);
  assert.match(js,/dealerMetricClear8946/);
  assert.match(js,/interfaceVersion='8\.9\.(?:46|73)'/);
  assert.match(css,/nmDraftOpenRed8946/);
  assert.match(css,/dealerMetricPaid8946/);
  assert.match(css,/dealerMetricDebt8946/);
  assert.match(css,/dealerMetricClear8946/);
});
