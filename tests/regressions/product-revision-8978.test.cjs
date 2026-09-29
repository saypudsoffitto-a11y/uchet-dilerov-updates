const test = require('node:test');
const assert = require('node:assert/strict');
const { update } = require('../../server/master-protocol-8962');

function product(price, rev = 0) {
  return {
    id: 100,
    groupId: 1,
    name: 'BAUF 5 м',
    article: 'BAUF-5',
    buyPrice: 100,
    retailPrice: price,
    wholesalePrice: price,
    unit: 'м²',
    stock: 50,
    archived: false,
    ...(rev ? { catalogRev: rev } : {})
  };
}

function baseStore() {
  return {
    revision: 10,
    state: {
      dealers: [],
      groups: [{ id: 1, name: 'Плёнка' }],
      products: [
        product(140),
        {
          id: 200,
          groupId: 1,
          name: 'MSD Premium',
          article: 'MSD',
          buyPrice: 90,
          retailPrice: 120,
          wholesalePrice: 110,
          unit: 'м²',
          stock: 70,
          archived: false
        }
      ],
      ops: [{
        id: 1,
        ts: 1,
        type: 'sale',
        dealerId: 1,
        dealer: 'Тест',
        items: [{ productId: 100, name: 'BAUF 5 м', qty: 1, price: 140, total: 140 }],
        total: 140
      }],
      receiptSeq: 2,
      receiptStates: {},
      receiptItemStates: {},
      dealerAliases: {},
      productAliases: {},
      deletedDealers: {},
      deletedProducts: {},
      catalogDeletedKeys: {}
    },
    computers: {
      masterId: 'master-device-0001',
      devices: {
        'master-device-0001': { name: 'Компьютер 1 · Главный', ordinal: 1 },
        'worker-device-0001': { name: 'Компьютер 2', ordinal: 2 }
      }
    }
  };
}

const worker = { id: 'worker-device-0001', name: 'Компьютер 2' };
const master = { id: 'master-device-0001', name: 'Компьютер 1 · Главный' };

test('8.9.78: worker can change price and server increments product catalogRev', () => {
  const current = baseStore();
  const before = { ...current.state.products[0] };
  const after = { ...before, retailPrice: 180, wholesalePrice: 180 };

  const next = update(current, {
    protocol: 2,
    action: 'changes',
    device: worker,
    changes: [],
    archives: {},
    productChanges: [{ id: '100', before, after }]
  });

  const saved = next.state.products.find(p => String(p.id) === '100');
  assert.equal(saved.retailPrice, 180);
  assert.equal(saved.wholesalePrice, 180);
  assert.equal(saved.catalogRev, 1);
  assert.equal(saved.stock, 50);
  assert.ok(saved.catalogUpdatedAt);
  assert.equal(saved.catalogUpdatedBy, worker.id);

  assert.ok(next.state.products.find(p => String(p.id) === '200'));
  assert.equal(next.state.ops[0].items[0].price, 140);
});

test('8.9.78: stale old price cannot overwrite a newer product card', () => {
  const current = baseStore();
  const before = { ...current.state.products[0] };
  const first = update(current, {
    protocol: 2,
    action: 'changes',
    device: worker,
    changes: [],
    archives: {},
    productChanges: [{
      id: '100',
      before,
      after: { ...before, retailPrice: 180, wholesalePrice: 180 }
    }]
  });

  assert.throws(() => update(first, {
    protocol: 2,
    action: 'changes',
    device: master,
    changes: [],
    archives: {},
    productChanges: [{
      id: '100',
      before,
      after: { ...before, retailPrice: 150, wholesalePrice: 150 }
    }]
  }), /уже изменена на другом компьютере/);
});

test('8.9.78: fresh next edit succeeds and increments catalogRev again', () => {
  const current = baseStore();
  const before = { ...current.state.products[0] };
  const first = update(current, {
    protocol: 2,
    action: 'changes',
    device: worker,
    changes: [],
    archives: {},
    productChanges: [{
      id: '100',
      before,
      after: { ...before, retailPrice: 180, wholesalePrice: 180 }
    }]
  });

  const fresh = first.state.products.find(p => String(p.id) === '100');
  const second = update(first, {
    protocol: 2,
    action: 'changes',
    device: master,
    changes: [],
    archives: {},
    productChanges: [{
      id: '100',
      before: { ...fresh },
      after: { ...fresh, retailPrice: 190, wholesalePrice: 190 }
    }]
  });

  const saved = second.state.products.find(p => String(p.id) === '100');
  assert.equal(saved.retailPrice, 190);
  assert.equal(saved.catalogRev, 2);
});

test('8.9.78: legacy full catalog is not allowed to resurrect an old product price', () => {
  const current = baseStore();
  const before = { ...current.state.products[0] };
  const first = update(current, {
    protocol: 2,
    action: 'changes',
    device: worker,
    changes: [],
    archives: {},
    productChanges: [{
      id: '100',
      before,
      after: { ...before, retailPrice: 180, wholesalePrice: 180 }
    }]
  });

  const staleCatalog = {
    dealers: first.state.dealers,
    groups: first.state.groups,
    products: [before, first.state.products.find(p => String(p.id) === '200')],
    deletedDealers: first.state.deletedDealers,
    deletedProducts: first.state.deletedProducts,
    dealerAliases: first.state.dealerAliases,
    productAliases: first.state.productAliases,
    catalogDeletedKeys: first.state.catalogDeletedKeys
  };

  assert.throws(() => update(first, {
    protocol: 2,
    action: 'changes',
    device: master,
    changes: [],
    archives: {},
    catalog: staleCatalog
  }), /Старая версия программы попыталась заменить каталог товаров/);
});
