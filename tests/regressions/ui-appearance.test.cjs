'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../app/ui-theme.js'),'utf8');
function harness(stored,{blocked=false}={}){
  const nodes=new Map(),events={},windowEvents={},writes=[],root={dataset:{}},menus=[];
  const doc={documentElement:root,readyState:'loading',activeElement:null,getElementById:id=>nodes.get(id),addEventListener:(name,fn)=>events[name]=fn,querySelectorAll:()=>menus};
  function element(){
    return {nodeType:1,disabled:false,hidden:false,style:{left:'950px',top:'750px'},offsetWidth:208,offsetHeight:160,
      listeners:{},attrs:{},classes:new Set(),setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.listeners[k]=v},focus(){doc.activeElement=this},remove(){this.removed=true},
      classList:{add(){}},querySelectorAll(){return []},matches(){return false}};
  }
  doc.createElement=()=>{const card=element();Object.defineProperty(card,'innerHTML',{set(){nodes.set('uiThemeSelect',element());nodes.set('uiThemeStatus',element())}});card.querySelector=()=>nodes.get('uiThemeSelect');return card};
  const settings={querySelector(){return null},insertBefore(card){nodes.set(card.id,card)}};nodes.set('settings',settings);
  let observe;
  const context={document:doc,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},localStorage:{getItem(){if(blocked)throw Error('blocked');return stored},setItem(k,v){if(blocked)throw Error('blocked');writes.push([k,v]);stored=v}},innerWidth:1000,innerHeight:800,
    MutationObserver:class{constructor(fn){observe=fn}observe(){}},WeakSet};
  Object.defineProperty(context,'state',{get(){throw Error('Appearance accessed business data')}});
  context.save=()=>{throw Error('Appearance called business persistence')};doc.body={};
  vm.runInNewContext(source,context);events.DOMContentLoaded();
  return {root,nodes,writes,windowEvents,change(value){const s=nodes.get('uiThemeSelect');s.value=value;s.listeners.change({target:s})},menu(){const m=element(),buttons=[element(),element(),element()];m.matches=()=>true;m.querySelectorAll=()=>buttons;observe([{addedNodes:[m]}]);return {m,buttons,key(key){let prevented=false;m.listeners.keydown({key,preventDefault(){prevented=true},stopPropagation(){}});return prevented}}},doc};
}
test('stored theme is restored before UI setup; unknown preference safely selects standard',()=>{
  assert.equal(harness('colorful').root.dataset.uiTheme,'colorful');assert.equal(harness('multicolor').root.dataset.uiTheme,'multicolor');assert.equal(harness('unknown').root.dataset.uiTheme,'standard');assert.equal(harness(null).root.dataset.uiTheme,'standard');
});
test('switching appearance writes only its own preference and restores it on next launch',()=>{
  const h=harness(null);h.change('colorful');assert.deepEqual(h.writes,[['uchet-ui-theme','colorful']]);assert.equal(harness(h.writes[0][1]).nodes.get('uiThemeSelect').value,'colorful');h.change('multicolor');assert.equal(harness(h.writes[1][1]).nodes.get('uiThemeSelect').value,'multicolor');h.change('standard');assert.equal(h.root.dataset.uiTheme,'standard');
});
test('unavailable storage keeps app usable and explains that preference could not be saved',()=>{
  const h=harness(null,{blocked:true});h.change('colorful');assert.equal(h.root.dataset.uiTheme,'colorful');assert.match(h.nodes.get('uiThemeStatus').textContent,/Не удалось сохранить/);
});
test('a theme change in another window updates controls without writing back',()=>{
  const h=harness(null);h.windowEvents.storage({key:'uchet-ui-theme',newValue:'colorful'});assert.equal(h.nodes.get('uiThemeSelect').value,'colorful');assert.equal(h.writes.length,0);h.windowEvents.storage({key:'business-db',newValue:'standard'});assert.equal(h.root.dataset.uiTheme,'colorful');
});
test('context menu supports arrows, Home, End and Escape without replacing action callbacks',()=>{
  const h=harness(null),{m,buttons,key}=h.menu();let called=0;buttons[1].onclick=()=>called++;
  assert.equal(h.doc.activeElement,buttons[0]);key('ArrowUp');assert.equal(h.doc.activeElement,buttons[2]);key('Home');key('ArrowDown');assert.equal(h.doc.activeElement,buttons[1]);buttons[1].onclick();assert.equal(called,1);key('End');assert.equal(h.doc.activeElement,buttons[2]);key('Escape');assert.equal(m.removed,true);
});
test('long menus are clamped inside the viewport; Tab closes them without trapping focus',()=>{
  const h=harness(null),{m,key}=h.menu();assert.equal(m.style.left,'788px');assert.equal(m.style.top,'636px');assert.equal(key('Tab'),false);assert.equal(m.removed,true);
});
test('colored navigation keeps readable text in active and inactive states',()=>{
  const css=fs.readFileSync(path.join(__dirname,'../../app/ui-theme.css'),'utf8');
  const luminance=hex=>[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const palette=[...css.matchAll(/button\[data-section=(\w+)\] \{--nav-tone:#([a-f0-9]{6});--nav-wash:#([a-f0-9]{6})/g)];
  assert.ok(palette.length>=14);
  for(const [,section,foreground,background] of palette){
    assert.ok(contrast(luminance(foreground),luminance(background))>=4.5,section+' inactive contrast');
    assert.ok(contrast(1,luminance(foreground))>=4.5,section+' active contrast');
  }
});
