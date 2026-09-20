const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const appDir=path.join(__dirname,'..','..','app');
const patch=fs.readFileSync(path.join(appDir,'next-8948.js'),'utf8');
const preload=fs.readFileSync(path.join(appDir,'preload.js'),'utf8');
const main=fs.readFileSync(path.join(appDir,'main-8948.js'),'utf8');
const editMenu=fs.readFileSync(path.join(appDir,'release-8930-main.js'),'utf8');
const pinLock=fs.readFileSync(path.join(appDir,'pin-lock-8948.js'),'utf8');
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
  assert.match(pkg.version,/^8\.9\.(48|49|50|51|52|53|54|55|56|57|58|59|60)$/);
  assert.equal(pkg.main,'main-8948.js');
  assert.ok(pkg.build.files.includes('next-8948.js'));
  assert.ok(pkg.build.files.includes('main-8948.js'));
});

test('runtime loader points at 8.9.48 patch exactly once',()=>{
  assert.match(preload,/\.\/next-8948\.js/);
  assert.match(preload,/\?runtime=89(48|49|50|51|52|53|54|55|56|57|58|59|60)/);
  assert.match(preload,/dataset\.uchetRuntime='8\.9\.(48|49|50|51|52|53|54|55|56|57|58|59|60)'/);
  assert.doesNotMatch(preload,/\?\?runtime=89(48|49|50|51|52|53|54|55|56|57|58|59|60)/);
});


test('uploaded interface improvements are merged safely without replacing the working renderer',()=>{
  assert.match(patch,/html button,html \.btn\{min-height:40px/);
  assert.match(patch,/html th,html td\{padding:12px 13px;font-size:14px;line-height:1\.4/);
  assert.match(patch,/html #products \.productTable th,html #products \.productTable td\{font-size:14px!important/);
  assert.match(patch,/backdrop-filter:blur\(2px\)/);
  assert.match(patch,/closeModalOnEscape8948/);
  for(const fn of ['closeProductModal','closeDealerModal','closeReceiptView','closeQtyModal','closeInitialDebtModal','closeDebtReport'])assert.match(patch,new RegExp(fn));
  assert.match(editMenu,/label:'Удалить',role:'delete'/);
  assert.doesNotMatch(patch,/inputContextMenu/);
});


test('same dealer name and phone are deduplicated across sync without losing history',()=>{
  assert.match(patch,/canonicalizeDealerDuplicates8948/);
  assert.match(patch,/dealerAliases/);
  assert.match(patch,/deletedDealers/);
  assert.match(patch,/normDealerPhone8948/);
  assert.match(patch,/Never merge name-only cards: phone is required/);
  assert.match(patch,/Такой дилер с этим именем и телефоном уже есть/);
});


test('application entry is protected by a local numeric PIN',()=>{
  assert.ok(pkg.build.files.includes('pin-lock-8948.js'));
  assert.match(preload,/\.\/pin-lock-8948\.js/);
  assert.ok(preload.indexOf('./pin-lock-8948.js')<preload.indexOf('./hotfix-8917.js'),'PIN lock must load first');
  assert.match(pinLock,/uchet_pin_auth_v1/);
  assert.match(pinLock,/PBKDF2/);
  assert.match(pinLock,/SHA-256/);
  assert.match(pinLock,/120000/);
  assert.match(pinLock,/^|[^\w]\\d\{4,8\}/);
  assert.match(pinLock,/Создайте код-пароль/);
  assert.match(pinLock,/Введите код-пароль/);
  assert.match(pinLock,/Сменить код-пароль/);
  assert.match(pinLock,/Код хранится только на этом компьютере/);
  assert.match(pinLock,/localStorage\.setItem\(STORAGE_KEY/);
  assert.doesNotMatch(pinLock,/state\.pin|state\.password/i);
});
