import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,QUESTIONS,makeQuestions} from '../content.mjs';
import {getContent,localQuestion} from '../locale.mjs';
import {PAIRS,MISCONCEPTIONS,findPair} from '../comparisons.mjs';
import {cleanSaved,cleanQuiz,parseRoute,validPair} from '../state.mjs';

test('Every curriculum field and quiz option has authored Thai with the same model data',()=>{
 const en=getContent('en'),th=getContent('th');
 assert.equal(th.TYPES.length,9);assert.equal(th.LESSONS.length,5);assert.equal(th.QUESTIONS.length,20);
 for(const x of TYPES){const y=th.TYPES.find(t=>t.id===x.id);for(const key of ['name','quote','desire','fear','summary','gift','trap','practice','reflection','scenario','growthText','stressText','bothText']){assert.ok(/[ก-๙]/.test(y[key]),`${x.id} ${key}`);assert.notEqual(y[key],x[key]);}assert.equal(x.growth,y.growth);assert.equal(x.stress,y.stress);assert.deepEqual(Object.keys(y.wings),Object.keys(x.wings));for(const wing of Object.values(y.wings))assert.match(wing,/[ก-๙]/);}
 for(const x of th.LESSONS)for(const k of ['name','subtitle','description'])assert.match(x[k],/[ก-๙]/);
 for(const x of th.QUESTIONS){assert.match(x.q,/[ก-๙]/);assert.match(x.explain,/[ก-๙]/);assert.equal(x.options.length,4);assert.equal(new Set(x.options).size,4);assert.equal(x.answer,en.QUESTIONS.find(q=>q.id===x.id).answer);}
 for(const id of Object.keys(th.SUBTYPES))for(const key of ['sp','so','sx']){const s=th.SUBTYPES[id][key];assert.match(s.name,/[ก-๙]/);assert.match(s.text,/[ก-๙]/);assert.equal(s.counter,en.SUBTYPES[id][key].counter);}
 for(const id of Object.keys(th.TRIADS)){const m=th.TRIADS[id];assert.match(m.name,/[ก-๙]/);assert.deepEqual(m.groups.map(g=>g.types),en.TRIADS[id].groups.map(g=>g.types));}
});
test('Changing language preserves shuffled answer order and the meaning of the correct answer',()=>{
 for(const random of [()=>.01,()=>.5,()=>.99])for(const q of makeQuestions('all',random)){
  const original=QUESTIONS.find(x=>x.id===q.id),th=getContent('th').QUESTIONS.find(x=>x.id===q.id);
  const local=localQuestion(q,'th');assert.equal(local.answer,q.answer);assert.equal(local.options[local.answer],th.options[original.answer]);
  assert.deepEqual(localQuestion(q,'en').options,q.options);
  for(let i=0;i<4;i++)assert.equal(local.options[i],th.options[original.options.indexOf(q.options[i])]);
 }
});
test('18 detailed pair articles have consistent orientation and both languages',()=>{
 assert.equal(PAIRS.length,18);assert.equal(new Set(PAIRS.map(p=>`${p.a}-${p.b}`)).size,18);
 for(const p of PAIRS){assert.ok(p.a>=1&&p.a<p.b&&p.b<=9);assert.equal(findPair(p.b,p.a),p);assert.equal(p.thoughts.length,2);for(const v of [p.title,p.similar,p.difference,p.scene,...p.thoughts,p.question]){assert.ok(v.en);assert.match(v.th,/[ก-๙]/);}}
 assert.ok(findPair(8,1));assert.ok(findPair(3,4));assert.equal(MISCONCEPTIONS.length,8);
 for(let a=1;a<=9;a++)for(let b=1;b<=9;b++){const result=validPair(a,b);assert.ok(result>=1&&result<=9&&result!==a);}
});
test('Legacy notes and reading progress survive the language migration',()=>{
 const old={type:4,done:['core','wings'],notes:{'core-4':'ความหมายส่วนตัว'}};
 assert.deepEqual(cleanSaved(old),{...old,lang:'th'});assert.equal(cleanSaved({...old,lang:'en'}).lang,'en');assert.equal(cleanSaved({...old,lang:'bad'}).lang,'th');
 assert.deepEqual(parseRoute('#compare/8/1'),{page:'compare',type:8,detail:'1'});assert.equal(parseRoute('#core/999',999).type,1);
});
test('Resumed rounds rebuild trusted content and reject corrupted answer state',()=>{
 const q=makeQuestions('core',()=>.2),raw={questions:q,index:1,answers:[2],finished:false};
 const clean=cleanQuiz(raw);assert.deepEqual(clean,raw);assert.equal(cleanQuiz({...raw,index:99}),null);assert.equal(cleanQuiz({...raw,answers:[99]}),null);
 assert.equal(cleanQuiz({...raw,finished:true}),null);assert.equal(cleanQuiz({...raw,questions:[q[0],q[0]]}),null);
 const changed=structuredClone(raw);changed.questions[0].explain='<script>malicious</script>';changed.questions[0].answer=99;
 assert.equal(cleanQuiz(changed).questions[0].explain,q[0].explain);assert.equal(cleanQuiz(changed).questions[0].answer,q[0].answer);
 const finished={questions:q,index:3,answers:[0,1,2,3],finished:true};assert.ok(cleanQuiz(finished));
});
