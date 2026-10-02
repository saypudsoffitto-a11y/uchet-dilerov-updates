(function(root){
  'use strict';
  const isNewMatRos=(op,item)=>[op?.source,item?.source].some(value=>String(value||'').toLowerCase()==='newmatros');
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const round=value=>Math.round(value*1e6)/1e6;

  function itemName(op,item){
    const original=String(item.name||'');
    if(!isNewMatRos(op,item))return original;
    let name=original.replace(/^\s*Потолок\s*\d+\s*(?:[·•|:;—–-]\s*)?/iu,'').trim();
    if(item.article==='NM-MAT'){
      name=name.replace(/^\s*(?:Полотно|Каталог)\s*:\s*/iu,'');
      const parts=name.split(/\s+[·•]\s+/u);
      const width=parts.slice(1).find(part=>/^рулон\s/iu.test(part));
      name=parts[0].trim()+(width?' · '+width.trim():'');
    }
    return name||original;
  }

  // A view of the original lines, never a rewrite of financial or inventory data.
  function rows(op,{cornerDetails=false}={}){
    const result=[],corners=[];
    for(const [index,item] of (op.items||[]).entries()){
      const view={...item,name:itemName(op,item),_receiptItemIndex:index};
      if(isNewMatRos(op,item)&&item.article==='NM-CORNER')corners.push(view);
      else result.push(view);
    }
    if(corners.length){
      const qty=round(corners.reduce((sum,item)=>sum+number(item.qty),0));
      const total=round(corners.reduce((sum,item)=>sum+(Number.isFinite(Number(item.total))?Number(item.total):number(item.qty)*number(item.price)),0));
      const samePrice=corners.every(item=>number(item.price)===number(corners[0].price));
      result.push({article:'NM-CORNER',name:'Доп. углы',unit:'шт',qty,total,
        price:samePrice?number(corners[0].price):null,_receiptCornerSummary:true,
        _receiptItemIndices:corners.map(item=>item._receiptItemIndex)});
      if(cornerDetails)result.push(...corners.map(item=>({...item,_receiptCornerDetail:true})));
    }
    return result;
  }
  const api={rows,itemName};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.receiptDisplay8983=api;
})(globalThis);
