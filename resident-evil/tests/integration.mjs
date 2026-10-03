import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const js=await readFile(new URL('app.js',root),'utf8');
const data=JSON.parse(await readFile(new URL('data/archive.json',root),'utf8'));
const renderedImages=new Set();
const factory=new Function('document','localStorage','location','history','window','fetch','matchMedia','URLSearchParams','navigator','console','return (async()=>{'+js+'\nreturn {state,filtered,detail,render,selectEvent,selectEra,url};})()');
async function boot({hash='#lang=en',cap=10,consented=true}={}){
 const app={innerHTML:''},listeners={},dialogs=[],memory=new Map();
 memory.set('re-archive:cap',JSON.stringify(cap));memory.set('re-archive:consented',JSON.stringify(consented));
 const doc={documentElement:{lang:''},title:'',getElementById:()=>null,querySelector:q=>q==='#app'?app:null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn,body:{append(){}},createElement:()=>{
  const callbacks={},dialog={innerHTML:'',returnValue:'',setAttribute(){},addEventListener:(name,fn)=>callbacks[name]=fn,showModal(){},remove(){},querySelector:q=>q==='#cap-select'?{value:String(dialog.cap??cap)}:null,callbacks};dialogs.push(dialog);return dialog;
 }};
 const loc={hash,origin:'https://apirak09.github.io',pathname:'/resident-evil/'};
 const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
 const history={replaceState(_s,_t,value){loc.currentHash=value;}};
 const fetch=async path=>{assert.equal(path,'./data/archive.json');return{ok:true,json:async()=>data};};
 const api=await factory(doc,storage,loc,history,{addEventListener(){},scrollTo(){}},fetch,()=>({matches:false}),URLSearchParams,{}, {error:e=>{throw e;}});
 const click=dataset=>listeners.click({target:{closest:()=>({dataset})},preventDefault(){}});
 return{api,app,doc,memory,dialogs,click,loc,listeners};
}
const fresh=await boot({consented:false});
assert.equal(fresh.dialogs.length,0,'Reading starts without a blocking consent modal');
assert(fresh.app.innerHTML.includes('Major story spoilers are visible'),'First-reader warning remains visible');
assert(fresh.app.innerHTML.includes('aria-label="Choose an era"'),'Era navigation is visible immediately');
assert(fresh.app.innerHTML.includes('A mother finds a living archive'),'First era opens without a click');
assert.equal((fresh.app.innerHTML.match(/class="expanded-story"/g)||[]).length,0,'Overview does not dump full incident text');
const h=await boot({hash:'#event=mansion&lang=en'}),{api,app,doc,click,memory}=h;
assert.equal(api.state.era,'raccoon','Legacy links resolve to their era');
assert.equal(api.state.detailOpen,true);
assert(app.innerHTML.includes('id="story-mansion" role="region"'),'Shared story expands inline');
api.selectEvent('mansion');assert.equal(api.state.detailOpen,false,'One click collapses an open story');
api.selectEvent('mansion');assert.equal(api.state.detailOpen,true,'One click opens the same story');
assert.equal((app.innerHTML.match(/class="expanded-story"/g)||[]).length,1,'Only one full story is open');
api.selectEra('aftermath');assert.equal(api.state.detailOpen,false);assert(app.innerHTML.includes('Claire’s search reaches the Ashfords'));
assert(!app.innerHTML.includes('id="node-mansion"'),'Era selection changes the visible branches');
api.selectEvent('dead-aim');assert.equal(api.state.supportingOpen,true,'A shared supporting event opens its parent group');
for(const lang of ['en','th']){
 api.state.lang=lang;api.state.cap=10;
 for(const event of data.events){
  api.selectEvent(event.id,{toggle:false,scroll:false});
  assert(app.innerHTML.includes(event.title[lang]),event.id+' translated story');
  assert(app.innerHTML.includes('id="story-'+event.id+'" role="region"'),event.id+' inline detail');
  assert(app.innerHTML.includes('class="evidence"'),event.id+' sources retained');
  for(const match of app.innerHTML.matchAll(/<img[^>]+src="([^"]+)"/g))renderedImages.add(match[1]);
 }
}
api.state.lang='en';api.state.cap=1;api.state.selected='village';api.state.era='origins';api.render();
assert(!doc.title.includes(data.events.find(e=>e.id==='village').title.en),'No later title leaks');
assert(!app.innerHTML.includes('Miranda loses Eva'));assert(!app.innerHTML.includes('assets/eras/mold-era'),'Locked eras do not show later scenes');
api.state.cap=10;api.state.entity='leon';api.state.era='all';assert.equal(api.filtered().length,14);
api.state.entity='';api.state.q='Raccoon';assert(api.filtered().some(e=>e.id==='raccoon-survivors'),'Search includes narrative and RE2');
api.state.q='ปรสิต';assert(api.filtered().length>0,'Thai narrative search');
api.state.q='no-result-zzzzz';api.render();assert(app.innerHTML.includes('No records match'));
api.state.q='';api.state.view='biology';api.state.cap=7;api.render();assert(!app.innerHTML.includes('>Megamycete</h2>'));assert(!app.innerHTML.includes('data-bio="megamycete"'));
api.state.cap=10;api.render();assert.equal((app.innerHTML.match(/class="bio-record"/g)||[]).length,15);
api.state.view='guide';api.render();assert(app.innerHTML.includes('One continuity. A connected history.'));
api.selectEvent('raccoon-survivors',{toggle:false,scroll:false});await click({action:'save'});await click({action:'read'});
assert(JSON.parse(memory.get('re-archive:saved')).includes('raccoon-survivors'));assert(JSON.parse(memory.get('re-archive:read')).includes('raccoon-survivors'));
await click({action:'language'});assert.equal(doc.documentElement.lang,'th');assert(api.url().includes('lang=th'));
for(const appliedCap of [1,10]){
 const blocked=await boot({hash:'#event=village&lang=en',cap:1,consented:false});
 assert.equal(blocked.dialogs.length,1,'Only a specifically blocked shared record requests a boundary');
 blocked.dialogs[0].cap=appliedCap;blocked.dialogs[0].returnValue='apply';blocked.dialogs[0].callbacks.close();
 if(appliedCap===10){assert.equal(blocked.api.state.selected,'village');assert.equal(blocked.api.state.detailOpen,true);assert.equal(blocked.api.state.era,'mold-era');}
 else{assert.notEqual(blocked.api.state.selected,'village');assert(!blocked.doc.title.includes(data.events.find(e=>e.id==='village').title.en));}
}
const directFresh=await boot({hash:'#event=village&lang=th',consented:false});assert.equal(directFresh.dialogs.length,0);assert.equal(directFresh.api.state.detailOpen,true,'Allowed first-reader links open directly');
const returnTrip=await boot();returnTrip.api.selectEra('raccoon');returnTrip.api.state.q='Leon';returnTrip.api.render();await returnTrip.click({action:'clear'});assert.equal(returnTrip.api.state.era,'raccoon','Clearing a search returns to the era being read');
const escape=await boot({hash:'#event=mansion&lang=en'});escape.listeners.keydown({key:'Escape',target:{closest:()=>null}});assert.equal(escape.api.state.detailOpen,false,'Escape closes inline detail on desktop and mobile');
const lower=await boot({hash:'#event=rose&lang=en',cap:1});assert(!lower.app.innerHTML.includes('Rose enters the archive within herself'));
const nativeKeys=await boot({hash:'#era=raccoon&lang=en'});
for(const keyEvent of [{key:'Home',ctrlKey:true},{key:'ArrowLeft',altKey:true}]){let prevented=false;nativeKeys.listeners.keydown({...keyEvent,target:{closest:()=>({dataset:{era:'raccoon'}})},preventDefault(){prevented=true;}});assert.equal(prevented,false,'Browser keyboard shortcuts remain native');assert.equal(nativeKeys.api.state.era,'raccoon');}
for(const path of renderedImages){assert(path.startsWith('./assets/'),'Images stay local');assert((await stat(new URL(path,root))).size>0,'Rendered image missing: '+path);}
console.log('PASS: 114 bilingual inline stories; first-reader overview without a modal; era selection; one-click open/close; legacy and supporting deep links; spoiler isolation; search, trails, storage, Escape and language. DOM doubles do not claim visual browser coverage.');
