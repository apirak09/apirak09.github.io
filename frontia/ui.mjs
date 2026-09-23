import { ACTIVE_EPISODE } from './shared.mjs';
import { CAST, CLUE_NAMES, EPISODES, PLACE_NAMES } from './stories.mjs';

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
    <section class="hero midnight-hero"><span class="badge">เรื่องต้นแบบ · เล่นได้แล้ว</span><h1>สัญญาณเที่ยงคืน</h1><div class="sub">เสียงประกาศเรียกชื่อคุณ จากชานชาลาที่ปิดไปแล้ว</div>${navButton('episode/ep-midnight', stories[ACTIVE_EPISODE] && !stories[ACTIVE_EPISODE].deleted ? 'อ่านต่อ' : 'เริ่มอ่าน', 'cta')}</section>
    ${stories[ACTIVE_EPISODE] && !stories[ACTIVE_EPISODE].deleted ? `<h2>อ่านต่อจากที่ค้างไว้</h2>${storyRow(ACTIVE_EPISODE, stories[ACTIVE_EPISODE])}` : ''}
    <h2>คนที่คุณจะพบ</h2><div class="cast-list">${Object.entries(CAST).map(([key, x]) => `<div class="cast-card"><img src="./assets/midnight/${key}-neutral.webp" alt="" loading="lazy"><div><strong>${esc(x.name)}</strong><span>${esc(x.role)}</span><p>${esc(x.description)}</p></div></div>`).join('')}</div>
    <div class="home-note">${saveStatus}<p class="hint">${record.settings.backendUrl ? 'หนึ่งการตอบจะเปิดเรื่องต่อหลายช็อต พร้อมภาพและสถานะที่เปลี่ยนตามเหตุการณ์' : 'เล่นบทตัวอย่างได้สองช่วง · ตั้งค่า Backend เพื่อดำเนินเรื่องด้วย AI'}</p></div>`);

  if (view === 'play') return page(`<h1>เรื่องของฉัน</h1><p class="sub">ตอนนี้เล่นเรื่องสัญญาณเที่ยงคืนหนึ่งเรื่อง ฉากและตำแหน่งที่อ่านค้างจะบันทึกอัตโนมัติ</p>${saveStatus}${storyRow(ACTIVE_EPISODE, stories[ACTIVE_EPISODE])}${started.filter(key => key !== ACTIVE_EPISODE).length ? `<h2>บันทึกจากเวอร์ชันก่อน</h2><p class="hint">เปิดอ่านหรือสำรองเรื่องเดิมได้</p>${started.filter(key => key !== ACTIVE_EPISODE).map(key => storyRow(key, stories[key])).join('')}` : ''}`);

  if (view === 'chat') return page(`<h1>ตัวละคร</h1><section class="panel"><span class="accent">✦</span><h2>คำพูดของคุณมีผลต่อเรื่อง</h2><p class="sub">เลือกคำตอบหรือพิมพ์สิ่งที่อยากพูดหลังอ่านครบช่วง ตัวละครจะตอบสนองและดำเนินเหตุการณ์ต่อหลายช็อตในเรื่องเดียวกัน</p>${navButton('episode/ep-midnight', 'ไปยังสัญญาณเที่ยงคืน', 'btn primary')}</section><h2>คนในสถานี</h2>${Object.entries(CAST).map(([key, x]) => `<div class="cast-card"><img src="./assets/midnight/${key}-neutral.webp" alt="" loading="lazy"><div><strong>${esc(x.name)} · ${esc(x.role)}</strong><p>${esc(x.description)}</p></div></div>`).join('')}`);

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
      <h2 class="settingsGroup">ติดตั้งและเกี่ยวกับ</h2>${button('install', 'เพิ่มลงหน้าจอหลัก')}<p class="hint">Cinematic Play 0.7.0 · เปิดอ่านฉากภาพที่บันทึกไว้แบบออฟไลน์ได้ การสร้างฉาก AI ต้องมีอินเทอร์เน็ตและ Backend รุ่น 0.7 ที่เชื่อมแล้ว</p>`);
  }

  if (view === 'episode' && ep) {
    const startedStory = stories[id] && !stories[id].deleted;
    return `<main id="main" tabindex="-1"><div class="detailCover ${ep.theme}" aria-hidden="true"></div>${navButton('home', '←', 'iconbtn back', 'aria-label="กลับหน้าหลัก"')}<section class="detail">${notices}<span class="badge">${id === ACTIVE_EPISODE ? 'เรื่องต้นแบบ' : 'บันทึกเก่า'}</span><h1>${esc(ep.title)}</h1><p class="sub">${esc(ep.subtitle)}</p><div class="chips">${ep.tags.map(tag => `<span class="chip">${esc(tag)}</span>`).join('')}</div><p class="description">${esc(ep.description)}</p>${startedStory ? `<p class="sub">ฉากล่าสุด: ${esc(stories[id].scene.chapter)} · ${stories[id].history.length} ฉาก</p>` : ''}<p class="hint">${id !== ACTIVE_EPISODE ? 'เรื่องเดิมเปิดอ่านได้ แต่ช่วงนี้เน้นพัฒนาเรื่องต้นแบบเพียงเรื่องเดียว' : record.settings.backendUrl ? 'ดำเนินเรื่องผ่าน Backend ที่คุณตั้งค่าไว้' : 'เริ่มจากฉากตัวอย่างภาษาไทย · เชื่อม AI ได้ภายหลัง'}</p></section>${id === ACTIVE_EPISODE || startedStory ? button('start', startedStory ? 'อ่านต่อ' : 'เริ่มเรื่อง', 'bigcta') : navButton('home', 'กลับหน้าหลัก', 'bigcta')}</main>`;
  }

  if (view === 'player' && ep && stories[id] && !stories[id].deleted) {
    const story = stories[id], scene = story.scene;
    const previewEnded = !record.settings.backendUrl && story.history.length >= 3;
    const beatIndex = story.beatIndex ?? 0;
    const beat = scene.beats?.[beatIndex] || { text: scene.body, background: 'platform', actor: null, expression: 'neutral', companion: null, companionExpression: 'neutral' };
    const lastBeat = beatIndex >= (scene.beats?.length || 1) - 1;
    const status = story.status || { minute: 17, clues: [], relationships: { mina: 0, tara: 0, arun: 0 } };
    const clock = `${String(Math.floor(status.minute / 60)).padStart(2, '0')}:${String(status.minute % 60).padStart(2, '0')}`;
    const portrait = (actor, expression, side) => actor ? `<img class="scene-portrait ${side}" src="./assets/midnight/${actor}-${expression}.webp" alt="${esc(CAST[actor].name)} สีหน้า${esc({ neutral: 'สงบ', warm: 'เป็นมิตร', worried: 'กังวล', resolved: 'มุ่งมั่น' }[expression])}" draggable="false">` : '';
    if (id !== ACTIVE_EPISODE) return `<main class="player archived" id="main" tabindex="-1"><div class="stageTop archive-top">${navButton('play', '←', 'iconbtn', 'aria-label="กลับเรื่องของฉัน"')}<span class="chapter">${esc(scene.chapter)}</span>${button('story-menu', '•••', 'iconbtn', 'aria-label="เมนูเรื่อง"')}</div><div class="storybody">${notices}<p class="demo-label">บันทึกจากเวอร์ชันก่อน · เปิดอ่านอย่างเดียว</p><h1>${esc(ep.title)}</h1><p class="sub">${esc(scene.location)}</p><p class="narrative">${esc(scene.body)}</p><div class="tools">${button('journal', '▤ บันทึก', 'tool')}${button('story-status', '◎ สถานะ', 'tool')}</div>${saveStatus}</div></main>`;
    const visual = `<div class="cinematic-stage" style="--scene-bg:url('./assets/midnight/${beat.background}.webp')" aria-label="${esc(PLACE_NAMES[beat.background])}">
      <div class="stageTop">${navButton('play', '←', 'iconbtn', 'aria-label="กลับเรื่องของฉัน"')}<span class="chapter">${esc(scene.chapter)}</span>${button('story-menu', '•••', 'iconbtn', 'aria-label="เมนูเรื่อง"')}</div>
      <div class="scene-hud"><span>◷ ${clock}</span><span>◇ เบาะแส ${status.clues.length}</span><span>♡ มีนา ${status.relationships.mina > 0 ? '+' : ''}${status.relationships.mina}</span></div>
      <div class="scene-location">${esc(PLACE_NAMES[beat.background])}</div>
      <div class="portraits ${beat.companion ? 'pair' : ''}">${portrait(beat.companion, beat.companionExpression, 'support')}${portrait(beat.actor, beat.expression, 'lead')}</div>
      <section class="visual-dialogue" aria-live="polite"><div class="beat-progress">${esc(ep.title)} · ช็อต ${beatIndex + 1}/${scene.beats?.length || 1}</div><div class="speaker">${esc(beat.actor ? CAST[beat.actor].name : 'เรื่องราว')}</div><p class="beat-text">${esc(beat.text)}</p>${!lastBeat ? button('next-beat', 'อ่านต่อ ›', 'beat-next', 'aria-label="อ่านช็อตถัดไป"') : '<span class="beat-finish">จบช่วงนี้ · เลือกการกระทำด้านล่าง</span>'}</section>
    </div>`;
    return `<main class="player cinematic-player" id="main" tabindex="-1">${visual}
      <section class="reader-controls">${notices}<div class="tools">${button('journal', '▤ บันทึก', 'tool')}${button('locations', '⌘ สถานที่', 'tool')}${button('story-status', '◎ สถานะ', 'tool')}</div><div class="storybody"><div class="reader-meta"><span>ช่วงที่ ${story.history.length} · ${esc(PLACE_NAMES[beat.background])}</span>${saveStatus}</div>
      ${!record.settings.backendUrl ? '<p class="demo-label">บทตัวอย่าง · ยังไม่ได้ใช้ AI</p>' : ''}
      ${lastBeat ? previewEnded ? `<div class="panel preview-end"><h2>จบบทตัวอย่าง</h2><p class="sub">เชื่อม ChatGPT เพื่อให้ตัวละครและเรื่องดำเนินต่อจากการตัดสินใจของคุณ</p>${navButton('settings', 'ตั้งค่าการเชื่อมต่อ', 'btn primary')}</div>` : `<div class="prompt">คุณจะทำอย่างไรต่อ?</div>${scene.choices.map((choice, i) => `<button class="choice" type="button" data-choice="${i}" ${busy ? 'disabled' : ''}><span class="num">${i + 1}</span><span class="grow">${esc(choice.label)}</span><span aria-hidden="true">›</span></button>`).join('')}<label class="sr-only" for="freeText">สิ่งที่อยากพูดหรือทำ</label><div class="reply"><textarea id="freeText" maxlength="4000" rows="2" placeholder="หรือพิมพ์สิ่งที่คุณอยากพูดหรือทำ…" ${busy ? 'disabled' : ''}>${esc(record.drafts[id] || '')}</textarea>${button('send', '↑', 'send', `aria-label="ส่งข้อความ" ${busy ? 'disabled' : ''}`)}</div><p class="hint">Ctrl/⌘ + Enter เพื่อส่ง · หนึ่งครั้งจะได้เรื่องต่อหลายช็อต</p>` : `<p class="read-hint">อ่านช็อตด้านบนต่อ เพื่อไปถึงช่วงเลือกการกระทำ</p>`}
      ${busy ? `<div class="generation" role="status"><span class="spinner" aria-hidden="true"></span><span>กำลังสร้างเรื่องต่อหลายช็อต…</span>${button('cancel', 'ยกเลิก', 'textbtn')}</div>` : ''}</div></section></main>`;
  }
  return page(`<h1>ยังไม่มีฉากที่บันทึกไว้</h1>${navButton('play', 'เลือกเรื่อง', 'btn primary')}`);
}

export function sheet(title, content) {
  return `<div class="sheet-head"><h2 id="dialogTitle">${esc(title)}</h2>${button('close-dialog', '×', 'iconbtn', 'aria-label="ปิดหน้าต่าง"')}</div>${content}`;
}
