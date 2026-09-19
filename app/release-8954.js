(()=>{
  'use strict';
  if(window.__release8954Installed)return;
  window.__release8954Installed=true;

  const style=document.createElement('style');
  style.id='release8954Style';
  style.textContent=`
    @media screen {
      /* Чек внутри программы тоже не должен растягиваться на рабочую область. */
      html .receipt.receipt8951{
        width:min(700px,100%)!important;
        max-width:700px!important;
        margin:10px auto!important;
        padding:12px 14px!important;
      }
      html .receipt.receipt8951 h2{
        font-size:15px!important;
        line-height:1.15!important;
        margin:0 0 5px!important;
      }
      html .receipt.receipt8951 .meta{margin-bottom:6px!important}
      html .receipt.receipt8951 th,
      html .receipt.receipt8951 td{padding:4px 5px!important;line-height:1.12!important}
      html .receipt.receipt8951 .total{margin-top:6px!important;font-size:14px!important}
      html .receipt.receipt8951 .sign{margin-top:9px!important}
    }
  `;
  (document.head||document.documentElement).appendChild(style);

  document.documentElement.dataset.interfaceVersion='8.9.54';
})();