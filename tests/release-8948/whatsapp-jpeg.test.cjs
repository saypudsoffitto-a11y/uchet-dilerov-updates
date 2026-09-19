'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.resolve(__dirname,'../../app');

test('preload exposes JPEG receipt API for WhatsApp',()=>{
  const src=fs.readFileSync(path.join(appDir,'preload.js'),'utf8');
  assert.match(src,/sendJpeg:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('receipt:sendJpegWhatsApp'/);
});

test('main process renders and sends JPEG as an image clipboard payload',()=>{
  const src=fs.readFileSync(path.join(appDir,'main.js'),'utf8');
  assert.match(src,/ipcMain\.handle\('receipt:sendJpegWhatsApp'/);
  assert.match(src,/capturePage\(/);
  assert.match(src,/\.toJPEG\(92\)/);
  assert.match(src,/clipboard\.writeImage\(image\)/);
});

test('WhatsApp receipt uses compact approved columns and no article column',()=>{
  const src=fs.readFileSync(path.join(appDir,'pdf-compact-8938.js'),'utf8');
  const start=src.indexOf('function receiptJpegHtml8948');
  const end=src.indexOf('function resolveDebtReport',start);
  assert.ok(start>=0&&end>start,'JPEG receipt template exists');
  const tpl=src.slice(start,end);
  assert.match(tpl,/<th>№<\/th><th>Наименование<\/th><th>Цена<\/th><th>Кол-во<\/th><th>Сумма<\/th>/);
  assert.doesNotMatch(tpl,/Артикул/);
  assert.match(tpl,/Сумма прописью:/);
  assert.match(tpl,/Подпись:/);
  assert.match(src,/fileName:\`Товарная_накладная_\$\{op\.receiptNo\}\.jpg\`/);
  assert.match(src,/html:receiptJpegHtml8948\(op,d\)/);
});

test('PDF save path remains available separately',()=>{
  const src=fs.readFileSync(path.join(appDir,'pdf-compact-8938.js'),'utf8');
  assert.match(src,/window\.downloadReceipt=async function/);
  assert.match(src,/window\.receiptAPI\?\.savePdf/);
  assert.match(src,/\.pdf\`/);
});
