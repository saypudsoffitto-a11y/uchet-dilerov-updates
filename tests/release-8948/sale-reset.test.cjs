'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.resolve(__dirname,'../../app/release-8947.js'),'utf8');

test('sale form reset installs only around successful saveSale',()=>{
  assert.match(src,/function installSaleReset8948\(\)/);
  assert.match(src,/const beforeOps=Array\.isArray\(state\?\.ops\)\?state\.ops\.length:0/);
  assert.match(src,/if\(!created\)return result/);
});

test('successful sale reset clears dealer and product inputs but preserves receipt',()=>{
  const start=src.indexOf('function installSaleReset8948');
  const end=src.indexOf('function install(){',start);
  const block=src.slice(start,end);
  assert.match(block,/saleDealerSearch\.value=''/);
  assert.match(block,/saleDealerSelected\.textContent='Дилер не выбран'/);
  assert.match(block,/priceType\.value='retail'/);
  assert.match(block,/salePrice\.value=''/);
  assert.match(block,/saleProductSearch\.value=''/);
  assert.match(block,/saleProduct\.value=''/);
  assert.doesNotMatch(block,/receiptArea\.innerHTML=''/);
  assert.match(block,/saleDealerSearch\?\.focus\(\)/);
});
