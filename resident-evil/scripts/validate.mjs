import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const d=JSON.parse(await readFile(new URL('data/archive.json',root),'utf8'));
const refs={};
for(const key of ['events','eras','entities','works','sources','biology']){for(const x of d[key])assert(/^[a-z0-9-]+$/.test(x.id),key+' unsafe ID: '+x.id);refs[key]=new Map(d[key].map(x=>[x.id,x]));assert.equal(refs[key].size,d[key].length,`Duplicate ID in ${key}`);}
const bilingual=(x,label)=>{assert.equal(typeof x.en,'string',label+' English');assert.equal(typeof x.th,'string',label+' Thai');assert(x.en.trim()&&x.th.trim(),label+' empty translation');};
let previous='';
for(const e of d.events){
 assert(/^[a-z0-9-]+$/.test(e.id),e.id+' invalid ID');assert(/^\d{4}-\d{2}-\d{2}$/.test(e.sortDate),e.id+' sortDate');assert(e.sortDate>=previous,e.id+' out of order');previous=e.sortDate;
 assert(refs.eras.has(e.era),e.id+' missing era');assert(['day','month','year','range','approximate','uncertain'].includes(e.precision));assert(['core','support'].includes(e.importance));assert(Number.isInteger(e.spoiler)&&e.spoiler>=1&&e.spoiler<=10);
 for(const key of ['date','title','summary','location','cause','consequence']){if(key==='location'&&!e.location.en)continue;bilingual(e[key],e.id+' '+key);}
 assert(e.story.length>0,e.id+' no story');e.story.forEach(x=>bilingual(x,e.id+' story'));if(e.uncertainty)bilingual(e.uncertainty,e.id+' uncertainty');
 if(['approximate','uncertain'].includes(e.precision))assert(e.uncertainty,e.id+' needs uncertainty note');
 assert(e.works.length&&e.sources.length,e.id+' missing primary work or references');
 for(const [key,target] of [['characters','entities'],['organizations','entities'],['agents','entities'],['works','works'],['sources','sources'],['connections','events']])for(const id of e[key]){assert(refs[target].has(id),`${e.id}: missing ${target}/${id}`);assert(key!=='connections'||id!==e.id,`${e.id}: self connection`);}
 for(const key of ['characters','organizations','agents','works','sources','connections'])assert.equal(new Set(e[key]).size,e[key].length,e.id+' duplicate '+key);
}
for(const entity of d.entities){bilingual(entity.name,entity.id);bilingual(entity.description,entity.id);assert(['character','organization','agent'].includes(entity.category));}
for(const s of d.sources){assert(s.title&&s.checked);assert.equal(new URL(s.url).protocol,'https:');assert(['official','game-file','reference'].includes(s.kind));}
for(const w of d.works)assert(refs.sources.has(w.source),w.id+' source');
for(const r of d.biology){assert(refs.entities.has(r.id),r.id+' entity');bilingual(r.description,r.id);for(const p of r.parents){assert(refs.biology.has(p.id),r.id+' parent');assert(['derived','combined','research-line','condition'].includes(p.type));}for(const id of r.sources)assert(refs.sources.has(id));}
function ancestors(id,trail=[]){assert(!trail.includes(id),'Biology cycle: '+[...trail,id].join(' -> '));for(const p of refs.biology.get(id).parents)ancestors(p.id,[...trail,id]);}d.biology.forEach(x=>ancestors(x.id));
assert(!refs.biology.get('plaga').parents.length,'Plaga must remain independent');assert(!refs.biology.get('megamycete').parents.length,'Megamycete must remain independent');
assert(d.events.find(x=>x.id==='rose').sortDate>d.events.find(x=>x.id==='requiem').sortDate,'Rose must follow Requiem in-world');
for(const file of ['index.html','app.js','styles.css','assets/favicon.svg','assets/noto-thai-400.woff','assets/noto-thai-600.woff','assets/FONT-LICENSE.txt','docs/LORE-SOURCES.md'])assert((await stat(new URL(file,root))).size>0,file+' missing');
const js=await readFile(new URL('app.js',root),'utf8');assert(!/https?:\/\/[^'"\s]+\.js/.test(js),'No third-party JS');
const css=await readFile(new URL('styles.css',root),'utf8');assert(css.includes('prefers-reduced-motion'));assert(css.includes('max-width:480px'));assert(css.includes('focus-visible'));
console.log(`PASS: ${d.events.length} bilingual events; ${d.entities.length} trails; ${d.biology.length} biology records; ${d.sources.length} references. Chronology, relationships, language fields, spoiler levels and deployment assets valid.`);
