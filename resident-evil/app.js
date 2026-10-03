const $ = (q, root = document) => root.querySelector(q);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}
[c]));
const storage = {
  get(k, fallback) {
    try {
      return JSON.parse(localStorage.getItem('re-archive:'+k)) ?? fallback;
    }
    catch {
      return fallback;
    }
  },
  set(k,v) {
    try {
      localStorage.setItem('re-archive:'+k,JSON.stringify(v));
    }
    catch {
    }
  }
};
const ui = {
  archive:['Chronology','ลำดับเหตุการณ์'],
  biology:['Biological research','สายการวิจัยชีวภาพ'],
  guide:['Reading the archive','คู่มืออ่านแฟ้ม'],
  language:['ภาษาไทย','English'],
  search:['Search incidents, people, places…','ค้นเหตุการณ์ คน สถานที่…'],
  trace:['Follow a record','ติดตามแฟ้ม'],
  all:['All records','ทุกแฟ้ม'],
  allEras:['All eras','ทุกยุค'],
  core:['Essential incidents only','เฉพาะเหตุการณ์หลัก'],
  bookmarks:['Saved records','แฟ้มที่บันทึก'],
  spoilers:['Spoiler boundary','ขอบเขตสปอยล์'],
  event:['INCIDENT RECORD','แฟ้มเหตุการณ์'],
  cause:['What led here','อะไรนำมาถึงจุดนี้'],
  incident:['What happened','เกิดอะไรขึ้น'],
  result:['What changed','อะไรเปลี่ยนไป'],
  connect:['Where the story goes','เรื่องเชื่อมไปทางไหน'],
  characters:['People','ผู้เกี่ยวข้อง'],
  organizations:['Organizations','องค์กร'],
  agents:['Biology & weapons','เชื้อและอาวุธ'],
  works:['Depicted in','เล่าใน'],
  sources:['Evidence & references','หลักฐานและแหล่งอ้างอิง'],
  note:['Chronology note','หมายเหตุลำดับเวลา'],
  read:['Mark as read','อ่านแล้ว'],
  unread:['Read','อ่านแล้ว'],
  save:['Save record','บันทึกแฟ้ม'],
  saved:['Saved','บันทึกแล้ว'],
  share:['Copy link','คัดลอกลิงก์'],
  copied:['Link copied','คัดลอกแล้ว'],
  prev:['Previous','ก่อนหน้า'],
  next:['Next','ถัดไป'],
  back:['Back to timeline','กลับลำดับเวลา'],
  close:['Close','ปิด'],
  clear:['Clear filters','ล้างตัวกรอง'],
  empty:['No records match this view.','ไม่พบแฟ้มที่ตรงกับตัวกรอง'],
  emptyHint:['Try a different search, era or spoiler boundary.','ลองเปลี่ยนคำค้น ยุค หรือขอบเขตสปอยล์'],
  count:['records','แฟ้ม'],
  visible:['visible','แสดงได้'],
  readCount:['read','อ่านแล้ว'],
  support:['Supporting record','แฟ้มประกอบ'],
  essential:['Core incident','เหตุการณ์หลัก'],
  sourceWarning:['Source pages may contain spoilers beyond this boundary.','หน้าแหล่งอ้างอิงอาจมีสปอยล์เกินขอบเขตที่เลือก'],
  begin:['Open the archive','เปิดแฟ้มประวัติศาสตร์'],
  continue:['Continue reading','อ่านต่อ'],
  reset:['Reset reading progress','เริ่มนับการอ่านใหม่'],
  guideTitle:['One continuity. A connected history.','หนึ่งความต่อเนื่อง ประวัติศาสตร์ที่เชื่อมกัน'],
  bioTitle:['Related does not mean identical.','เกี่ยวข้องกัน ไม่ได้แปลว่าเป็นเชื้อเดียวกัน'],
  bioIntro:['Trace research lines, combinations and consequences. Parasites and mold have independent origins; not every monster is a virus.','ติดตามสายวิจัย การผสม และผลที่ตามมา ปรสิตกับเชื้อรามีต้นกำเนิดแยก ไม่ใช่สัตว์ประหลาดทุกตัวที่เกิดจากไวรัส'],
  derived:['Derived from','พัฒนาจาก'],
  combined:['Combined with','ผสานกับ'],
  'research-line':['Research connection','สายการวิจัย'],
  condition:['Later condition of','ภาวะภายหลังจาก'],
  noVisible:['This record is beyond your spoiler boundary.','แฟ้มนี้เกินขอบเขตสปอยล์ที่เลือก'],
  openSettings:['Adjust boundary','ปรับขอบเขต'],
  cancel:['Keep current boundary','คงขอบเขตเดิม'],
  apply:['Apply boundary','ใช้ขอบเขตนี้'],
  sourceOfficial:['Publisher / official','ผู้จัดจำหน่าย / ทางการ'],
  sourceFile:['Game-file transcript','ถอดข้อความจากไฟล์ในเกม'],
  sourceReference:['Secondary reference','แหล่งข้อมูลรอง'],
  lastChecked:['Research checked','ตรวจค้นข้อมูลถึง'],
  offline:['The archive could not load. Reload when your connection is available.','เปิดข้อมูลไม่ได้ ลองโหลดใหม่เมื่อเชื่อมต่ออินเทอร์เน็ตได้'],
  reload:['Reload','โหลดใหม่'],
  spoilerTitle:['This archive contains the story’s major revelations.','แฟ้มนี้เปิดเผยจุดสำคัญของเรื่อง'],
  spoilerIntro:['Choose how far the archive may reveal. This hides whole records, including early history revealed in later games. It is a knowledge boundary, not a recommended play order.','เลือกว่าต้องการรู้ถึงช่วงไหน ระบบจะซ่อนทั้งแฟ้ม รวมถึงอดีตที่เพิ่งถูกเฉลยในเกมภาคหลัง นี่คือขอบเขตความรู้ ไม่ใช่ลำดับแนะนำให้เล่นเกม'],
  safe:['Read only what you choose.','อ่านเท่าที่คุณเลือก'],
  selected:['Selected record','แฟ้มที่เลือก'],
  progress:['Reading progress','ความคืบหน้าการอ่าน'],
  from:['BIOHAZARD / CANON ARCHIVE','BIOHAZARD / CANON ARCHIVE'],
  spoilerHidden:['records hidden by your boundary','แฟ้มถูกซ่อนตามขอบเขต'],
  follow:['Follow these incidents','ติดตามเหตุการณ์นี้'],
  readStory:['A century of ambition. A world of consequences.','หนึ่งศตวรรษแห่งความทะเยอทะยาน และผลที่สะเทือนไปทั่วโลก'],
  tagline:['Understand Resident Evil as one continuous history.','เข้าใจเรื่องราว Resident Evil เป็นประวัติศาสตร์เดียวที่ต่อเนื่องกัน'],
  keyboard:['Tab to navigate · Enter to open · Escape to return on mobile','ใช้ Tab เลื่อนจุดเลือก · Enter เปิดแฟ้ม · Escape กลับบนมือถือ']
};
const caps = [[1,'RE 0 / RE 1'],[2,'Raccoon City — RE 2 / RE 3 / Outbreak'],[3,'Survivor / CODE: Veronica'],[4,'RE 4 / Umbrella Chronicles / Revelations'],[5,'RE 5 / Degeneration / Infinite Darkness'],[6,'RE 6 / Revelations 2 / Damnation / Marhawa'],[7,'RE 7 / Vendetta / Death Island / Heavenly Island'],[8,'Village'],[9,'Requiem'],[10,'All revelations / ทั้งหมด — Shadows of Rose']];
let data, byEvent, byEntity, bySource, byWork;
let pendingEvent = "";
const hash = new URLSearchParams(location.hash.slice(1));
const state = {
  lang:hash.get('lang') === 'en'?'en':hash.get('lang')==='th'?'th':storage.get('lang','th'),
  cap:storage.get('cap',10),
  consented:storage.get('consented',false),
  view:['timeline','biology','guide'].includes(hash.get('view'))?hash.get('view'):'timeline',
  era:hash.get('era')||'origins',
  entity:'',
  q:'',
  core:false,
  savedOnly:false,
  selected:hash.get('event')||'',
  browseEra:hash.get('era')||'origins',
  toolsOpen:false,
  supportingOpen:false,
  detailOpen:false,
  read:new Set(storage.get('read',[])),
  saved:new Set(storage.get('saved',[]))
};
const t = key => ui[key]?.[state.lang==='en'?0:1] ?? key;
const l = obj => obj?.[state.lang] ?? '';
const icon = name => {
  const paths= {
    file:'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    search:'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M16 16l6 6',
    bookmark:'M6 3h12v18l-6-4-6 4z',
    check:'M4 12l5 5L20 6',
    share:'M8 12l8-7 M8 12l8 7 M6 12a2 2 0 1 0 0 .1 M18 4a2 2 0 1 0 0 .1 M18 20a2 2 0 1 0 0 .1',
    shield:'M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z',
    globe:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M2 12h20 M12 2c-6 6-6 14 0 20 M12 2c6 6 6 14 0 20'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${(paths[name]||paths.file).split(' M').map((p,i)=>`<path d="${i?'M':''}${p}"/>`).join('')}</svg>`;
};
const allowed = e => e.spoiler <= state.cap;
function filtered() {
  return data.events.filter(e=>allowed(e) && (state.era==='all'||e.era===state.era) && (!state.core||e.importance==='core') && (!state.savedOnly||state.saved.has(e.id)) && (!state.entity||[...e.characters,...e.organizations,...e.agents,...e.works].includes(state.entity)) && (!state.q||searchText(e).includes(state.q.toLocaleLowerCase())));
}
function searchText(e) {
  return [e.title.en,e.title.th,e.summary.en,e.summary.th,e.cause.en,e.cause.th,e.consequence.en,e.consequence.th,...e.story.flatMap(p=>[p.en,p.th]),e.era,e.location.en,e.location.th,e.date.en,...[...e.characters,...e.organizations,...e.agents].map(id=>byEntity[id]?.name.en),...e.works.map(id=>byWork[id]?.name)].join(' ').toLocaleLowerCase();
}
function url(e=state.selected) {
  const p=new URLSearchParams();
  if(e&&state.detailOpen)p.set('event',e);
  if(state.era!=='all')p.set('era',state.era);
  p.set('lang',state.lang);
  if(state.view!=='timeline')p.set('view',state.view);
  return '#'+p.toString();
}
function syncURL() {
  history.replaceState(null,'',url());
}
function precision(e) {
  return ({
    day:['CONFIRMED DAY','ยืนยันวัน'],month:['CONFIRMED PERIOD','ยืนยันช่วงเวลา'],year:['CONFIRMED YEAR','ยืนยันปี'],range:['TIME RANGE','ช่วงเวลา'],approximate:['APPROXIMATE','โดยประมาณ'],uncertain:['PLACEMENT UNCERTAIN','ตำแหน่งไม่แน่นอน']
  })[e.precision][state.lang==='en'?0:1];
}
function sourceHTML(ids) {
  return `<p class="source-warning">${t('sourceWarning')}</p><ol class="source-list">${[...new Set(ids)].map(id=>{const s=bySource[id];return s?`<li><span class="source-kind">${s.kind==='official'?t('sourceOfficial'):s.kind==='game-file'?t('sourceFile'):t('sourceReference')}</span><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}<span class="sr-only"> (${state.lang==='en'?'opens a new tab':'เปิดแท็บใหม่'})</span></a>${s.locator?`<small>${esc(s.locator)}</small>`:''}</li>`:'';}).join('')}</ol>`;
}
function tags(ids) {
  return ids.filter(id=>byEntity[id]&&allowed(byEntity[id])).map(id=>`<button class="tag" data-entity="${id}">${esc(l(byEntity[id].name))}</button>`).join('');
}
function biology() {
  const records=data.biology.filter(allowed);
  return `<main id="archive" class="secondary-main"><section class="view-heading"><p class="eyebrow">BIOLOGICAL RESEARCH / LINEAGE INDEX</p><h1>${t('bioTitle')}</h1><p>${t('bioIntro')}</p></section><div class="bio-legend"><span class="solid-line"></span>${t('derived')} <span class="dashed-line"></span>${t('research-line')} / ${t('combined')}</div><div class="biology-grid">${records.map((r,i)=>`<article class="bio-record" id="bio-${r.id}"><div class="bio-number">${String(i+1).padStart(2,'0')}<span>${r.id==='plaga'?'PARASITE':['megamycete','mold','cadou'].includes(r.id)?'FUNGAL LINE':r.id==='elpis'?'COUNTERMEASURE':r.id==='rcs'?'CONDITION':'VIRAL RESEARCH'}</span></div><h2>${esc(r.title)}</h2><p>${esc(l(r.description))}</p>${r.parents.filter(p=>records.some(x=>x.id===p.id)).map(p=>`<div class="bio-parent ${p.type==='derived'?'derived':'related'}"><span>${t(p.type)}</span><button data-bio="${p.id}">${esc(byEntity[p.id]?.name.en)}</button></div>`).join('')}<button class="bio-follow" data-entity="${r.id}">${t('follow')} <b>${data.events.filter(e=>allowed(e)&&e.agents.includes(r.id)).length}</b></button><details class="evidence"><summary>${t('sources')}</summary>${sourceHTML(r.sources)}</details></article>`).join('')}</div><aside class="biology-note"><h2>${state.lang==='en'?'Not every connection is a direct genetic parent.':'ไม่ใช่ทุกความเชื่อมโยงที่เป็นต้นทางพันธุกรรมโดยตรง'}</h2><p>${state.lang==='en'?'Solid markers describe documented derivation. Dashed markers describe combinations, research relationships or later conditions. This view does not infer a common origin for Las Plagas and mold, or assign an unknown agent to a family. P30 is a control drug, and Elpis is a countermeasure.':'เส้นทึบหมายถึงการพัฒนาต่อที่มีหลักฐาน เส้นประหมายถึงการผสม ความเชื่อมโยงงานวิจัย หรือภาวะที่ตามมา ไม่สรุปว่า Las Plagas กับเชื้อรามีต้นกำเนิดร่วมกัน และไม่จัดเชื้อที่ไม่ทราบชนิดเข้าสายใด P30 เป็นยาควบคุม ส่วน Elpis เป็นสารรับมือ'}</p></aside></main>`;
}
function guide() {
  const en=state.lang==='en';
  return `<main id="archive" class="secondary-main guide-main"><section class="view-heading"><p class="eyebrow">ARCHIVE PROTOCOL / READ BEFORE RETELLING</p><h1>${t('guideTitle')}</h1><p>${en?'Start with the essentials. Follow causes, people and consequences; open the references when a detail needs checking.':'เริ่มจากเหตุการณ์หลัก ไล่เหตุ ผู้เกี่ยวข้อง และผลที่ตามมา แล้วเปิดแหล่งอ้างอิงเมื่ออยากตรวจรายละเอียด'}</p></section><div class="guide-grid"><article><span class="guide-no">01</span><h2>${en?'Tell the story, one incident at a time.':'เล่าเรื่องทีละเหตุการณ์'}</h2><p>${en?'Choose an era on the horizontal timeline. Its essential events are already visible in numbered order. Open a card for causes, the full story and consequences; the extra stories are grouped underneath.':'เลือกยุคบนเส้นเวลา เหตุการณ์หลักแสดงเป็นกิ่งเรียงตามหมายเลขอยู่แล้ว แตะการ์ดเพื่ออ่านต้นเหตุ เรื่องเต็ม และผลที่ตามมา ส่วนเรื่องประกอบรวมไว้ด้านล่าง'}</p><button data-action="essentials">${t('core')}</button></article><article><span class="guide-no">02</span><h2>${en?'Follow a person, not a pile of names.':'ตามคน ไม่ใช่ท่องรายชื่อ'}</h2><p>${en?'Select a name or organization on a record to reveal its trail through history. Clear the filter to return to the whole story. Your saved records and explicit reading marks stay on this device.':'เลือกชื่อคนหรือองค์กรในแฟ้มเพื่อดูเส้นทางตลอดประวัติศาสตร์ ล้างตัวกรองเพื่อกลับมาทั้งเรื่อง แฟ้มที่บันทึกและเครื่องหมายอ่านแล้วเก็บในอุปกรณ์นี้'}</p><button data-action="home">${t('archive')}</button></article><article><span class="guide-no">03</span><h2>${en?'One incident, multiple portrayals.':'หนึ่งเหตุการณ์ หลายการเล่า'}</h2><p>${en?'Original games and remakes are combined. Shared outcomes matter more than incompatible playable routes. Outbreak’s branching scenarios are not forced into a single itinerary. Differences appear only where they materially change interpretation, such as Operation Javier.':'เกมต้นฉบับกับรีเมกอยู่ในแฟ้มเดียว ใช้ผลร่วมที่ยืนยันมากกว่าเส้นทางเล่นที่ขัดกัน ไม่ฝืนรวมฉากแตกแขนงของ Outbreak เป็นเส้นเดียว ความต่างจะกล่าวเฉพาะเมื่อมีผลต่อความเข้าใจ เช่น Operation Javier'}</p></article><article><span class="guide-no">04</span><h2>${en?'Certainty has a visible label.':'ระดับความแน่นอนมองเห็นได้'}</h2><p>${en?'Confirmed days, confirmed periods, approximate dates and uncertain placement are labeled separately. Sorting anchors are for navigation; they never turn an undated document into a confirmed day.':'แยกวันยืนยัน ช่วงเวลายืนยัน โดยประมาณ และตำแหน่งไม่แน่นอน วันที่ที่ใช้เรียงข้อมูลมีไว้เพื่อการนำทาง ไม่ได้เปลี่ยนเอกสารไร้วันที่ให้เป็นวันที่ยืนยัน'}</p></article><article><span class="guide-no">05</span><h2>${en?'Canon is a scope, not a product list.':'ขอบเขตแคนนอน ไม่ใช่รายชื่อสินค้าทั้งหมด'}</h2><p>${en?'This archive follows the primary game continuity, including useful story DLC, canonical CG productions and materially connected side stories. It prioritizes the historical chain over collecting every minor detail. No adaptation timeline is mixed into it.':'แฟ้มนี้ตามความต่อเนื่องหลักของเกม รวม DLC เนื้อเรื่อง ภาพยนตร์ CG ในความต่อเนื่องเดียวกัน และเรื่องเสริมที่เชื่อมประวัติศาสตร์อย่างมีนัยสำคัญ ให้ความสำคัญกับสายเหตุการณ์มากกว่าการเก็บเกร็ดทุกข้อ'}</p></article><article><span class="guide-no">06</span><h2>${en?'Evidence remains inspectable.':'หลักฐานย้อนตรวจได้'}</h2><p>${en?'Publisher pages, game-file transcripts and secondary references have different labels. Transcript mirrors preserve primary text but are not official Capcom sites. Reference databases assist cross-checking; they are not treated as proof for disputed details. External sources can spoil later stories.':'หน้าเจ้าของผลงาน ข้อความถอดจากไฟล์เกม และแหล่งรองมีป้ายแยกกัน เว็บถอดข้อความเก็บเนื้อหาปฐมภูมิ แต่ไม่ใช่เว็บ Capcom ฐานข้อมูลชุมชนช่วยตรวจค้น ไม่ใช้ตัดสินประเด็นขัดแย้งโดยลำพัง และแหล่งภายนอกอาจสปอยล์เรื่องภายหลัง'}</p><a class="text-link" href="./docs/LORE-SOURCES.md">${en?'Source policy and editorial notes':'นโยบายแหล่งอ้างอิงและหมายเหตุการเรียบเรียง'}</a></article></div><div class="guide-footer"><p>${en?'Independent fan project. Resident Evil / Biohazard and associated names belong to Capcom. Original AI-assisted atmospheric illustrations, not game screenshots or evidence. The images are visual mood cues; the sourced text establishes the history.':'โครงการแฟนจัดทำอิสระ Resident Evil / Biohazard และชื่อที่เกี่ยวข้องเป็นของ Capcom ภาพประกอบบรรยากาศสร้างใหม่ด้วย AI ไม่ใช่ภาพจากเกมหรือหลักฐานของเหตุการณ์ ข้อมูลประวัติศาสตร์ยึดข้อความและแหล่งอ้างอิง'}</p><p>${t('lastChecked')}: ${data.updated}</p><button data-action="reset">${t('reset')}</button></div></main>`;
}
Object.assign(ui,{
 storyTitle:['The story of Resident Evil','เรื่องราวของ Resident Evil'],
 storyIntro:['Six eras. One connected history. Choose a point on the timeline, then follow the numbered events.','6 ยุค เรื่องราวเดียวกัน เลือกช่วงเวลาที่สนใจ แล้วไล่เหตุการณ์ตามหมายเลข'],
 chooseEra:['Choose an era','เลือกยุคบนเส้นเวลา'],
 swipe:['Swipe to travel through the eras','ปัดเส้นเวลาเพื่อเดินทางไปยุคอื่น'],
 keyEvents:['The events that move the story forward','เหตุการณ์ที่พาเรื่องเดินต่อ'],
 readMore:['Read the full story','อ่านเรื่องนี้ต่อ'],
 collapse:['Collapse this story','ย่อรายละเอียด'],
 supportEvents:['More stories in this era','เรื่องประกอบในยุคนี้'],
 tools:['Search & follow someone','ค้นหาและติดตามตัวละคร'],
 illustration:['Original atmospheric illustration','ภาพประกอบบรรยากาศ'],
 synopsis:['This era in one sentence','ยุคนี้ในประโยคเดียว'],
 locked:['Beyond your spoiler boundary','เกินขอบเขตสปอยล์'],
 inlineSpoiler:['Major story spoilers are visible.','มีสปอยล์เนื้อเรื่องทั้งชุด'],
 acknowledge:['Understood','รับทราบ'],
 results:['Search results','ผลการค้นหา'],
 eraBefore:['Previous era','ยุคก่อนหน้า'],
 eraAfter:['Next era','ยุคถัดไป'],
 picked:['You are here','กำลังอ่านยุคนี้'],
 continueEra:['Where the story goes next','เรื่องเดินต่อไปทางไหน'],
 bioNav:['Biology map','แผนผังเชื้อ'],
 timelineNav:['Story timeline','เส้นเวลาเนื้อเรื่อง'],
 guideNav:['About this archive','เกี่ยวกับแฟ้มนี้'],
 moments:['incidents','เหตุการณ์'],
 causedBy:['Cause','ต้นเหตุ'],
 changes:['Consequence','ผลที่ตามมา'],
 simpleHelp:['Read 1 → 2 → 3. Open any card for the details.','อ่านตาม 1 → 2 → 3 แตะการ์ดที่สนใจเพื่อดูรายละเอียด'],
 noEra:['No incidents are visible in this era yet.','ยังไม่มีเหตุการณ์ที่แสดงได้ในยุคนี้'],
 scopeHint:['The branches organize the story in chronological order. Documented links appear inside each event.','กิ่งเหตุการณ์เรียงตามเวลา ส่วนความเชื่อมโยงที่มีหลักฐานอยู่ในรายละเอียดของแต่ละเหตุการณ์'],
 shownAll:['All story revelations','เปิดเนื้อเรื่องทั้งหมด'],
 reducedScope:['Some records are hidden by your spoiler boundary.','บางเหตุการณ์ถูกซ่อนตามขอบเขตสปอยล์ของคุณ']
});
const eraTitles={
 origins:{en:'The origins',th:'จุดเริ่มต้น'},
 raccoon:{en:'Raccoon City',th:'Raccoon City'},
 aftermath:{en:'Umbrella falls',th:'Umbrella ล่มสลาย'},
 global:{en:'Global bioterror',th:'ภัยชีวภาพทั่วโลก'},
 'mold-era':{en:'The Winters story',th:'เรื่องของ Winters'},
 legacy:{en:'The legacy',th:'คนรุ่นใหม่'}
};
const artPath=(id,small=false)=>`./assets/eras/${id}${small?'-thumb':''}.webp`;
const eraAvailable=id=>data.events.some(e=>e.era===id&&allowed(e));
const sceneByEvent={
 'miranda-origin':'village','spencer-miranda':'village',
 'trevor-family':'mansion','umbrella-founded':'laboratory','ashford-twins':'laboratory','young-researchers':'laboratory',
 't-virus':'laboratory','veronica-sleep':'laboratory','marcus-murder':'laboratory','g-research':'laboratory',
 'arklay-leak':'mansion','ecliptic':'train','mansion':'mansion','birkin-raid':'laboratory',
 'mold-program':'laboratory','c-program':'laboratory','javier':'laboratory','umbrella-end':'laboratory',
 'ashley-rescue':'spanish-village','spencer-raid':'mansion','jill-captive':'laboratory','kijuju':'kijuju',
 'baker-infection':'baker-house','baker-house':'baker-house','baker-cleanup':'baker-house','village':'village',
 'bsaa-weapons':'village','elpis-revealed':'laboratory'
};
const scenePath=e=>sceneByEvent[e.id]?`./assets/scenes/${sceneByEvent[e.id]}.webp`:artPath(e.era,true);
const browseEra=()=>eraAvailable(state.browseEra)?state.browseEra:data.events.find(allowed)?.era||data.eras[0].id;

const eraLabel=id=>l(eraTitles[id]);
const chevron=()=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 5 7 7-7 7"/></svg>';
function header(){
 return `<header class="topbar"><a href="#lang=${state.lang}" class="brand" data-action="home"><span class="brand-symbol" aria-hidden="true">${icon('file')}</span><span>BIOHAZARD<small>THE CONNECTED HISTORY</small></span></a><nav class="view-nav" aria-label="${t('archive')}"><button data-view="timeline" ${state.view==='timeline'?'aria-current="page"':''}>${t('timelineNav')}</button><button data-view="biology" ${state.view==='biology'?'aria-current="page"':''}>${t('bioNav')}</button></nav><div class="top-actions"><button class="boundary-button" data-action="spoilers" aria-label="${t('spoilers')}">${icon('shield')}<span>${t('spoilers')}</span>${state.cap<10?`<b>${state.cap}</b>`:''}</button><button class="language-button" data-action="language" aria-label="${state.lang==='en'?'เปลี่ยนเป็นภาษาไทย':'Switch to English'}">${icon('globe')}<span>${t('language')}</span></button></div></header>`;
}
function eraRail(){
 return `<section class="time-navigation" aria-label="${t('chooseEra')}"><div class="rail-heading"><span>${t('chooseEra')}</span><span class="swipe-hint">${t('swipe')} ↔</span><span class="rail-instruction">${state.lang==='en'?'Start at the left. Follow the story.':'เริ่มจากซ้าย แล้วเดินทางไปตามเรื่อง'}</span></div><nav class="era-rail" aria-label="${t('chooseEra')}">${data.eras.map((era,i)=>{const available=eraAvailable(era.id);return `<button class="era-stop ${state.era===era.id?'active':''} ${available?'':'locked'}" data-era="${era.id}" ${state.era===era.id?'aria-current="step"':''} aria-label="${available?esc(eraLabel(era.id)):t('locked')} · ${esc(l(era.range))}" ${available?'':'disabled'}><span class="era-preview">${available?`<img src="${artPath(era.id,true)}" alt="" width="600" height="400" decoding="async">`:`<span class="locked-art">${icon('shield')}</span>`}<span class="era-number">0${i+1}</span></span><span class="era-track"><i></i></span><span class="era-years">${esc(l(era.range))}</span><strong>${available?esc(eraLabel(era.id)):t('locked')}</strong><span class="era-stop-count">${available?data.events.filter(e=>e.era===era.id&&allowed(e)).length+' '+t('moments'):'—'}</span></button>`;}).join('')}</nav></section>`;
}
function searchTools(){
 const groups=(category,label)=>`<optgroup label="${t(label)}">${data.entities.filter(x=>x.category===category&&allowed(x)).sort((a,b)=>l(a.name).localeCompare(l(b.name))).map(x=>`<option value="${x.id}" ${state.entity===x.id?'selected':''}>${esc(l(x.name))}</option>`).join('')}</optgroup>`;
 return `<details class="search-tools" ${state.toolsOpen?'open':''}><summary>${icon('search')}${t('tools')}<span>${state.q||state.entity?state.lang==='en'?'Filter active':'กำลังค้นหา':state.lang==='en'?'Optional':'เลือกใช้ได้'}</span></summary><div class="search-controls"><label class="search-field"><span class="sr-only">${t('search')}</span>${icon('search')}<input type="search" id="search" placeholder="${t('search')}" value="${esc(state.q)}" autocomplete="off"></label><label class="trace-field"><span class="sr-only">${t('trace')}</span><select id="trace"><option value="">${t('trace')}</option>${groups('character','characters')}${groups('organization','organizations')}${groups('agent','agents')}</select></label><button class="saved-filter ${state.savedOnly?'on':''}" data-action="savedOnly" aria-pressed="${state.savedOnly}">${icon('bookmark')}${t('bookmarks')}</button>${state.q||state.entity||state.savedOnly?`<button data-action="clear">${t('clear')}</button>`:''}</div></details>`;
}
function detail(e,list){
 if(!e)return '';
 const ix=list.findIndex(x=>x.id===e.id);
 const related=e.connections.map(id=>byEvent[id]).filter(x=>x&&allowed(x));
 return `<div class="expanded-story" id="story-${e.id}" role="region" aria-labelledby="event-${e.id}-title"><div class="story-content"><section class="story-cause"><span class="section-kicker">01 / ${t('cause')}</span><p>${esc(l(e.cause))}</p></section><section class="story-incident"><span class="section-kicker">02 / ${t('incident')}</span>${e.story.map(p=>`<p>${esc(l(p))}</p>`).join('')}</section><section class="story-consequence"><span class="section-kicker">03 / ${t('result')}</span><p>${esc(l(e.consequence))}</p></section>${e.uncertainty?`<aside class="uncertainty"><h3>${t('note')}</h3><p>${esc(l(e.uncertainty))}</p></aside>`:''}</div><aside class="story-context">${[['characters',e.characters],['organizations',e.organizations],['agents',e.agents]].filter(x=>x[1].length).map(([key,ids])=>`<div><h3>${t(key)}</h3><div class="tags">${tags(ids)}</div></div>`).join('')}<div><h3>${t('works')}</h3><div class="work-names">${e.works.map(id=>`<span>${esc(byWork[id].name)}</span>`).join('')}</div></div><div class="record-actions"><button class="${state.read.has(e.id)?'on':''}" data-action="read" aria-pressed="${state.read.has(e.id)}">${icon('check')}${state.read.has(e.id)?t('unread'):t('read')}</button><button class="${state.saved.has(e.id)?'on':''}" data-action="save" aria-pressed="${state.saved.has(e.id)}">${icon('bookmark')}${state.saved.has(e.id)?t('saved'):t('save')}</button><button data-action="share">${icon('share')}<span id="share-label">${t('share')}</span></button></div></aside>${related.length?`<section class="connections"><h3>${t('connect')}</h3><div>${related.map(x=>`<button data-event="${x.id}"><small>${esc(l(x.date))}</small><strong>${esc(l(x.title))}</strong>${chevron()}</button>`).join('')}</div></section>`:''}<details class="evidence"><summary>${t('sources')} <span>${e.sources.length}</span></summary>${sourceHTML(e.sources)}</details><nav class="record-pagination" aria-label="${t('archive')}">${ix>0?`<button data-event="${list[ix-1].id}">← ${t('prev')}</button>`:'<span></span>'}<button class="collapse-control" data-action="back">${t('collapse')}</button>${ix>=0&&ix<list.length-1?`<button data-event="${list[ix+1].id}">${t('next')} →</button>`:'<span></span>'}</nav></div>`;
}
function eventNode(e,i,list){
 const open=state.detailOpen&&state.selected===e.id;
 const era=data.eras.find(x=>x.id===e.era);
 return `<li class="story-node ${open?'expanded':''} ${e.importance}" id="node-${e.id}"><span class="branch-number" aria-hidden="true">${i+1}</span><article class="node-card"><button class="node-toggle" data-event="${e.id}" aria-expanded="${open}" aria-controls="story-${e.id}" aria-labelledby="event-${e.id}-title" aria-describedby="event-${e.id}-summary"><span class="node-image"><i class="scene-label">${t('illustration')}</i><img src="${scenePath(e)}" alt="" width="600" height="400" loading="lazy" decoding="async"><span>${esc(e.works.slice(0,2).map(id=>byWork[id].name.replace(/^Resident Evil\s*/i,'RE ')).join(' / '))}</span></span><span class="node-copy"><span class="node-date">${esc(l(e.date))}<span class="precision ${e.precision}">${precision(e)}</span></span><strong id="event-${e.id}-title">${esc(l(e.title))}</strong><span class="node-summary" id="event-${e.id}-summary">${esc(l(e.summary))}</span><span class="node-location">${esc(l(e.location))}${state.read.has(e.id)?` · ${t('unread')}`:''}</span><span class="node-open">${open?t('collapse'):t('readMore')}<b aria-hidden="true">${open?'−':'+'}</b></span></span></button>${open?detail(e,list):`<div class="node-peek"><span><b>${t('changes')}</b>${esc(l(e.consequence))}</span></div><div id="story-${e.id}" hidden></div>`}</article></li>`;
}
function eraStage(era){
 const visible=data.events.filter(e=>e.era===era.id&&allowed(e));
 const main=visible.filter(e=>e.importance==='core');
 const support=visible.filter(e=>e.importance==='support');
 const ix=data.eras.indexOf(era);
 const before=data.eras.slice(0,ix).filter(x=>eraAvailable(x.id)).at(-1);
 const after=data.eras.slice(ix+1).find(x=>eraAvailable(x.id));
 return `<section class="era-stage" id="era-story" aria-labelledby="era-title"><div class="era-root"><figure><img src="${artPath(era.id)}" alt="" width="960" height="640" decoding="async"><figcaption>${t('illustration')}</figcaption></figure><div class="era-root-copy"><p class="eyebrow">CHAPTER 0${ix+1} <span>·</span> ${esc(l(era.range))}</p><h2 id="era-title" tabindex="-1">${esc(l(era.headline))}</h2><p>${esc(l(era.summary))}</p><span class="root-meta">${visible.length} ${t('moments')} <i></i> ${t('simpleHelp')}</span></div></div>${main.length?`<div class="branch-heading"><h3>${t('keyEvents')}</h3><span>${main.length}</span></div><ol class="event-branches">${main.map((e,i)=>eventNode(e,i,visible)).join('')}</ol>`:`<p class="era-empty">${t('noEra')}</p>`}${support.length?`<details class="supporting-stories" ${state.supportingOpen?'open':''}><summary>${icon('file')} ${t('supportEvents')} <b>${support.length}</b><span>+</span></summary><ol class="support-list">${support.map(e=>eventNode(e,visible.indexOf(e),visible)).join('')}</ol></details>`:''}<nav class="chapter-next" aria-label="${t('chooseEra')}">${before?`<button data-era="${before.id}"><span>← ${t('eraBefore')}</span><strong>${esc(eraLabel(before.id))}</strong></button>`:'<span></span>'}${after?`<button data-era="${after.id}" class="next-era"><span>${t('continueEra')} →</span><strong>${esc(eraLabel(after.id))}</strong><small>${esc(l(after.summary))}</small></button>`:'<span></span>'}</nav></section>`;
}
function timeline(){
 const searching=!!(state.q||state.entity||state.savedOnly||state.core);
 if(searching)state.era='all';
 if(!searching&&!data.eras.some(x=>x.id===state.era&&eraAvailable(x.id)))state.era=browseEra();
 if(state.selected&&(!byEvent[state.selected]||!allowed(byEvent[state.selected]))){state.selected='';state.detailOpen=false;}
 const era=data.eras.find(x=>x.id===state.era);
 const list=filtered();
 const entity=byEntity[state.entity];
 const banner=!state.consented?`<aside class="spoiler-notice"><span>${icon('shield')}${t('inlineSpoiler')}</span><div><button data-action="spoilers">${t('openSettings')}</button><button data-action="acknowledge">${t('acknowledge')} ×</button></div></aside>`:'';
 return `<main id="archive" class="archive-main">${banner}<section class="story-intro"><div><p class="eyebrow">BIOHAZARD / CANON TIMELINE</p><h1>${t('storyTitle')}</h1><p>${t('storyIntro')}</p></div><div class="intro-stat"><strong>${data.eras.length}</strong><span>${state.lang==='en'?'ERAS / ONE STORY':'ยุค / เรื่องเดียว'}</span></div></section>${eraRail()}${searchTools()}${state.cap<10?`<p class="scope-note">${icon('shield')}${t('reducedScope')} <button data-action="spoilers">${t('openSettings')}</button></p>`:''}${searching?`<section class="search-results" aria-label="${t('results')}"><div class="results-heading"><div><p class="eyebrow">${t('results')} / ${list.length}</p><h2>${entity?esc(l(entity.name)):state.savedOnly?t('bookmarks'):state.core?t('core'):esc(state.q)}</h2>${entity?`<p>${esc(l(entity.description))}</p>`:''}</div><button data-action="clear">← ${t('back')}</button></div>${list.length?`<ol class="event-branches result-branches">${list.map((e,i)=>eventNode(e,i,list)).join('')}</ol>`:`<div class="empty-state"><h3>${t('empty')}</h3><p>${t('emptyHint')}</p><button data-action="clear">${t('clear')}</button></div>`}</section>`:eraStage(era)}</main>`;
}
function render(focusId){
 const old=$('#search'),pos=old?.selectionStart;
 document.documentElement.lang=state.lang;
 const content=state.view==='timeline'?timeline():state.view==='biology'?biology():guide();
 document.title=`BIOHAZARD — ${t('storyTitle')}${state.detailOpen&&byEvent[state.selected]&&allowed(byEvent[state.selected])?' / '+l(byEvent[state.selected].title):''}`;
 $('#app').innerHTML=header()+content+`<footer class="site-footer"><span>BIOHAZARD / INDEPENDENT CANON ARCHIVE</span><div><button data-view="guide">${t('guideNav')}</button><span>${[...state.read].filter(id=>byEvent[id]&&allowed(byEvent[id])).length} ${t('readCount')}</span></div></footer><div id="announcer" class="sr-only" aria-live="polite"></div>`;
 syncURL();
 const rail=$('.era-rail'),active=$('.era-stop.active');
 if(rail&&active)rail.scrollLeft=active.offsetLeft-rail.offsetLeft-(rail.clientWidth-active.clientWidth)/2;
 if(focusId){const el=document.getElementById(focusId);el?.focus({preventScroll:true});if(el&&pos!==null&&el.setSelectionRange)try{el.setSelectionRange(pos,pos);}catch{}}
}
const motion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth';
function focusNode(id,scroll=false){
 const el=$(`#node-${id} .node-toggle`);el?.focus({preventScroll:true});
 if(scroll)$(`#node-${id}`)?.scrollIntoView({behavior:motion(),block:'start'});
}
function selectEvent(id,{toggle=true,scroll=true}={}){
 const e=byEvent[id];if(!e)return;
 if(!allowed(e)){pendingEvent=id;showSpoilers(false,t('noVisible'));return;}
 const close=toggle&&state.detailOpen&&state.selected===id;
 const searching=!!(state.q||state.entity||state.savedOnly||state.core);
 if(!searching||!filtered().some(x=>x.id===id)){
  state.era=e.era;state.browseEra=e.era;state.entity='';state.q='';state.savedOnly=false;state.core=false;
 }
 state.view='timeline';state.selected=id;state.detailOpen=!close;
 if(e.importance==='support')state.supportingOpen=true;
 storage.set('last',id);render();focusNode(id,scroll&&!close);
}
function selectEra(id,{focus=true,scroll=true}={}){
 if(!data.eras.some(x=>x.id===id)||!eraAvailable(id))return;
 state.era=id;state.browseEra=id;state.view='timeline';state.detailOpen=false;state.selected='';state.q='';state.entity='';state.savedOnly=false;state.core=false;state.supportingOpen=false;
 render();
 const rail=$('.era-rail'),stop=$(`.era-stop[data-era="${id}"]`);
 if(rail&&stop)rail.scrollTo({left:stop.offsetLeft-rail.offsetLeft-(rail.clientWidth-stop.clientWidth)/2,behavior:motion()});
 if(focus)$('#era-title')?.focus({preventScroll:true});
 if(scroll)$('.time-navigation')?.scrollIntoView({behavior:motion(),block:'start'});
}
function showSpoilers(first=false,message=''){
 const d=document.createElement('dialog');d.className='spoiler-dialog';d.setAttribute('aria-label',t('spoilerTitle'));
 d.innerHTML=`<form method="dialog"><p class="eyebrow">${icon('shield')} ${t('spoilers')}</p><h2>${t('spoilerTitle')}</h2><p>${message?esc(message)+' ':''}${t('spoilerIntro')}</p><label for="cap-select">${t('spoilers')}</label><select id="cap-select">${caps.map(([n,name])=>`<option value="${n}" ${n===state.cap?'selected':''}>${n===10?'':n+' / '}${esc(name)}</option>`).join('')}</select><div class="dialog-actions"><button value="cancel">${t('close')}</button><button class="primary" value="apply">${t('apply')}</button></div></form>`;
 document.body.append(d);
 d.addEventListener('close',()=>{
  if(d.returnValue==='apply'){
   state.cap=Number($('#cap-select',d).value);state.consented=true;storage.set('cap',state.cap);storage.set('consented',true);
   if(state.entity&&byEntity[state.entity]&&!allowed(byEntity[state.entity]))state.entity='';
   if(pendingEvent&&allowed(byEvent[pendingEvent])){
    const e=byEvent[pendingEvent];state.selected=e.id;state.era=e.era;state.browseEra=e.era;state.detailOpen=true;state.entity='';state.q='';state.savedOnly=false;state.core=false;state.supportingOpen=e.importance==='support';pendingEvent='';
   }
   render();
  }
  d.remove();$('.boundary-button')?.focus({preventScroll:true});
 });d.showModal();
}
function persist(){storage.set('read',[...state.read]);storage.set('saved',[...state.saved]);}
document.addEventListener('toggle',event=>{
 if(event.target.classList?.contains('search-tools'))state.toolsOpen=event.target.open;
 if(event.target.classList?.contains('supporting-stories'))state.supportingOpen=event.target.open;
},true);
document.addEventListener('click',async event=>{
 const el=event.target.closest('button, a[data-action]');if(!el)return;
 if(el.dataset.event){selectEvent(el.dataset.event);return;}
 if(el.dataset.era){selectEra(el.dataset.era,{scroll:!el.classList?.contains('era-stop')});return;}
 if(el.dataset.view){state.view=el.dataset.view;state.detailOpen=false;render();window.scrollTo({top:0,behavior:'instant'});$('[data-view="'+state.view+'"]')?.focus({preventScroll:true});return;}
 if(el.dataset.entity){state.entity=el.dataset.entity;state.era='all';state.q='';state.core=false;state.savedOnly=false;state.view='timeline';state.detailOpen=false;state.toolsOpen=true;render();$('.results-heading')?.scrollIntoView({behavior:motion(),block:'start'});$('#trace')?.focus({preventScroll:true});return;}
 if(el.dataset.bio){$(`#bio-${el.dataset.bio}`)?.scrollIntoView({behavior:motion(),block:'center'});return;}
 const action=el.dataset.action;if(!action)return;event.preventDefault();
 if(action==='language'){state.lang=state.lang==='th'?'en':'th';storage.set('lang',state.lang);render();$('.language-button')?.focus({preventScroll:true});return;}
 if(action==='spoilers'){showSpoilers();return;}
 if(action==='acknowledge'){state.consented=true;storage.set('consented',true);render();$('.boundary-button')?.focus({preventScroll:true});return;}
 if(action==='back'){state.detailOpen=false;render();focusNode(state.selected,true);return;}
 if(action==='home'){selectEra(data.events.find(allowed).era,{focus:false,scroll:false});window.scrollTo({top:0,behavior:'instant'});return;}
 if(action==='essentials'){state.era='all';state.view='timeline';state.entity='';state.q='';state.core=true;state.savedOnly=false;state.detailOpen=false;render();return;}
 if(action==='clear'){state.entity='';state.q='';state.core=false;state.savedOnly=false;state.detailOpen=false;state.era=browseEra();render();$('#search')?.focus({preventScroll:true});return;}
 if(action==='savedOnly'){state.savedOnly=!state.savedOnly;state.detailOpen=false;state.toolsOpen=true;if(!state.savedOnly)state.era=browseEra();render();return;}
 if(action==='read'||action==='save'){const set=action==='read'?state.read:state.saved;set.has(state.selected)?set.delete(state.selected):set.add(state.selected);persist();render();$(`[data-action="${action}"]`)?.focus({preventScroll:true});return;}
 if(action==='reset'){state.read.clear();persist();render();return;}
 if(action==='share'){
  const link=location.origin+location.pathname+url();
  try{await navigator.clipboard.writeText(link);$('#share-label').textContent=t('copied');$('#announcer').textContent=t('copied');}
  catch{const d=document.createElement('dialog');d.className='spoiler-dialog';d.setAttribute('aria-label',t('share'));d.innerHTML=`<form method="dialog"><h2>${t('share')}</h2><input class="share-input" aria-label="${t('share')}" readonly value="${esc(link)}"><button class="primary">${t('close')}</button></form>`;document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();$('input',d).select();}return;
 }
});
document.addEventListener('input',event=>{
 if(event.target.id==='search'){state.q=event.target.value;state.era=state.q||state.entity||state.savedOnly?'all':browseEra();state.detailOpen=false;state.toolsOpen=true;render('search');}
});
document.addEventListener('change',event=>{
 if(event.target.id==='trace'){state.entity=event.target.value;state.era=state.entity||state.q||state.savedOnly?'all':browseEra();state.detailOpen=false;state.toolsOpen=true;render('trace');}
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&state.detailOpen&&!document.querySelector('dialog[open]')){state.detailOpen=false;render();focusNode(state.selected);return;}
 const button=event.target.closest?.('.era-stop');
 if(button&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  event.preventDefault();const eras=data.eras.filter(e=>eraAvailable(e.id));let ix=eras.findIndex(e=>e.id===button.dataset.era);
  ix=event.key==='Home'?0:event.key==='End'?eras.length-1:Math.max(0,Math.min(eras.length-1,ix+(event.key==='ArrowRight'?1:-1)));
  selectEra(eras[ix].id,{focus:false,scroll:false});$(`.era-stop[data-era="${eras[ix].id}"]`)?.focus({preventScroll:true});
 }
});
window.addEventListener('hashchange',()=>{
 const p=new URLSearchParams(location.hash.slice(1));if(['th','en'].includes(p.get('lang')))state.lang=p.get('lang');
 if(p.get('event'))selectEvent(p.get('event'),{toggle:false});
 else if(p.get('era'))selectEra(p.get('era'));
});
try{
 const response=await fetch('./data/archive.json');if(!response.ok)throw new Error('Archive HTTP '+response.status);data=await response.json();
 byEvent=Object.fromEntries(data.events.map(x=>[x.id,x]));byEntity=Object.fromEntries(data.entities.map(x=>[x.id,x]));bySource=Object.fromEntries(data.sources.map(x=>[x.id,x]));byWork=Object.fromEntries(data.works.map(x=>[x.id,x]));
 const requested=byEvent[hash.get('event')];
 if(requested&&allowed(requested)){state.selected=requested.id;state.era=requested.era;state.browseEra=requested.era;state.detailOpen=true;state.supportingOpen=requested.importance==='support';}
 render();
 if(requested&&!allowed(requested)){pendingEvent=requested.id;showSpoilers(false,t('noVisible'));}
 if(requested&&allowed(requested))focusNode(requested.id,true);
}catch(error){console.error(error);$('#app').innerHTML=`<main class="boot"><p class="eyebrow">BIOHAZARD</p><h1>${t('offline')}</h1><button onclick="location.reload()">${t('reload')}</button></main>`;}
