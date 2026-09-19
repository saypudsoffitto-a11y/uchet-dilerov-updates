'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.resolve(__dirname,'../../app');

test('JPEG capture crops to the receipt sheet instead of an 840px full-width canvas',()=>{
  const main=fs.readFileSync(path.join(appDir,'main-8948.js'),'utf8');
  assert.match(main,/document\.querySelector\('\.sheet'\)\|\|document\.body/);
  assert.match(main,/Math\.max\(320,Math\.min\(1200/);
  assert.doesNotMatch(main,/Math\.max\(840/);
  assert.doesNotMatch(main,/scrollWidth,document\.body\.scrollWidth,840/);
});

test('on-screen receipt is capped at the approved compact width',()=>{
  const src=fs.readFileSync(path.join(appDir,'release-8954.js'),'utf8');
  assert.match(src,/width:min\(700px,100%\)!important/);
  assert.match(src,/max-width:700px!important/);
  assert.match(src,/font-size:15px!important/);
  assert.match(src,/dataset\.interfaceVersion='8\.9\.54'/);
});
