import test from 'node:test';
import assert from 'node:assert/strict';
import {getContent} from '../locale.mjs';
import {STORAGE_KEY,QUIZ_KEY} from '../state.mjs';

// Runtime smoke test using a minimal DOM surface; this does not claim browser/layout QA.
test('All views render in both languages, and swapping retains notes, route and an active quiz',async()=>{
 const handlers={},winHandlers={},store=new Map([[STORAGE_KEY,JSON.stringify({type:4,done:['core'],notes:{'core-4':'<img onerror="alert(1)">บททบทวน'}})]]),session=new Map();
 const element=()=>({id:'',textContent:'',focus(){},scrollIntoView(){},matches(){return false;},getAttribute(){return null;}});
 const nodes=new Map();const root={innerHTML:'',addEventListener(k,f){handlers[k]=f;},querySelectorAll(){return [];}};
 globalThis.document={documentElement:{lang:'th'},title:'',activeElement:element(),modelContext:null,getElementById(id){if(id==='app')return root;if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},querySelector(){return element();},addEventListener(){}};
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 globalThis.sessionStorage={getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)};
 globalThis.location={href:'https://example.com/enneagram/#core/4',search:'',hash:'#core/4'};
 globalThis.history={pushState(_s,_t,url){updateURL(url);},replaceState(_s,_t,url){updateURL(url);}};
 function updateURL(value){const url=new URL(value,location.href);Object.assign(location,{href:url.href,search:url.search,hash:url.hash});}
 globalThis.window={scrollTo(){},addEventListener(k,f){winHandlers[k]=f;}};
 await import('../app.mjs?render-test');
 function action(name,value){const el={dataset:{action:name,value}};handlers.click({button:0,target:{dataset:{},closest(selector){return selector==='[data-action]'?el:null;}}});}
 function change(id,value){handlers.change({target:{id,value}});}
 function route(hash){updateURL(hash);winHandlers.hashchange();assert.ok(!root.innerHTML.includes('undefined'),hash);assert.ok(!root.innerHTML.includes('[object Object]'),hash);}
 assert.equal(document.documentElement.lang,'th');
 action('tab','reflect');assert.match(root.innerHTML,/&lt;img onerror=/);assert.ok(!root.innerHTML.includes('<img onerror='));
 action('language');assert.equal(document.documentElement.lang,'en');assert.match(root.innerHTML,/&lt;img onerror=/);assert.equal(location.hash,'#core/4');assert.equal(JSON.parse(store.get(STORAGE_KEY)).notes['core-4'],'<img onerror="alert(1)">บททบทวน');
 for(const lang of ['en','th']){
  if(document.documentElement.lang!==lang)action('language');
  for(let type=1;type<=9;type++){
   for(const page of ['core','subtypes','wings','arrows','triads']){route(`#${page}/${type}`);assert.match(root.innerHTML,new RegExp(getContent(lang).LESSONS.find(x=>x.id===page).name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));}
   for(let other=1;other<=9;other++)if(type!==other){route(`#compare/${type}/${other}`);assert.ok(root.innerHTML.includes(getContent(lang).TYPES[type-1].fear));assert.ok(root.innerHTML.includes(getContent(lang).TYPES[other-1].fear));}
  }
  for(const page of ['sources','practice'])route(`#${page}/4`);
 }
 route('#compare/8/1');action('pair-swap');assert.equal(location.hash,'#compare/1/8');change('compare-a','8');assert.equal(location.hash,'#compare/8/1');
 route('#practice/4');change('practice-filter','core');action('answer','0');
 const before=session.get(QUIZ_KEY),beforeHash=location.hash;action('language');assert.equal(session.get(QUIZ_KEY),before);assert.equal(location.hash,beforeHash);assert.ok(root.innerHTML.includes('id="feedback"'));
 for(let i=0;i<4;i++){if(i>0)action('answer','1');action('next-question');}
 const completed=JSON.parse(session.get(QUIZ_KEY));assert.equal(completed.quiz.finished,true);assert.equal(completed.quiz.answers.length,4);assert.match(root.innerHTML,/quiz-review/);
 if(completed.quiz.answers.some((a,i)=>a!==completed.quiz.questions[i].answer)){action('retry-missed');const retry=JSON.parse(session.get(QUIZ_KEY));assert.ok(retry.quiz.questions.length<5);assert.equal(retry.quiz.answers.length,0);}
 route('#core/4');action('complete');assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)).done,[]);action('complete');assert.deepEqual(JSON.parse(store.get(STORAGE_KEY)).done,['core']);
 action('sources-modal');assert.match(root.innerHTML,/aria-modal="true"/);assert.match(root.innerHTML,/<div class="shell" inert>/);action('close-modal');assert.ok(!root.innerHTML.includes('aria-modal="true"'));
});
