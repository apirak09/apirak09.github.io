import {B, functions, functionById, axes, roles, sources, sourceById} from './content.mjs?v=20261021a';
import {lessons, lessonById} from './lessons.mjs?v=20261021a';
import {types, typeById, shadowStack, beebeRoles} from './types.mjs?v=20261021a';
import {comparisons, getComparison} from './comparisons.mjs?v=20261021a';
import {questions, questionById, makeRound} from './quiz.mjs?v=20261021a';
import {readState, writeState, readRound, writeRound, escapeHTML as e} from './state.mjs?v=20261021a';

const app=document.querySelector('#app');
let localStore,sessionStore;
try{localStore=window.localStorage;}catch{}
try{sessionStore=window.sessionStorage;}catch{}
let state=readState(localStore),round=readRound(sessionStore),storageOK=!!localStore,roundStorageOK=!!sessionStore;
const urlLang=new URLSearchParams(location.search).get('lang');
if(['th','en'].includes(urlLang))state.lang=urlLang;
let stackType='INTP',stackFocus=0,menuOpen=false,quizTopic='all',quizCount='10',toastTimer;
const L=value=>typeof value==='object'&&value!==null?(value[state.lang]??value.th??''):value;
const t=(th,en)=>state.lang==='th'?th:en;
const text=value=>e(L(value));
const num=i=>String(i).padStart(2,'0');
const icon=name=>{const paths={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',functions:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',types:'<path d="M4 5h16M4 12h16M4 19h16M8 3v18M16 3v18"/>',compare:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',practice:'<path d="M5 3h14v18H5zM8 8l2 2 4-4M8 15h8"/>',notes:'<path d="M5 3h14v18H5zM9 8h6M9 12h6M9 16h4"/>',sources:'<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 6v15"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',check:'<path d="m5 12 4 4L19 6"/>'};return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">${paths[name]??paths.arrow}</svg>`;};
const href=(route,label,cls='',extra='')=>`<a href="#${route}" class="${cls}" ${extra}>${label}</a>`;
const button=(label,action,cls='',extra='')=>`<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const activeAttr=active=>active?'aria-current="page"':'';
const tone=id=>`tone-${id[0]}`;
function persist(){storageOK=writeState(localStore,state);return storageOK;}
function persistRound(){roundStorageOK=writeRound(sessionStore,round);}
function notify(message){
 document.querySelector('#announcement').textContent=message;
 document.querySelector('.toast')?.remove();clearTimeout(toastTimer);
 const node=document.createElement('div');node.className='toast';node.textContent=message;document.body.append(node);
 toastTimer=setTimeout(()=>node.remove(),2400);
}
function route(){
 let parts;try{parts=decodeURIComponent(location.hash.slice(1)).split('/');}catch{parts=[];}
 const [page,a,b,c]=parts;
 if(page==='lesson'&&lessonById[a])return {page,a};
 if(page==='functions'&&functionById[a])return {page,a,b:['process','life','reflect'].includes(b)?b:'process'};
 if(page==='types'&&typeById[a])return {page,a};
 if(page==='compare'){
  const kind=a==='types'?'types':'functions',valid=kind==='types'?typeById:functionById;
  const first=valid[b]?b:kind==='types'?'INFJ':'Ni';
  const fallback=kind==='types'?'INFP':'Ne';
  const second=valid[c]&&c!==first?c:Object.keys(valid).find(id=>id!==first&&id===fallback)??Object.keys(valid).find(id=>id!==first);
  return {page,kind,a:first,b:second};
 }
 if(['practice','notes','sources'].includes(page))return {page};
 if(page==='functions')return {page,a:'Ni',b:'process'};
 if(page==='types')return {page,a:'INTP'};
 return {page:'home'};
}
const pageNames={home:B('ภาพรวมการเรียน','Your learning guide'),functions:B('สำรวจ 8 Functions','Explore 8 functions'),types:B('สำรวจ 16 ไทป์','Explore 16 types'),compare:B('คู่ที่มักสับสน','Common confusions'),practice:B('ทบทวนความเข้าใจ','Knowledge practice'),notes:B('บันทึกของฉัน','My reflections'),sources:B('อ้างอิงและหลักฐาน','Sources and evidence')};
function pageTitle(r){return r.page==='lesson'?L(lessonById[r.a].short):L(pageNames[r.page]);}
function sidebar(r){
 const nav=(page,path,label,ico)=>href(path,`${icon(ico)}<span>${label}</span>`,'nav-link'+(r.page===page?' active':''),activeAttr(r.page===page));
 return `<aside class="sidebar" id="sidebar" aria-label="${t('เมนูการเรียน','Learning navigation')}">
 ${href('home','<img src="./icon.svg" alt=""><span>cognia</span>','brand')}<p class="brand-sub">A field guide to your mind</p>
 <nav class="side-scroll" aria-label="${t('เมนูหลัก','Main menu')}">
 ${nav('home','home',t('เริ่มต้นที่นี่','Start here'),'home')}
 <p class="nav-label">${t('เส้นทางการเรียนรู้','THE LEARNING PATH')}</p>
 ${lessons.map((l,i)=>href(`lesson/${l.id}`,`<span class="nav-num">${num(i+1)}</span><span>${text(l.short)}</span>${state.done.includes(l.id)?'<span class="nav-check" aria-label="'+t('อ่านแล้ว','Read')+'">✓</span>':''}`,'nav-link'+(r.page==='lesson'&&r.a===l.id?' active':''),activeAttr(r.page==='lesson'&&r.a===l.id))).join('')}
 <p class="nav-label">${t('สำรวจและทบทวน','EXPLORE & REFLECT')}</p>
 ${nav('functions','functions/Ni/process',t('8 Cognitive functions','8 cognitive functions'),'functions')}
 ${nav('types','types/INTP',t('Function stacks · 16 ไทป์','Function stacks · 16 types'),'types')}
 ${nav('compare','compare/functions/Ni/Ne',t('คู่ที่มักสับสน','Common confusions'),'compare')}
 ${nav('practice','practice',t('แบบฝึกหัด','Practice'),'practice')}
 ${nav('notes','notes',t('บันทึกของฉัน','My reflections'),'notes')}
 ${nav('sources','sources',t('อ้างอิงและหลักฐาน','Sources & evidence'),'sources')}
 </nav>
 <div class="side-progress"><div class="progress-copy"><span>${t('ความคืบหน้า','Your progress')}</span><span>${state.done.length} / ${lessons.length}</span></div><div class="progress-track" role="progressbar" aria-label="${t('บทเรียนที่ทำเครื่องหมายอ่านแล้ว','Lessons marked as read')}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${state.done.length}"><div class="progress-fill" style="width:${state.done.length*10}%"></div></div><p class="device-note">${t('บันทึกในเบราว์เซอร์นี้','Saved in this browser')}</p></div></aside>`;
}
function pageHead(eyebrow,title,intro,badge=''){
 return `<header class="page-head"><p class="eyebrow">${eyebrow}</p><div class="head-line"><h1 id="page-title">${title}</h1>${badge?`<span class="badge">${badge}</span>`:''}</div>${intro?`<p>${intro}</p>`:''}</header>`;
}
function sourceLine(ids){
 return `<div class="source-line"><span>${t('อ่านประกอบ','Reading')}:</span>${[...new Set(ids)].filter(id=>sourceById[id]).map(id=>`<a href="${e(sourceById[id].url)}" target="_blank" rel="noopener noreferrer">${e(id.length===2?id:sourceById[id].name.replace('Myers & Briggs Foundation · ','Foundation · '))} ↗</a>`).join('')}</div>`;
}
function reflection(key,prompt){
 return `<section class="reflection"><h2>${t('ลองสำรวจตัวเอง','Pause and reflect')}</h2><p id="reflection-prompt">${text(prompt)}</p><label class="sr-only" for="reflection-note">${t('บันทึกคำตอบส่วนตัว','Your personal reflection')}</label><textarea id="reflection-note" data-note="${key}" aria-describedby="reflection-prompt reflection-save" maxlength="20000" placeholder="${t('จดเหตุการณ์จริง เหตุผล และสิ่งที่ยังไม่แน่ใจ…','Record an event, your reasoning, and what remains uncertain…')}">${e(state.notes[key]??'')}</textarea><span class="save-note" id="reflection-save" role="status">${t('บันทึกอัตโนมัติในเบราว์เซอร์นี้เท่านั้น · ใช้ร่วมกันเมื่อสลับภาษา','Autosaved only in this browser · the same note is kept across languages')}</span></section>`;
}
function miniFunctions(family){return `<div class="mini-functions">${functions.filter(f=>!family||f.family===family).map(f=>href(`functions/${f.id}/process`,`<strong>${f.id}</strong><h3>${text(f.title)}</h3><p>${text(f.core)}</p><p class="mini-tag">${t('เปิดดูวิธีประมวลผลและตัวอย่าง','Explore the process and examples')} →</p>`,`mini-function ${tone(f.id)}`)).join('')}</div>`;}
function home(){
 const next=lessons.find(l=>!state.done.includes(l.id))??lessons[0];
 const matrixLabels={Se:B('รับสิ่งที่เกิดขึ้น','Meet the present'),Si:B('เทียบประสบการณ์','Reference experience'),Ne:B('เปิดความเป็นไปได้','Explore alternatives'),Ni:B('กลั่นภาพรวม','Synthesize a pattern'),Te:B('จัดระบบผลลัพธ์','Organize results'),Ti:B('ตรวจความสอดคล้อง','Check coherence'),Fe:B('ดูบริบทระหว่างคน','Relate shared values'),Fi:B('ตรวจคุณค่าภายใน','Align with values')};
 return `<section class="hero"><div><span class="badge">${t('MBTI · คู่มือเรียนด้วยตัวเอง','MBTI · A self-guided course')}</span><h1 id="page-title">${t('เข้าใจวิธีคิด<br><em>ให้ลึกกว่าตัวอักษร</em>','Understand the process.<br><em>Beyond four letters.</em>')}</h1><p class="hero-copy">${t('จากความชอบในการรับข้อมูลและตัดสินใจ สู่ 8 cognitive functions และความสัมพันธ์ใน 16 ไทป์ เรียนให้เห็นเหตุผลข้างใน ก่อนรีบเลือกว่าตัวเองเป็นใคร','From preferences in perception and judgment to eight cognitive functions and sixteen type patterns. Explore the reasoning beneath a behavior before choosing a label.')}</p><div class="actions">${href(`lesson/${next.id}`,`${t(state.done.length?'เรียนต่อ':'เริ่มเรียน',state.done.length?'Continue learning':'Start learning')} ${icon('arrow')}`,'button primary')}${href('functions/Ni/process',t('สำรวจ 8 Functions','Explore 8 functions'),'button')}</div><p class="hero-foot">${t('10 บทเรียน · ไทย / English · บันทึกความคืบหน้าได้','10 lessons · ไทย / English · Progress saved locally')}</p></div>
 <div class="matrix panel"><div class="matrix-head"><h2>${t('4 กระบวนการ × 2 ทิศทาง','4 processes × 2 attitudes')}</h2><span class="eyebrow">The function map</span></div><div class="matrix-grid"><span></span><span class="matrix-label">${t('หันออก · e','Outward · e')}</span><span class="matrix-label">${t('หันเข้า · i','Inward · i')}</span>${['S','N','T','F'].map(f=>`<span class="matrix-row">${f}</span>${['e','i'].map(a=>href(`functions/${f+a}/process`,`<strong>${f+a}</strong><span>${text(matrixLabels[f+a])}</span>`,`matrix-cell tone-${f}`)).join('')}`).join('')}</div><p class="matrix-foot">${t('S / N: รับข้อมูล · T / F: ประเมินและเลือก · กดเพื่อสำรวจ','S / N: perceive · T / F: evaluate and choose · Select to explore')}</p></div></section>
 <div class="section-heading"><h2>${t('ค่อย ๆ ลงลึก ทีละชั้น','A path that builds, one layer at a time')}</h2><p>${state.done.length} / 10 ${t('บทที่อ่านแล้ว','lessons marked as read')}</p></div>
 <div class="lesson-grid">${lessons.map((l,i)=>href(`lesson/${l.id}`,`<span class="lesson-number">${num(i+1)}</span><div><h3>${text(l.short)}</h3><p class="lesson-meta">${l.minutes} ${t('นาทีโดยประมาณ','min, approx.')} · ${state.done.includes(l.id)?t('อ่านแล้ว','Read'):t('บทเรียน','Lesson')}</p></div><span class="card-arrow" aria-hidden="true">${state.done.includes(l.id)?'✓':'↗'}</span>`,'lesson-card panel'+(state.done.includes(l.id)?' done':''))).join('')}</div>
 <div class="home-bottom"><div class="rule-note"><strong>${t('มองให้เห็น โดยไม่ตีกรอบคน','Notice a pattern without limiting a person')}</strong><p>${t('Functions เป็นภาษาช่วยสังเกต ไม่ใช่คะแนนความฉลาดหรือกลไกสมองที่เว็บนี้อ้างว่าพิสูจน์แล้ว คำอธิบายที่ดูตรงยังต้องเจอหลักฐานที่ขัดได้','Functions are prompts for observation, not intelligence scores or brain mechanisms claimed as established here. Keep even a convincing self-description open to counterevidence.')}</p></div><div class="compact-links">${href('compare/functions/Ni/Ne',`<strong>Ni / Ne</strong><span>${t('ภาพรวมกับความเป็นไปได้','Synthesis and possibilities')} ↗</span>`,'compact-link')}${href('compare/types/INFJ/INFP',`<strong>INFJ / INFP</strong><span>${t('คล้ายข้างนอก ต่างข้างใน','Similar appearance, different process')} ↗</span>`,'compact-link')}${href('compare/types/INTJ/INTP',`<strong>INTJ / INTP</strong><span>${t('ความต่างที่ไม่ใช่ความฉลาด','A difference beyond intelligence')} ↗</span>`,'compact-link')}</div></div>`;
}
function inlineStack(id){return `<div class="inline-stack" aria-label="${id} function stack">${typeById[id].stack.map(f=>href(`functions/${f}/process`,f,tone(f))).join('')}</div>`;}
function stackViewer(id,selectable=false){
 const profile=typeById[id];const selected=profile.stack[stackFocus];
 return `<section class="stack-viewer"><div class="stack-controls"><h3>${t('แตะตำแหน่งเพื่ออ่านบทบาท','Select a position to inspect its role')}</h3>${selectable?`<label class="select-label" for="stack-type">${t('เลือกไทป์','Type')}<select id="stack-type" data-stack-type>${types.map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${x.id}</option>`).join('')}</select></label>`:`<span class="badge">${id}</span>`}</div><div class="stack-grid">${profile.stack.map((f,i)=>`<button class="stack-node ${tone(f)}" type="button" data-stack-focus="${i}" aria-pressed="${i===stackFocus}" aria-controls="stack-explanation" aria-label="${i+1} ${roles[i].name}: ${f}"><small>${num(i+1)}</small><strong>${f}</strong><span>${roles[i].name}</span></button>`).join('')}</div><div class="stack-detail" id="stack-explanation" aria-live="polite"><h3>${selected} · ${text(roles[stackFocus].title)}</h3><p>${text(roles[stackFocus].body)}</p><p>${text(functionById[selected].core)}</p>${href(`functions/${selected}/process`,`${t('เจาะลึก','Explore')} ${selected} →`)}</div><p class="convention">${t('แสดง tertiary ตาม convention สลับ e/i ที่นิยม · Foundation อนุญาตให้ทิศของ tertiary เป็น e หรือ i ได้ · ตำแหน่งไม่ใช่คะแนนความเก่ง','Tertiary shown using the common alternating-attitude convention. Foundation material permits either attitude. Position is not an ability score.')}</p></section>`;
}
function shadowViewer(){
 const id=stackType;const all=[...typeById[id].stack,...shadowStack(id)];
 return `<p class="rule-note">${t('โมเดลเสริม Beebe · บทบาท archetype ไม่ใช่คะแนนหรือการวินิจฉัย','Beebe extension · archetypal roles, not scores or diagnoses')}</p><label class="select-label" for="shadow-type" style="margin-top:15px">${t('เลือกตัวอย่าง','Example type')}<select id="shadow-type" data-stack-type>${types.map(x=>`<option value="${x.id}" ${id===x.id?'selected':''}>${x.id}</option>`).join('')}</select></label><div class="shadow-wrap"><table class="shadow-table"><thead><tr><th>${t('ตำแหน่ง','Position')}</th><th>Function</th><th>${t('ชื่อบทบาท','Role')}</th><th>${t('ใจความในโมเดล','Interpretive theme')}</th></tr></thead><tbody>${all.map((f,i)=>`<tr class="${i>=4?'shadow-row':''}"><td>${i+1}${i===4?' · Shadow':''}</td><td>${href(`functions/${f}/process`,f)}</td><td>${e(beebeRoles[i][0])}</td><td>${text(beebeRoles[i][1])}</td></tr>`).join('')}</tbody></table></div>`;
}
function widget(name){
 if(['perceiving','judging'].includes(name))return miniFunctions(name);
 if(name==='axes')return `<div class="axis-list">${axes.map(a=>`<section class="axis-card"><div class="axis-code">${href(`functions/${a.a}/process`,a.a)} ↔ ${href(`functions/${a.b}/process`,a.b)}</div><h3>${text(a.name)}</h3><p>${text(a.body)}</p><p class="axis-exercise">${t('ลองใช้','Try it')}: ${text(a.exercise)}</p></section>`).join('')}</div>`;
 if(name==='roles')return `<div class="role-list">${roles.map((r,i)=>`<div class="role-row"><span class="role-index">${num(i+1)}</span><div><h3>${r.name} · ${text(r.title)}</h3><p>${text(r.body)}</p></div></div>`).join('')}</div>`;
 if(name==='stack')return stackViewer(stackType,true);
 if(name==='shadow')return shadowViewer();
 if(name==='types')return `<div class="type-mini-grid">${types.map(p=>href(`types/${p.id}`,`${p.id}<small>${p.stack.join(' · ')}</small>`)).join('')}</div>`;
 if(name==='comparisons')return `<div class="compact-links">${comparisons.filter(p=>p.kind==='types').slice(0,6).map(p=>href(`compare/types/${p.a}/${p.b}`,`<strong>${p.a} / ${p.b}</strong><span>${t('เทียบเหตุผลข้างใน','Compare the process')} ↗</span>`,'compact-link')).join('')}</div>`;
 return '';
}
function lessonPage(id){
 const lesson=lessonById[id],index=lessons.indexOf(lesson),done=state.done.includes(id),next=lessons[index+1];
 return `${pageHead(`${t('บทเรียน','LESSON')} ${num(index+1)} / 10 · ${lesson.minutes} ${t('นาทีโดยประมาณ','MIN, APPROX.')}`,text(lesson.title),text(lesson.intro))}<div class="reading-layout"><article class="article"><p class="rule-note" style="margin-bottom:19px">${text(lesson.kicker)}</p>${lesson.sections.map((section,i)=>`<section class="article-section panel" id="section-${i}"><h2 tabindex="-1">${text(section.h)}</h2>${section.p?`<p>${text(section.p)}</p>`:''}${section.bullets?`<ul>${section.bullets.map(b=>`<li>${text(b)}</li>`).join('')}</ul>`:''}${section.table?`<div class="table-wrap"><table><thead><tr>${section.table.heads.map(h=>`<th scope="col">${text(h)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row=>`<tr>${row.map(c=>`<td>${text(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}${section.widget?widget(section.widget):''}</section>`).join('')}${reflection(`lesson:${id}`,lesson.prompt)}${sourceLine(lesson.sources)}<div class="lesson-end"><button class="button read-toggle" type="button" data-done="${id}" aria-pressed="${done}">${icon(done?'check':'notes')}${done?t('อ่านแล้ว · กดเพื่อยกเลิก','Read · select to undo'):t('ทำเครื่องหมายว่าอ่านแล้ว','Mark as read')}</button>${next?href(`lesson/${next.id}`,`${t('ถัดไป','Next')}: ${text(next.short)} ${icon('arrow')}`,'button primary'):href('practice',`${t('ลองทบทวนความเข้าใจ','Practice what you learned')} ${icon('arrow')}`,'button primary')}</div></article><nav class="toc" aria-label="${t('ในบทนี้','In this lesson')}"><p>${t('ในบทนี้','IN THIS LESSON')}</p>${lesson.sections.map((s,i)=>`<a href="#section-${i}" data-scroll="section-${i}">${text(s.h)}</a>`).join('')}</nav></div>`;
}
function functionPage(id,view){
 const f=functionById[id];const same={Ni:'Ne',Ne:'Ni',Si:'Se',Se:'Si',Ti:'Te',Te:'Ti',Fe:'Fi',Fi:'Fe'}[id];
 return `${pageHead('THE EIGHT COGNITIVE FUNCTIONS',t('หนึ่ง function มีอะไรมากกว่าคำเรียก','There is more to a function than a label'),t('เลือกกระบวนการ แล้วดูว่าความสนใจ เกณฑ์ และตัวอย่างเชื่อมกันอย่างไร ทุกคนใช้ได้มากกว่าหนึ่งด้าน','Select a process to connect its emphasis with examples. Everyone can draw on more than one perspective.'))}
 <nav class="selector" aria-label="${t('เลือก function','Choose a function')}">${functions.map(x=>href(`functions/${x.id}/${view}`,x.id,tone(x.id),activeAttr(x.id===id))).join('')}</nav>
 <section class="panel ${tone(id)}"><div class="function-hero"><div class="function-code">${id}</div><div class="function-title"><p class="eyebrow">${e(f.name)}</p><h2>${text(f.title)}</h2><p>${text(f.tag)}</p></div></div><div class="function-question"><span>${t('คำถามที่ช่วยจับใจความ','A QUESTION THAT CAPTURES THE EMPHASIS')}</span>“${text(f.question)}”</div></section>
 <nav class="segments" aria-label="${t('มุมของ function','Function perspectives')}">${[['process',B('กระบวนการ','The process')],['life',B('ในสถานการณ์','In a situation')],['reflect',B('สำรวจตัวเอง','Reflect')]].map(([tab,label])=>href(`functions/${id}/${tab}`,text(label),'',activeAttr(tab===view))).join('')}</nav>
 ${view==='process'?`<section class="content-card panel"><p class="eyebrow">${t('สิ่งที่กำลังทำ','WHAT THE PROCESS EMPHASIZES')}</p><h2>${text(f.core)}</h2><p>${text(f.mechanism)}</p></section><div class="two-col"><section class="content-card panel good"><p class="eyebrow">${t('เมื่อใช้อย่างยืดหยุ่น','WHEN USED FLEXIBLY')}</p><h2>${t('สิ่งที่ช่วยได้','What it can contribute')}</h2><p>${text(f.strength)}</p></section><section class="content-card panel caution"><p class="eyebrow">${t('เมื่อให้น้ำหนักด้านเดียว','WHEN OVERRELIED ON')}</p><h2>${t('สิ่งที่อาจมองข้าม','What may be missed')}</h2><p>${text(f.trap)}</p></section></div><aside class="myth-note"><strong>${t('อย่าสรุปจากภาพจำ','AVOID THE STEREOTYPE')}</strong>${text(f.myth)}</aside>`:''}
 ${view==='life'?`<p class="rule-note">${t('ตัวอย่างแต่งขึ้นเพื่อให้เห็นกระบวนการ ไม่ใช่พฤติกรรมที่ใช้ฟันธงไทป์ คนเดียวใช้หลายกระบวนการได้','Original examples illustrate a process rather than diagnose a type. One person can use several processes.')}</p><div class="two-col"><section class="content-card panel"><p class="eyebrow">${t('ในชีวิตประจำวัน','EVERYDAY LIFE')}</p><h2>${t('ฉากใกล้ตัว','An everyday situation')}</h2><p>${text(f.scene)}</p></section><section class="content-card panel"><p class="eyebrow">${t('งานกลุ่ม / การทดลอง','A PROJECT / EXPERIMENT')}</p><h2>${t('เมื่อผลไม่ตรงคาด','An unexpected result')}</h2><p>${text(f.project)}</p></section></div><section class="content-card panel" style="margin-top:16px"><h2>${t('ลองเพิ่มอีกด้าน','Add another perspective')}: ${f.axis}</h2><p>${text(axes.find(a=>[a.a,a.b].includes(id)).body)}</p>${href(`functions/${f.axis}/process`,`${t('เปิดดู','Explore')} ${f.axis} →`,'button small', 'style="margin-top:15px"')}</section>`:''}
 ${view==='reflect'?`${reflection(`function:${id}`,f.reflect)}<section class="content-card panel" style="margin-top:17px"><p class="eyebrow">${t('ทดลองก้าวเล็ก ๆ','ONE SMALL EXPERIMENT')}</p><h2>${t('ฝึกให้ได้มุมมองเพิ่ม','Practice for flexibility')}</h2><p>${text(f.grow)}</p></section>`:''}
 ${href(`compare/functions/${id}/${same}`,`<div><span>${t('คู่ที่ดูคล้าย แต่ใช้จุดอ้างอิงต่างกัน','SIMILAR PROCESS, DIFFERENT REFERENCE')}</span><strong>${id} / ${same} · ${t('ความต่างอยู่ตรงไหน?','What is different?')}</strong></div><b aria-hidden="true">↗</b>`,'related')}${sourceLine([id])}`;
}
function typePage(id){
 const profile=typeById[id];stackType=id;
 return `${pageHead('SIXTEEN TYPE PATTERNS',t('เห็นไทป์ผ่านความสัมพันธ์ของ functions','Read a type through relationships'),t('เลือกไทป์เพื่อสำรวจคู่หลักและสี่ตำแหน่ง อ่านเป็นสมมติฐานของ pattern ไม่ใช่รายการคุณสมบัติที่ต้องมีครบ','Select a type to explore its process relationships. Read it as a proposed pattern rather than a checklist of required traits.'))}<nav class="selector type-selector" aria-label="${t('เลือกไทป์','Choose a type')}">${types.map(p=>href(`types/${p.id}`,p.id,'',activeAttr(p.id===id))).join('')}</nav><section class="panel type-profile"><strong>${id}</strong><div><h2>${text(profile.title)}</h2><p>${text(profile.focus)}</p></div></section>${stackViewer(id)}<div class="two-col"><section class="content-card panel caution"><h2>${t('จุดที่ pattern นี้ชวนให้ตรวจ','A blind spot to check')}</h2><p>${text(profile.risk)}</p></section><section class="content-card panel good"><h2>${t('ฝึกเพิ่มความยืดหยุ่น','Practice flexibility')}</h2><p>${text(profile.grow)}</p></section></div><section class="content-card panel" style="margin-top:16px"><p class="eyebrow">${t('ฉากตัวอย่างที่แต่งขึ้น','AN ORIGINAL ILLUSTRATIVE SCENARIO')}</p><p>${text(profile.scene)}</p></section>${reflection(`type:${id}`,B('pattern นี้ตรงกับเหตุการณ์จริงไหน และขัดกับเหตุการณ์ไหน? แยกสิ่งที่ทำเพราะบทบาทบังคับออกจากวิธีที่คุณเลือกเอง','Which actual events support this pattern, and which contradict it? Separate role requirements from freely chosen approaches.'))}${href(`compare/types/${id}/${id==='INFJ'?'INFP':id==='INFP'?'INFJ':id==='INTP'?'INTJ':id==='INTJ'?'INTP':types.find(p=>p.id!==id&&p.stack[0]===profile.stack[0])?.id??'INTP'}`,`<div><span>${t('อย่าดูทีละไทป์อย่างเดียว','COMPARE AN ALTERNATIVE')}</span><strong>${t('เทียบกับไทป์ที่อาจดูคล้าย','Look at a similar type')}</strong></div><b>↗</b>`,'related')}${sourceLine(['types','processes'])}`;
}
function comparePage(r){
 const kind=r.kind,a=r.a,b=r.b,items=kind==='types'?types:functions,lookup=kind==='types'?typeById:functionById,p=getComparison(kind,a,b);
 const options=selected=>items.map(x=>`<option value="${x.id}" ${selected===x.id?'selected':''}>${x.id}${kind==='functions'?' · '+e(x.name):''}</option>`).join('');
 const focus=id=>kind==='types'?`<h2>${id}</h2>${inlineStack(id)}<p>${text(lookup[id].focus)}</p>`:`<h2>${id}</h2><p class="eyebrow">${e(lookup[id].name)}</p><p>${text(lookup[id].core)}</p>`;
 return `${pageHead('SIMILAR ON THE OUTSIDE',t('คู่คล้ายกัน แต่ข้างในต่างกัน','Similar appearance. Different process.'),t('ดูสิ่งที่เหมือนก่อน แล้วเทียบจุดอ้างอิงในสถานการณ์เดียวกัน ตัวอย่างหนึ่งครั้งไม่เพียงพอจะฟันธงไทป์','Start with the resemblance, then compare the reference behind a choice in the same situation. A single example cannot determine a type.'))}<nav class="segments" aria-label="${t('ชนิดการเปรียบเทียบ','Comparison kind')}">${href('compare/functions/Ni/Ne',t('เปรียบเทียบ Functions','Compare functions'),'',activeAttr(kind==='functions'))}${href('compare/types/INFJ/INFP',t('เปรียบเทียบไทป์','Compare types'),'',activeAttr(kind==='types'))}</nav><div class="compare-controls"><label for="compare-a">${t('ฝั่งแรก','First perspective')}<select id="compare-a" data-compare="a">${options(a)}</select></label><button type="button" class="icon-button" data-action="swap-compare" aria-label="${t('สลับสองฝั่ง','Swap perspectives')}">${icon('compare')}</button><label for="compare-b">${t('ฝั่งที่สอง','Second perspective')}<select id="compare-b" data-compare="b">${options(b)}</select></label></div><p class="eyebrow">${t('คู่ที่มีบทเปรียบเทียบเฉพาะ','PAIRS WITH A DETAILED DISCUSSION')}</p><nav class="compare-chips" aria-label="${t('เลือกคู่เจาะลึก','Choose a detailed comparison')}">${comparisons.filter(x=>x.kind===kind).map(x=>href(`compare/${kind}/${x.a}/${x.b}`,`${x.a} / ${x.b}`,'',activeAttr((x.a===a&&x.b===b)||(x.a===b&&x.b===a)))).join('')}</nav>
 <span class="badge">${p?t('บทเปรียบเทียบเจาะลึก','Detailed discussion'):t('เทียบโครงสร้าง · ยังไม่มีบทเฉพาะคู่นี้','Structural comparison · no pair-specific article')}</span>
 ${p?`<section class="compare-intro"><h2>${t('เหมือนกันตรงไหน','Where they can resemble each other')}</h2><p>${text(p.same)}</p></section>`:`<p class="rule-note" style="margin-top:17px">${t('ด้านล่างแสดงคำอธิบายและโครงสร้างของแต่ละฝั่ง ยังไม่มีฉากเปรียบเทียบที่เขียนเฉพาะคู่นี้ จึงใช้เป็นจุดเริ่มต้นสังเกตเท่านั้น','Below are the descriptions and structures for each side. This pair has no original matched scenario yet; use the view as a starting point for observation.')}</p>`}
 <div class="two-col"><section class="content-card panel compare-column">${focus(a)}</section><section class="content-card panel compare-column">${focus(b)}</section></div>
 ${p?`<section class="content-card panel purple" style="margin-top:18px"><p class="eyebrow">${t('ความต่างสำคัญ','THE DISTINCTION')}</p><p>${text(p.difference)}</p></section><div class="section-heading"><h2>${t('ลองอยู่ในสถานการณ์เดียวกัน','Put them in the same situation')}</h2><p>${t('ตัวอย่างแต่งขึ้นเพื่อสอนกระบวนการ','Original examples of a process')}</p></div><div class="two-col"><section class="content-card panel"><h2>${a}</h2><p>${text(p.left)}</p></section><section class="content-card panel"><h2>${b}</h2><p>${text(p.right)}</p></section></div><aside class="reflection"><h2>${t('คำถามสำหรับแยกให้ชัด','A question to explore the distinction')}</h2><p>${text(p.ask)}</p></aside>`:kind==='types'?`<section class="content-card panel" style="margin-top:18px"><h2>${t('Functions ในสี่ตำแหน่งหลักที่มีร่วมกัน','Processes shared in the primary four')}</h2><p>${typeById[a].stack.filter(f=>typeById[b].stack.includes(f)).join(' · ')||t('ไม่มี process ที่ตรงกันทั้งตัวอักษรและทิศในสี่ตำแหน่งหลัก','No identical function–attitudes in these primary stacks')}</p><p>${t('การมีชุดร่วมกันไม่ได้แปลว่าให้น้ำหนักหรือมีบทบาทเหมือนกัน กลับไปดู dominant และ auxiliary','A shared set does not imply the same emphasis or role. Compare the dominant and auxiliary.')}</p></section>`:''}
 ${sourceLine(kind==='types'?['types','processes']:[a,b])}`;
}
function practiceSetup(){
 return `<section class="panel quiz-setup"><p class="eyebrow">${questions.length} ${t('ข้อเขียนขึ้นใหม่','ORIGINAL KNOWLEDGE QUESTIONS')}</p><h2>${t('ทบทวนความเข้าใจ ด้วยคำตอบที่ดีที่สุดข้อเดียว','Check your understanding, one best answer at a time')}</h2><p>${t('สุ่มลำดับโจทย์และช้อยส์ เก็บรอบเดิมเมื่อรีโหลดหรือสลับภาษา มีคำอธิบายหลังตอบทุกข้อ และกลับมาฝึกเฉพาะข้อที่พลาดได้','Questions and options are shuffled. Your round survives reloads and language changes, with an explanation after every answer and targeted missed-question practice.')}</p><div class="quiz-fields"><label for="quiz-topic">${t('เนื้อหาที่ทบทวน','Topic')}<select id="quiz-topic">${`<option value="all" ${quizTopic==='all'?'selected':''}>${t('ทุกบทเรียน','All lessons')}</option>`+lessons.map(l=>`<option value="${l.id}" ${quizTopic===l.id?'selected':''}>${text(l.short)}</option>`).join('')}</select></label><label for="quiz-count">${t('ความยาวรอบ','Round length')}<select id="quiz-count"><option value="10" ${quizCount==='10'?'selected':''}>${t('สูงสุด 10 ข้อ','Up to 10 questions')}</option><option value="all" ${quizCount==='all'?'selected':''}>${t('ทุกข้อในหัวข้อที่เลือก','Every question in this topic')}</option></select></label></div><div class="actions">${button(`${t('เริ่มรอบใหม่','Start a round')} ${icon('arrow')}`,'start-quiz','primary')}${button(`${t('ฝึกข้อที่ยังพลาด','Practice missed questions')} (${state.missed.length})`,'missed-quiz','',state.missed.length?'':'disabled')}</div><p style="font-size:.73rem">${t('คะแนนนี้บอกความเข้าใจเนื้อหา ไม่ใช่ไทป์ของคุณ · ไม่มีข้อสอบ MBTI อย่างเป็นทางการในเว็บ','Scores reflect knowledge, not your personality type. This site contains no official MBTI assessment items.')}</p></section>`;
}
function quizResults(){
 const wrong=round.ids.filter(id=>round.answers[id]!==questionById[id].correct),score=round.ids.length-wrong.length;
 return `<section class="panel quiz-setup"><p class="eyebrow">${t('จบรอบแล้ว','ROUND COMPLETE')}</p><p class="score">${score}<span style="font-size:1.2rem;color:var(--muted);letter-spacing:0"> / ${round.ids.length}</span></p><h2>${t('ดูเหตุผล แล้วลองอีกครั้ง','Review the reasoning, then try again')}</h2><p>${wrong.length?t(`รอบนี้พลาด ${wrong.length} ข้อ เปิดอ่านคำอธิบายด้านล่าง หรือเริ่มฝึกข้อที่ยังพลาดได้`,`You missed ${wrong.length} in this round. Review below or practice the questions still in your missed list.`):t('ตอบถูกครบในรอบนี้ ลองเปลี่ยนหัวข้อหรืออธิบายเหตุผลด้วยคำของคุณเอง','Every answer in this round was correct. Try another topic or explain the reasoning in your own words.')}</p><div class="actions" style="margin-top:20px">${button(t('เลือกฝึกรอบใหม่','Set up another round'),'reset-quiz','primary')}${button(`${t('ฝึกข้อที่ยังพลาด','Practice missed')} (${state.missed.length})`,'missed-quiz','',state.missed.length?'':'disabled')}</div></section><div class="quiz-review">${wrong.map(id=>{const q=questionById[id];return `<details><summary>${text(q.prompt)}</summary><p><strong>${t('คำตอบที่ถูก','Correct answer')}: ${text(q.options[q.correct])}</strong></p><p>${text(q.explanation)}</p>${href(`lesson/${q.lesson}`,t('กลับไปอ่านบทเรียน →','Return to the lesson →'))}</details>`;}).join('')}</div>`;
}
function practicePage(){
 let content;
 if(!round)content=practiceSetup();
 else if(round.cursor===round.ids.length)content=quizResults();
 else{
  const q=questionById[round.ids[round.cursor]],answered=Object.hasOwn(round.answers,q.id),answer=round.answers[q.id],correct=answer===q.correct;
  content=`<div class="quiz-top"><span>${t('ข้อ','Question')} ${round.cursor+1} / ${round.ids.length} · ${text(lessonById[q.lesson].short)}</span>${button(t('ตั้งรอบใหม่','New round'),'reset-quiz','quiet small')}</div><section class="quiz-panel panel"><h2 id="question-title">${text(q.prompt)}</h2><div class="quiz-options" role="group" aria-labelledby="question-title">${round.orders[q.id].map((original,i)=>`<button type="button" class="quiz-option${answered?(original===q.correct?' correct':original===answer?' wrong':''):''}" data-answer="${original}" ${answered?'disabled':''}><span class="option-letter" aria-hidden="true">${'ABCD'[i]}</span><span>${text(q.options[original])}${answered&&original===q.correct?` <strong>✓ ${t('คำตอบที่ถูก','Correct answer')}</strong>`:''}${answered&&original===answer&&original!==q.correct?` <strong>× ${t('คำตอบของคุณ','Your answer')}</strong>`:''}</span></button>`).join('')}</div>${answered?`<div class="quiz-feedback ${correct?'good':'bad'}" role="status"><h3>${correct?t('ถูกต้อง','Correct'):t('ยังไม่ใช่ ลองดูเหตุผล','Not quite — look at the reasoning')}</h3><p>${text(q.explanation)}</p></div>`:''}<div class="quiz-bottom"><span>${t('เลือกคำตอบที่ดีที่สุดเพียงข้อเดียว','Select the single best answer')}</span>${answered?button(`${t(round.cursor+1===round.ids.length?'ดูผลรอบนี้':'ข้อถัดไป',round.cursor+1===round.ids.length?'See results':'Next question')} ${icon('arrow')}`,'next-question','primary'):''}</div></section>`;
 }
 return `${pageHead('PRACTICE THE REASONING',t('ฝึกให้เข้าใจ ไม่ใช่แค่จำคำเรียก','Practice understanding, not just terminology'),t('แบบฝึกหัดความรู้ ไม่มีคะแนนบุคลิกภาพ ไม่ต้องพยายามตอบให้เหมือนไทป์ที่อยากเป็น','A knowledge exercise without personality scoring. There is no type you need to perform.'))}${content}`;
}
function notesPage(){
 const entries=Object.entries(state.notes).filter(([,note])=>note.trim());
 const info=key=>{const[kind,id]=key.split(':');if(kind==='lesson'&&lessonById[id])return {title:lessonById[id].short,path:`lesson/${id}`};if(kind==='function'&&functionById[id])return {title:B(id+' · '+functionById[id].title.th,id+' · '+functionById[id].title.en),path:`functions/${id}/reflect`};if(kind==='type'&&typeById[id])return {title:B(id+' · สำรวจ pattern',id+' · Pattern reflection'),path:`types/${id}`};return null;};
 return `${pageHead('YOUR OBSERVATIONS',t('เก็บเหตุการณ์ ก่อนเก็บคำตอบ','Collect observations before conclusions'),t('บันทึกจากบทเรียนและหน้าสำรวจอยู่ที่นี่ ข้อความของคุณใช้ร่วมกันทั้งสองภาษาและเก็บในเบราว์เซอร์นี้เท่านั้น','Your lesson and exploration notes appear here. The same text is preserved across languages and stored only in this browser.'))}${entries.length?`<div class="notes-grid">${entries.map(([key,note])=>{const x=info(key);return x?`<article class="note-entry panel"><h2>${text(x.title)}</h2><p>${e(note)}</p>${href(x.path,t('กลับไปแก้ไขบันทึก →','Return to edit →'))}</article>`:'';}).join('')}</div>`:`<div class="panel empty-state"><p>${t('ยังไม่มีบันทึก ลองเริ่มจากเหตุการณ์หนึ่งครั้งที่ทำให้คุณสงสัยวิธีคิดของตัวเอง','No notes yet. Start with one event that made you curious about your own reasoning.')}</p>${href('lesson/foundations',t('เริ่มบทแรก','Open the first lesson'),'button', 'style="margin-top:18px"')}</div>`}`;
}
function sourcesPage(){
 return `${pageHead('SOURCES & EVIDENCE',t('รู้ว่าคำอธิบายมาจากไหน','Know where an explanation comes from'),t('แยกแหล่งสอนโมเดลออกจากงานวิจัยที่ทดสอบข้ออ้างของโมเดล สรุปและตัวอย่างในเว็บเขียนใหม่ทั้งไทยและอังกฤษ','Distinguish teaching a model from testing its claims. Summaries and illustrative examples are written afresh in Thai and English.'))}<div class="rule-note"><strong>${t('ขอบเขตการอ่านอ้างอิง','Scope of source review')}</strong><p>${t('ตรวจหน้าเนื้อหาสาธารณะของ Foundation, Cognitive Processes และบทความ Beebe ส่วนงาน McCrae & Costa อ่านเฉพาะบทคัดย่อ ไม่ได้ทบทวนวรรณกรรมทั้งสาขา และไม่อ้างว่าความตรงของแบบสอบถามพิสูจน์ทุก stack หรือ shadow role','Public Foundation and Cognitive Processes material and Beebe’s article were consulted. For McCrae and Costa only the abstract was consulted. This is not a systematic review, and questionnaire validity is not presented as proof of every stack or shadow role.')}</p></div><div class="two-col"><section class="content-card panel"><h2>${t('Convention ที่ใช้ในเว็บ','The convention used here')}</h2><p>${t('สี่ตำแหน่งหลักใช้ทิศสลับ e/i และให้ tertiary ทิศเดียวกับ dominant เพื่อเทียบแผนภาพได้สม่ำเสมอ Foundation เปิดให้ tertiary มีทิศ e หรือ i จึงไม่ใช่ข้อยุติเดียวของทุกสำนัก','Primary stacks alternate attitudes and show the tertiary with the dominant’s attitude for consistent diagrams. Foundation permits either tertiary attitude, so the presentation is not a universal agreement.')}</p></section><section class="content-card panel"><h2>${t('สิ่งที่เป็นโมเดลเสริม','What is an extension')}</h2><p>${t('Beebe 8 roles เป็นการตีความเชิง archetype ส่วน loop ใช้เป็นศัพท์ชุมชนเพื่อสำรวจการวนมุมเดิม ไม่เสนอเป็นกลไกที่ได้รับการยืนยันหรือผลวินิจฉัย','Beebe’s eight roles are an archetypal interpretation. Loop is explained as community shorthand for repeated reliance, not as an established mechanism or diagnosis.')}</p></section></div><div class="source-grid">${sources.map(s=>`<article class="source-card panel"><p class="eyebrow">${text(s.kind)}</p><h2>${e(s.name)}</h2><p>${text(s.note)}</p><a href="${e(s.url)}" target="_blank" rel="noopener noreferrer">${t('เปิดแหล่งต้นทาง','Open the source')} ↗</a><span class="source-host">${e(new URL(s.url).hostname)}</span></article>`).join('')}</div><p class="convention" style="margin-top:20px">${t('ตรวจอ้างอิง 21 ตุลาคม 2026 · เว็บอิสระเพื่อการเรียนรู้ ไม่ใช่แบบประเมิน MBTI® อย่างเป็นทางการหรือบริการที่ได้รับการรับรองจากเจ้าของเครื่องหมาย','Sources checked 21 October 2026 · An independent learning resource, not an official MBTI® assessment or an endorsed service.')}</p>`;
}
function searchDialog(){
 return `<dialog class="search-dialog" id="search-dialog" aria-labelledby="search-title"><div class="search-header"><h2 id="search-title">${t('ค้นหาในคู่มือ','Search the guide')}</h2><button type="button" class="icon-button" data-action="close-search" aria-label="${t('ปิดค้นหา','Close search')}">${icon('close')}</button></div><label class="sr-only" for="search-input">${t('พิมพ์ชื่อ function ไทป์ หรือหัวข้อ','Enter a function, type, or topic')}</label><input class="search-field" id="search-input" type="search" autocomplete="off" placeholder="${t('เช่น Ni, INTP, คุณค่า, shadow…','Try Ni, INTP, values, shadow…')}"><div id="search-results" class="search-results" aria-live="polite"><p class="empty-state">${t('ค้นหาบทเรียน Functions ไทป์ และคู่เปรียบเทียบ','Find lessons, functions, types, and comparisons')}</p></div></dialog>`;
}
function render({focus=false,restoreId=null}={}){
 const previousNavScroll=document.querySelector('.side-scroll')?.scrollTop??0;
 const r=route();document.documentElement.lang=state.lang;
 document.title=`${pageTitle(r)} · Cognia`;
 const content=r.page==='home'?home():r.page==='lesson'?lessonPage(r.a):r.page==='functions'?functionPage(r.a,r.b):r.page==='types'?typePage(r.a):r.page==='compare'?comparePage(r):r.page==='practice'?practicePage():r.page==='notes'?notesPage():sourcesPage();
 app.innerHTML=`<div class="shell ${menuOpen?'menu-open':''}">${sidebar(r)}<button class="menu-backdrop" type="button" data-action="close-menu" aria-label="${t('ปิดเมนู','Close menu')}" tabindex="-1"></button><div class="main-wrap"><header class="topbar"><div class="topbar-left"><button type="button" class="icon-button mobile-menu" data-action="menu" aria-controls="sidebar" aria-expanded="${menuOpen}" aria-label="${t('เปิดหรือปิดเมนู','Toggle navigation')}">${icon('menu')}</button><p class="breadcrumb">${e(pageTitle(r))}</p></div><div class="top-actions"><button type="button" class="icon-button" data-action="search" aria-label="${t('ค้นหาในคู่มือ','Search the guide')}">${icon('search')}</button><button type="button" class="lang-button" id="language-swap" data-action="language" aria-label="${t('เปลี่ยนเป็นภาษาอังกฤษ','Switch to Thai')}"><span class="${state.lang==='en'?'lang-current':''}">ENG</span><span aria-hidden="true">/</span><span class="${state.lang==='th'?'lang-current':''}">ไทย</span></button></div></header>${!storageOK||!roundStorageOK?`<aside class="storage-banner" role="status">${t('เบราว์เซอร์ไม่อนุญาตให้บันทึก ความคืบหน้าและคำตอบยังใช้ได้ในหน้านี้ แต่อาจหายเมื่อปิดหรือรีโหลด','Browser storage is unavailable. Progress and answers work in this page but may be lost on reload or close.')}</aside>`:''}<main id="main" class="main" tabindex="-1">${content}<footer class="footer"><span>Cognia · ${t('เข้าใจรูปแบบ โดยไม่ตีกรอบคน','Understand patterns without limiting people')}</span><div>${href('sources',t('อ้างอิงและข้อจำกัด','Sources & limitations'))} <span aria-hidden="true"> · </span><a href="../enneagram/">Ennea ↗</a></div></footer></main></div>${searchDialog()}</div>`;
 document.querySelector('.side-scroll').scrollTop=previousNavScroll;
 if(restoreId)document.getElementById(restoreId)?.focus({preventScroll:true});
 else if(focus)document.getElementById('main').focus({preventScroll:true});
}
function navigate(path){
 menuOpen=false;
 if(location.hash===`#${path}`){render({focus:true});window.scrollTo(0,0);}else location.hash=path;
}
function updateSearch(query){
 const normal=v=>v.normalize('NFKC').toLocaleLowerCase();
 const q=normal(query.trim());let entries=[];
 const code=/^(?:[sntf][ei]|[ei][sn][tf][jp])$/i.test(q);
 const add=(title,description,path,extra='')=>{
  const combined=normal(`${title} ${description} ${extra}`);
  const matches=code?new RegExp(`\\b${q}\\b`,'i').test(combined):combined.includes(q);
  if(matches)entries.push({title,description,path,score:normal(title).startsWith(q)?0:1});
 };
 if(q){
  functions.forEach(f=>add(`${f.id} · ${L(f.title)}`,L(f.core),`functions/${f.id}/process`,`${f.name} ${L(f.mechanism)} ${L(f.myth)} ${L(f.reflect)}`));
  types.forEach(p=>add(`${p.id} · ${L(p.title)}`,p.stack.join(' · '),`types/${p.id}`,L(p.focus)));
  lessons.forEach(l=>add(L(l.short),L(l.intro),`lesson/${l.id}`,l.sections.map(s=>[L(s.h),L(s.p),...(s.bullets??[]).map(L)].join(' ')).join(' ')));
  comparisons.forEach(p=>add(`${p.a} / ${p.b}`,L(p.difference),`compare/${p.kind}/${p.a}/${p.b}`));
 }
 document.querySelector('#search-results').innerHTML=q?entries.sort((a,b)=>a.score-b.score).slice(0,25).map(x=>href(x.path,`${e(x.title)}<small>${e(x.description.slice(0,135))}${x.description.length>135?'…':''}</small>`,'search-result')).join('')||`<p class="empty-state">${t('ยังไม่พบ ลองใช้ชื่อ function หรือคำสั้นลง','No matches. Try a function name or a shorter term.')}</p>`:`<p class="empty-state">${t('ค้นหาบทเรียน Functions ไทป์ และคู่เปรียบเทียบ','Find lessons, functions, types, and comparisons')}</p>`;
}
app.addEventListener('click',event=>{
 const target=event.target.closest('button,a');if(!target)return;
 if(target.dataset.scroll){event.preventDefault();document.getElementById(target.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(target.matches('.search-result'))document.querySelector('#search-dialog')?.close();
 if(target.matches('a[href^="#"]')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(target.getAttribute('href').slice(1));return;}
 if(target.dataset.done){const id=target.dataset.done;state.done=state.done.includes(id)?state.done.filter(x=>x!==id):[...state.done,id];persist();const scroll=window.scrollY;render();window.scrollTo(0,scroll);document.querySelector(`[data-done="${id}"]`)?.focus({preventScroll:true});notify(t('อัปเดตความคืบหน้าแล้ว','Progress updated'));return;}
 if(target.dataset.stackFocus!==undefined){stackFocus=Number(target.dataset.stackFocus);const scroll=window.scrollY;render();window.scrollTo(0,scroll);document.querySelector(`[data-stack-focus="${stackFocus}"]`)?.focus({preventScroll:true});return;}
 if(target.dataset.answer!==undefined&&round){
  const q=questionById[round.ids[round.cursor]];if(!q||Object.hasOwn(round.answers,q.id))return;
  const a=Number(target.dataset.answer);round.answers[q.id]=a;
  state.missed=a===q.correct?state.missed.filter(id=>id!==q.id):[...new Set([...state.missed,q.id])];persist();persistRound();
  const scroll=window.scrollY;render();window.scrollTo(0,scroll);document.querySelector('[data-action="next-question"]')?.focus({preventScroll:true});return;
 }
 const action=target.dataset.action;
 if(action==='language'){
  state.lang=state.lang==='th'?'en':'th';persist();const u=new URL(location.href);u.searchParams.set('lang',state.lang);history.replaceState(null,'',u);const scroll=window.scrollY;render({restoreId:'language-swap'});window.scrollTo(0,scroll);return;
 }
 if(action==='search'){const d=document.querySelector('#search-dialog');d.showModal();document.querySelector('#search-input').focus();return;}
 if(action==='close-search'){document.querySelector('#search-dialog').close();return;}
 if(action==='menu'||action==='close-menu'){menuOpen=action==='menu'?!menuOpen:false;document.querySelector('.shell').classList.toggle('menu-open',menuOpen);document.querySelector('[data-action="menu"]').setAttribute('aria-expanded',String(menuOpen));if(menuOpen)document.querySelector('.sidebar a').focus();return;}
 if(action==='swap-compare'){const r=route();navigate(`compare/${r.kind}/${r.b}/${r.a}`);return;}
 if(action==='start-quiz'){
  quizTopic=document.querySelector('#quiz-topic').value;quizCount=document.querySelector('#quiz-count').value;
  const pool=quizTopic==='all'?questions:questions.filter(q=>q.lesson===quizTopic);
  round=makeRound(pool,quizCount==='all'?pool.length:Number(quizCount));persistRound();render({focus:true});return;
 }
 if(action==='missed-quiz'){
  const pool=state.missed.map(id=>questionById[id]).filter(Boolean);if(!pool.length)return;
  round=makeRound(pool,pool.length);persistRound();render({focus:true});return;
 }
 if(action==='reset-quiz'){round=null;persistRound();render({focus:true});return;}
 if(action==='next-question'&&round){const q=questionById[round.ids[round.cursor]];if(!q||!Object.hasOwn(round.answers,q.id))return;round.cursor++;persistRound();render({focus:true});document.querySelector('.quiz-top, .quiz-setup')?.scrollIntoView({block:'start'});return;}
});
app.addEventListener('change',event=>{
 const input=event.target;
 if(input.matches('[data-stack-type]')){stackType=input.value;stackFocus=0;const scroll=window.scrollY;render({restoreId:input.id});window.scrollTo(0,scroll);}
 if(input.matches('[data-compare]')){
  const r=route();let a=document.querySelector('#compare-a').value,b=document.querySelector('#compare-b').value;
  if(a===b){if(input.dataset.compare==='a')b=r.a;else a=r.b;}
  navigate(`compare/${r.kind}/${a}/${b}`);
 }
 if(input.id==='quiz-topic')quizTopic=input.value;
 if(input.id==='quiz-count')quizCount=input.value;
});
app.addEventListener('input',event=>{
 const input=event.target;
 if(input.dataset.note){state.notes[input.dataset.note]=input.value;const ok=persist();document.querySelector('#reflection-save').textContent=ok?t('บันทึกแล้ว · อยู่ในเบราว์เซอร์นี้เท่านั้น','Saved · only in this browser'):t('ยังบันทึกถาวรไม่ได้ เก็บข้อความไว้ในหน้านี้ชั่วคราว','Storage unavailable; text is held only in this page');}
 if(input.id==='search-input')updateSearch(input.value);
});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();document.querySelector('#main').focus();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&menuOpen){menuOpen=false;document.querySelector('.shell').classList.remove('menu-open');const trigger=document.querySelector('[data-action="menu"]');trigger.setAttribute('aria-expanded','false');trigger.focus();}
 // Keep keyboard navigation within the open mobile drawer.
 if(event.key==='Tab'&&menuOpen){
  const links=[...document.querySelectorAll('.sidebar a')];const first=links[0],last=links.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
window.addEventListener('hashchange',()=>{menuOpen=false;stackFocus=0;render({focus:true});window.scrollTo(0,0);});
render();
