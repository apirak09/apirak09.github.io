import {LESSONS,getWings,QUESTIONS} from './content.mjs';
export const STORAGE_KEY='ennea-learning-v1';
export const QUIZ_KEY='ennea-practice-v2';
export const ROUTES=[...LESSONS.map(l=>l.id),'compare','practice','sources'];
export function cleanSaved(raw){
 const d=raw&&typeof raw==='object'?raw:{};
 const notes=Object.fromEntries(Object.entries(d.notes&&typeof d.notes==='object'?d.notes:{}).filter(([k,v])=>/^core-[1-9]$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,6000)]));
 return {type:Number.isInteger(d.type)&&d.type>=1&&d.type<=9?d.type:1,lang:d.lang==='en'?'en':'th',done:[...new Set(Array.isArray(d.done)?d.done.filter(x=>LESSONS.some(l=>l.id===x)):[])],notes};
}
export function parseRoute(hash,savedType=1){
 const [page,type,detail]=(hash||'').replace(/^#/,'').split('/');
 const fallback=Number.isInteger(savedType)&&savedType>=1&&savedType<=9?savedType:1;
 return {page:ROUTES.includes(page)?page:'core',type:/^[1-9]$/.test(type||'')?Number(type):fallback,detail};
}
export function validateView(input){
 if(!input||typeof input!=='object'||!ROUTES.includes(input.lesson))throw new Error('Choose an existing lesson.');
 if(input.type!==undefined&&(!Number.isInteger(input.type)||input.type<1||input.type>9))throw new Error('Type must be an integer from 1 to 9.');
 return {lesson:input.lesson,type:input.type};
}
export function validWing(type,value){return getWings(type).includes(Number(value))?Number(value):getWings(type)[0];}
export function validPair(a,b){const x=Math.max(1,Math.min(9,Number(a)||1));const y=Number(b);return Number.isInteger(y)&&y>=1&&y<=9&&y!==x?y:(x===8?1:8);}
export function cleanQuiz(raw){
 if(!raw||!Array.isArray(raw.questions)||!raw.questions.length||raw.questions.length>QUESTIONS.length)return null;
 const ids=new Set();const questions=[];
 for(const q of raw.questions){
  const original=QUESTIONS.find(x=>x.id===q?.id);
  if(!original||ids.has(q.id)||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options).size!==4||q.options.some(o=>!original.options.includes(o)))return null;
  ids.add(q.id);questions.push({...original,options:[...q.options],answer:q.options.indexOf(original.options[original.answer])});
 }
 const answers=Array.isArray(raw.answers)?raw.answers:[];
 if(answers.length>questions.length||answers.some(x=>!Number.isInteger(x)||x<0||x>3))return null;
 const index=raw.index;
 if(!Number.isInteger(index)||index<0||index>=questions.length||answers.length<index||answers.length>index+1)return null;
 if(raw.finished&&answers.length!==questions.length)return null;
 return {questions,index,answers:[...answers],finished:raw.finished===true};
}
