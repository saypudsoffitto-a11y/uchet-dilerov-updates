'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.resolve(__dirname,'../../app');

test('active sidebar has strong state and section-specific selected colors',()=>{
  const css=fs.readFileSync(path.join(appDir,'interface-8945.css'),'utf8');
  assert.match(css,/nav button\.active::before/);
  assert.match(css,/data-section="debts"\]\.active\{background:#df3b50/);
  assert.match(css,/data-section="sales"\]\.active\{background:#159463/);
  assert.match(css,/font-weight:800!important/);
});

test('all app tables have horizontal and vertical grid separators',()=>{
  const css=fs.readFileSync(path.join(appDir,'interface-8945.css'),'utf8');
  assert.match(css,/border-right:1px solid #dce5f0!important/);
  assert.match(css,/border-bottom:1px solid #dce5f0!important/);
  assert.match(css,/th:last-child,\s*html td:last-child\{border-right:0!important\}/);
});

test('JPEG receipt is compact and keeps currency cells on one line',()=>{
  const src=fs.readFileSync(path.join(appDir,'pdf-compact-8938.js'),'utf8');
  const start=src.indexOf('function receiptJpegHtml8948');
  const end=src.indexOf('function resolveDebtReport',start);
  const block=src.slice(start,end);
  assert.match(block,/\.sheet\{width:700px;padding:12px 14px 10px/);
  assert.match(block,/h1\{text-align:center;font-size:15px/);
  assert.match(block,/th,td\{border:1px solid #cfd7e3;padding:4px 5px/);
  assert.match(block,/\.price\{width:100px;text-align:right;white-space:nowrap\}/);
  assert.match(block,/\.sum\{width:106px;text-align:right;white-space:nowrap\}/);
  assert.match(block,/class="date">от /);
});
