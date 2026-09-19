'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.resolve(__dirname,'../../app/release-8947.js'),'utf8');

test('completed sale returns work surface to clean starting state',()=>{
  const start=src.indexOf('function installSaleReset8948');
  const end=src.indexOf('function installBackNavigation8948',start);
  const block=src.slice(start,end);
  assert.match(block,/if\(window\.receiptArea\)receiptArea\.innerHTML=''/);
  assert.match(block,/saleDealerSearch\.value=''/);
  assert.match(block,/saleDealerSelected\.textContent='Дилер не выбран'/);
  assert.match(block,/saleProductSearch\.value=''/);
  assert.match(block,/saleDealerSearch\?\.focus\(\)/);
  assert.match(block,/if\(!created\)return result/);
});

test('Back navigation tracks sections and Escape performs one Back action',()=>{
  assert.match(src,/function installBackNavigation8948\(\)/);
  assert.match(src,/const stack=\[\]/);
  assert.match(src,/window\.historyBack8948=function\(\)/);
  assert.match(src,/e\.key!=='Escape'/);
  assert.match(src,/stopImmediatePropagation/);
  assert.match(src,/suppressPush=true/);
});

test('modal headers receive a Back button next to Close',()=>{
  assert.match(src,/back\.textContent='← Назад'/);
  assert.match(src,/group\.append\(back,close\)/);
  assert.match(src,/backCloseGroup8948/);
});
