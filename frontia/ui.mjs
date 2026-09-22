import { EPISODES } from './stories.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dateText = time => new Date(time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
const button = (action, label, className = 'btn', extra = '') => `<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`;
const navButton = (view, label, className = 'iconbtn', extra = '') => `<button type="button" class="${className}" data-nav="${view}" ${extra}>${label}</button>`;
const header = () => `<header class="top"><div class="brand">cinematic<i>play</i></div><div class="spacer"></div>${navButton('settings', '⚙', 'iconbtn', 'aria-label="ตั้งค่า"')}</header>`;
function tabs(active) {
  return `<nav class="tabs" aria-label="เมนูหลัก">${[['home', '⌂', 'หน้าแรก'], ['chat', '◌', 'แชต'], ['play', '▶', 'เรื่องของฉัน'], ['settings', '⚙', 'ตั้งค่า']].map(([view, icon, label]) => navButton(view, `<span aria-hidden="true">${icon}</span><small>${label}</small>`, `tab ${active === view ? 'on' : ''}`, active === view ? 'aria-current="page"' : '')).join('')}</nav>`;
}
function storyRow(id, story) {
  const ep = EPISODES[id];
  const count = story && !story.deleted ? story.history.length : 0;
  return navButton(`episode/${id}`, `<span class="libart ${ep.theme}" aria-hidden="true"></span><span class="grow"><span class="rowtitle">${esc(ep.title)}</span><span class="rowsub">${count ? `${count} ฉาก · ${esc(story.scene.chapter)}` : 'ยังไม่ได้เริ่ม'}</span>${count ? `<span class="rowsub">บันทึก ${esc(dateText(story.updatedAt))}</span>` : ''}</span><span aria-hidden="true">›</span>`, 'library');
}
export function renderView(ctx) {
  const { record, route, busy, auth, models, cloud, message, remember, updateReady, offline } = ctx;
  const [view, id] = route.split('/');
  const ep = EPISODES[id];
  const stories = record.save.stories;
  const started = Object.keys(stories).filter(key => !stories[key].deleted).sort((a, b) => stories[b].updatedAt - stories[a].updatedAt);
  const notices = `${offline ? '<div class="notice">ออฟไลน์ · อ่านเรื่องที่บันทึกไว้ได้</div>' : ''}${record.migrationNotice ? `<div class="notice">${esc(record.migrationNotice)} ${button('dismiss-migration', 'รับทราบ', 'textbtn')}</div>` : ''}${updateReady ? `<div class="notice">มีเวอร์ชันใหม่พร้อมแล้ว ${button('update', 'อัปเดต', 'textbtn', busy ? 'disabled' : '')}</div>` : ''}${message ? `<div class="notice error" role="alert">${esc(message)} ${button('dismiss-message', 'ปิด', 'textbtn')}</div>` : ''}`;
  const page = content => `<main class="page" id="main" tabindex="-1">${header()}${notices}${content}</main>${tabs(view)}`;
  const saveStatus = `<span class="save-status" data-save-status role="status">${esc(cloud)}</span>`;

  if (view === 'home') return page(`
    <section class="hero"><span class="badge">เรื่องแนะนำ</span><h1>สัญญาณเที่ยงคืน</h1><div class="sub">เมืองที่จดจำทุกการตัดสินใจของคุณ</div>${navButton('episode/ep-midnight', 'ดูเรื่องนี้', 'cta')}</section>
    ${started.length ? `<h2>เล่นต่อ</h2>${started.slice(0, 2).map(key => storyRow(key, stories[key])).join('')}` : ''}
    <h2>แนะนำสำหรับคุณ</h2><div class="cards" aria-label="เรื่องแนะนำ">${Object.values(EPISODES).slice(1).map(x => navButton(`episode/${x.id}`, `<span class="art ${x.theme}" aria-hidden="true"><span class="art-symbol">${x.theme === 'summer' ? '☀' : x.theme === 'orbit' ? '◎' : '⌂'}</span></span><span class="cardtitle">${esc(x.title)}</span><span class="cardmeta">${esc(x.subtitle)}</span>`, 'card')).join('')}</div>
    <div class="home-note">${saveStatus}<p class="hint">${record.settings.backendUrl ? 'เลือกเรื่อง แล้วดำเนินเรื่องด้วย AI จาก Backend ส่วนตัวของคุณ' : 'ลองอ่านฉากตัวอย่างได้ทันที · เชื่อม ChatGPT ในตั้งค่าเพื่อเล่นกับ AI'}</p></div>`);

  if (view === 'play') return page(`<h1>เรื่องของฉัน</h1><p class="sub">ความคืบหน้าและบทสนทนาบันทึกแยกแต่ละเรื่อง</p>${saveStatus}${Object.keys(EPISODES).map(key => storyRow(key, stories[key])).join('')}`);

  if (view === 'chat') return page(`<h1>แชต</h1><section class="panel"><span class="accent">✦</span><h2>คุยต่อในเรื่องของคุณ</h2><p class="sub">เลือกตัวละคร แล้วพิมพ์สิ่งที่อยากพูดในฉาก บทสนทนาจะเป็นส่วนหนึ่งของเส้นเรื่องที่บันทึกไว้</p></section><h2>ตัวละคร</h2>${Object.values(EPISODES).map(x => `<button class="library" type="button" data-talk="${x.id}"><span class="avatar">${esc(x.character[0])}</span><span class="grow"><span class="rowtitle">${esc(x.character)} · ${esc(x.title)}</span><span class="rowsub">${stories[x.id] && !stories[x.id].deleted ? 'กลับไปคุยต่อในฉากล่าสุด' : 'เริ่มเรื่องและทำความรู้จัก'}</span></span><span aria-hidden="true">›</span></button>`).join('')}`);

  if (view === 'settings') {
    const selected = record.settings.model;
    const options = models.length ? models : [{ model: selected, displayName: selected }];
    if (!options.some(x => x.model === selected)) options.unshift({ model: selected, displayName: `${selected} (ยังไม่พบในบัญชี)` });
    return page(`<h1>ตั้งค่า</h1><div class="row"><div class="avatar">J</div><div class="grow"><div class="rowtitle">พื้นที่เล่นส่วนตัว</div><div class="rowsub">นิยายภาษาไทย · เลือกเส้นทางของคุณเอง</div></div></div>
      <form id="settingsForm"><h2 class="settingsGroup">การเชื่อมต่อ AI</h2><label class="field-label" for="backendUrl">Backend URL</label><input id="backendUrl" name="backendUrl" class="field" type="url" inputmode="url" autocomplete="url" placeholder="https://backend-ของคุณ" value="${esc(record.settings.backendUrl)}">
      <label class="field-label" for="appPassword">รหัสผ่าน Backend ส่วนตัว</label><input id="appPassword" name="appPassword" class="field" type="password" autocomplete="current-password" placeholder="รหัสผ่านของเซิร์ฟเวอร์คุณ">
      <label class="check-label"><input id="rememberPassword" type="checkbox" ${remember ? 'checked' : ''}> จำรหัสผ่านในอุปกรณ์นี้</label><p class="hint">เมื่อไม่เลือก ระบบจะจำรหัสเฉพาะแท็บนี้ ไม่ควรจำรหัสบนเครื่องที่ใช้ร่วมกัน</p>
      <label class="field-label" for="model">โมเดล</label><select id="model" name="model" class="field">${options.map(x => `<option value="${esc(x.model)}" ${x.model === selected ? 'selected' : ''}>${esc(x.displayName || x.model)}</option>`).join('')}</select><p class="hint">กดทดสอบเพื่อดึงรายชื่อโมเดลที่บัญชีใช้ได้จริง</p>
      <div class="btnrow"><button class="btn" type="submit">บันทึกการตั้งค่า</button>${button('test-backend', 'ทดสอบ Backend')}</div></form>
      <div class="connection-status" role="status"><span class="dot ${auth?.connected ? 'ok' : ''}"></span>${auth?.connected ? `เชื่อม ChatGPT แล้ว${auth.plan ? ` · ${esc(auth.plan)}` : ''}` : auth ? 'Backend พร้อม · ยังไม่ได้เชื่อม ChatGPT' : 'ยังไม่ได้ตรวจสอบการเชื่อมต่อ'}</div>
      <div class="btnrow">${button('connect', auth?.connected ? 'เชื่อมบัญชีใหม่' : 'เชื่อม ChatGPT', 'btn primary')}${button('forget-password', 'ลืมรหัสในเครื่อง')}</div>
      <h2 class="settingsGroup">การบันทึก</h2><div class="setting"><span>บันทึกอัตโนมัติ</span>${saveStatus}</div>
      <p class="hint">บันทึกทุกฉากลงเครื่อง เมื่อ Backend พร้อมจะซิงก์ให้อัตโนมัติ การล้างข้อมูลเว็บไซต์หรือโหมดไม่ระบุตัวตนอาจทำให้เซฟในเครื่องหาย</p>
      <div class="btnrow">${button('sync', 'ซิงก์ตอนนี้')}${button('conflicts', 'ตรวจข้อมูลที่ชนกัน', 'btn', ctx.conflict ? '' : 'hidden')}</div>
      <div class="btnrow">${button('export', 'สำรองเป็นไฟล์')}${button('import', 'นำเข้าเซฟ')}</div><input id="importFile" type="file" accept="application/json,.json" hidden>
      <div class="btnrow">${button('backups', 'กู้คืนเซฟก่อนหน้า')}${button('persistent', 'เก็บข้อมูลถาวร')}</div>
      <div class="btnrow">${button('reset-all', 'เริ่มเรื่องใหม่ทั้งหมด', 'btn danger')}</div>
      <p class="hint">ก่อนเริ่มใหม่หรือนำเข้า ระบบจะเก็บสำเนาสำหรับกู้คืนในอุปกรณ์นี้ ไฟล์สำรองไม่รวมรหัสผ่านและข้อมูลล็อกอิน</p>
      <h2 class="settingsGroup">ติดตั้งและเกี่ยวกับ</h2>${button('install', 'เพิ่มลงหน้าจอหลัก')}<p class="hint">Cinematic Play 0.6.0 · เปิดอ่านเซฟแบบออฟไลน์ได้ การสร้างฉาก AI ต้องมีอินเทอร์เน็ตและ Backend ที่เชื่อมแล้ว</p>`);
  }

  if (view === 'episode' && ep) {
    const startedStory = stories[id] && !stories[id].deleted;
    return `<main id="main" tabindex="-1"><div class="detailCover ${ep.theme}" aria-hidden="true"></div>${navButton('home', '←', 'iconbtn back', 'aria-label="กลับหน้าหลัก"')}<section class="detail">${notices}<span class="badge">นิยาย</span><h1>${esc(ep.title)}</h1><p class="sub">${esc(ep.subtitle)}</p><div class="chips">${ep.tags.map(tag => `<span class="chip">${esc(tag)}</span>`).join('')}</div><p class="description">${esc(ep.description)}</p>${startedStory ? `<p class="sub">ฉากล่าสุด: ${esc(stories[id].scene.chapter)} · ${stories[id].history.length} ฉาก</p>` : ''}<p class="hint">${record.settings.backendUrl ? 'ดำเนินเรื่องผ่าน Backend ที่คุณตั้งค่าไว้' : 'เริ่มจากฉากตัวอย่างภาษาไทย · เชื่อม AI ได้ภายหลัง'}</p></section>${button('start', startedStory ? 'เล่นต่อ' : 'เริ่มเรื่อง', 'bigcta')}</main>`;
  }

  if (view === 'player' && ep && stories[id] && !stories[id].deleted) {
    const story = stories[id], scene = story.scene;
    const previewEnded = !record.settings.backendUrl && story.history.length >= 2;
    return `<main class="player" id="main" tabindex="-1"><section class="stage ${ep.theme}"><div class="stageTop">${navButton('play', '←', 'iconbtn', 'aria-label="กลับเรื่องของฉัน"')}<span class="chapter">${esc(scene.chapter)}</span>${button('story-menu', '•••', 'iconbtn', 'aria-label="เมนูเรื่อง"')}</div><div class="location">${esc(scene.location)}</div></section>
      <section class="story"><div class="tools">${button('journal', '▤ บันทึก', 'tool')}${button('locations', '⌘ สถานที่', 'tool')}${button('story-status', '◎ สถานะ', 'tool')}</div><div class="storybody">${notices}<div class="reader-meta"><span>${esc(ep.title)} · ฉาก ${story.history.length}</span>${saveStatus}</div>
      ${!record.settings.backendUrl ? '<p class="demo-label">ฉากตัวอย่าง · ยังไม่ได้ใช้ AI</p>' : ''}${scene.speaker ? `<div class="speaker">${esc(scene.speaker)}</div>` : ''}<div class="narrative" aria-live="polite">${esc(scene.body)}</div>
      ${previewEnded ? `<div class="panel preview-end"><h2>จบฉากตัวอย่าง</h2><p class="sub">เชื่อม ChatGPT เพื่อให้เรื่องดำเนินต่อจากการตัดสินใจของคุณ</p>${navButton('settings', 'ตั้งค่าการเชื่อมต่อ', 'btn primary')}</div>` : `<div class="prompt">คุณจะทำอย่างไร?</div>${scene.choices.map((choice, i) => `<button class="choice" type="button" data-choice="${i}" ${busy ? 'disabled' : ''}><span class="num">${i + 1}</span><span class="grow">${esc(choice.label)}</span><span aria-hidden="true">›</span></button>`).join('')}<label class="sr-only" for="freeText">สิ่งที่อยากพูดหรือทำ</label><div class="reply"><textarea id="freeText" maxlength="4000" rows="2" placeholder="พิมพ์สิ่งที่อยากพูดหรือทำเอง…" ${busy ? 'disabled' : ''}>${esc(record.drafts[id] || '')}</textarea>${button('send', '↑', 'send', `aria-label="ส่งข้อความ" ${busy ? 'disabled' : ''}`)}</div><p class="hint">Enter ขึ้นบรรทัดใหม่ · Ctrl/⌘ + Enter ส่งข้อความ</p>`}
      ${busy ? `<div class="generation" role="status"><span class="spinner" aria-hidden="true"></span><span>กำลังสร้างฉากถัดไป…</span>${button('cancel', 'ยกเลิก', 'textbtn')}</div>` : ''}</div></section></main>`;
  }
  return page(`<h1>ยังไม่มีฉากที่บันทึกไว้</h1>${navButton('play', 'เลือกเรื่อง', 'btn primary')}`);
}

export function sheet(title, content) {
  return `<div class="sheet-head"><h2 id="dialogTitle">${esc(title)}</h2>${button('close-dialog', '×', 'iconbtn', 'aria-label="ปิดหน้าต่าง"')}</div>${content}`;
}
