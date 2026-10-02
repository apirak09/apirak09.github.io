import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const js=await readFile(new URL('app.js',root),'utf8'),data=JSON.parse(await readFile(new URL('data/archive.json',root),'utf8'));
const app={innerHTML:''},listeners={},memory=new Map([['re-archive:consented','true'],['re-archive:cap','10']]);
const doc={documentElement:{lang:''},title:'',querySelector:q=>q==='#app'?app:null,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn,body:{append(){}},createElement:()=>({innerHTML:'',setAttribute(){},addEventListener(){},showModal(){},remove(){}})};
const loc={hash:'#event=mansion&lang=en',origin:'https://apirak09.github.io',pathname:'/resident-evil/'};
const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const win={addEventListener(){},scrollTo(){}},history={replaceState(){}};
const fetch=async path=>{assert.equal(path,'./data/archive.json');return {ok:true,json:async()=>data};};
const factory=new Function('document','localStorage','location','history','window','fetch','matchMedia','URLSearchParams','navigator','console','return (async()=>{'+js+'\nreturn {state,filtered,detail,render};})()');
const api=await factory(doc,storage,loc,history,win,fetch,()=>({matches:false}),URLSearchParams,{}, {error:e=>{throw e;}});
assert(app.innerHTML.includes('The mansion incident'),'Shared event should render on startup');
for(const lang of ['en','th']){
 api.state.lang=lang;api.state.cap=10;
 for(const event of data.events){
  const html=api.detail(event,data.events);
  assert(html.includes(event.title[lang]),event.id+' translation render');
  assert(html.includes('class="evidence"'),event.id+' source disclosure');
  assert(html.includes('class="record-pagination"'),event.id+' navigation');
 }
}
api.state.lang='en';api.state.cap=1;api.state.selected='miranda-origin';api.render();
assert(!doc.title.includes('Miranda'),'Browser metadata must respect spoiler boundaries');
assert(!app.innerHTML.includes('Miranda loses Eva'));
assert(!app.innerHTML.includes('The ruins call the survivors back'));
api.state.cap=10;api.state.entity='leon';assert.equal(api.filtered().length,14);
api.state.entity='';api.state.q='Raccoon';assert(api.filtered().some(e=>e.id==='raccoon-survivors'),'Search must find RE2, including narrative text');
api.state.q='ปรสิต';assert(api.filtered().length>0,'Thai search');
api.state.q='no-result-zzzzz';api.render();assert(app.innerHTML.includes('No records match'));
api.state.q='';api.state.view='biology';api.state.cap=7;api.render();
assert(!app.innerHTML.includes('>Megamycete</h2>'));
assert(!app.innerHTML.includes('data-bio="megamycete"'),'Hidden parents must not leak');
api.state.cap=10;api.render();assert.equal((app.innerHTML.match(/class="bio-record"/g)||[]).length,15);
api.state.view='guide';api.render();assert(app.innerHTML.includes('One continuity. A connected history.'));
api.state.view='timeline';api.state.selected='raccoon-survivors';api.state.entity='';api.render();
const click=action=>listeners.click({target:{closest:()=>({dataset:{action}})},preventDefault(){}});
await click('save');await click('read');
assert(JSON.parse(memory.get('re-archive:saved')).includes('raccoon-survivors'));
assert(JSON.parse(memory.get('re-archive:read')).includes('raccoon-survivors'));
await click('language');assert.equal(doc.documentElement.lang,'th');
console.log('PASS: 114 bilingual record renders, deep links, search, trails, empty states, metadata/biology spoiler isolation, storage and language switch. Uses DOM test doubles; browser visual QA is documented separately.');
