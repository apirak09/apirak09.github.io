import { ACTIVE_EPISODE } from './shared.mjs';
import { CAST, CLUE_NAMES, EPISODES, PLACE_NAMES } from './stories.mjs';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dateText = time => new Date(time).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
const button = (action, label, className = 'btn', extra = '') => `<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`;
const navButton = (view, label, className = 'iconbtn', extra = '') => `<button type="button" class="${className}" data-nav="${view}" ${extra}>${label}</button>`;
const header = () => `<header class="top"><button class="brand brand-button" type="button" data-nav="home" aria-label="Cinematic Play หน้าแรก">cinematic<i>play</i></button><span class="top-caption">นิยายภาพโต้ตอบ · ภาษาไทย</span><div class="spacer"></div>${navButton('settings', '⚙', 'iconbtn', 'aria-label="ตั้งค่า"')}</header>`;
function tabs(active) {
  return `<nav class="tabs" aria-label="เมนูหลัก">${[['home', '⌂', 'หน้าแรก'], ['chat', '◌', 'แชต'], ['play', '▶', 'เรื่องของฉัน'], ['settings', '⚙', 'ตั้งค่า']].map(([view, icon, label]) => view === 'chat'
    ? `<button type="button" class="tab ${active === view ? 'on' : ''}" data-talk="${ACTIVE_EPISODE}" aria-label="เข้าไปอ่านและตอบในเรื่อง"><span aria-hidden="true">${icon}</span><small>${label}</small></button>`
    : navButton(view, `<span aria-hidden="true">${icon}</span><small>${label}</small>`, `tab ${active === view ? 'on' : ''}`, active === view ? 'aria-current="page"' : '')).join('')}</nav>`;
}
function storyRow(id, story) {
  const ep = EPISODES[id];
  const count = story && !story.deleted ? story.history.length : 0;
  return navButton(`episode/${id}`, `<span class="libart ${ep.theme}" aria-hidden="true"></span><span class="grow"><span class="rowtitle">${esc(ep.title)}</span><span class="rowsub">${count ? `${count} ฉาก · ${esc(story.scene.chapter)}` : 'ยังไม่ได้เริ่ม'}</span>${count ? `<span class="rowsub">บันทึก ${esc(dateText(story.updatedAt))}</span>` : ''}</span><span aria-hidden="true">›</span>`, 'library');
}
export function renderView(ctx) {
  const { record, route, busy, auth, models, cloud, message, remember, updateReady, offline, autoPlay, uiHidden } = ctx;
  const [view, id] = route.split('/');
  const ep = EPISODES[id];
  const stories = record.save.stories;
  const started = Object.keys(stories).filter(key => !stories[key].deleted).sort((a, b) => stories[b].updatedAt - stories[a].updatedAt);
  const notices = `${offline ? '<div class="notice">ออฟไลน์ · อ่านเรื่องที่บันทึกไว้ได้</div>' : ''}${record.migrationNotice ? `<div class="notice">${esc(record.migrationNotice)} ${button('dismiss-migration', 'รับทราบ', 'textbtn')}</div>` : ''}${updateReady ? `<div class="notice">มีเวอร์ชันใหม่พร้อมแล้ว ${button('update', 'อัปเดต', 'textbtn', busy ? 'disabled' : '')}</div>` : ''}${message ? `<div class="notice error" role="alert">${esc(message)} ${button('dismiss-message', 'ปิด', 'textbtn')}</div>` : ''}`;
  const page = (content, className = '') => `<main class="page ${className}" id="main" tabindex="-1">${header()}${notices}${content}</main>${tabs(view)}`;
  const saveStatus = `<span class="save-status" data-save-status role="status">${esc(cloud)}</span>`;

  if (view === 'home') {
    const current = stories[ACTIVE_EPISODE];
    const hasProgress = !!current && !current.deleted;
    const sceneCards = [
      ['platform', '01', 'ชานชาลาที่ 4'],
      ['control', '02', 'ห้องควบคุม'],
      ['tunnel', '03', 'ปากอุโมงค์'],
    ];
    return page(`
      <section class="home-portal" aria-labelledby="home-title">
        <div class="portal-art" aria-hidden="true">
          <img class="portal-character portal-support" src="./assets/midnight/tara-neutral.webp" alt="">
          <img class="portal-character portal-lead" src="./assets/midnight/mina-worried.webp" alt="">
          <img class="portal-character portal-elder" src="./assets/midnight/arun-neutral.webp" alt="">
        </div>
        <div class="portal-copy">
          <p class="portal-eyebrow"><span class="live-dot"></span> CINEMATIC PLAY · STORY 01</p>
          <span class="portal-badge">เรื่องต้นแบบ · เล่นได้แล้ว</span>
          <h1 id="home-title">สัญญาณ<br class="desktop-break">เที่ยงคืน</h1>
          <p class="portal-subtitle">${esc(EPISODES[ACTIVE_EPISODE].subtitle)}</p>
          <p class="portal-description">${esc(EPISODES[ACTIVE_EPISODE].description)}</p>
          <div class="portal-tags">${EPISODES[ACTIVE_EPISODE].tags.map(tag => `<span>${esc(tag)}</span>`).join('')}<span>นิยายภาพภาษาไทย</span></div>
          <div class="portal-actions">
            ${button('start', hasProgress ? 'อ่านต่อจากจุดที่ค้าง' : 'เริ่มอ่านเรื่องนี้', 'portal-cta', 'data-talk="ep-midnight"')}
            ${navButton('settings', record.settings.backendUrl ? 'การเชื่อมต่อ AI' : 'ตั้งค่า AI ภายหลัง', 'portal-secondary')}
          </div>
          <p class="portal-note">${hasProgress ? `บันทึกล่าสุด · ${esc(current.scene.chapter)} · ${current.history.length} ช่วง` : record.settings.backendUrl ? 'Backend ถูกตั้งค่าไว้แล้ว · ตรวจการเชื่อมต่อ AI ได้ในตั้งค่า' : 'เริ่มอ่านบทตัวอย่างได้ทันที แล้วเชื่อม AI ภายหลังเพื่อเล่นต่อ'}</p>
        </div>
        <aside class="portal-preview" aria-label="รูปแบบการเล่น">
          <div class="preview-top"><span>YOUR STORY, IN SCENES</span><span>00:17</span></div>
          <div class="preview-rule"></div>
          <div class="preview-stat"><strong>4–7</strong><span>ช็อตต่อการตอบหนึ่งครั้ง</span></div>
          <div class="preview-stat"><strong>01</strong><span>เรื่องต้นแบบ · ดำเนินต่อจากทางเลือกของคุณ</span></div>
          <div class="preview-bottom"><span class="preview-icon">✦</span><span>เปลี่ยนฉาก สีหน้า และสถานะ<br>ตามสิ่งที่คุณเลือก</span></div>
        </aside>
      </section>

      <section class="world-section" aria-labelledby="world-title">
        <div class="section-heading"><div><p class="section-kicker">INSIDE THE STORY</p><h2 id="world-title">สถานีที่ไม่มีในตาราง</h2></div><p>สามสถานที่ · เหตุการณ์เดียวที่ไม่ควรเกิดขึ้น</p></div>
        <div class="location-gallery">${sceneCards.map(([place, number, label]) => `<article class="location-card"><img src="./assets/midnight/${place}.webp" alt="" loading="lazy"><div class="location-shade"></div><span class="location-number">${number}</span><strong>${esc(label)}</strong></article>`).join('')}</div>
      </section>

      <div class="home-lower-grid">
        <section class="cast-section" aria-labelledby="cast-title">
          <div class="section-heading cast-heading"><div><p class="section-kicker">THE PEOPLE YOU'LL MEET</p><h2 id="cast-title">คนที่คุณจะพบ</h2></div><span class="cast-count">ตัวละครหลัก 03 คน</span></div>
          <div class="cast-grid">${Object.entries(CAST).map(([key, x], index) => `<article class="home-cast-card"><div class="cast-art cast-${key}"><img src="./assets/midnight/${key}-neutral.webp" alt="" loading="lazy"><span>0${index + 1}</span></div><div class="cast-copy"><strong>${esc(x.name)}</strong><span class="cast-role">${esc(x.role)}</span><p>${esc(x.description)}</p></div></article>`).join('')}</div>
        </section>
        <aside class="onboarding-card" aria-labelledby="onboarding-title">
          <p class="section-kicker">A STORY THAT RESPONDS</p><h2 id="onboarding-title">เริ่มต้นได้ง่าย ๆ</h2>
          <ol class="onboarding-steps"><li><span>01</span><div><strong>อ่านเป็นฉาก</strong><small>ตัวละครและอารมณ์เปลี่ยนไปตามเหตุการณ์</small></div></li><li><span>02</span><div><strong>เลือกหรือพิมพ์ตอบ</strong><small>การตัดสินใจของคุณเป็นส่วนหนึ่งของเรื่อง</small></div></li><li><span>03</span><div><strong>เรื่องดำเนินต่อ</strong><small>หนึ่งคำตอบสร้างบทสนทนาต่อเนื่องหลายช็อต</small></div></li></ol>
          <div class="onboarding-foot">${record.settings.backendUrl ? '<span class="setup-indicator ready"></span><span>ตั้งค่า Backend แล้ว · ตรวจการเชื่อมต่อได้ในตั้งค่า</span>' : '<span class="setup-indicator"></span><span>โหมดตัวอย่างพร้อมเล่น · เชื่อม AI เพิ่มได้ในตั้งค่า</span>'}</div>
        </aside>
      </div>
      <footer class="home-footer">${saveStatus}<span>เรื่องและตำแหน่งอ่านบันทึกอัตโนมัติ</span></footer>`, 'home-page');
  }

  if (view === 'play') return page(`<h1>เรื่องของฉัน</h1><p class="sub">ตอนนี้เล่นเรื่องสัญญาณเที่ยงคืนหนึ่งเรื่อง ฉากและตำแหน่งที่อ่านค้างจะบันทึกอัตโนมัติ</p>${saveStatus}${storyRow(ACTIVE_EPISODE, stories[ACTIVE_EPISODE])}${started.filter(key => key !== ACTIVE_EPISODE).length ? `<h2>บันทึกจากเวอร์ชันก่อน</h2><p class="hint">เปิดอ่านหรือสำรองเรื่องเดิมได้</p>${started.filter(key => key !== ACTIVE_EPISODE).map(key => storyRow(key, stories[key])).join('')}` : ''}`);

  if (view === 'chat') return page(`<h1>ตัวละครในเรื่อง</h1><section class="panel"><span class="accent">✦</span><h2>บทสนทนาอยู่ในฉาก</h2><p class="sub">อ่านเหตุการณ์และตอบตัวละครได้ในสัญญาณเที่ยงคืน ทุกครั้งที่คุณเลือกหรือพิมพ์ เรื่องจะดำเนินต่อเนื่องหลายช็อต</p>${button('start', stories[ACTIVE_EPISODE] && !stories[ACTIVE_EPISODE].deleted ? 'กลับเข้าไปอ่านต่อ' : 'เริ่มอ่านและพูดคุย', 'btn primary wide', `data-talk="${ACTIVE_EPISODE}"`)}</section><h2>คนในสถานี</h2>${Object.entries(CAST).map(([key, x]) => `<div class="cast-card"><img src="./assets/midnight/${key}-neutral.webp" alt="" loading="lazy"><div><strong>${esc(x.name)} · ${esc(x.role)}</strong><p>${esc(x.description)}</p></div></div>`).join('')}`);

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
      <h2 class="settingsGroup">ติดตั้งและเกี่ยวกับ</h2>${button('install', 'เพิ่มลงหน้าจอหลัก')}<p class="hint">Cinematic Play 0.7.2 · เปิดอ่านฉากภาพที่บันทึกไว้แบบออฟไลน์ได้ การสร้างฉาก AI ต้องมีอินเทอร์เน็ตและ Backend รุ่น 0.7 ที่เชื่อมแล้ว</p>`);
  }

  if (view === 'episode' && ep) {
    const startedStory = stories[id] && !stories[id].deleted;
    return `<main id="main" tabindex="-1"><div class="detailCover ${ep.theme}" aria-hidden="true"></div>${navButton('home', '←', 'iconbtn back', 'aria-label="กลับหน้าหลัก"')}<section class="detail">${notices}<span class="badge">${id === ACTIVE_EPISODE ? 'เรื่องต้นแบบ' : 'บันทึกเก่า'}</span><h1>${esc(ep.title)}</h1><p class="sub">${esc(ep.subtitle)}</p><div class="chips">${ep.tags.map(tag => `<span class="chip">${esc(tag)}</span>`).join('')}</div><p class="description">${esc(ep.description)}</p>${startedStory ? `<p class="sub">ฉากล่าสุด: ${esc(stories[id].scene.chapter)} · ${stories[id].history.length} ฉาก</p>` : ''}<p class="hint">${id !== ACTIVE_EPISODE ? 'เรื่องเดิมเปิดอ่านได้ แต่ช่วงนี้เน้นพัฒนาเรื่องต้นแบบเพียงเรื่องเดียว' : record.settings.backendUrl ? 'ดำเนินเรื่องผ่าน Backend ที่คุณตั้งค่าไว้' : 'เริ่มจากฉากตัวอย่างภาษาไทย · เชื่อม AI ได้ภายหลัง'}</p></section>${id === ACTIVE_EPISODE || startedStory ? button('start', startedStory ? 'อ่านต่อ' : 'เริ่มเรื่อง', 'bigcta') : navButton('home', 'กลับหน้าหลัก', 'bigcta')}</main>`;
  }

  if (view === 'player' && ep && stories[id] && !stories[id].deleted) {
    const story = stories[id], scene = story.scene;
    const previewEnded = !record.settings.backendUrl && story.history.length >= 3;
    const savedBeatIndex = story.beatIndex ?? 0;
    const beatIndex = ctx.reviewBeatIndex == null ? savedBeatIndex : Math.min(ctx.reviewBeatIndex, savedBeatIndex);
    const beat = scene.beats?.[beatIndex] || { text: scene.body, background: 'platform', actor: null, expression: 'neutral', companion: null, companionExpression: 'neutral' };
    const lastBeat = beatIndex >= (scene.beats?.length || 1) - 1;
    const reviewing = beatIndex < savedBeatIndex;
    const status = story.status || { minute: 17, clues: [], relationships: { mina: 0, tara: 0, arun: 0 } };
    const clock = `${String(Math.floor(status.minute / 60)).padStart(2, '0')}:${String(status.minute % 60).padStart(2, '0')}`;
    const expressions = { neutral: 'สงบ', warm: 'เป็นมิตร', worried: 'กังวล', resolved: 'มุ่งมั่น' };
    const portrait = (actor, expression, side) => actor ? `<img class="scene-portrait ${side}" src="./assets/midnight/${actor}-${expression}.webp" alt="${esc(CAST[actor].name)} สีหน้า${esc(expressions[expression])}" draggable="false">` : '';
    if (id !== ACTIVE_EPISODE) return `<main class="player archived" id="main" tabindex="-1"><div class="stageTop archive-top">${navButton('play', '←', 'iconbtn', 'aria-label="กลับเรื่องของฉัน"')}<span class="chapter">${esc(scene.chapter)}</span>${button('story-menu', '•••', 'iconbtn', 'aria-label="เมนูเรื่อง"')}</div><div class="storybody">${notices}<p class="demo-label">บันทึกจากเวอร์ชันก่อน · เปิดอ่านอย่างเดียว</p><h1>${esc(ep.title)}</h1><p class="sub">${esc(scene.location)}</p><p class="narrative">${esc(scene.body)}</p><div class="tools">${button('journal', '▤ บันทึก', 'tool')}${button('story-status', '◎ สถานะ', 'tool')}</div>${saveStatus}</div></main>`;
    const currentActor = beat.actor || beat.companion;
    const relationship = currentActor ? status.relationships[currentActor] : null;
    const signed = n => `${n > 0 ? '+' : ''}${n}`;
    const effects = scene.effects || {};
    const changes = !reviewing && lastBeat ? [
      effects.minutes ? `◷ ${signed(effects.minutes)} นาที` : '',
      effects.clue ? `◇ พบเบาะแส: ${CLUE_NAMES[effects.clue]}` : '',
      ...(effects.trust || []).filter(change => change.delta).map(change => `♡ ${CAST[change.actor].name} ${signed(change.delta)}`),
    ].filter(Boolean) : [];
    const controls = `<div class="scene-tools" role="group" aria-label="เครื่องมืออ่านเรื่อง">${button('journal', '▤ <span>บทสนทนา</span>', 'scene-tool', 'aria-label="ดูบทสนทนาที่อ่านแล้ว"')}${button('locations', '⌘ <span>สถานที่</span>', 'scene-tool', 'aria-label="ดูสถานที่ในเรื่อง"')}${button('story-status', '◎ <span>สถานะ</span>', 'scene-tool', 'aria-label="ดูสถานะเรื่อง"')}${button('hide-ui', '◫ <span>ดูภาพ</span>', 'scene-tool', 'aria-label="ซ่อน UI เพื่อดูภาพฉาก"')}${button('auto-play', `${autoPlay ? 'Ⅱ <span>หยุดอัตโนมัติ</span>' : '▷ <span>อัตโนมัติ</span>'}`, 'scene-tool', `aria-label="${autoPlay ? 'หยุดเล่นช็อตต่ออัตโนมัติ' : 'เล่นช็อตต่ออัตโนมัติ'}" aria-pressed="${!!autoPlay}"`)}</div>`;
    const choices = lastBeat && !reviewing && !previewEnded ? `<section class="scene-choice-tray" aria-label="ทางเลือกในเรื่อง"><div class="choice-header"><strong>คุณจะทำอย่างไรต่อ?</strong><small>เลือกหนึ่งข้อหรือพิมพ์ด้านล่าง</small></div><div class="story-choices">${scene.choices.map((choice, i) => `<button class="choice" type="button" data-choice="${i}" ${busy ? 'disabled' : ''}><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="grow">${esc(choice.label)}</span><span aria-hidden="true">↗</span></button>`).join('')}</div></section>` : '';
    const reply = lastBeat && !reviewing ? previewEnded
      ? `<div class="preview-end"><h2>จบบทตัวอย่าง</h2><p>เรื่องที่บันทึกไว้อ่านซ้ำได้ เชื่อม AI เพื่อดำเนินเรื่องจากตรงนี้</p>${navButton('settings', 'ตั้งค่าการเชื่อมต่อ AI ›', 'preview-connect')}</div>`
      : `<label class="sr-only" for="freeText">สิ่งที่อยากพูดหรือทำ</label><div class="reply"><textarea id="freeText" maxlength="4000" rows="1" placeholder="หรือพิมพ์สิ่งที่คุณอยากพูดหรือทำ…" ${busy ? 'disabled' : ''}>${esc(record.drafts[id] || '')}</textarea>${button('send', '↑', 'send', `aria-label="ส่งข้อความ" ${busy ? 'disabled' : ''}`)}</div><p class="input-hint">หนึ่งคำตอบสร้างเรื่องต่อหลายช็อต · Ctrl/⌘ + Enter เพื่อส่ง</p>`
      : `<div class="beat-navigation"><span>${reviewing ? 'กำลังย้อนอ่าน · ตำแหน่งล่าสุดยังบันทึกอยู่' : 'แตะอ่านต่อเพื่อเปิดช็อตถัดไป'}</span>${button('next-beat', 'อ่านต่อ <span aria-hidden="true">›</span>', 'beat-next', 'aria-label="อ่านช็อตถัดไป"')}</div>`;
    return `<main class="player cinematic-player" id="main" tabindex="-1"><div class="cinematic-stage ${lastBeat && !reviewing ? 'awaiting-reply' : 'reading-beat'} ${beat.actor ? `dialogue-${beat.actor}` : 'dialogue-narrator'} ${uiHidden ? 'ui-hidden' : ''}" style="--scene-bg:url('./assets/midnight/${beat.background}.webp')" aria-label="${esc(PLACE_NAMES[beat.background])}">
      <div class="stageTop">${navButton('play', '←', 'iconbtn', 'aria-label="กลับเรื่องของฉัน"')}<span class="chapter">${esc(scene.chapter)}</span><div class="stage-actions">${controls}${button('story-menu', '•••', 'iconbtn', 'aria-label="เมนูเรื่อง"')}</div></div>
      <div class="scene-hud">${button('story-status', `◷ <strong>${clock}</strong>`, 'hud-chip', 'aria-label="ดูสถานะ เวลาในเรื่อง"')}${button('story-status', `◇ <strong>${status.clues.length}</strong> เบาะแส`, 'hud-chip', 'aria-label="ดูสถานะและเบาะแส"')}${currentActor ? button('story-status', `♡ <strong>${esc(CAST[currentActor].name)}</strong> ${signed(relationship)}`, 'hud-chip', 'aria-label="ดูความสัมพันธ์กับตัวละคร"') : ''}</div>
      <div class="scene-location"><span class="location-mark" aria-hidden="true"></span>${esc(PLACE_NAMES[beat.background])}</div>
      <div class="portraits ${beat.companion ? 'pair' : ''}">${portrait(beat.companion, beat.companionExpression, 'support')}${portrait(beat.actor, beat.expression, 'lead')}</div>
      <div class="scene-notices">${notices}</div>
      <div class="scene-readout"><div class="readout-head"><span>ช่วงที่ ${story.history.length} <span aria-hidden="true">/</span> ${esc(ep.title)}</span><span>${!record.settings.backendUrl ? 'บทตัวอย่าง' : 'เรื่องของคุณ'}</span></div><div class="readout-track" role="progressbar" aria-label="ความคืบหน้าของช่วงนี้" aria-valuemin="0" aria-valuemax="${scene.beats?.length || 1}" aria-valuenow="${beatIndex + 1}"><span style="width:${(beatIndex + 1) / (scene.beats?.length || 1) * 100}%"></span></div></div>
      ${choices}
      <section class="visual-dialogue" aria-label="เนื้อเรื่องและการตอบ" tabindex="-1"><div class="dialogue-inner"><div class="dialogue-top"><div class="beat-progress">ช็อต ${beatIndex + 1}/${scene.beats?.length || 1}</div><div class="dialogue-utilities">${beatIndex > 0 ? button('previous-beat', '‹ ก่อนหน้า', 'previous-beat', 'aria-label="ย้อนอ่านช็อตก่อนหน้า"') : ''}${saveStatus}</div></div>
        <div class="story-line" aria-live="polite"><div class="speaker">${esc(beat.actor ? CAST[beat.actor].name : 'เรื่องราว')}<span>${esc(beat.actor ? CAST[beat.actor].role : PLACE_NAMES[beat.background])}</span></div><p class="beat-text">${esc(beat.text)}</p></div>
        ${changes.length ? `<div class="scene-effects" aria-label="ผลจากช่วงนี้">${changes.map(change => `<span>${esc(change)}</span>`).join('')}</div>` : ''}
        ${busy ? `<div class="generation" role="status"><span class="spinner" aria-hidden="true"></span><span>กำลังสร้างเรื่องต่อหลายช็อต…</span>${button('cancel', 'ยกเลิก', 'textbtn')}</div>` : ''}${reply}
        </div></section>${uiHidden ? button('show-ui', 'แตะเพื่อแสดง UI', 'show-scene-ui', 'aria-label="แสดง UI ของฉาก"') : ''}
    </div></main>`;
  }
  return page(`<h1>ยังไม่มีฉากที่บันทึกไว้</h1>${navButton('play', 'เลือกเรื่อง', 'btn primary')}`);
}

export function sheet(title, content) {
  return `<div class="sheet-head"><h2 id="dialogTitle">${esc(title)}</h2>${button('close-dialog', '×', 'iconbtn', 'aria-label="ปิดหน้าต่าง"')}</div>${content}`;
}
