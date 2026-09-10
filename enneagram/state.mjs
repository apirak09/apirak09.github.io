import {LESSONS,getWings} from './content.mjs';
export const STORAGE_KEY='ennea-learning-v1';
export const ROUTES=[...LESSONS.map(l=>l.id),'practice','sources'];
export function cleanSaved(raw){
 const d=raw&&typeof raw==='object'?raw:{};
 const notes=Object.fromEntries(Object.entries(d.notes&&typeof d.notes==='object'?d.notes:{}).filter(([k,v])=>/^core-[1-9]$/.test(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,6000)]));
 return {type:Number.isInteger(d.type)&&d.type>=1&&d.type<=9?d.type:1,done:[...new Set(Array.isArray(d.done)?d.done.filter(x=>LESSONS.some(l=>l.id===x)):[])],notes};
}
export function parseRoute(hash,savedType=1){
 const [page,type,detail]=(hash||'').replace(/^#/,'').split('/');
 const n=/^[1-9]$/.test(type||'')?Number(type):savedType;
 return {page:ROUTES.includes(page)?page:'core',type:n,detail};
}
export function validateView(input){
 if(!input||typeof input!=='object'||!ROUTES.includes(input.lesson))throw new Error('Choose an existing lesson.');
 if(input.type!==undefined&&(!Number.isInteger(input.type)||input.type<1||input.type>9))throw new Error('Type must be an integer from 1 to 9.');
 return {lesson:input.lesson,type:input.type};
}
export function validWing(type,value){return getWings(type).includes(Number(value))?Number(value):getWings(type)[0];}
