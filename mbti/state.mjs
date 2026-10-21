import {lessons} from './lessons.mjs?v=20261021a';
import {questionById,validateRound} from './quiz.mjs?v=20261021a';
export const storageKey='cognia-learning-v1';
export const roundKey='cognia-round-v1';
const allowed = new Set(lessons.map(l=>l.id));
export function cleanState(value){
 const notes={};
 if(value?.notes&&typeof value.notes==='object')for(const [key,note]of Object.entries(value.notes)){
  if(/^(lesson|function|type):[A-Za-z-]+$/.test(key)&&typeof note==='string')notes[key]=note.slice(0,20000);
 }
 return {lang:value?.lang==='en'?'en':'th',done:Array.isArray(value?.done)?[...new Set(value.done.filter(id=>allowed.has(id)))]:[],notes,missed:Array.isArray(value?.missed)?[...new Set(value.missed.filter(id=>Object.hasOwn(questionById,id)))]:[]};
}
export function readState(storage){try{return cleanState(JSON.parse(storage.getItem(storageKey)));}catch{return cleanState(null);}}
export function writeState(storage,state){try{storage.setItem(storageKey,JSON.stringify(cleanState(state)));return true;}catch{return false;}}
export function readRound(storage){try{return validateRound(JSON.parse(storage.getItem(roundKey)));}catch{return null;}}
export function writeRound(storage,round){try{if(round)storage.setItem(roundKey,JSON.stringify(round));else storage.removeItem(roundKey);return true;}catch{return false;}}
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
