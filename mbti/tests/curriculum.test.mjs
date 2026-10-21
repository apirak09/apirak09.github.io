import test from 'node:test';
import assert from 'node:assert/strict';
import {functions,axes,roles,sourceById,opposite} from '../content.mjs';
import {lessons} from '../lessons.mjs';
import {types,stackFromType,shadowStack} from '../types.mjs';
import {comparisons,getComparison} from '../comparisons.mjs';
import {questions,makeRound,validateRound} from '../quiz.mjs';
import {cleanState,readState,writeState,readRound,writeRound,escapeHTML} from '../state.mjs';

test('the sixteen displayed stacks agree with a fixed reference table and letter derivation',()=>{
 const expected={ISTJ:'Si Te Fi Ne',ISFJ:'Si Fe Ti Ne',INFJ:'Ni Fe Ti Se',INTJ:'Ni Te Fi Se',ISTP:'Ti Se Ni Fe',ISFP:'Fi Se Ni Te',INFP:'Fi Ne Si Te',INTP:'Ti Ne Si Fe',ESTP:'Se Ti Fe Ni',ESFP:'Se Fi Te Ni',ENFP:'Ne Fi Te Si',ENTP:'Ne Ti Fe Si',ESTJ:'Te Si Ne Fi',ESFJ:'Fe Si Ne Ti',ENFJ:'Fe Ni Se Ti',ENTJ:'Te Ni Se Fi'};
 assert.equal(types.length,16);
 for(const p of types){assert.equal(p.stack.join(' '),expected[p.id]);assert.deepEqual(stackFromType(p.id),p.stack);assert.equal(new Set(p.stack.map(f=>f[0])).size,4);assert.equal(p.stack[3],opposite(p.stack[0]));}
 assert.equal(stackFromType('INTJ-A'),null);assert.equal(stackFromType('NOPE'),null);
 assert.deepEqual(shadowStack('INTP'),['Te','Ni','Se','Fi']);
});

test('the full course, functions, comparisons, and quiz have unique identities and usable source references',()=>{
 assert.equal(lessons.length,10);assert.equal(functions.length,8);assert.equal(axes.length,4);assert.equal(roles.length,4);assert.equal(questions.length,32);assert.equal(comparisons.length,18);
 for(const items of [lessons,functions,questions,types])assert.equal(new Set(items.map(x=>x.id)).size,items.length);
 const validFunctions=new Set(functions.map(f=>f.id));
 for(const f of functions){assert.ok(validFunctions.has(f.axis));assert.ok(sourceById[f.id]);}
 for(const l of lessons){assert.ok(l.sections.length>=3);assert.ok(l.sources.every(id=>sourceById[id]));assert.ok(questions.filter(q=>q.lesson===l.id).length>=2);}
 for(const p of comparisons){const reversed=getComparison(p.kind,p.b,p.a);assert.deepEqual(reversed.left,p.right);assert.deepEqual(reversed.right,p.left);assert.equal(reversed.a,p.b);}
 assert.equal(getComparison('types','ISTP','ESFJ'),null);
});

test('all bilingual editorial fields contain Thai and English without untranslated option gaps',()=>{
 function walk(value,path='root'){
  if(!value||typeof value!=='object')return;
  if(Object.hasOwn(value,'th')||Object.hasOwn(value,'en')){
   assert.equal(typeof value.th,'string',path);assert.equal(typeof value.en,'string',path);assert.ok(value.th.trim(),path);assert.ok(value.en.trim(),path);
   assert.ok(!/[\u0E00-\u0E7F]/.test(value.en),`Thai text in English field: ${path}`);
  }else for(const[k,v]of Object.entries(value))walk(v,`${path}.${k}`);
 }
 walk({functions,axes,roles,lessons,types,comparisons,questions});
 for(const q of questions){assert.equal(q.options.length,4);assert.ok(q.correct>=0&&q.correct<4);assert.equal(new Set(q.options.map(o=>o.th)).size,4);assert.equal(new Set(q.options.map(o=>o.en)).size,4);assert.ok(lessons.some(l=>l.id===q.lesson));}
});

test('a full quiz visits every question once, retains option identities, and safely restores an answered round',()=>{
 const round=makeRound(questions,questions.length,()=>.37);
 assert.equal(round.ids.length,32);assert.equal(new Set(round.ids).size,32);
 for(const order of Object.values(round.orders))assert.deepEqual([...order].sort(),[0,1,2,3]);
 round.answers[round.ids[0]]=2;round.cursor=1;
 assert.deepEqual(validateRound(JSON.parse(JSON.stringify(round))),round);
 assert.equal(validateRound({...round,ids:[round.ids[0],round.ids[0]]}),null);
 assert.equal(validateRound({...round,orders:{...round.orders,[round.ids[0]]:[0,0,1,2]}}),null);
 assert.equal(validateRound({...round,answers:{},cursor:1}),null);
 assert.equal(validateRound({...round,cursor:100}),null);
 const filtered=questions.filter(q=>q.lesson==='stacks');const short=makeRound(filtered,10);assert.equal(short.ids.length,filtered.length);
});

test('progress and reflections survive reload without trusting arbitrary stored values',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const state=cleanState({lang:'en',done:['stacks','fake','stacks'],notes:{'lesson:stacks':'<script>alert(1)</script>','bad/key':'bad'},missed:['preference','unknown','preference']});
 assert.deepEqual(state.done,['stacks']);assert.deepEqual(state.missed,['preference']);assert.equal(state.notes['bad/key'],undefined);
 assert.ok(writeState(storage,state));assert.deepEqual(readState(storage),state);
 const round=makeRound(questions,10);assert.ok(writeRound(storage,round));assert.deepEqual(readRound(storage),round);
 assert.ok(writeRound(storage,null));assert.equal(readRound(storage),null);
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.deepEqual(readState(blocked),cleanState(null));assert.equal(writeState(blocked,state),false);assert.equal(readRound(blocked),null);
 assert.equal(escapeHTML('<img onerror="x"> &'), '&lt;img onerror=&quot;x&quot;&gt; &amp;');
});
