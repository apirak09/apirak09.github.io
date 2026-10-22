import assert from 'node:assert/strict';
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./questions.json',import.meta.url)));
const events={},elements=new Map(),cache=new Map(),optionDetails=Array.from({length:142},()=>({open:false}));
class Element{
 constructor(){this.style={};this.dataset={};this.disabled=false;this.value='';this.classList={toggle(){}};this.attributes={};}
 addEventListener(n,fn){(this.events??={})[n]=fn}focus(){this.focused=true}setSelectionRange(){}scrollIntoView(){}setAttribute(n,v){this.attributes[n]=v}
}
const element=s=>{if(!elements.has(s))elements.set(s,new Element());return elements.get(s)};
globalThis.document={querySelector:element,querySelectorAll:s=>s==='.study-options'?optionDetails:[],addEventListener:(n,fn)=>(events[n]??=[]).push(fn),createElement:()=>new Element()};
globalThis.window={scrollTo(){},addEventListener(){},confirm:()=>true,history:{replaceState(_,__,url){globalThis.location.href=String(url);globalThis.location.hash=url.hash}}};
globalThis.location={href:'https://apirak09.github.io/chemsafe/?v=3.1#study',hash:'#study',replace(){},reload(){}};
globalThis.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
globalThis.fetch=async()=>({ok:true,json:async()=>data});
const [a,b]=data.questions;
cache.set('chemsafe-progress-v1',JSON.stringify({schema:1,bankVersion:'3.0.0',stats:{[a.id]:{attempts:2,correct:0,streak:0,last:1,lastCorrect:false},[b.id]:{attempts:1,correct:1,streak:1,last:2,lastCorrect:true}},bookmarks:[a.id],total:3,correct:1,history:[],coverage:{number:2,done:[a.id,b.id],order:data.questions.map(q=>q.id),started:1},practice:{id:data.questions[2].id,mode:'adaptive',selected:1,revealed:false,round:3},exam:{ids:data.questions.slice(0,10).map(q=>q.id),answers:{[a.id]:1},index:1,started:1,deadline:null,finished:false}}));
await import('./app.mjs');
const emit=(name,event)=>{for(const fn of events[name]||[])fn(event)};
const click=dataset=>{const button=new Element();button.dataset=dataset;emit('click',{target:{closest:()=>button}});return button};
const input=(id,value,extra={})=>{const target=element('#'+id);Object.assign(target,{id,value},extra);emit('input',{target,isComposing:!!extra.isComposing});};
const change=(id,value,extra={})=>{const target=element('#'+id);Object.assign(target,{id,value},extra);emit('change',{target});};
const list=()=>element('#study-list').innerHTML,stored=()=>JSON.parse(cache.get('chemsafe-progress-v1')),before=stored();
assert(element('#main').innerHTML.includes('ทบทวนเร็ว พร้อมเฉลย'),'direct #study URL opens quick review');
assert(element('#study-count').textContent.includes('142 / 142'));
assert.equal((list().match(/class="study-card"/g)||[]).length,142,'all questions appear without pagination');
for(const q of data.questions){const card=list().split(`id="study-${q.id}"`)[1].split('</article>')[0];assert.equal((card.match(/class="study-option is-answer"/g)||[]).length,1);assert(card.includes('✓ เฉลย '+['A','B','C','D'][q.correct[0]]));assert(card.includes('เหตุผล:'));assert(card.includes('href="https://'),q.id+' has a primary or supplemental reference');}
input('study-search','P34Q2');assert.equal((list().match(/class="study-card"/g)||[]).length,1);assert(list().includes('study-p34q2'));
input('study-search','__nothing_exists__');assert(element('#study-count').textContent.includes('0 / 142'));assert(list().includes('ไม่พบข้อสอบ'));
input('study-search','สายสิญจน์');assert(!list().includes('study-p34q2'),'default scope is stem only');
change('study-scope','all');assert(list().includes('study-p34q2'));assert(list().includes('<mark>สายสิญจน์</mark>'));
click({action:'studyClear'});assert.equal((list().match(/class="study-card"/g)||[]).length,142);
change('study-status','weak');assert.equal((list().match(/class="study-card"/g)||[]).length,1);assert(list().includes('study-'+a.id));
change('study-status','bookmarks');assert(list().includes('study-'+a.id));click({studyBookmark:a.id});assert(list().includes('ไม่พบข้อสอบ'));
click({action:'studyClear'});const button=click({studyBookmark:a.id});assert.equal(button.attributes['aria-pressed'],'true');
change('study-category',a.category);assert.equal((list().match(/class="study-card"/g)||[]).length,data.questions.filter(q=>q.category===a.category).length);
change('study-choices','',{checked:true});assert(optionDetails.every(d=>d.open));
change('study-choices','',{checked:false});assert(optionDetails.every(d=>!d.open));
click({action:'studyClear'});input('study-search','P34Q2');const prior=list();input('study-search','uncommitted',{isComposing:true});assert.equal(list(),prior,'IME composition does not interrupt the search field');
for(const key of ['stats','total','correct','coverage','practice','exam','history'])assert.deepEqual(stored()[key],before[key],'reading, filtering and bookmarks must not change '+key);
assert.equal(stored().bankVersion,'3.1.0');
click({view:'home'});assert.equal(location.hash,'');assert(element('#main').innerHTML.includes('ฝึกทีละข้อ'));
click({view:'study'});assert.equal(location.hash,'#study');assert(list().includes('study-p34q2'),'search survives navigation');
console.log('PASS: direct review URL, all 142 keys, live keyword/scope/category/status filters, bookmarks, choices, empty state, IME and unchanged scores/rounds/active practice');
