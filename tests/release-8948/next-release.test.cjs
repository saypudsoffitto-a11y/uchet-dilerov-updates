const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.join(__dirname,'..','..','app');
const patch=fs.readFileSync(path.join(appDir,'next-8948.js'),'utf8');
const preload=fs.readFileSync(path.join(appDir,'preload.js'),'utf8');
const main=fs.readFileSync(path.join(appDir,'main-8948.js'),'utf8');
const pkg=require('../../app/package.json');

test('next release keeps NewMatRos receipt description compact',()=>{
  assert.match(patch,/Полотно: /);
  assert.match(patch,/рулон /);
  assert.match(patch,/узкая плёнка/);
  assert.match(patch,/широкая плёнка/);
  assert.match(patch,/material\.name=compactMaterialName8948/);
});

test('product table context menu contains all agreed actions',()=>{
  for(const label of ['Изменить товар','Копировать','Создать копию карточки','Создать новый товар','Удалить товар']){
    assert.match(patch,new RegExp(label));
  }
  assert.match(patch,/nth-child\(3\).*360px/);
  assert.match(patch,/nth-child\(2\).*90px/);
});

test('WhatsApp uses JPEG IPC in the new override',()=>{
  assert.match(preload,/sendJpeg/);
  assert.match(main,/receipt:sendJpegWhatsApp/);
  assert.match(main,/toJPEG\(92\)/);
  assert.match(patch,/\.jpg/);
  assert.doesNotMatch(patch,/sendPdf\(/);
});

test('package is wired for 8.9.48 draft build',()=>{
  assert.equal(pkg.version,'8.9.48');
  assert.equal(pkg.main,'main-8948.js');
  assert.ok(pkg.build.files.includes('next-8948.js'));
  assert.ok(pkg.build.files.includes('main-8948.js'));
});
