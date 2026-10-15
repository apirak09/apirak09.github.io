'use strict';
// Hand-drawn vector costumes. Run from any directory; generated assets are committed.
const fs = require('node:fs');
const path = require('node:path');
const { SKINS } = require('../club.js');
const out = path.resolve(__dirname, '../assets/skins');
fs.mkdirSync(out, { recursive: true });
const palettes = {
  mint: ['#b9ffe0', '#55d8a8', '#188f80', '#e9fff0', '#f6bf51'],
  rose: ['#ffd6e4', '#f18eae', '#ba4879', '#ffe9d4', '#ffad4f'],
  ice: ['#c9f3ff', '#65bdf2', '#276abc', '#ecfbff', '#ffc75c'],
  prism: ['#fff7c7', '#caa1fd', '#7857c9', '#f5eeff', '#ffbc61'],
  aurora: ['#a3ffe1', '#43bfca', '#6241a8', '#b9f8e9', '#9be9e2'],
  neon: ['#7a5aaa', '#342258', '#17172f', '#6651a0', '#80f8ff'],
  batman: ['#64778c', '#334157', '#141d32', '#505970', '#eac35c'],
  spiderman: ['#ff8b79', '#e4424e', '#9e1f3e', '#1d67b0', '#f1bc60'],
  superman: ['#83d9ff', '#238bcc', '#12519b', '#288dca', '#fac96b'],
  captain: ['#86b5ef', '#416eaf', '#22395c', '#f2f3e4', '#f5bd59'],
  ironman: ['#ffbd84', '#be363f', '#67223b', '#d64749', '#f5ce7a'],
  thor: ['#dee8ff', '#7185a4', '#344462', '#3d4c69', '#f6ce86'],
  panther: ['#665f83', '#26253c', '#101827', '#303044', '#9c95c7'],
  strange: ['#73a9d7', '#285a8d', '#172c4b', '#244d78', '#e7b968']
};
const line = '#101f3b';
const star = (x, y, size, fill = '#fff3cf') => `<path d="M${x} ${y-size}l${size*.29} ${size*.66} ${size*.71} ${size*.1}-${size*.52} ${size*.5} ${size*.12} ${size*.74}-${size*.6}-${size*.35}-${size*.6} ${size*.35} ${size*.12}-${size*.74}-${size*.52}-${size*.5} ${size*.71}-${size*.1}Z" fill="${fill}"/>`;
function costume(id) {
  let back = '', suit = '', crest = '', wing = '', mask = '', eye = '', finish = '';
  const cape = color => `<path d="M51 38C29 40 19 52 11 74L5 106l18-7 2 14 16-12 9 13 12-22Z" fill="${color}" stroke="${line}" stroke-width="3"/><path d="M33 51 16 97m24-44-9 47m14-39-4 38" fill="none" stroke="#ffffff30" stroke-width="2"/>`;
  if (id === 'prism') {
    suit = `<path d="M26 70Q51 99 102 61" fill="none" stroke="url(#rainbow)" stroke-width="35" opacity=".68" clip-path="url(#body-clip)"/>`;
    finish = star(61, 39, 6) + star(72, 91, 4) + star(26, 64, 3) + `<path d="m34 83 8-11 10 12 14-19" fill="none" stroke="#ffffffaa" stroke-width="1.3"/>`;
  }
  if (id === 'aurora') {
    suit = `<path d="M34 34Q51 61 39 96M48 30Q72 65 55 112M61 33Q90 65 72 111" fill="none" stroke="#b9ffe88c" stroke-width="2" clip-path="url(#body-clip)"/>`;
    crest = `<path d="M57 17a9 9 0 1 0 14 10 10 10 0 0 1-14-10" fill="#cefff0" stroke="#308792" stroke-width="1.5"/>`;
    finish = star(35, 61, 4, '#b0fff0') + star(73, 97, 3, '#cdf9ff');
  }
  if (id === 'neon') {
    suit = `<path d="M27 53Q24 93 57 110m-18-65q-10 25 6 38m13 10 20-5" fill="none" stroke="#61f8f0" stroke-width="2.4" clip-path="url(#body-clip)"/><path d="m34 46 6-8 10 2m-20 61 7 5m21 7 15-3" fill="none" stroke="#ff84e9" stroke-width="2"/>`;
    finish = `<path d="m33 73 13-7-1 10 14-6-12 16 1-11-15 6" fill="#76fff5"/><path d="M77 35q22-5 31 16" fill="none" stroke="#fc8dff" stroke-width="2"/>`;
  }
  if (id === 'batman') {
    back = cape('#172333');
    crest = `<path d="m61 41 1-30 15 22 17-3 13-17 3 36Z" fill="#28354a" stroke="${line}" stroke-width="3"/><path d="m66 27 2-9 5 11m28 2 5-11-1 14" fill="none" stroke="#8191a3" stroke-width="1.4"/>`;
    suit = `<path d="M31 96Q62 109 101 91l-2 10q-35 19-67 6" fill="#dfb94f" stroke="${line}" stroke-width="2"/><path d="M40 99v10m12-8v12m13-12v12m13-13v10m12-14v10" stroke="#826431" stroke-width="2"/><rect x="60" y="99" width="12" height="11" rx="2" fill="#ffdb6e" stroke="#a17c36" stroke-width="1.5"/>`;
    mask = `<path d="M68 38q35-17 44 20l-5 22-15-7-13 11-16-18Z" fill="#263449" stroke="${line}" stroke-width="2.8"/>`;
    eye = `<path d="m82 52 23-4-6 13-15 3Z" fill="#e6f5ff" stroke="#0b182c" stroke-width="2"/>`;
    wing = `<path d="M28 70q18-17 33 0l5 18-10-3-5 7-7-7-8 5-6-9-8-1Z" fill="#28364c" stroke="${line}" stroke-width="2.5"/><ellipse cx="61" cy="87" rx="15" ry="9" fill="#e2be59" stroke="#9c8139" stroke-width="1"/><path d="m47 83 8 3 3-5 3 3 3-3 3 5 8-3-4 7-6-1-4 5-4-5-6 1Z" fill="#182438"/>`;
  }
  if (id === 'spiderman') {
    suit = `<path d="M28 80q21 8 47-1l30 12-15 23-46 3-17-18Z" fill="#2264ad" stroke="${line}" stroke-width="2"/><path d="M32 103q18 1 35-4l18-12 13 5-7 17-24 9-29-5Z" fill="#e54150"/>`;
    mask = `<path d="M62 40q19-18 40-1l13 26-15 18-34-10Z" fill="#e94a51" stroke="${line}" stroke-width="2"/><g fill="none" stroke="#801f3c" stroke-width="1.3"><path d="m85 39 1 40m-24-24 46 9M70 39l31 34m-5-39L73 75M65 48q24 4 38-7M64 61q24 2 47-10m-40 19q20 1 40-7M77 37q-5 23 8 40m8-43q-4 20 11 36"/></g>`;
    eye = `<path d="m77 48 27-5q6 18-12 27-15-1-15-22Z" fill="#f0fbff" stroke="#122842" stroke-width="3"/><path d="m83 51 14-4" stroke="#c4e2f7" stroke-width="2"/>`;
    wing = `<path d="M29 69q22-12 35 2l-8 22-23-2-11-10Z" fill="#e94752" stroke="${line}" stroke-width="2.5"/><path d="m29 69 27 24m-34-12 40-7m-26-9 3 27m13-26-7 26m-16-18q13 7 28-2m-26 12q14 7 29-1" fill="none" stroke="#801e3d" stroke-width="1.1"/>`;
    finish = `<path d="M75 91v17m-7-13 7 4 7-4m-14 7 7-2 8 3m-15-9 1-4 6 7 6-7 2 4m-14 10-2 6m15-6 2 5" fill="none" stroke="#111e39" stroke-width="1.8"/><ellipse cx="75" cy="100" rx="3" ry="5" fill="#111e39"/>`;
  }
  if (id === 'superman') {
    back = cape('#c72d42');
    crest = `<path d="M66 36q2-19 24-15l11 9-18 3q6 11-5 16 2-10-12-13Z" fill="#172e4e" stroke="${line}" stroke-width="2"/><path d="M79 25q12 0 16 6" fill="none" stroke="#4b6179" stroke-width="1.5"/>`;
    suit = `<path d="M28 102q31 10 69-4l-3 10q-31 17-63 5Z" fill="#e9bd52" stroke="#86633c" stroke-width="2"/><path d="m51 72 19-3 20 9-17 22-24-19Z" fill="#eabc47" stroke="#153552" stroke-width="2.2"/><path d="m55 77 16-4 12 5-13 17-16-14Z" fill="#ce3440"/><path d="m76 77-11-1-5 5 14 1-6 7-9-3" fill="none" stroke="#ffe370" stroke-width="3.2"/>`;
    wing = `<path d="M23 70q17-13 31 0l8 9-15 10-14-1-10-9Z" fill="#2387c5" stroke="${line}" stroke-width="2.5"/><path d="m28 77 15 2 9-4m-18 9 12-1" fill="none" stroke="#85d1ee" stroke-width="1.7"/>`;
  }
  if (id === 'captain') {
    crest = `<path d="m67 37-14-16 2 16-12-6 9 15 16 3m33-10 13-14 1 15 9-4-7 14-14 1" fill="#e5edf4" stroke="#283a56" stroke-width="2"/><path d="m58 29 6 14m50-9-7 10" stroke="#8e9eb3" stroke-width="1.4"/>`;
    mask = `<path d="M62 37q25-19 43 6l8 24-13 10-22-6-14-13Z" fill="#416eae" stroke="${line}" stroke-width="2.5"/><path d="m78 44 5-15 6 1 5 13-5 2-1-4-6 1-1 4Zm6-7 4-1-2-4Z" fill="#f5f9ef"/><path d="M67 43q9-12 21-12" fill="none" stroke="#abcdf5" stroke-width="1.3"/>`;
    eye = `<path d="m82 50 21-3 2 13-17 6Z" fill="#f0fcff" stroke="#1c2b49" stroke-width="2"/><ellipse cx="96" cy="55" rx="4" ry="6" fill="#223750"/><circle cx="97" cy="52" r="1.6" fill="#fff"/>`;
    suit = `<path d="M42 96v18m11-20v23m12-24v23m11-23v20m12-25v19" stroke="#bc3b50" stroke-width="7" clip-path="url(#body-clip)"/>` + star(73, 87, 11, '#edf5ef');
    wing = `<circle cx="39" cy="81" r="22" fill="#bf364c" stroke="${line}" stroke-width="2.6"/><circle cx="39" cy="81" r="17" fill="#e9eceb" stroke="#ffffff8a"/><circle cx="39" cy="81" r="12" fill="#bc384e"/><circle cx="39" cy="81" r="8" fill="#29588d"/>${star(39, 81, 7, '#f3f9ed')}<path d="M22 76q5-13 17-13" fill="none" stroke="#ffb9ab" stroke-width="1.6"/>`;
  }
  if (id === 'ironman') {
    crest = `<path d="M58 36 65 18l20-4 20 12 8 19-16 8-29-6Z" fill="url(#metal)" stroke="#4b2639" stroke-width="2.5"/><path d="m66 23 16-4 14 7-4 13-17-1Z" fill="#b83c45" stroke="#74303b" stroke-width="1.5"/>`;
    mask = `<path d="m65 40 14-7 24 7 10 21-6 19-15 8-21-13-10-20Z" fill="url(#gold)" stroke="#542d3d" stroke-width="2.5"/><path d="m70 43 6 12-3 15 19 10 10-8 4-16-8-11m-22 13 20 2m-18 12 16 2" fill="none" stroke="#a36c35" stroke-width="1.6"/><path d="m72 45 8-5 17 6" fill="none" stroke="#ffeda7" stroke-width="1.5"/>`;
    eye = `<path d="m78 52 25 4-4 7-20-4Z" fill="#7bf7ff" stroke="#207b94" stroke-width="1.5"/><path d="m82 55 17 3" stroke="#e9ffff" stroke-width="2"/>`;
    suit = `<path d="M29 88 47 83l16 10 15-4 23 8-8 17-20 7-23-3-18-12Z" fill="url(#metal)" stroke="#61273d" stroke-width="2"/><path d="m43 88 3 18 15 8m16-20-3 19 14-4m-22-14-1 24M30 95l12 3m39 3 16 2" fill="none" stroke="#f7b36b" stroke-width="1.2"/><circle cx="72" cy="94" r="10" fill="#e4ad5b" stroke="#6c3540" stroke-width="2"/><circle cx="72" cy="94" r="6.4" fill="#58dff0" stroke="#d9ffff" stroke-width="2"/><circle cx="72" cy="94" r="3" fill="#e9ffff"/>`;
    wing = `<path d="M22 69 35 60l18 9 6 15-11 12-19-6-10-10Z" fill="url(#metal)" stroke="#4d293b" stroke-width="2.6"/><path d="m25 72 10-6 11 7-3 17m-17-10 22 2m-14-15-3 20" fill="none" stroke="#f5b46f" stroke-width="1.3"/><circle cx="40" cy="79" r="7" fill="url(#gold)" stroke="#74333c" stroke-width="1.7"/><circle cx="40" cy="79" r="4" fill="#9bffff" stroke="#e9ffff" stroke-width="1.3"/>`;
    finish = `<path d="m55 43-4 8m-9 48 10 5m39-13 9 2" stroke="#ffdd9b" stroke-width="1.2"/><circle cx="33" cy="70" r="1.2" fill="#fff1ae"/><circle cx="51" cy="85" r="1.2" fill="#fff1ae"/>`;
  }
  if (id === 'thor') {
    back = cape('#b52c45');
    crest = `<path d="M61 44 65 23l16-9 19 9 10 21-15 10Z" fill="url(#silver)" stroke="#32425f" stroke-width="2.5"/><path d="m81 17 1 31m-13-20 27 0m-30 8 38 1" fill="none" stroke="#566b89" stroke-width="1.4"/><path d="m67 33-22-17 1 10 16 15-22-8 10 15 16 3m38-18 18-15 1 11-16 14 18-7-8 14-14 1" fill="#d6e2f2" stroke="#445877" stroke-width="2"/><path d="m49 24 13 12m56-10-10 12" stroke="#fff" stroke-width="1.3"/>`;
    mask = `<path d="M76 42q20-2 28 12l3 21-17 6-19-11Z" fill="#f3d2a3" stroke="#77627b" stroke-width="2"/><path d="m68 48 9 25-6 9-10-20m43-11 4 25-9 8-1-12" fill="#d4ac53" stroke="#8b6b48" stroke-width="1.5"/>`;
    eye = `<path d="m81 55 18-2-2 8-14 2Z" fill="#e2f7ff" stroke="#435579" stroke-width="1.5"/><path d="m87 56 9-1" stroke="#4cb9f0" stroke-width="2.3"/>`;
    suit = `<path d="M41 81 61 77l34 8 4 18-22 17-31-6-17-17Z" fill="#273e5c" stroke="#15293f" stroke-width="2"/><path d="m57 80 2 30m18-25-4 30M39 102l45 4" fill="none" stroke="#a1b7cb" stroke-width="2"/>${[[48,86],[73,88],[48,100],[72,102],[52,112],[72,113]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5.5" fill="url(#silver)" stroke="#425b79" stroke-width="1.3"/><circle cx="${x-1}" cy="${y-1}" r="2.5" fill="#e2ebf3"/>`).join('')}`;
    wing = `<path d="m31 83 13-2 11 12-9 7-16-8Z" fill="#b7c9d7" stroke="#2c405a" stroke-width="2"/><path d="m30 87 18-30" stroke="#613c34" stroke-width="7"/><path d="m30 87 18-30" stroke="#ba9065" stroke-width="2.5"/><path d="m33 50 26 3 1 21-28-3-4-7Z" fill="url(#silver)" stroke="#34465d" stroke-width="2.5"/><path d="m33 55 20 2v12l-17-2m20-13 4 4-1 12" fill="none" stroke="#edf5ff" stroke-width="1.4"/><path d="M31 90q-15 10-10 16 9 3 12-13" fill="none" stroke="#694438" stroke-width="2"/>`;
    finish = `<path d="m24 52-6 12 7-2-6 18m37-36 7 7-6-1 8 11" fill="none" stroke="#b5efff" stroke-width="1.7"/>`;
  }
  if (id === 'panther') {
    crest = `<path d="m63 43 2-25 15 13 17-1 12-12 1 30Z" fill="#29283f" stroke="#111d30" stroke-width="2.5"/><path d="m68 27 1 11 8-4m27-8-2 10-5-2" fill="none" stroke="#b7add6" stroke-width="1.4"/>`;
    mask = `<path d="m67 38 17-6 22 8 8 21-9 18-14 9-23-17-7-21Z" fill="#24263a" stroke="#111b2f" stroke-width="2.8"/><path d="m85 35 3 16-8 14 9 15m14-39-9 13 9 14-9 14M66 46l9 7-7 10m40-13-8 3 10 10" fill="none" stroke="#aaa6ba" stroke-width="1.35"/><path d="m89 39 2 9m-18 23 9 5m22-7-6 6" stroke="#bf7aff" stroke-width="1.5"/>`;
    eye = `<path d="m78 53 11 3-3 6-9-3m16-3 13-5-3 8-9 3Z" fill="#dce6ff" stroke="#6d5c8c" stroke-width="1"/>`;
    suit = `<path d="M39 80q30 19 58-1l4 14q-27 21-62 1Z" fill="#171e31" stroke="#7d7098" stroke-width="1.4"/><path d="m44 87 4 13 5-11 5 14 5-11 6 13 5-13 7 9 2-14 8 6 2-12" fill="#b5b4cb" stroke="#eee4fa" stroke-width=".7"/><path d="m37 101 14 6 7 12m39-23-11 11-7 10m-16-14 4 10m-22-55-7 10" fill="none" stroke="#a46ae8" stroke-width="1.7"/><path d="m50 109 8-1m23 0 8-4" stroke="#d59bff" stroke-width="1.1"/>`;
    wing = `<path d="M25 70q19-12 34 2l2 14-16 9-16-5-9-10Z" fill="#303045" stroke="#111a2d" stroke-width="2.4"/><path d="m29 75 12-4 11 5-10 12-13-7m13-10 1 13" fill="none" stroke="#9671b4" stroke-width="1.3"/><path d="m45 89 6 8m-14-7 6 10m-13-12 4 10" stroke="#d5d7e1" stroke-width="2.1"/>`;
  }
  if (id === 'strange') {
    back = cape('#aa3447') + `<path d="m52 49-7-23 16 10 12 20m23-13 9-19 9 14-4 27" fill="#b74250" stroke="#4c2b40" stroke-width="2.4"/><path d="m48 32 10 12m48-12 2 15" stroke="#e4a15a" stroke-width="1.3"/>`;
    crest = `<path d="M63 37q8-22 29-15l13 12-16 1-5 11-10-8Z" fill="#293649" stroke="#17243d" stroke-width="2"/><path d="m67 31 7-4m23 1 5 7" stroke="#c5c3c4" stroke-width="3"/>`;
    mask = `<path d="M72 43q22-9 33 12l3 16-17 15-19-13Z" fill="#efc8a0" stroke="#8e695c" stroke-width="1.8"/><path d="m77 72 10 4 3-4 9 1-4 11-9 4-9-8" fill="#4c3e41"/><path d="m84 72 4-2 6 2" fill="none" stroke="#3b3340" stroke-width="2"/>`;
    eye = `<path d="m82 52 19-1-4 11-13-1Z" fill="#fbf6e3" stroke="#423f53" stroke-width="1.4"/><ellipse cx="94" cy="55" rx="3.4" ry="4.6" fill="#377879"/><circle cx="95" cy="54" r="1.2" fill="#fff"/><path d="m81 48 17-1" stroke="#473f4b" stroke-width="2"/>`;
    suit = `<path d="m45 74 19 10 13-3 16 11-4 21-21 8-27-11Z" fill="#244c76" stroke="#142d4c" stroke-width="2"/><path d="m55 82 9 9-8 23m21-28-5 33m-30-14 48 1m-44-7 40 1" fill="none" stroke="#6694ae" stroke-width="1.3"/><path d="M49 70q18 17 40 9" fill="none" stroke="#ddb457" stroke-width="2.5"/><path d="m76 85 12 5-12 8-10-7Z" fill="url(#gold)" stroke="#70572e" stroke-width="1.5"/><ellipse cx="77" cy="91" rx="5" ry="3.5" fill="#65b985" stroke="#d6ec9d" stroke-width="1"/><circle cx="77" cy="91" r="1.8" fill="#d3ffbc"/>`;
    wing = `<path d="M24 75q18-15 32 0l1 16-20 6-15-12Z" fill="#255c84" stroke="#182d49" stroke-width="2.5"/><circle cx="39" cy="79" r="21" fill="#f3922022" stroke="#eaa03d" stroke-width="1.6"/><circle cx="39" cy="79" r="17" fill="none" stroke="#ffce69" stroke-width="1" stroke-dasharray="3 2"/><circle cx="39" cy="79" r="13" fill="#cc762523" stroke="#efa342" stroke-width="1.1"/><path d="m39 63 14 24-28 0Zm-13 7 26 0-13 24Z" fill="none" stroke="#ffcc72" stroke-width="1"/><circle cx="39" cy="79" r="4" fill="none" stroke="#ffe4a0" stroke-width="1.4"/>`;
    finish = `<path d="M12 99q12-3 18-15m-12 13 3-9m-8 7 4-10" fill="none" stroke="#e8ab64" stroke-width="1"/>`;
  }
  return { back, suit, crest, wing, mask, eye, finish };
}
for (const skin of SKINS.filter(skin => skin.id !== 'classic')) {
  const [light, mid, dark, belly, beak] = palettes[skin.id];
  const c = costume(skin.id);
  const body = 'M36 44C45 30 63 26 80 29c21 2 34 18 36 38 3 25-16 47-42 51-24 4-49-7-55-29-5-17 1-32 17-45Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="-3 -3 139 139"><title>${skin.name}</title><defs>
  <linearGradient id="coat" x1=".2" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="${light}"/><stop offset=".48" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
  <linearGradient id="belly" x2=".2" y2="1"><stop stop-color="${belly}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
  <linearGradient id="gold" x2=".3" y2="1"><stop stop-color="#fff2ad"/><stop offset=".4" stop-color="#eac26b"/><stop offset="1" stop-color="#ab753b"/></linearGradient>
  <linearGradient id="silver" x2=".7" y2="1"><stop stop-color="#f3faff"/><stop offset=".38" stop-color="#b3c9dc"/><stop offset=".65" stop-color="#6f87a3"/><stop offset="1" stop-color="#d8e6ed"/></linearGradient>
  <linearGradient id="metal" x2=".45" y2="1"><stop stop-color="#f37c60"/><stop offset=".42" stop-color="#ba3542"/><stop offset="1" stop-color="#6d2136"/></linearGradient>
  <linearGradient id="rainbow" x2=".6" y2="1"><stop stop-color="#ff969e"/><stop offset=".2" stop-color="#ffdf7d"/><stop offset=".4" stop-color="#9bf2c0"/><stop offset=".6" stop-color="#6cd9ee"/><stop offset=".8" stop-color="#a7a5ff"/><stop offset="1" stop-color="#f08ddc"/></linearGradient>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".85"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="body-clip"><path d="${body}"/></clipPath></defs>
  <g stroke-linejoin="round" stroke-linecap="round">${c.back}
  <path d="M22 76Q7 64 4 75l14 11C2 79 1 91 12 96l15-3" fill="${dark}" stroke="${line}" stroke-width="3.2"/>
  <path d="M59 35Q47 19 52 15q12-2 22 12Q59 7 66 7q15 0 24 24" fill="${light}" stroke="${line}" stroke-width="3.2"/>
  <path d="${body}" fill="${skin.id === 'prism' ? 'url(#rainbow)' : 'url(#coat)'}" stroke="${line}" stroke-width="3.3"/>
  <path d="M29 91q29 15 56-4 11-8 21-3-7 23-32 29-30 6-45-13Z" fill="url(#belly)"/>
  <path d="M38 46q13-12 31-12M25 63l4-6" fill="none" stroke="${light}" stroke-width="3.2" opacity=".8"/>
  ${c.suit}${c.crest}${c.mask}
  ${c.eye || `<ellipse cx="91" cy="57" rx="17" ry="22" fill="#eff8ff" stroke="${line}" stroke-width="3"/><ellipse cx="95" cy="58" rx="8.5" ry="13" fill="${line}"/><ellipse cx="98" cy="52" rx="3.8" ry="5" fill="#fff"/><path d="M79 47q3-6 7-7" fill="none" stroke="#fff" stroke-width="2"/>`}
  <path d="M109 72q14-7 20 2 1 5-12 10l11 3q1 7-13 9l-11-9 1-9Z" fill="${beak}" stroke="${line}" stroke-width="2.8"/><path d="m107 83 18-6-9 9 11 2-13 3" fill="#bd592e" opacity=".8"/><path d="m111 75 10-1" fill="none" stroke="#fff0b0" stroke-width="2"/>
  ${c.wing || `<path d="M35 65Q17 53 20 64l13 12Q16 65 18 77q3 9 15 10-13-4-9 5 8 11 27 4 15-7 10-19-9-12-26-12Z" fill="${skin.id === 'prism' ? 'url(#rainbow)' : 'url(#coat)'}" stroke="${line}" stroke-width="2.8"/><path d="M28 67q15 4 24 15m-26-4 18 9m-14 4 11 1" fill="none" stroke="${light}" stroke-width="2.2"/>`}
  ${skin.category === 'glow' ? `<g filter="url(#glow)">${c.finish}</g>` : c.finish}</g></svg>`;
  fs.writeFileSync(path.join(out, `${skin.id}.svg`), svg.replace(/[ \t]+$/gm, '') + '\n');
}
console.log(`Built ${SKINS.length - 1} bird costumes.`);
