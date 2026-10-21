export const STORE_KEY='chemsafe-progress-v1';
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function blankProgress(){return {schema:1,bankVersion:'2.0.0',stats:{},bookmarks:[],history:[],total:0,correct:0,cycle:[],turn:0,recent:[],practice:null,exam:null}}
export function statFor(p,id){return p.stats[id]||{attempts:0,correct:0,streak:0,last:0,lastCorrect:null}}
export function isScored(q){return q.status==='verified'&&Array.isArray(q.correct)&&q.correct.length===1&&Number.isInteger(q.correct[0])&&q.correct[0]>=0&&q.correct[0]<q.options.length}
export function record(p,q,choice,now=Date.now()){const s={...statFor(p,q.id)};s.attempts++;s.last=now;s.lastChoice=choice;const scored=isScored(q);s.lastCorrect=scored?q.correct.includes(choice):null;if(scored){p.total++;if(s.lastCorrect){p.correct++;s.correct++;s.streak++}else s.streak=0}p.stats[q.id]=s;return s}
// Every third draw reserves a place for a weak question. All other draws drain
// the current shuffled coverage cycle. Thus repeats cannot starve unseen items.
export function nextPractice(bank,p,random=Math.random){if(!bank.length)return null;const ids=new Set(bank.map(q=>q.id));p.cycle=(p.cycle||[]).filter(id=>ids.has(id));p.recent=(p.recent||[]).filter(id=>ids.has(id));if(!p.cycle.length){const unseen=shuffle(bank.filter(q=>!statFor(p,q.id).attempts).map(q=>q.id),random);const seen=shuffle(bank.filter(q=>statFor(p,q.id).attempts).map(q=>q.id),random);p.cycle=[...unseen,...seen]}
 p.turn=(p.turn||0)+1;let id;const weak=bank.filter(q=>isScored(q)&&statFor(p,q.id).lastCorrect===false&&!p.recent.includes(q.id));if(p.turn%3===0&&weak.length){weak.sort((a,b)=>statFor(p,a.id).last-statFor(p,b.id).last);id=weak[0].id}else{let index=p.cycle.findIndex(x=>!p.recent.includes(x));if(index<0)index=0;id=p.cycle.splice(index,1)[0]}
 p.recent=[...p.recent,id].slice(-Math.min(4,Math.max(0,bank.length-1)));return bank.find(q=>q.id===id)}
export function examPool(bank,count,p,random=Math.random){const valid=bank.filter(isScored);const unseen=shuffle(valid.filter(q=>!statFor(p,q.id).attempts),random);const seen=shuffle(valid.filter(q=>statFor(p,q.id).attempts),random);return [...unseen,...seen].slice(0,count).map(q=>q.id)}
export function summarize(bank,p){return {seen:bank.filter(q=>statFor(p,q.id).attempts>0).length,mastered:bank.filter(q=>isScored(q)&&statFor(p,q.id).streak>=3).length,weak:bank.filter(q=>statFor(p,q.id).lastCorrect===false).length,accuracy:p.total?Math.round(p.correct/p.total*100):0}}
export function validateProgress(value,bank,meta={}){value=migrateProgress(value,bank,meta);if(!value||value.schema!==1||!value.stats||typeof value.stats!=='object')throw Error('รูปแบบข้อมูลไม่ถูกต้อง');const p=blankProgress(),ids=new Set(bank.map(q=>q.id));p.bankVersion=meta.version||value.bankVersion||p.bankVersion;for(const [id,s]of Object.entries(value.stats)){if(!ids.has(id))continue;if(!s||!Number.isSafeInteger(s.attempts)||s.attempts<0||!Number.isSafeInteger(s.correct)||s.correct<0||s.correct>s.attempts||!Number.isSafeInteger(s.streak)||s.streak<0||s.streak>s.correct||!Number.isFinite(s.last))throw Error('ประวัติคำตอบไม่ถูกต้อง');p.stats[id]={...s};}
 p.bookmarks=Array.isArray(value.bookmarks)?value.bookmarks.filter(id=>ids.has(id)):[];p.total=Number.isSafeInteger(value.total)&&value.total>=0?value.total:0;p.correct=Number.isSafeInteger(value.correct)&&value.correct>=0&&value.correct<=p.total?value.correct:0;p.history=Array.isArray(value.history)?value.history.slice(-20):[];p.cycle=Array.isArray(value.cycle)?value.cycle.filter(x=>ids.has(x)):[];p.turn=Number.isSafeInteger(value.turn)?value.turn:0;p.recent=Array.isArray(value.recent)?value.recent.filter(x=>ids.has(x)):[];
 if(value.practice&&ids.has(value.practice.id)){const x=value.practice,q=bank.find(q=>q.id===x.id);p.practice={id:x.id,selected:Number.isInteger(x.selected)&&x.selected>=0&&x.selected<q.options.length?x.selected:null,revealed:!!x.revealed,mode:['adaptive','weak','bookmarks','single'].includes(x.mode)?x.mode:'adaptive',round:Number.isSafeInteger(x.round)?x.round:1}}
 if(value.exam&&Array.isArray(value.exam.ids)&&value.exam.ids.length&&value.exam.ids.length<=bank.length&&new Set(value.exam.ids).size===value.exam.ids.length&&value.exam.ids.every(id=>ids.has(id)&&isScored(bank.find(q=>q.id===id)))){const e=value.exam,answers={};for(const [id,v]of Object.entries(e.answers||{})){const q=bank.find(q=>q.id===id);if(e.ids.includes(id)&&Number.isInteger(v)&&v>=0&&v<q.options.length)answers[id]=v}p.exam={ids:e.ids,answers,index:Math.min(Math.max(0,Number.isInteger(e.index)?e.index:0),e.ids.length-1),started:Number.isFinite(e.started)?e.started:Date.now(),deadline:Number.isFinite(e.deadline)?e.deadline:null,finished:!!e.finished}}
 return p}

// Keep visited counts and bookmarks when equivalent old questions are merged.
// Answers to rewritten questions must be chosen again; an old option number is
// never silently treated as an answer to a different revised choice.
export function migrateProgress(value,bank,meta={}){
 if(!value||!meta.version||value.bankVersion===meta.version||!meta.migration)return value;
 const migration=meta.migration,ids=new Set(bank.map(q=>q.id)),alias=id=>migration.aliases?.[id]||id;
 const revised=new Set(migration.revisedIds||[]),valid=id=>ids.has(alias(id));
 const mapChoice=(id,n)=>Number.isInteger(n)&&n>=0?(migration.choiceMaps?.[id]?.[n]??n):n;
 const result={...value,bankVersion:meta.version,stats:{}};
 for(const [oldId,s]of Object.entries(value.stats||{})){
  if(!valid(oldId))continue;const id=alias(oldId);
  if(!s||!Number.isSafeInteger(s.attempts)||s.attempts<0||!Number.isSafeInteger(s.correct)||s.correct<0||s.correct>s.attempts||!Number.isSafeInteger(s.streak)||s.streak<0||s.streak>s.correct||!Number.isFinite(s.last))throw Error('ประวัติคำตอบไม่ถูกต้อง');
  const old=result.stats[id];const latest=!old||s.last>=old.last?{...s,lastChoice:mapChoice(oldId,s.lastChoice)}:old;
  result.stats[id]={...latest,attempts:(old?.attempts||0)+s.attempts,correct:(old?.correct||0)+s.correct};
  if(revised.has(id)){result.stats[id].correct=0;result.stats[id].streak=0;result.stats[id].lastCorrect=null;delete result.stats[id].lastChoice}
 }
 const mapIds=list=>[...new Set((Array.isArray(list)?list:[]).filter(valid).map(alias))];
 result.bookmarks=mapIds(value.bookmarks);result.cycle=mapIds(value.cycle);result.recent=mapIds(value.recent);
 if(value.practice&&valid(value.practice.id)){
  const old=value.practice,id=alias(old.id);result.practice={...old,id,selected:revised.has(id)?null:mapChoice(old.id,old.selected),revealed:revised.has(id)?false:old.revealed};
 }else result.practice=null;
 if(value.exam?.ids?.every(valid)&&!value.exam.ids.some(id=>revised.has(alias(id)))){
  const e=value.exam,answers={};for(const oldId of e.ids)if(e.answers?.[oldId]!=null)answers[alias(oldId)]=mapChoice(oldId,e.answers[oldId]);
  result.exam={...e,ids:mapIds(e.ids),answers};result.exam.index=Math.max(0,result.exam.ids.indexOf(alias(e.ids[e.index])));
 }else result.exam=null;
 return result;
}
export function validateBank(data){
 if(!data||!Array.isArray(data.questions)||!data.questions.length)throw Error('คลังข้อสอบว่าง');
 const ids=new Set,keys=new Set;
 for(const q of data.questions){
  if(!q.id||ids.has(q.id)||!Array.isArray(q.options)||q.options.length!==4||!q.options.every(x=>typeof x==='string'&&x.trim())||!isScored(q)||typeof q.question!=='string'||!q.question.trim())throw Error('คลังข้อสอบต้องมีเฉลยเดียวทุกข้อ');
  if(!q.dedupeKey||keys.has(q.dedupeKey))throw Error('พบข้อสอบซ้ำในคลัง');
  ids.add(q.id);keys.add(q.dedupeKey);
 }
 return data;
}
