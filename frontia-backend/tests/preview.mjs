// Static visual QA only: no backend, credentials, or browser storage is used.
// Run: node tests/preview.mjs /absolute/path/to/preview.html
import fs from 'node:fs/promises';
import { renderView } from '../../frontia/ui.mjs';
import { blankRecord } from '../../frontia/storage.mjs';
import { startStory } from '../../frontia/stories.mjs';
const css = await fs.readFile(new URL('../../frontia/styles.css', import.meta.url), 'utf8');
const record = blankRecord(); record.save.stories['ep-summer'] = startStory('ep-summer');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const cases = [['หน้าแรก · 320 px', 320, 'home'], ['อ่านนิยาย · 390 px', 390, 'player/ep-summer'], ['ตั้งค่า · 390 px', 390, 'settings']];
const frames = cases.map(([label, width, route]) => {
  const view = renderView({ record, route, busy: false, auth: null, models: [], cloud: 'บันทึกในเครื่องแล้ว', message: '', remember: false, updateReady: false, offline: false });
  return `<section><h2>${label}</h2><iframe title="${label}" width="${width}" height="830" srcdoc="${escape(`<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body><div id="app">${view}</div></body></html>`)}"></iframe></section>`;
}).join('');
if (!process.argv[2]) throw new Error('Provide an output HTML path');
await fs.writeFile(process.argv[2], `<!doctype html><html lang="th"><meta charset="utf-8"><title>Cinematic Play · Mobile layout QA</title><style>body{margin:20px;background:#101116;color:#f6e8c9;font:14px system-ui}.frames{display:flex;gap:18px}h1{font-size:20px}h2{font-size:14px;font-weight:500}iframe{border:1px solid #413c32;border-radius:18px}section{flex:none}</style><h1>Cinematic Play 0.6 · ตรวจเลย์เอาต์มือถือ (ข้อมูลตัวอย่าง)</h1><div class="frames">${frames}</div></html>`);
