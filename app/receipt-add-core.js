(function(root){
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 function append(state,opId,productId,qty,price){
  if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(price)||price<0)throw Error('Проверь количество и цену.');
  const next=JSON.parse(JSON.stringify(state));const op=next.ops.find(o=>String(o.id)===String(opId)&&o.type==='sale');if(!op)throw Error('Продажа не найдена. Открой накладную заново.');
  const p=next.products.find(p=>String(p.id)===String(productId)&&!p.archived);if(!p)throw Error('Товар не найден или находится в архиве.');
  if(!next.dealers.some(d=>String(d.id)===String(op.dealerId)))throw Error('Дилер этой продажи не найден.');
  const buyPrice=Number(p.buyPrice)||0,total=round(qty*price);if(!Number.isFinite(total)||!Number.isFinite((price-buyPrice)*qty))throw Error('Слишком большое количество или цена.');
  const item={productId:p.id,article:p.article||'',name:p.name,qty,unit:p.unit||'шт',price,buyPrice,total,profit:round((price-buyPrice)*qty)};
  op.items=[...(op.items||[]),item];op.total=round(op.items.reduce((s,i)=>s+(Number(i.total)||0),0));op.profit=round(op.items.reduce((s,i)=>s+(Number(i.profit)||0),0));op.updatedAt=Date.now();
  p.stock=(Number(p.stock)||0)-qty;
  return {state:next,op,item};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={append};else root.receiptAddCore={append};
})(globalThis);
