import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,SUBTYPES,TRIADS,QUESTIONS,SOURCES,CONNECTIONS,getWings,point,makeQuestions} from '../content.mjs';
import {cleanSaved,parseRoute,validateView,validWing} from '../state.mjs';

test('The curriculum contains all 9 types and 27 uniquely addressable subtypes',()=>{
 assert.deepEqual(TYPES.map(t=>t.id),[1,2,3,4,5,6,7,8,9]);
 for(const t of TYPES){assert.deepEqual(Object.keys(SUBTYPES[t.id]),['sp','so','sx']);for(const s of Object.values(SUBTYPES[t.id])){assert.ok(s.name&&s.text);}}
 assert.equal(Object.values(SUBTYPES).flatMap(Object.values).length,27);
});
test('Countertypes match the named Chestnut–Paes classification',()=>{
 const expected=['sx','sp','sp','sp','sx','sx','so','so','so'];
 for(let i=1;i<=9;i++)assert.deepEqual(Object.entries(SUBTYPES[i]).filter(([,s])=>s.counter).map(([k])=>k),[expected[i-1]]);
});
test('Traditional arrows match the source sequences and the actual diagram',()=>{
 const growth=[7,4,6,1,8,9,5,2,3],stress=[4,8,9,2,7,3,1,5,6];
 const connected=(a,b)=>CONNECTIONS.some(([x,y])=>(a===x&&b===y)||(a===y&&b===x));
 for(const t of TYPES){assert.equal(t.growth,growth[t.id-1]);assert.equal(t.stress,stress[t.id-1]);assert.ok(connected(t.id,t.growth));assert.ok(connected(t.id,t.stress));assert.equal(CONNECTIONS.filter(e=>e.includes(t.id)).length,2);}
});
test('Wing wraparound and the Nine-at-top geometry are correct',()=>{
 assert.deepEqual(getWings(1),[9,2]);assert.deepEqual(getWings(9),[8,1]);assert.deepEqual(getWings(4),[3,5]);
 const nine=point(9);assert.ok(Math.abs(nine.x-200)<1e-8);assert.equal(nine.y,55);assert.ok(point(1).x>200);assert.ok(point(8).x<200);
 for(const t of TYPES)assert.deepEqual(Object.keys(t.wings).map(Number).sort((a,b)=>a-b),getWings(t.id).sort((a,b)=>a-b));
 assert.equal(validWing(4,9),3);
});
test('Triad memberships match the four conventional classifications',()=>{
 const expected={centers:[[8,9,1],[2,3,4],[5,6,7]],hornevian:[[3,7,8],[1,2,6],[4,5,9]],harmonic:[[2,7,9],[1,3,5],[4,6,8]],object:[[3,6,9],[1,4,7],[2,5,8]]};
 for(const [key,groups] of Object.entries(expected)){assert.deepEqual(TRIADS[key].groups.map(g=>g.types),groups);assert.deepEqual(groups.flat().sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);}
});
test('Shuffling preserves each correct answer and source-linked explanation',()=>{
 assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,20);
 for(const filter of ['all','core','subtypes','wings','arrows','triads']){
  for(const random of [()=>.01,()=>.5,()=>.99]){
   const round=makeQuestions(filter,random);assert.equal(round.length,filter==='all'?20:4);
   for(const q of round){const original=QUESTIONS.find(o=>o.id===q.id);assert.equal(q.options[q.answer],original.options[original.answer]);assert.equal(new Set(q.options).size,4);assert.ok(q.explain);for(const id of q.sources)assert.ok(SOURCES[id],id);}
  }
 }
 assert.notDeepEqual(makeQuestions('all',()=>.01).map(q=>q.id),makeQuestions('all',()=>.99).map(q=>q.id));
});
test('Corrupted local data cannot inject routes or unbounded notes',()=>{
 assert.deepEqual(cleanSaved(null),{type:1,done:[],notes:{}});
 const data=cleanSaved({type:99,done:['core','core','arbitrary'],notes:{'core-1':'x'.repeat(10000),'core-10':'bad','arbitrary':'bad'}});
 assert.equal(data.type,1);assert.deepEqual(data.done,['core']);assert.equal(data.notes['core-1'].length,6000);assert.equal(Object.keys(data.notes).length,1);
 assert.deepEqual(parseRoute('#arrows/9/stress'),{page:'arrows',type:9,detail:'stress'});
 assert.equal(parseRoute('#<script>/999',2).page,'core');assert.equal(parseRoute('#core/0',2).type,2);
 assert.throws(()=>validateView({lesson:'delete',type:1}));assert.throws(()=>validateView({lesson:'core',type:1.2}));assert.throws(()=>validateView({lesson:'core',type:'2'}));assert.deepEqual(validateView({lesson:'subtypes',type:5}),{lesson:'subtypes',type:5});
});
