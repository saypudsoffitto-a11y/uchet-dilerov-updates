'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.resolve(__dirname,'../../app');
const src=fs.readFileSync(path.join(appDir,'release-8953.js'),'utf8');

test('selected sidebar section is unmistakable and tables use a full grid',()=>{
  assert.match(src,/nav button\.active\{/);
  assert.match(src,/font-weight:800!important/);
  assert.match(src,/data-section="debts"\]\.active\{background:#df3b50/);
  assert.match(src,/border-right:1px solid #dce5f0!important/);
  assert.match(src,/border-bottom:1px solid #dce5f0!important/);
});

test('JPEG receipt is compact, has no article column, and currency never wraps',()=>{
  const start=src.indexOf('function compactReceiptImage8953');
  const end=src.indexOf('window.sendWhatsApp',start);
  const block=src.slice(start,end);
  assert.match(block,/\.sheet\{width:700px;padding:12px 14px 10px/);
  assert.match(block,/h1\{text-align:center;font-size:15px/);
  assert.match(block,/<th>№<\/th><th>Наименование<\/th><th>Кол-во<\/th><th>Цена<\/th><th>Сумма<\/th>/);
  assert.doesNotMatch(block,/Артикул/);
  assert.match(block,/\.price\{width:100px;text-align:right;white-space:nowrap\}/);
  assert.match(block,/\.sum\{width:106px;text-align:right;white-space:nowrap\}/);
  assert.match(block,/Сумма прописью:/);
});

test('successful sale resets the current page for the next receipt',()=>{
  assert.match(src,/function resetSaleForm8953\(\)/);
  assert.match(src,/dealerSearch\.value=''/);
  assert.match(src,/selected\.textContent='Дилер не выбран'/);
  assert.match(src,/productSearch\.value=''/);
  assert.match(src,/receipt\.innerHTML=''/);
  assert.match(src,/const created=.*type==='sale'/);
  assert.match(src,/if\(created\)resetSaleForm8953\(\)/);
});

test('Back button and Escape perform one navigation step',()=>{
  assert.match(src,/back\.textContent='← Назад'/);
  assert.match(src,/window\.historyBack8953=/);
  assert.match(src,/e\.key!=='Escape'/);
  assert.match(src,/stopImmediatePropagation/);
  assert.match(src,/navStack8953/);
});
