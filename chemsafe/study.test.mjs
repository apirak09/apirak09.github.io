import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {studyMatches,highlightKeywords,normalizeKeyword} from './study.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./questions.json',import.meta.url)));
const q={id:'p34q2',question:'ข้อใดควรปฏิบัติ เมื่ออยู่ในห้องปฏิบัติการ SDS',category:'PPE',options:['ถอดสายสิญจน์','แว่นตานิรภัย','ทางเดิน','กระโปรง']};
const progress={stats:{p34q2:{attempts:1,lastCorrect:false}},bookmarks:['p34q2']};
test('default search uses question keywords, not choices; multiple words are AND',()=>{
 assert(studyMatches(q,progress,{query:'ห้องปฏิบัติการ sds'}));
 assert(studyMatches(q,progress,{query:'  ห้องปฏิบัติการ   SDS  '}));
 assert(studyMatches(q,progress,{query:'P34Q2'}));
 assert(!studyMatches(q,progress,{query:'ห้องปฏิบัติการ ไฟไหม้'}));
 assert(!studyMatches(q,progress,{query:'สายสิญจน์'}));
 assert(studyMatches(q,progress,{query:'สายสิญจน์',scope:'all'}));
});
test('normalizes spaces, zero-width characters, case and Unicode width',()=>{
 assert.equal(normalizeKeyword(' ＳＤＳ \u200b '),'sds');
 assert(studyMatches(q,progress,{query:'ＳＤＳ'}));
 assert(studyMatches(q,progress,{query:'ห้องปฏิบัติ\u200bการ'}));
 assert(studyMatches({...q,question:'สาร เคมีหกรั่วไหล'},progress,{query:'สารเคมี'}));
});
test('filters combine and never mutate progress',()=>{
 const before=JSON.stringify(progress);
 for(const status of ['all','weak','bookmarks'])assert(studyMatches(q,progress,{status,category:'PPE'}));
 assert(!studyMatches(q,progress,{category:'ไฟไหม้'}));
 assert(!studyMatches(q,progress,{status:'unseen'}));
 assert(!studyMatches(q,progress,{status:'revised'}));
 assert(studyMatches({...q,revised:true},progress,{status:'revised'}));
 assert(studyMatches(q,{stats:{},bookmarks:[]},{status:'unseen'}));
 assert.equal(JSON.stringify(progress),before);
});
test('highlighting escapes HTML and treats regex characters as plain text',()=>{
 assert.equal(highlightKeywords('<script>SDS & HF</script>','sds HF'),'&lt;script&gt;<mark>SDS</mark> &amp; <mark>HF</mark>&lt;/script&gt;');
 assert.equal(highlightKeywords('a+b [SDS]','a+b [SDS]'),'<mark>a+b</mark> <mark>[SDS]</mark>');
 assert.equal(highlightKeywords('plain & safe',''), 'plain &amp; safe');
 assert.equal(highlightKeywords('SDS SDS','SDS SDS'),'<mark>SDS</mark> <mark>SDS</mark>');
 for(const query of ['\\','.*','[','(','${','<img src=x onerror=alert(1)>'])assert.doesNotThrow(()=>highlightKeywords(q.question,query));
});
test('all 142 production items remain searchable by question and ID, without duplicate results',()=>{
 const p={stats:{},bookmarks:[]};
 assert.equal(data.questions.filter(q=>studyMatches(q,p,{})).length,142);
 for(const item of data.questions){assert(studyMatches(item,p,{query:item.question}));assert(studyMatches(item,p,{query:item.id}));}
});
