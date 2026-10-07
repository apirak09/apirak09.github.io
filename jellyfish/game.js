/* Jelly: Reborn — a dependency-free, side-view ocean RPG. */
const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
const mini = $('minimap').getContext('2d');
const TAU = Math.PI * 2, T = 24, COLS = 264, ROWS = 112;
const WORLD_W = COLS * T, WORLD_H = ROWS * T, LIFE = 480;
const SAVE_KEY = 'apirak-jelly-reborn-v1';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = (v) => `${Math.floor(Math.max(0, v) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, v) % 60).toString().padStart(2, '0')}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
document.body.classList.toggle('is-touch', touch);
let W = 1200, H = 640, mode = 'title', time = 0, tick = 0, last = 0;
let camera = { x: 0, y: 0 }, shake = 0, menu = null, uiTime = 0, saveTime = 0;
let input = { keys: new Set(), joyX: 0, joyY: 0, attack: false, pointer: false, mx: 0, my: 0, dx: 1, dy: 0 };
let state, player, boss, enemies = [], drops = [], shots = [], particles = [], labels = [], ripples = [];
let nearest = null, lastBiome = -1, deaths = 0, kills = 0, noticeTimer, areaTimer, audio = null, sound = false;
let tiles = new Uint8Array(COLS * ROWS), floors = new Int16Array(COLS);
const zones = [
  { name: 'สวนปะการัง', en: 'CORAL GARDEN', from: 0, to: 77, sky: '#236574', deep: '#103a47', rock: '#1c4550', top: '#43836b', accent: '#ffc397', plants: '#86ad75' },
  { name: 'ป่าสาหร่าย', en: 'KELP FOREST', from: 77, to: 145, sky: '#144652', deep: '#0d2c39', rock: '#143942', top: '#347167', accent: '#c2dda2', plants: '#62997b' },
  { name: 'ซากนครจม', en: 'DROWNED CITY', from: 145, to: 207, sky: '#22364d', deep: '#142135', rock: '#243b53', top: '#52747f', accent: '#a9bcdd', plants: '#7ea5b6' },
  { name: 'ร่องลึกนิรันดร์', en: 'ETERNAL TRENCH', from: 207, to: COLS, sky: '#202539', deep: '#12162a', rock: '#282e46', top: '#696072', accent: '#e5a2b2', plants: '#9979a8' }
];
const stageDefs = [
  { name: 'ตัวอ่อน', en: 'PLANULA', end: 35, icon: '◌', hp: 75, speed: 175, damage: .8, radius: 11, color: '#c6f0d7', desc: 'ตัวเล็ก ว่ายคล่อง แต่พลังโจมตียังน้อย' },
  { name: 'โพลิป', en: 'POLYP', end: 70, icon: '✣', hp: 90, speed: 135, damage: .95, radius: 13, color: '#f4d7b0', desc: 'ว่ายช้าลง ฟื้นพลังงานได้เร็ว' },
  { name: 'เอไฟรา', en: 'EPHYRA', end: 140, icon: '✧', hp: 115, speed: 170, damage: 1.1, radius: 16, color: '#b6e8d0', desc: 'หนวดเริ่มงอก พลังโจมตีและความทนทานเพิ่มขึ้น' },
  { name: 'โตเต็มวัย', en: 'MEDUSA', end: 420, icon: '◈', hp: 150, speed: 190, damage: 1.35, radius: 21, color: '#b5f4c0', desc: 'ร่างแข็งแกร่งที่สุด เหมาะกับการท้าทายบอส' },
  { name: 'ชรา', en: 'ELDER', end: LIFE, icon: '◇', hp: 135, speed: 165, damage: 1.5, radius: 23, color: '#ded0f3', desc: 'พลังโจมตีสูงขึ้น ก่อนเริ่มต้นชีวิตรอบใหม่' }
];
const organs = [
  { id: 'sting', name: 'เข็มพิษ', short: 'เข็มพิษ', color: '#d2f3c5', damage: 16, cool: .33, energy: 3, type: 'bolt', speed: 490, desc: 'ยิงเข็มไปข้างหน้า แม่นและประหยัดพลัง', where: 'อวัยวะติดตัวตั้งแต่เกิด' },
  { id: 'barbs', name: 'หนวดหนาม', short: 'หนาม', color: '#f3b391', damage: 32, cool: .52, energy: 7, type: 'melee', desc: 'ฟาดเป็นวงกว้าง ระยะใกล้และผลักศัตรู', where: 'สวนปะการัง ทางตะวันออกของจุดเกิด' },
  { id: 'venom', name: 'ถุงพิษ', short: 'ลูกพิษ', color: '#c5df8a', damage: 21, cool: .55, energy: 8, type: 'venom', speed: 360, desc: 'ลูกพิษระเบิด สร้างความเสียหายต่อเนื่อง', where: 'ใต้รากไม้ใหญ่ในป่าสาหร่าย' },
  { id: 'sonar', name: 'กระดิ่งเสียง', short: 'คลื่น', color: '#a5dce7', damage: 28, cool: .95, energy: 15, type: 'wave', desc: 'ปล่อยคลื่นรอบตัว ทะลุสิ่งกีดขวาง', where: 'วิหารในซากนครจม' },
  { id: 'electric', name: 'ขนไฟฟ้า', short: 'ไฟฟ้า', color: '#f8dd89', damage: 30, cool: .64, energy: 11, type: 'chain', desc: 'สายฟ้าเชื่อมศัตรูสูงสุด 3 ตัวในระยะ', where: 'แท่นเรืองแสงหน้าประตูร่องลึก' },
  { id: 'frost', name: 'เกล็ดเย็น', short: 'น้ำแข็ง', color: '#b5c6f3', damage: 13, cool: .62, energy: 9, type: 'frost', speed: 430, desc: 'ยิง 3 เกล็ด ลดความเร็วศัตรูชั่วคราว', where: 'ถ้ำลับใต้สวนปะการัง' }
];
const upgrades = [
  { id: 'shell', name: 'เยื่อหุ้มเปลือก', desc: 'พลังชีวิต +20 ต่อระดับ', max: 5, cost: 8 },
  { id: 'power', name: 'ประสาทพิษ', desc: 'พลังโจมตี +10% ต่อระดับ', max: 5, cost: 10 },
  { id: 'flow', name: 'เส้นใยกระแสน้ำ', desc: 'ฟื้นพลังงานเร็วขึ้น +15% ต่อระดับ', max: 4, cost: 8 }
];
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const rand = rng(66322490);
const decorations = [], backgroundFish = [], ambient = [];
let objects = [];
const zoneAt = (x) => zones.findIndex(z => x / T < z.to);
const floorAt = (x) => floors[clamp(Math.floor(x / T), 0, COLS - 1)] * T;
const solid = (x, y) => x < 0 || x >= COLS || y < 0 || y >= ROWS || tiles[Math.floor(y) * COLS + Math.floor(x)] !== 0;
const at = (x, y) => solid(x / T, y / T);
function buildWorld() {
  for (let x = 0; x < COLS; x++) {
    floors[x] = Math.floor(27 + x * .253 + Math.sin(x * .085) * 3.2 + Math.sin(x * .27) * 1.5);
    for (let y = 0; y < ROWS; y++) if (y >= floors[x]) tiles[y * COLS + x] = 1;
  }
  const carve = (cx, cy, rx, ry) => {
    for (let x = Math.max(1, Math.floor(cx - rx)); x < Math.min(COLS - 1, cx + rx); x++)
      for (let y = Math.max(1, Math.floor(cy - ry)); y < Math.min(ROWS - 2, cy + ry); y++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) tiles[y * COLS + x] = 0;
  };
  // Submerged caves have open entrances; every organ is reachable by swimming.
  carve(49, 47, 17, 8); carve(36, 36, 5, 16); carve(59, 40, 5, 11);
  carve(120, 69, 20, 8); carve(104, 57, 6, 16); carve(133, 61, 5, 14);
  carve(183, 84, 18, 8); carve(171, 70, 6, 17); carve(196, 78, 7, 14);
  carve(239, 84, 21, 19); carve(218, 76, 11, 8);
  // Floating outcrops make the open water an explorable space, not a corridor.
  for (const [cx, cy, rx, ry] of [[63,22,8,3],[90,32,7,3],[138,39,6,3],[161,40,9,3],[202,51,7,3]]) {
    for (let x = cx-rx; x <= cx+rx; x++) for (let y = cy-ry; y <= cy+ry; y++)
      if (((x-cx)/rx)**2+((y-cy)/ry)**2<1) tiles[y*COLS+x]=1;
  }
  for (let x=4;x<COLS-4;x++) {
    for (let y=3;y<ROWS-2;y++) if (solid(x,y) && !solid(x,y-1)) {
      if (rand()<.47) decorations.push({x:x*T+T/2,y:y*T,kind:zoneAt(x*T)===1?'kelp':rand()<.55?'coral':'grass',size:25+rand()*62,seed:rand()*20});
      if(rand()<.12)decorations.push({x:x*T,y:y*T,kind:'shell',size:8+rand()*10,seed:rand()*20});
    }
  }
  for(let i=0;i<120;i++) {const x=rand()*WORLD_W,y=90+rand()*(floorAt(x)-160);backgroundFish.push({x,y,s:4+rand()*10,speed:8+rand()*24,phase:rand()*TAU});}
  for(let i=0;i<110;i++) ambient.push({x:rand()*W,y:rand()*H,r:rand()<.25?2:1,speed:4+rand()*12,phase:rand()*TAU});
  objects = [
    {id:'home',kind:'anchor',x:15*T,y:floorAt(15*T)-29,name:'ปะการังแห่งการเกิดใหม่'},
    {id:'barbs',kind:'organ',x:32*T,y:floorAt(32*T)-55,organ:1,name:'หนวดหนาม'},
    {id:'frost',kind:'organ',x:49*T,y:48*T,organ:5,name:'เกล็ดเย็น'},
    {id:'kelp-home',kind:'anchor',x:88*T,y:floorAt(88*T)-30,name:'รากสาหร่ายเก่า'},
    {id:'venom',kind:'organ',x:113*T,y:floorAt(113*T)-68,organ:2,name:'ถุงพิษ'},
    {id:'ruin-home',kind:'anchor',x:152*T,y:floorAt(152*T)-30,name:'แท่นนครจม'},
    {id:'sonar',kind:'organ',x:172*T,y:65*T,organ:3,name:'กระดิ่งเสียง'},
    {id:'electric',kind:'organ',x:217*T,y:73*T,organ:4,name:'ขนไฟฟ้า'},
    {id:'deep-home',kind:'anchor',x:216*T,y:82*T,name:'ปะการังหน้าร่องลึก'},
    {id:'gate',kind:'gate',x:226*T,y:83*T,name:'ปลุกผู้เฝ้าร่องลึก'}
  ];
}
buildWorld();
function defaultState() {
  return {version:1,cycle:1,age:0,pearls:0,unlocked:[0],weapon:0,upgrades:{shell:0,power:0,flow:0},explored:[],opened:[],anchors:['home'],checkpoint:'home',bossDefeated:false,kills:0,deaths:0,totalTime:0};
}
function stageIndex(age = state?.age || 0) { return Math.max(0, stageDefs.findIndex(s => age < s.end)); }
function maxHP() {return stageDefs[stageIndex()].hp + state.upgrades.shell*20;}
function makePlayer(saved) {
  const home = objects.find(o=>o.id===state.checkpoint) || objects[0];
  let x=saved?.x || home.x,y=saved?.y || home.y-70;
  if (at(x,y)) { x=home.x;y=home.y-70; }
  return {x,y,vx:0,vy:0,r:stageDefs[stageIndex()].radius,hp:clamp(saved?.hp ?? maxHP(),1,maxHP()),energy:clamp(saved?.energy ?? 100,0,100),food:clamp(saved?.food ?? 100,0,100),inv:0,cool:0,dashCool:0,dashTime:0,aim:0,attackFlash:0,stage:stageIndex(),trail:[]};
}
function spawnEnemies() {
  enemies=[];
  const r=rng(481975);
  for(let i=0;i<72;i++) {
    const x=850+r()*(WORLD_W-1600),zi=zoneAt(x),y=Math.max(130,floorAt(x)-90-r()*440);
    if(at(x,y)||x>223*T)continue;
    const type=zi===0?'shrimp':zi===1?(r()<.55?'fish':'urchin'):zi===2?(r()<.55?'eel':'urchin'):'angler';
    const hp={shrimp:38,fish:54,urchin:65,eel:80,angler:95}[type];
    enemies.push({id:i,x,y,homeX:x,homeY:y,vx:0,vy:0,r:type==='eel'?19:15,type,hp,max:hp,damage:8+zi*3,timer:r()*3,phase:r()*TAU,alert:false,poison:0,slow:0,flash:0,shot:1+r()*2});
  }
  boss={x:245*T,y:83*T,vx:0,vy:0,r:68,hp:1250,max:1250,active:false,phase:1,pattern:0,timer:2.5,warn:0,state:'idle',poison:0,slow:0,flash:0,targetX:0,targetY:0,attackTime:0};
  drops=[];
  const rr=rng(19191);
  for(let i=0;i<100;i++) {
    const x=260+rr()*(WORLD_W-640),y=floorAt(x)-60-rr()*360;
    if(!at(x,y))drops.push({x,y,kind:'food',r:5,phase:rr()*TAU,amount:12,life:Infinity});
  }
}
function safeLoad() {
  try {
    const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
    const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.unlocked)||!Number.isFinite(data.age)||!Number.isFinite(data.pearls))return null;
    const s={...defaultState(),...data};
    s.age=clamp(s.age,0,LIFE-.01);s.cycle=clamp(Math.floor(s.cycle)||1,1,10000);s.pearls=clamp(Math.floor(s.pearls),0,999999);
    s.unlocked=[...new Set([0,...s.unlocked.filter(v=>Number.isInteger(v)&&v>=0&&v<organs.length)])];
    s.weapon=s.unlocked.includes(s.weapon)?s.weapon:0;
    s.upgrades=Object.fromEntries(upgrades.map(u=>[u.id,clamp(Math.floor(s.upgrades?.[u.id])||0,0,u.max)]));
    for(const key of ['opened','anchors','explored'])s[key]=Array.isArray(s[key])?s[key]:[];
    s.explored=s.explored.filter(v=>Number.isInteger(v)&&v>=0&&v<COLS*ROWS);
    if(s.player && (!Number.isFinite(s.player.x)||!Number.isFinite(s.player.y)))delete s.player;
    return s;
  }catch{return null;}
}
let saved = safeLoad();
if(saved){$('continue-btn').classList.remove('hidden');$('start-btn').classList.add('secondary-btn');$('start-btn').classList.remove('primary-btn');$('start-btn').textContent='เริ่มใหม่';}
state=defaultState();player=makePlayer();spawnEnemies();
let explored = new Set();
function startGame(resume=false) {
  state=resume&&saved?{...saved}:defaultState();
  explored=new Set(state.explored);deaths=state.deaths;kills=state.kills;
  player=makePlayer(resume?state.player:null);spawnEnemies();
  if(boss.active)boss.active=false;
  camera.x=clamp(player.x-W/2,0,WORLD_W-W);camera.y=clamp(player.y-H*.52,0,WORLD_H-H);
  mode='play';menu=null;lastBiome=-1;input.keys.clear();shots=[];particles=[];labels=[];
  $('start-screen').classList.add('hidden');$('panel-overlay').classList.add('hidden');
  for(const id of ['hud','quest','life-hud','hotbar','game-menu'])$(id).classList.remove('hidden');
  if(touch)$('touch-controls').classList.remove('hidden');
  buildHotbar();updateHUD();reveal();saveGame();
  canvas.focus({preventScroll:true});startAudio();
  toast(resume?'ยินดีต้อนรับกลับสู่กระแสน้ำ':'ว่ายไปทางขวา แล้วสำรวจแสงสีทองด้วย E',4);
}
function saveGame() {
  if(mode==='title')return;
  try {
    const data={...state,explored:[...explored],kills,deaths,player:{x:player.x,y:player.y,hp:player.hp,food:player.food,energy:player.energy}};
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));saved=data;
    $('save-state').textContent='บันทึกแล้ว';
  }catch{$('save-state').textContent='บันทึกไม่ได้';}
}
function toast(text,seconds=3) {
  clearTimeout(noticeTimer);$('toast').textContent=text;$('toast').classList.remove('hidden');
  noticeTimer=setTimeout(()=>$('toast').classList.add('hidden'),seconds*1000);
}
function particlesAt(x,y,color,n=12,speed=65) {
  for(let i=0;i<n;i++){const a=Math.random()*TAU,s=speed*(.3+Math.random());particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.55,max:1,color,size:Math.random()<.4?3:2});}
  if(particles.length>400)particles.splice(0,particles.length-400);
}
function label(x,y,text,color='#fff0cf'){labels.push({x,y,text,color,life:1.2});}
function ripple(x,y,color,r=110){ripples.push({x,y,color,r,age:0,life:.42});}
function reveal() {
  const cx=Math.floor(player.x/T),cy=Math.floor(player.y/T);
  for(let x=cx-15;x<=cx+15;x++)for(let y=cy-12;y<=cy+12;y++)if(x>=0&&x<COLS&&y>=0&&y<ROWS&&((x-cx)/15)**2+((y-cy)/12)**2<1)explored.add(y*COLS+x);
}
function bodyDamage(){return stageDefs[stageIndex()].damage*(1+state.upgrades.power*.1);}
function hitEnemy(e,damage,kind) {
  if(e.hp<=0)return;
  e.hp-=damage;e.flash=.14;e.alert=true;
  if(kind==='venom')e.poison=4;
  if(kind==='frost')e.slow=2.5;
  label(e.x,e.y-e.r,Math.round(damage).toString(),kind==='venom'?'#c7e28c':kind==='frost'?'#b1d5ff':'#fff1ca');
  particlesAt(e.x,e.y,organs[state.weapon].color,5,75);
  if(e.hp<=0) {
    if(e===boss){defeatBoss();return;}
    kills++;state.pearls+=1;playTone(340,.08,'sine',.035);particlesAt(e.x,e.y,'#ffda99',12,110);
    drops.push({x:e.x,y:e.y,kind:'pearl',r:5,phase:0,amount:1,life:25});
    if(Math.random()<.55)drops.push({x:e.x+12,y:e.y,kind:'food',r:5,phase:1,amount:18,life:30});
  }
}
function hurt(damage,x,y) {
  if(player.inv>0||mode!=='play')return;
  player.hp-=damage;player.inv=.9;
  const a=Math.atan2(player.y-y,player.x-x);player.vx+=Math.cos(a)*140;player.vy+=Math.sin(a)*140;
  shake=reducedMotion?0:5;particlesAt(player.x,player.y,'#f2adb0',10,90);playTone(100,.13,'triangle',.06);label(player.x,player.y-28,`−${Math.round(damage)}`,'#ffadb7');
  if(player.hp<=0)rebirth('death');
}
function rebirth(reason='age') {
  if(reason==='death')deaths++;
  if(boss.active){boss.active=false;boss.hp=boss.max;boss.state='idle';boss.phase=1;boss.timer=2.5;}
  state.cycle++;state.age=0;
  const old={x:player.x,y:player.y};player=makePlayer();shots=[];
  particlesAt(old.x,old.y,'#d0efc8',30,140);ripple(player.x,player.y,'#d0efc8',180);
  $('boss-hud').classList.add('hidden');document.body.classList.remove('boss-active');
  saveGame();
  openPanel('rebirth',reason);
  playTone(262,.25,'sine',.04);playTone(392,.35,'sine',.04,.1);
}
function changeStage(idx) {
  const oldMax=stageDefs[player.stage].hp+state.upgrades.shell*20;
  player.stage=idx;player.r=stageDefs[idx].radius;player.hp=Math.min(maxHP(),player.hp+(maxHP()-oldMax));
  // Growth beside rocks must not embed the larger body in terrain.
  if(collides(player.x,player.y,player.r)) {
    for(let r=T;r<=T*5;r+=T) {let moved=false;for(let a=0;a<TAU;a+=TAU/8){const x=player.x+Math.cos(a)*r,y=player.y+Math.sin(a)*r;if(!collides(x,y,player.r)){player.x=x;player.y=y;moved=true;break;}}if(moved)break;}
  }
  ripple(player.x,player.y,stageDefs[idx].color,160);particlesAt(player.x,player.y,stageDefs[idx].color,28,120);
  toast(`เติบโตเป็น${stageDefs[idx].name} · ${stageDefs[idx].desc}`,4);playTone(520,.2,'sine',.04);
}
function collides(x,y,r) {
  for(const [dx,dy]of[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r*.7,r*.7],[-r*.7,r*.7],[r*.7,-r*.7],[-r*.7,-r*.7]])if(at(x+dx,y+dy))return true;
  return false;
}
function moveEntity(e,dt) {
  // Substeps prevent a dash from tunnelling through a one-tile wall.
  const n=Math.max(1,Math.ceil(Math.max(Math.abs(e.vx),Math.abs(e.vy))*dt/(T*.45))),step=dt/n;
  for(let i=0;i<n;i++) {
    const nx=clamp(e.x+e.vx*step,e.r+T,WORLD_W-e.r-T);
    if(!collides(nx,e.y,e.r))e.x=nx;else e.vx=0;
    const ny=clamp(e.y+e.vy*step,e.r+T,WORLD_H-e.r-T);
    if(!collides(e.x,ny,e.r))e.y=ny;else e.vy=0;
  }
}
function aim() {
  if(input.pointer&&!touch)return Math.atan2(input.my-(player.y-camera.y),input.mx-(player.x-camera.x));
  let best=null,d=370;
  for(const e of [...enemies,...(boss.active?[boss]:[])])if(e.hp>0&&dist(player,e)<d){best=e;d=dist(player,e);}
  return best?Math.atan2(best.y-player.y,best.x-player.x):Math.atan2(input.dy,input.dx);
}
function shoot(x,y,a,speed,damage,kind,enemy=false,r=5,life=1.45) {
  shots.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,damage,kind,enemy,r,life,color:enemy?'#f5949d':organs[state.weapon].color});
}
function attack() {
  if(mode!=='play'||player.cool>0)return;
  const o=organs[state.weapon];if(player.energy<o.energy){if(player.cool<=0)toast('พลังงานต่ำ · หยุดโจมตีสักครู่เพื่อฟื้นพลัง',1.2);player.cool=.25;return;}
  player.energy-=o.energy;player.cool=o.cool;player.attackFlash=.2;
  const a=aim();player.aim=a;const dmg=o.damage*bodyDamage();
  const targets=[...enemies,...(boss.active?[boss]:[])].filter(e=>e.hp>0);
  if(o.type==='melee') {
    ripple(player.x+Math.cos(a)*45,player.y+Math.sin(a)*45,o.color,92);
    for(const e of targets)if(dist(player,e)<115+e.r){let da=Math.atan2(e.y-player.y,e.x-player.x)-a;da=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(da)<1.65){hitEnemy(e,dmg);if(e!==boss){e.vx+=Math.cos(a)*160;e.vy+=Math.sin(a)*160;}}}
    playTone(170,.12,'triangle',.035);
  }else if(o.type==='wave') {
    ripple(player.x,player.y,o.color,210);
    for(const e of targets)if(dist(player,e)<200+e.r)hitEnemy(e,dmg);
    playTone(320,.22,'sine',.035);
  }else if(o.type==='chain') {
    let source=player,hit=new Set();
    for(let n=0;n<3;n++) {let closest=null,range=n?190:290;for(const e of targets)if(!hit.has(e)&&dist(source,e)<range){range=dist(source,e);closest=e;}
      if(!closest){if(n===0)shoot(player.x,player.y,a,630,dmg,'electric',false,4,.55);break;}
      ripples.push({kind:'lightning',x:source.x,y:source.y,x2:closest.x,y2:closest.y,color:o.color,age:0,life:.2});hitEnemy(closest,dmg*(1-n*.2));hit.add(closest);source=closest;
    }
    playTone(620,.07,'sawtooth',.024);
  }else if(o.type==='frost') {
    for(const da of [-.17,0,.17])shoot(player.x+Math.cos(a)*18,player.y+Math.sin(a)*18,a+da,o.speed,dmg,'frost',false,5,1.25);
    playTone(720,.08,'sine',.035);
  }else {
    shoot(player.x+Math.cos(a)*16,player.y+Math.sin(a)*16,a,o.speed,dmg,o.type==='venom'?'venom':'sting',false,o.type==='venom'?8:4,1.5);
    playTone(o.type==='venom'?210:440,.065,'triangle',.03);
  }
}
function dash() {
  if(mode!=='play'||player.dashCool>0||player.energy<22)return;
  player.energy-=22;player.dashCool=1.5;player.dashTime=.19;player.inv=Math.max(player.inv,.28);
  let x=input.joyX+(input.keys.has('KeyD')||input.keys.has('ArrowRight')?1:0)-(input.keys.has('KeyA')||input.keys.has('ArrowLeft')?1:0);
  let y=input.joyY+(input.keys.has('KeyS')||input.keys.has('ArrowDown')?1:0)-(input.keys.has('KeyW')||input.keys.has('ArrowUp')?1:0);
  const m=Math.hypot(x,y);if(m<.1){x=input.dx;y=input.dy;}else{x/=m;y/=m;}
  player.vx=x*620;player.vy=y*620;ripple(player.x,player.y,'#c6eddf',65);playTone(120,.12,'sine',.04);
}
function equip(i) {
  if(!state.unlocked.includes(i))return;
  state.weapon=i;buildHotbar();saveGame();
  if(menu==='body')renderBody();
}
function interact() {
  if(mode!=='play'||!nearest)return;
  const o=nearest;
  if(o.kind==='organ'&&!state.opened.includes(o.id)) {
    if(!state.unlocked.includes(o.organ))state.unlocked.push(o.organ);
    state.opened.push(o.id);state.pearls+=4;state.weapon=o.organ;
    particlesAt(o.x,o.y,organs[o.organ].color,40,150);ripple(o.x,o.y,organs[o.organ].color,120);buildHotbar();
    toast(`พบ ${organs[o.organ].name} · ${organs[o.organ].desc}`,4.5);playTone(660,.2,'sine',.04);saveGame();
  }else if(o.kind==='anchor') {
    if(!state.anchors.includes(o.id))state.anchors.push(o.id);
    state.checkpoint=o.id;player.hp=maxHP();player.energy=100;player.food=Math.max(player.food,65);
    ripple(o.x,o.y,'#b5f4c0',140);toast('พักที่ปะการัง · ฟื้นพลัง และตั้งจุดเกิดใหม่');saveGame();
  }else if(o.kind==='gate') {
    if(state.bossDefeated){toast('ผู้เฝ้าร่องลึกสงบแล้ว · ทะเลเป็นของคุณ');return;}
    if(stageIndex()<2){toast('ร่างนี้ยังเล็กเกินไป · เติบโตเป็นเอไฟราก่อน',3);return;}
    if(state.unlocked.length<3){toast('หาอวัยวะอย่างน้อย 3 ชนิด ก่อนท้าทายร่องลึก',3);return;}
    activateBoss();
  }
}
function activateBoss() {
  boss.active=true;boss.hp=boss.max;boss.phase=1;boss.pattern=0;boss.timer=1.5;boss.state='idle';boss.poison=0;boss.slow=0;
  boss.x=246*T;boss.y=83*T;player.x=230*T;player.y=83*T;
  player.hp=maxHP();player.energy=100;player.inv=1;shots=[];
  $('boss-hud').classList.remove('hidden');document.body.classList.add('boss-active');
  toast('ผู้เฝ้าร่องลึกตื่นแล้ว · หลบแสงแดงก่อนมันพุ่ง',4);ripple(boss.x,boss.y,'#eea0ad',220);playTone(65,.8,'triangle',.07);
}
function updateBoss(dt) {
  if(!boss.active||boss.hp<=0)return;
  boss.flash=Math.max(0,boss.flash-dt);boss.slow=Math.max(0,boss.slow-dt);
  if(boss.poison>0){boss.poison-=dt;boss.hp-=5*bodyDamage()*dt;if(boss.hp<=0){defeatBoss();return;}}
  if(boss.hp<boss.max*.5&&boss.phase===1){boss.phase=2;toast('ผู้เฝ้าร่องลึกคลุ้มคลั่ง · ระวังการโจมตีต่อเนื่อง',3);particlesAt(boss.x,boss.y,'#f69c9b',35,150);}
  boss.timer-=dt;boss.attackTime+=dt;
  if(boss.state==='idle') {
    const tx=244*T+Math.sin(time*.38)*150,ty=82*T+Math.sin(time*.7)*170;
    boss.vx=lerp(boss.vx,(tx-boss.x)*.9,dt*2);boss.vy=lerp(boss.vy,(ty-boss.y)*.9,dt*2);
    if(boss.timer<=0){boss.pattern=(boss.pattern+1)%3;boss.state='warning';boss.timer=boss.phase===2?.85:1.25;boss.targetX=player.x;boss.targetY=player.y;boss.vx*=.25;boss.vy*=.25;}
  }else if(boss.state==='warning') {
    boss.vx*=1-dt*3;boss.vy*=1-dt*3;
    if(boss.timer<=0) {
      const a=Math.atan2(boss.targetY-boss.y,boss.targetX-boss.x);
      if(boss.pattern===0) {boss.state='charge';boss.timer=.68;boss.vx=Math.cos(a)*(boss.phase===2?560:440);boss.vy=Math.sin(a)*(boss.phase===2?560:440);}
      else if(boss.pattern===1) {
        for(let i=-3;i<=3;i++)shoot(boss.x,boss.y,a+i*.18,boss.phase===2?245:190,15,'boss',true,8,4);
        boss.state='idle';boss.timer=boss.phase===2?1.5:2.5;
      }else {
        const n=boss.phase===2?14:10;for(let i=0;i<n;i++)shoot(boss.x,boss.y,i*TAU/n+time*.05,150,13,'boss',true,7,4.5);
        ripple(boss.x,boss.y,'#e890aa',260);boss.state='idle';boss.timer=boss.phase===2?1.6:2.5;
      }
      playTone(80,.15,'sawtooth',.045);shake=reducedMotion?0:4;
    }
  }else if(boss.state==='charge'&&boss.timer<=0){boss.state='idle';boss.timer=2;boss.vx*=.1;boss.vy*=.1;}
  boss.x=clamp(boss.x+boss.vx*dt,230*T,254*T);boss.y=clamp(boss.y+boss.vy*dt,71*T,96*T);
  if(dist(player,boss)<player.r+boss.r-8)hurt(boss.state==='charge'?23:14,boss.x,boss.y);
  // The gate keeps the arena readable while leaving enough room to dodge.
  player.x=clamp(player.x,227*T,258*T);player.y=clamp(player.y,68*T,99*T);
}
function defeatBoss() {
  boss.active=false;boss.hp=0;state.bossDefeated=true;state.pearls+=35;
  shots=shots.filter(s=>!s.enemy);particlesAt(boss.x,boss.y,'#ffd9ac',70,220);ripple(boss.x,boss.y,'#ffd8aa',340);shake=reducedMotion?0:8;
  $('boss-hud').classList.add('hidden');document.body.classList.remove('boss-active');saveGame();
  openPanel('victory');playTone(392,.35,'sine',.06);playTone(523,.45,'sine',.045,.18);playTone(659,.5,'sine',.04,.36);
}
function update(dt) {
  time+=dt;tick++;state.totalTime+=dt;state.age+=dt;
  if(state.age>=LIFE){rebirth('age');return;}
  const st=stageIndex();if(st!==player.stage)changeStage(st);
  player.inv=Math.max(0,player.inv-dt);player.cool=Math.max(0,player.cool-dt);player.dashCool=Math.max(0,player.dashCool-dt);player.attackFlash=Math.max(0,player.attackFlash-dt);
  player.energy=clamp(player.energy+dt*(st===1?23:16)*(1+state.upgrades.flow*.15),0,100);
  player.food=Math.max(0,player.food-dt*.095);if(player.food<=0)player.hp-=dt*1.8;
  if(player.food>60&&player.hp<maxHP()&&!boss.active)player.hp=Math.min(maxHP(),player.hp+dt*.8);
  if(player.hp<=0){rebirth('death');return;}
  let ix=input.joyX+(input.keys.has('KeyD')||input.keys.has('ArrowRight')?1:0)-(input.keys.has('KeyA')||input.keys.has('ArrowLeft')?1:0);
  let iy=input.joyY+(input.keys.has('KeyS')||input.keys.has('ArrowDown')?1:0)-(input.keys.has('KeyW')||input.keys.has('ArrowUp')?1:0);
  const mag=Math.hypot(ix,iy);if(mag>1){ix/=mag;iy/=mag;}
  if(mag>.05){input.dx=ix/(mag>1?1:mag);input.dy=iy/(mag>1?1:mag);}
  if(player.dashTime>0) {player.dashTime-=dt;particlesAt(player.x,player.y,stageDefs[st].color,2,25);}
  else {const speed=stageDefs[st].speed*(player.food<20?.8:1);player.vx=lerp(player.vx,ix*speed,Math.min(1,dt*5));player.vy=lerp(player.vy,iy*speed,Math.min(1,dt*5));if(mag<.05)player.vy+=Math.sin(time*2)*dt*4;}
  moveEntity(player,dt);player.aim=aim();
  if(input.attack||input.keys.has('KeyJ'))attack();
  if(tick%4===0){player.trail.push({x:player.x,y:player.y,life:.45});if(player.trail.length>13)player.trail.shift();}
  for(const p of player.trail)p.life-=dt;
  if(tick%8===0)reveal();
  for(const e of enemies) {
    if(e.hp<=0||dist(player,e)>W+300)continue;
    e.timer+=dt;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);
    if(e.poison>0){e.poison-=dt;e.hp-=5*bodyDamage()*dt;if(e.hp<=0){e.hp=.01;hitEnemy(e,1);continue;}}
    const d=dist(player,e),aggro=d<330&&!boss.active;
    let tx=e.homeX+Math.sin(e.timer*.65+e.phase)*80,ty=e.homeY+Math.sin(e.timer*.85)*40;
    if(aggro&&e.type!=='urchin'){tx=player.x;ty=player.y;}
    const speed=({shrimp:72,fish:90,eel:122,urchin:30,angler:64}[e.type])*(e.slow>0?.4:1),a=Math.atan2(ty-e.y,tx-e.x);
    e.vx=lerp(e.vx,Math.cos(a)*speed,dt*2);e.vy=lerp(e.vy,Math.sin(a)*speed,dt*2);moveEntity(e,dt);
    if(d<e.r+player.r)hurt(e.damage,e.x,e.y);
    if(aggro&&(e.type==='urchin'||e.type==='angler')){e.shot-=dt;if(e.shot<=0){shoot(e.x,e.y,Math.atan2(player.y-e.y,player.x-e.x),165,e.damage,'enemy',true,5,2.6);e.shot=2.2;}}
  }
  updateBoss(dt);
  for(const s of shots) {
    const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    // Sweep against actors as well as tiles for consistent hits at low frame rates.
    const segmentHit=(e)=>{const vx=s.x-oldX,vy=s.y-oldY,l=vx*vx+vy*vy,t=l?clamp(((e.x-oldX)*vx+(e.y-oldY)*vy)/l,0,1):0;return Math.hypot(e.x-(oldX+vx*t),e.y-(oldY+vy*t))<e.r+s.r;};
    if(at(s.x,s.y))s.life=0;
    if(s.enemy){if(segmentHit(player)){hurt(s.damage,s.x,s.y);s.life=0;}}
    else for(const e of [...enemies,...(boss.active?[boss]:[])])if(e.hp>0&&segmentHit(e)) {
      hitEnemy(e,s.damage,s.kind);s.life=0;
      if(s.kind==='venom'){ripple(s.x,s.y,'#b6d987',90);for(const n of enemies)if(n!==e&&n.hp>0&&dist(s,n)<90)hitEnemy(n,s.damage*.55,'venom');}
      break;
    }
    if(s.life<=0)particlesAt(s.x,s.y,s.color,3,40);
  }
  shots=shots.filter(s=>s.life>0);
  for(const d of drops) {
    d.life-=dt;
    if(dist(player,d)<player.r+17){d.life=0;if(d.kind==='food'){player.food=Math.min(100,player.food+d.amount);player.hp=Math.min(maxHP(),player.hp+5);particlesAt(d.x,d.y,'#d5e8a6',5);}
      else {state.pearls+=d.amount;label(d.x,d.y,'+1','#ffda99');playTone(660,.07,'sine',.02);}}
  }
  drops=drops.filter(d=>d.life>0);
  nearest=null;let nd=86;
  for(const o of objects)if(!(o.kind==='organ'&&state.opened.includes(o.id))&&!boss.active&&dist(player,o)<nd){nearest=o;nd=dist(player,o);}
  updateEffects(dt);
  camera.x=clamp(lerp(camera.x,player.x-W*.5,Math.min(1,dt*3.8)),0,Math.max(0,WORLD_W-W));
  camera.y=clamp(lerp(camera.y,player.y-H*.48,Math.min(1,dt*3.8)),0,Math.max(0,WORLD_H-H));
  shake=Math.max(0,shake-dt*16);
  uiTime+=dt;saveTime+=dt;
  if(uiTime>.14){updateHUD();uiTime=0;}
  if(saveTime>8){saveGame();saveTime=0;}
}
function updateEffects(dt) {
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy-=15*dt;p.life-=dt;}
  particles=particles.filter(p=>p.life>0);
  for(const l of labels){l.y-=dt*28;l.life-=dt;}labels=labels.filter(l=>l.life>0);
  for(const r of ripples)r.age+=dt;ripples=ripples.filter(r=>r.age<r.life);
}
function startAudio() {
  if(!sound)return;
  try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();}catch{sound=false;}
}
function playTone(freq,duration,type='sine',volume=.04,delay=0) {
  if(!sound||!audio)return;
  try{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*.7),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.02);}catch{}
}

// Pixel silhouettes, layered terrain and parallax are rendered locally: no CDN or asset loading.
const tileCache=new Map(),CHUNK=16;
function px(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
function line(c,color,points,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(let i=0;i<points.length;i++)c[i?'lineTo':'moveTo'](Math.round(points[i][0]),Math.round(points[i][1]));c.stroke();}
function glow(c,x,y,r,color,alpha=.15){c.save();c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
function chunkImage(cx,cy) {
  const key=`${cx},${cy}`;if(tileCache.has(key))return tileCache.get(key);
  const c=document.createElement('canvas');c.width=c.height=CHUNK*T;const g=c.getContext('2d');
  for(let lx=0;lx<CHUNK;lx++)for(let ly=0;ly<CHUNK;ly++) {
    const x=cx*CHUNK+lx,y=cy*CHUNK+ly;if(x>=COLS||y>=ROWS||!solid(x,y))continue;
    const z=zones[zoneAt(x*T)],top=!solid(x,y-1),left=!solid(x-1,y),right=!solid(x+1,y),bottom=!solid(x,y+1),hash=((x*397+y*971)^3211)>>>0;
    const xx=lx*T,yy=ly*T;px(g,z.rock,xx,yy,T,T);
    px(g,'#081c2955',xx+(hash%4)*4,yy+((hash>>>4)%4)*4,8,4);
    px(g,'#9bc0a212',xx+((hash>>>6)%4)*4,yy+((hash>>>8)%4)*4,4,4);
    if(top){px(g,z.top,xx,yy,T,4);px(g,'#b6d3ab30',xx,yy,T,1);px(g,z.top,xx+(hash%4)*4,yy+4,4,3);}
    if(left)px(g,z.top+'99',xx,yy,3,T);
    if(right)px(g,'#05192666',xx+T-3,yy,3,T);
    if(bottom)px(g,'#102033',xx,yy+T-3,T,3);
    if(!top&&hash%37===0){px(g,z.accent+'75',xx+8,yy+8,6,6);px(g,z.accent+'35',xx+6,yy+6,10,2);}
  }
  tileCache.set(key,c);if(tileCache.size>35)tileCache.delete(tileCache.keys().next().value);return c;
}
function renderBackground() {
  const z=zones[clamp(zoneAt(camera.x+W/2),0,3)];
  const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,z.sky);g.addColorStop(.75,z.deep);g.addColorStop(1,'#102b36');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // Broken columns of light drift very slowly, above remote reef silhouettes.
  ctx.save();ctx.globalAlpha=zoneAt(camera.x+W/2)<2?.07:.025;
  for(let i=0;i<7;i++) {
    const x=i*230-(camera.x*.12)%230+Math.sin(time*.13+i)*15;
    ctx.fillStyle='#c2ebc7';ctx.beginPath();ctx.moveTo(x,-20);ctx.lineTo(x+36,-20);ctx.lineTo(x-110,H);ctx.lineTo(x-200,H);ctx.fill();
  }ctx.restore();
  for(let layer=0;layer<3;layer++) {
    const f=.12+layer*.12,base=H*.64+layer*H*.12-camera.y*.05;
    ctx.fillStyle=['#0a374136','#0b303851','#102d3990'][layer];ctx.beginPath();ctx.moveTo(0,H);
    for(let x=-30;x<W+60;x+=30){const wx=x+camera.x*f;const y=base+Math.sin(wx*.006+layer*5)*52+Math.sin(wx*.017+layer)*17;ctx.lineTo(x,y);}
    ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    if(layer===1)for(let i=0;i<12;i++) {
      const x=i*137-((camera.x*.2)%137),y=base+Math.sin((x+camera.x*.2)*.006+5)*52;
      px(ctx,'#16404a55',x,y-60,8,65);px(ctx,'#16404a55',x-12,y-48,12,6);px(ctx,'#16404a55',x+8,y-30,16,7);
    }
  }
  for(const f of backgroundFish){const x=f.x-camera.x*.7,y=f.y-camera.y*.65;if(x<-30||x>W+30||y<-30||y>H+30)continue;const xx=x+Math.sin(time*.25+f.phase)*55;drawFish(ctx,xx,y,f.s,Math.sin(f.phase)<0?-1:1,'#8bb5b14a',false);}
  for(const p of ambient){const x=(p.x-camera.x*.3+W*10+Math.sin(time*.12+p.phase)*12)%W,y=(p.y-time*p.speed+camera.y*.04+H*100)%H;px(ctx,'#cbe8d426',x,y,p.r,p.r);if(p.r===2)px(ctx,'#cbe8d415',x-2,y+2,1,2);}
  if(z===zones[2]||z===zones[3]) {
    for(let i=0;i<12;i++){const x=i*170-(camera.x*.24)%170,y=H*.5+Math.sin(i*2.71)*80;px(ctx,'#6480921d',x,y,18,H-y);px(ctx,'#6480921d',x-8,y,34,9);px(ctx,'#64809216',x+27,y+60,55,11);}
  }
}
function drawTerrain() {
  const size=CHUNK*T,x1=Math.max(0,Math.floor(camera.x/size)),x2=Math.min(Math.ceil(COLS/CHUNK)-1,Math.floor((camera.x+W)/size));
  const y1=Math.max(0,Math.floor(camera.y/size)),y2=Math.min(Math.ceil(ROWS/CHUNK)-1,Math.floor((camera.y+H)/size));
  for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)ctx.drawImage(chunkImage(x,y),Math.floor(x*size-camera.x),Math.floor(y*size-camera.y));
}
function drawPlant(d,front=false) {
  const x=d.x-camera.x,y=d.y-camera.y;if(x<-120||x>W+120||y<-30||y-d.size>H+30)return;
  const z=zones[zoneAt(d.x)],wave=Math.sin(time*1.1+d.seed)*4;
  if(d.kind==='kelp') {
    const h=d.size*2.5,points=[];for(let i=0;i<=10;i++)points.push([x+Math.sin(time*.7+d.seed+i*.65)*i*.9,y-i*h/10]);
    line(ctx,front?'#447d68':z.plants+'9c',points,4);
    for(let i=1;i<9;i++){const p=points[i],left=i%2===0;px(ctx,front?'#72a17b':'#609482b0',p[0]+(left?-18:3),p[1],16,4);px(ctx,front?'#72a17b':'#609482b0',p[0]+(left?-14:5),p[1]-4,11,4);}
  }else if(d.kind==='coral') {
    const warm=d.seed%3>1?'#ecad91':'#b5bf91',base=z===zones[3]?'#b291b1':z===zones[2]?'#8fabba':warm,h=d.size*.65;
    px(ctx,base+'bf',x-3,y-h,6,h);px(ctx,base+'bf',x-16,y-h*.65,6,h*.45);px(ctx,base+'bf',x+11,y-h*.8,6,h*.6);px(ctx,base+'bf',x-16,y-h*.29,31,6);
    px(ctx,base,x-6,y-h,12,5);px(ctx,base,x-19,y-h*.65,12,5);px(ctx,base,x+8,y-h*.8,12,5);px(ctx,'#fce5c640',x-3,y-h,6,2);
    if(d.seed>12){px(ctx,base+'a0',x+26,y-h*.33,6,h*.33);px(ctx,base,x+23,y-h*.36,12,5);}
  }else if(d.kind==='grass') {
    for(let i=-2;i<=2;i++)line(ctx,z.plants+'ac',[[x+i*4,y],[x+i*6+wave*.4,y-d.size*.35],[x+i*9+wave,y-d.size*.62]],2);
  }else {
    px(ctx,'#c1c9a177',x-6,y-5,13,5);px(ctx,'#d2ccac77',x-3,y-8,7,3);px(ctx,'#849da277',x,y-6,1,4);
  }
}
function drawRuins() {
  for(const [wx,wy,h]of[[159*T,64*T,145],[166*T,66*T,100],[178*T,69*T,130],[185*T,71*T,150],[193*T,76*T,100]]) {
    const x=wx-camera.x,y=wy-camera.y;if(x<-100||x>W+100||y-h>H||y<0)continue;
    px(ctx,'#426478',x-16,y-h,32,h);px(ctx,'#243e54',x-10,y-h+8,20,h-8);px(ctx,'#708998',x-23,y-h,46,8);px(ctx,'#537b85',x-23,y-8,46,8);
    for(let i=0;i<4;i++)px(ctx,'#63819050',x-8+i*5,y-h+15,2,h-31);
    px(ctx,'#192b3d',x-20,y-h+43,40,4);px(ctx,'#87aaa74a',x-21,y-h,42,2);
    if(wx===178*T){px(ctx,'#8baba44a',x-80,y-h+2,130,11);px(ctx,'#637f8560',x-50,y-h-8,76,10);}
  }
}
function drawFish(c,x,y,s,dir,color,eye=true) {
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(dir,1);
  px(c,color,-s,-s*.35,s*2,s*.7);px(c,color,-s*.55,-s*.55,s*1.1,s*1.1);px(c,color,-s*1.5,-s*.6,s*.45,s*1.2);px(c,color,-s*1.1,-s*.2,s*.45,s*.4);
  if(eye)px(c,'#16303a',s*.35,-s*.22,3,3);c.restore();
}
function drawJelly(c,x,y,st,weapon=0,scale=1,anim=time,inv=0,flash=0,armor=0,angle=0) {
  c.save();c.translate(Math.round(x),Math.round(y));c.scale(scale,scale);
  if(inv>0&&Math.floor(anim*16)%2)c.globalAlpha=.45;
  const color=flash>0?'#f4ffe2':stageDefs[st].color,accent=organs[weapon].color,pulse=1+Math.sin(anim*3)*.07;
  c.scale(pulse,1/pulse);
  if(st===0) {
    px(c,color,-11,-7,22,14);px(c,color,-8,-10,16,20);px(c,'#85bcb38c',-9,4,18,5);px(c,'#f0fff18e',-5,-6,10,3);
    for(let i=0;i<7;i++){const a=i*TAU/7+anim*.1;line(c,accent+'c0',[[Math.cos(a)*11,Math.sin(a)*8],[Math.cos(a)*17,Math.sin(a)*13]],1);}
    px(c,'#21484f',2,-3,2,2);px(c,'#21484f',7,-3,2,2);
  }else if(st===1) {
    px(c,'#91b7a0',-5,-3,10,19);px(c,color,-11,-8,22,10);px(c,color,-7,-12,14,6);px(c,'#f6eccac0',-4,-8,8,3);
    for(let i=0;i<6;i++){const a=-Math.PI+i*Math.PI/5,wx=Math.sin(anim*2+i)*2;line(c,accent,[[Math.cos(a)*9,Math.sin(a)*5-7],[Math.cos(a)*17+wx,Math.sin(a)*17-7]],2);}
    px(c,color,-8,13,16,3);px(c,'#29474a',-4,-5,2,2);px(c,'#29474a',3,-5,2,2);
  }else {
    const r=st===2?16:st===3?22:24;
    const tentLen=weapon===1?48:weapon===3?25:32;
    for(let i=0;i<7;i++) {
      const xx=(i-3)*r*.24,len=tentLen+(i%3)*5+Math.sin(anim*2+i)*3,wiggle=Math.sin(anim*2+i*.85)*4;
      const points=[[xx,r*.18],[xx+wiggle,r*.5+len*.3],[xx-wiggle*.3,r*.5+len*.65],[xx+wiggle*.8,r*.5+len]];
      line(c,i%2===0?accent+'b0':color+'85',points,weapon===1?3:2);
      if(weapon===1){px(c,accent,xx+wiggle-3,r*.5+len*.3,7,3);px(c,accent,xx-wiggle*.3-3,r*.5+len*.65,7,3);}
      if(weapon===4&&i%2===0)px(c,'#fff3b9',points[2][0],points[2][1],3,3);
    }
    px(c,color,-r,-r*.48,r*2,r*.7);px(c,color,-r*.76,-r*.76,r*1.52,r*.4);px(c,color,-r*.47,-r*.92,r*.94,r*.26);
    px(c,'#4b9e9a91',-r,-1,r*2,7);px(c,color,-r-3,3,r*2+6,5);px(c,'#edffe164',-r*.55,-r*.67,r*.8,4);
    px(c,'#a4cebc77',-r*.75,-r*.35,r*.35,r*.4);
    if(st===2)for(let i=-2;i<=2;i++)px(c,color,i*7-2,7,4,5+Math.sin(anim*3+i)*2);
    px(c,'#214850',-7,-4,3,4);px(c,'#214850',4,-4,3,4);px(c,'#579091',-1,2,3,2);
    if(weapon===2){px(c,accent+'c4',-r*.42,-r*.48,8,8);px(c,'#ebf5bf6a',-r*.37,-r*.43,3,3);}
    if(weapon===3){px(c,'#bfe2e8',-r*.75,-r*.76,r*1.5,4);px(c,'#7bafb6',-3,-r*.82,6,9);}
    if(weapon===4)for(let i=-3;i<=3;i++)line(c,accent,[[i*6,-r*.7],[i*7-2,-r*.7-6],[i*7+2,-r*.7-10]],1);
    if(weapon===5)for(let i=-2;i<=2;i++){px(c,accent,i*8-2,-r*.7-3,4,7);px(c,'#e3eaff',i*8-1,-r*.7-6,2,4);}
    if(armor>0){px(c,'#baae82',-r-3,0,5,8);px(c,'#dac39a',r-2,0,5,8);if(armor>2)px(c,'#c2af83',-4,-r*.95,8,4);}
  }
  if(st<2&&weapon!==0){px(c,accent,-5,-16,10,4);px(c,accent,-2,-20,4,5);}
  c.restore();
}
function drawOrgan(c,i,x=16,y=16,scale=1) {
  const o=organs[i];c.save();c.translate(x,y);c.scale(scale,scale);
  if(i===0){line(c,o.color,[[-9,9],[7,-7]],3);px(c,'#effde3',4,-10,7,4);px(c,'#789d83',-11,8,5,4);}
  if(i===1){line(c,o.color,[[-9,9],[-4,-1],[4,-8],[9,-9]],3);for(let k=0;k<3;k++)px(c,o.color,-5+k*5,-k*5,6,2);}
  if(i===2){px(c,o.color,-8,-7,16,16);px(c,o.color,-5,-10,10,4);px(c,'#829f66',-7,5,14,5);px(c,'#ebf6c1',-3,-5,5,4);}
  if(i===3){px(c,o.color,-10,-4,20,10);px(c,o.color,-6,-8,12,6);px(c,'#51849e',-10,5,20,3);px(c,o.color,-2,8,4,4);}
  if(i===4){line(c,o.color,[[4,-12],[-6,2],[3,2],[-3,12]],4);px(c,'#fff5c2',0,-7,4,6);}
  if(i===5){px(c,o.color,-3,-11,6,22);px(c,o.color,-8,-6,16,12);px(c,'#e5eeff',-2,-8,4,13);}
  c.restore();
}
function drawObject(o) {
  const x=o.x-camera.x,y=o.y-camera.y;if(x<-130||x>W+130||y<-130||y>H+130)return;
  if(o.kind==='organ') {
    const opened=state.opened.includes(o.id),color=organs[o.organ].color;
    px(ctx,'#3e5553',x-18,y+12,36,13);px(ctx,'#a4a78e',x-22,y+9,44,5);px(ctx,'#264b51',x-13,y+17,26,7);
    if(!opened){glow(ctx,x,y,90,color,.3);drawOrgan(ctx,o.organ,x,y-9+Math.sin(time*2)*5,1.15);for(let i=0;i<3;i++){const a=time*.4+i*TAU/3;px(ctx,color+'aa',x+Math.cos(a)*23,y-10+Math.sin(a)*16,2,2);}}
    else{px(ctx,'#769689',x-4,y+5,8,3);px(ctx,'#a0c9b2',x+2,y,2,5);}
  }else if(o.kind==='anchor') {
    const active=state.checkpoint===o.id,seen=state.anchors.includes(o.id),color=active?'#d7f4ac':'#7cadb1';
    glow(ctx,x,y-20,active?120:75,color,active?.23:.09);
    px(ctx,'#315d64',x-18,y+5,36,12);px(ctx,seen?'#aacd9b':'#6a9990',x-6,y-32,12,38);px(ctx,color,x-20,y-35,10,18);px(ctx,color,x+10,y-49,10,24);px(ctx,color,x-15,y-21,28,7);px(ctx,color,x-9,y-52,18,11);
    px(ctx,'#e5f6cb90',x-5,y-49,5,7);
    if(active){for(let i=0;i<4;i++){const a=time*.7+i*TAU/4;px(ctx,'#d8f6b687',x+Math.cos(a)*28,y-29+Math.sin(a)*20,2,2);}}
  }else {
    const defeated=state.bossDefeated,cc=defeated?'#a9dbc7':'#cf9ca9';glow(ctx,x,y-25,150,cc,.2);
    px(ctx,'#444354',x-36,y-93,15,124);px(ctx,'#444354',x+21,y-93,15,124);px(ctx,'#696779',x-45,y-99,27,8);px(ctx,'#696779',x+18,y-99,27,8);
    px(ctx,cc,x-31,y-71,5,17);px(ctx,cc,x+26,y-71,5,17);px(ctx,'#36384b',x-43,y+24,86,8);
    if(!defeated){for(let i=-2;i<=2;i++)px(ctx,cc+'85',x+i*8,y-65+Math.sin(time*2+i)*9,3,3);}
    else{px(ctx,'#cce5b3',x-5,y-27,10,4);px(ctx,'#cce5b3',x+1,y-34,4,8);}
  }
}
function drawEnemy(e) {
  if(e.hp<=0)return;const x=e.x-camera.x,y=e.y-camera.y;if(x<-60||x>W+60||y<-60||y>H+60)return;
  const color=e.flash>0?'#fce1c0':e.poison>0?'#c2d78c':e.slow>0?'#c3d6f4':e.type==='shrimp'?'#e7a392':e.type==='fish'?'#85bfb0':e.type==='eel'?'#b6bad2':e.type==='urchin'?'#b090c6':'#cfb3c9';
  if(e.type==='urchin') {
    for(let i=0;i<9;i++){const a=i*TAU/9+time*.15;line(ctx,color,[[x+Math.cos(a)*8,y+Math.sin(a)*8],[x+Math.cos(a)*22,y+Math.sin(a)*22]],2);}
    px(ctx,color,x-10,y-9,20,18);px(ctx,color,x-6,y-13,12,26);px(ctx,'#39434c',x-4,y-3,3,3);px(ctx,'#39434c',x+3,y-3,3,3);
  }else if(e.type==='eel') {
    ctx.save();ctx.translate(x,y);ctx.scale(e.vx<0?-1:1,1);
    for(let i=0;i<7;i++){px(ctx,color,-i*7,Math.sin(time*4+i*.8)*4-4,10,8);}px(ctx,color,0,-7,17,14);px(ctx,'#2c3f51',11,-4,3,3);ctx.restore();
  }else if(e.type==='shrimp') {
    ctx.save();ctx.translate(x,y);ctx.scale(e.vx>0?1:-1,1);
    px(ctx,color,-12,-6,21,12);px(ctx,color,-17,-9,8,8);px(ctx,'#f7cfb89c',-9,-7,12,3);px(ctx,color,8,-11,8,9);
    for(let i=0;i<4;i++)line(ctx,color,[[-8+i*5,4],[-12+i*5,12]],1);
    line(ctx,color,[[11,-6],[26,-13],[35,-10]],1);px(ctx,'#4e4651',11,-8,3,3);ctx.restore();
  }else {
    drawFish(ctx,x,y,e.type==='angler'?22:18,e.vx>0?1:-1,color);
    if(e.type==='angler'){line(ctx,color,[[x+10,y-12],[x+13,y-33],[x+23,y-37],[x+26,y-28]],2);px(ctx,'#ffe2a7',x+22,y-31,8,7);glow(ctx,x+26,y-27,36,'#ffe2a7',.22);}
  }
  if(e.hp<e.max){px(ctx,'#102030',x-18,y-e.r-10,36,3);px(ctx,'#dfaaa7',x-18,y-e.r-10,36*clamp(e.hp/e.max,0,1),3);}
}
function drawBoss() {
  if(state.bossDefeated)return;
  const x=boss.x-camera.x,y=boss.y-camera.y;if(x<-200||x>W+200||y<-180||y>H+180)return;
  const cc=boss.flash>0?'#ffe3bd':boss.phase===2?'#e49d9e':'#bfabb8',dir=player.x<boss.x?-1:1;
  glow(ctx,x,y,180,boss.phase===2?'#d39c93':'#a5a1ce',.18);
  if(boss.active&&boss.state==='warning') {
    ctx.save();ctx.globalAlpha=.2+Math.sin(time*18)*.08;
    if(boss.pattern===0){const a=Math.atan2(boss.targetY-boss.y,boss.targetX-boss.x);ctx.translate(x,y);ctx.rotate(a);px(ctx,'#ff9c91',0,-32,580,64);line(ctx,'#ffe8bb',[[0,0],[580,0]],2);}
    else if(boss.pattern===1){const a=Math.atan2(boss.targetY-boss.y,boss.targetX-boss.x);ctx.strokeStyle='#f8b199';ctx.lineWidth=2;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a+i*.18)*440,y+Math.sin(a+i*.18)*440);ctx.stroke();}}
    else {ctx.strokeStyle='#efa8a8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,200+Math.sin(time*10)*14,0,TAU);ctx.stroke();}
    ctx.restore();
  }
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(dir,1);
  for(let i=0;i<10;i++){const xx=-25-i*13,yy=Math.sin(time*2-i*.55)*18;px(ctx,i%2?cc+'b0':cc,xx,yy-10,18,20);px(ctx,'#68758e',xx+4,yy+6,12,7);}
  px(ctx,cc,-58,-30,111,59);px(ctx,cc,-44,-42,82,84);px(ctx,cc,-23,-51,55,102);
  px(ctx,'#707f9180',-46,15,89,19);px(ctx,'#e1c8be80',-31,-39,54,8);
  px(ctx,'#304052',13,-13,37,30);px(ctx,'#e6baac',25,-24,27,14);px(ctx,'#e6baac',23,22,31,10);
  for(let i=0;i<4;i++){px(ctx,'#fce1c5',19+i*8,-11,4,9);px(ctx,'#fce1c5',22+i*8,12,4,9);}
  px(ctx,'#edce8f',18,-27,8,7);px(ctx,'#241f32',21,-26,3,4);
  for(let i=0;i<5;i++){const xx=-43+i*17;px(ctx,cc,xx,-49,8,14);px(ctx,'#e4bcba',xx+2,-57,4,10);}
  line(ctx,cc,[[-13,-47],[-8,-88],[23,-104],[53,-91],[62,-65]],4);
  px(ctx,'#fff0b4',54,-73,15,17);px(ctx,'#e4bbac',50,-67,23,7);
  for(let i=0;i<3;i++)line(ctx,cc,[[-21+i*18,33],[-28+i*21,61+Math.sin(time*2+i)*5],[i*20,70]],3);
  ctx.restore();glow(ctx,x+dir*62,y-66,65,'#ffe2a9',.32);
  if(!boss.active){ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#b8a6c399';ctx.fillText('ผู้เฝ้าร่องลึก',x,y+108);}
}
function render() {
  ctx.imageSmoothingEnabled=false;renderBackground();
  ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  for(const d of decorations)drawPlant(d);
  drawRuins();drawTerrain();
  for(const o of objects)drawObject(o);
  for(const d of drops){const x=d.x-camera.x,y=d.y-camera.y;if(x<-20||x>W+20||y<-20||y>H+20)continue;const yy=y+Math.sin(time*2+d.phase)*4;
    if(d.kind==='food'){px(ctx,'#d0de9bbb',x-3,yy-3,6,6);px(ctx,'#f6ecc5bb',x-1,yy-4,2,2);px(ctx,'#d0de9b44',x-6,yy-1,2,2);}else{glow(ctx,x,yy,28,'#ffdc99',.2);px(ctx,'#eec792',x-4,yy-3,8,6);px(ctx,'#fff1c4',x-2,yy-4,4,4);}}
  for(const e of enemies)drawEnemy(e);drawBoss();
  if(mode==='title') {
    const portrait=W/H<.85,jx=portrait?W*.66:W*.74,jy=portrait?H*.27:H*.43;
    glow(ctx,jx,jy,portrait?160:240,'#b7efb4',.15);drawJelly(ctx,jx,jy,3,0,portrait?2.6:3.3,time);
    drawJelly(ctx,W*.57,H*.22,2,3,1.0,time+2);drawJelly(ctx,W*.89,H*.58,2,1,.75,time+5);
    for(let i=0;i<9;i++){const xx=jx+Math.sin(time*.4+i*1.37)*140,yy=jy+Math.cos(time*.3+i*.98)*135;px(ctx,'#e9f4c68a',xx,yy,2,2);}
  }else {
    for(const p of player.trail)if(p.life>0){ctx.globalAlpha=p.life*.12;drawJelly(ctx,p.x-camera.x,p.y-camera.y,player.stage,state.weapon,.9,time,0,0);ctx.globalAlpha=1;}
    glow(ctx,player.x-camera.x,player.y-camera.y,95,stageDefs[player.stage].color,.09);
    drawJelly(ctx,player.x-camera.x,player.y-camera.y,player.stage,state.weapon,1,time,player.inv,player.attackFlash,state.upgrades.shell,player.aim);
    const ax=player.x-camera.x+Math.cos(player.aim)*42,ay=player.y-camera.y+Math.sin(player.aim)*42;
    if(!touch&&mode==='play'){ctx.globalAlpha=.5;line(ctx,'#dce8c9',[[ax-3,ay],[ax+3,ay]],1);line(ctx,'#dce8c9',[[ax,ay-3],[ax,ay+3]],1);ctx.globalAlpha=1;}
  }
  for(const s of shots){const x=s.x-camera.x,y=s.y-camera.y;line(ctx,s.color+'66',[[x-s.vx*.018,y-s.vy*.018],[x,y]],s.r*.8);px(ctx,s.color,x-s.r/2,y-s.r/2,s.r,s.r);px(ctx,'#fff4db',x-1,y-1,2,2);}
  for(const r of ripples){const alpha=1-r.age/r.life;ctx.globalAlpha=alpha*.6;
    if(r.kind==='lightning'){const x=r.x-camera.x,y=r.y-camera.y,x2=r.x2-camera.x,y2=r.y2-camera.y;line(ctx,r.color,[[x,y],[lerp(x,x2,.33)+10,y+(y2-y)*.3-7],[lerp(x,x2,.6)-7,y+(y2-y)*.7+9],[x2,y2]],2);}
    else {ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x-camera.x,r.y-camera.y,Math.max(1,r.r*(r.age/r.life)),0,TAU);ctx.stroke();}
  }ctx.globalAlpha=1;
  for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);px(ctx,p.color,p.x-camera.x,p.y-camera.y,p.size,p.size);}ctx.globalAlpha=1;
  ctx.font='bold 12px monospace';ctx.textAlign='center';for(const l of labels){ctx.globalAlpha=Math.min(1,l.life*2);ctx.fillStyle='#052334';ctx.fillText(l.text,l.x-camera.x+1,l.y-camera.y+1);ctx.fillStyle=l.color;ctx.fillText(l.text,l.x-camera.x,l.y-camera.y);}ctx.globalAlpha=1;
  // Nearby target is visible in the world as well as in the interaction hint.
  if(nearest&&mode==='play'){const x=nearest.x-camera.x,y=nearest.y-camera.y-66;px(ctx,'#f3daa688',x-4,y,8,3);px(ctx,'#f3daa6',x-2,y+3,4,3);}
  ctx.restore();
  const vignette=ctx.createRadialGradient(W*.5,H*.4,Math.min(W,H)*.18,W*.5,H*.5,Math.max(W,H)*.66);vignette.addColorStop(0,'#00162500');vignette.addColorStop(1,'#01131b67');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  if(player.food<15&&mode!=='title'){ctx.strokeStyle='#dcb98277';ctx.lineWidth=5;ctx.strokeRect(3,3,W-6,H-6);}
}
function resize() {
  const r=canvas.getBoundingClientRect();W=Math.round(clamp(r.width*.85,480,1500));H=Math.round(W*r.height/Math.max(1,r.width));
  canvas.width=W;canvas.height=H;ctx.imageSmoothingEnabled=false;
  for(const p of ambient){p.x=Math.random()*W;p.y=Math.random()*H;}
  if(mode==='title'){camera.x=250;camera.y=clamp(floorAt(1000)-H*.82,0,WORLD_H-H);}
  else{camera.x=clamp(player.x-W*.5,0,Math.max(0,WORLD_W-W));camera.y=clamp(player.y-H*.5,0,Math.max(0,WORLD_H-H));}
}

function organCanvas(i,size=32) {
  const c=document.createElement('canvas');c.width=c.height=size;drawOrgan(c.getContext('2d'),i,size/2,size/2,size/32);return c;
}
function buildHotbar() {
  const bar=$('hotbar');bar.replaceChildren();
  organs.forEach((o,i)=>{
    const b=document.createElement('button'),unlocked=state.unlocked.includes(i);
    b.className=`slot${i===state.weapon?' active':''}${unlocked?'':' locked'}`;
    b.title=unlocked?`${o.name} · ${o.desc}`:`${o.name} · ${o.where}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',i===state.weapon?'true':'false');
    const key=document.createElement('kbd');key.textContent=i+1;b.append(key,organCanvas(i));
    const text=document.createElement('small');text.textContent=unlocked?o.short:'?';b.append(text);
    b.addEventListener('click',()=>{if(unlocked)equip(i);else toast(o.where);});bar.append(b);
  });
}
function questData() {
  if(state.bossDefeated)return {title:'ทะเลสงบแล้ว',detail:'สำรวจอวัยวะที่เหลือ แล้วใช้ชีวิตต่อได้',target:null};
  if(boss.active)return {title:'เอาชนะผู้เฝ้าร่องลึก',detail:'ดูสัญญาณเตือน · พุ่งหลบด้วย SPACE',target:boss};
  if(!state.unlocked.includes(1))return {title:'ตามหาอวัยวะแรก',detail:'สำรวจแสงสีทองทางขวา แล้วกด E',target:objects.find(o=>o.id==='barbs')};
  if(!state.unlocked.includes(2))return {title:'มุ่งสู่ป่าสาหร่าย',detail:'ตามหาถุงพิษใต้รากไม้ · ว่ายไปทางขวา',target:objects.find(o=>o.id==='venom')};
  if(!state.unlocked.includes(3))return {title:'สำรวจซากนครจม',detail:'ค้นหากระดิ่งเสียงในวิหารเก่า',target:objects.find(o=>o.id==='sonar')};
  if(!state.unlocked.includes(4))return {title:'ลงสู่ร่องลึก',detail:'เก็บขนไฟฟ้าที่แท่นหน้าประตู',target:objects.find(o=>o.id==='electric')};
  return {title:'ปลุกผู้เฝ้าร่องลึก',detail:stageIndex()<2?'เติบโตเป็นเอไฟรา แล้วสำรวจประตู':'พักที่ปะการัง แล้วกด E ที่ประตูร่องลึก',target:objects.find(o=>o.id==='gate')};
}
function updateHUD() {
  const mh=maxHP(),st=stageIndex(),def=stageDefs[st];
  $('health-fill').style.width=`${clamp(player.hp/mh,0,1)*100}%`;$('health-text').textContent=`${Math.ceil(player.hp)} / ${mh}`;
  $('energy-fill').style.width=`${player.energy}%`;$('energy-text').textContent=`${Math.floor(player.energy)}`;
  $('food-fill').style.width=`${player.food}%`;$('food-text').textContent=`อิ่ม ${Math.floor(player.food)}%`;
  $('stage-icon').textContent=def.icon;$('stage-name').textContent=def.name;$('cycle-text').textContent=`ชีวิตที่ ${state.cycle}`;
  $('stage-time').textContent=fmt(def.end-state.age);$('stage-time').title=st===4?'เวลาจนกลับเป็นตัวอ่อน':'เวลาจนเติบโตสู่ระยะถัดไป';
  $('life-fill').style.width=`${state.age/LIFE*100}%`;
  document.querySelectorAll('.life-stages span').forEach((el,i)=>el.classList.toggle('active',i===st));
  const zi=zoneAt(player.x),z=zones[zi];$('biome-tag').textContent=`0${zi+1} / ${z.en}`;$('biome-name').textContent=z.name;
  $('depth-text').textContent=`ความลึก ${Math.round(player.y/8)} m`;
  $('footer-status').textContent=`◇ ${state.pearls} ไข่มุก · ${state.unlocked.length}/6 อวัยวะ`;
  if(zi!==lastBiome){lastBiome=zi;if(mode==='play')showArea(zi);}
  const q=questData();$('quest-title').textContent=q.title;
  let direction='';if(q.target&&!boss.active){const dx=q.target.x-player.x,dy=q.target.y-player.y;direction=` · ${Math.round(Math.hypot(dx,dy)/8)} m ${Math.abs(dx)>70?(dx>0?'ทางขวา':'ทางซ้าย'):(dy>0?'ด้านล่าง':'ด้านบน')}`;}
  $('quest-detail').textContent=q.detail+direction;
  if(nearest&&mode==='play'){
    const prompt=$('interact-prompt');prompt.classList.remove('hidden');
    const key=touch?'สำรวจ':'[E]';
    prompt.textContent=`${key} ${nearest.kind==='anchor'?'พักและบันทึก':nearest.kind==='organ'?'เก็บ':''} ${nearest.name}`;
  }else $('interact-prompt').classList.add('hidden');
  if(boss.active){$('boss-fill').style.width=`${boss.hp/boss.max*100}%`;$('boss-phase').textContent=`LEVIATHAN · ${boss.phase===1?'I':'II'}`;}
  $('touch-dash').style.opacity=player.dashCool>0||player.energy<22?'.4':'1';
  drawMap(mini,180,76,true);
}
function showArea(zi) {
  clearTimeout(areaTimer);const el=$('area-banner');el.classList.add('hidden');
  $('area-kicker').textContent=`0${zi+1} / ${zones[zi].en}`;$('area-title').textContent=zones[zi].name;
  void el.offsetWidth;el.classList.remove('hidden');areaTimer=setTimeout(()=>el.classList.add('hidden'),4000);
}
function drawMap(c,w,h,isMini=false) {
  c.clearRect(0,0,w,h);c.fillStyle='#071d2c';c.fillRect(0,0,w,h);
  const sx=w/COLS,sy=h/ROWS;
  // Draw discovered cells only; the map remembers exploration across every life.
  for(const id of explored) {
    const x=id%COLS,y=Math.floor(id/COLS),z=zones[zoneAt(x*T)];
    c.fillStyle=tiles[id]?z.top+'a0':z.sky;c.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));
  }
  const visible=(o)=>explored.has(Math.floor(o.y/T)*COLS+Math.floor(o.x/T));
  for(const o of objects)if(visible(o)){
    const color=o.kind==='organ'?(state.opened.includes(o.id)?'#86a299':'#ffda99'):o.kind==='anchor'?'#b5f4c0':'#f7a1a5';
    px(c,color,o.x/WORLD_W*w-1,o.y/WORLD_H*h-1,isMini?2:4,isMini?2:4);
  }
  if(!isMini){c.strokeStyle='#769ca433';c.lineWidth=1;for(const z of zones){c.beginPath();c.moveTo(z.from*sx,0);c.lineTo(z.from*sx,h);c.stroke();}}
  const x=player.x/WORLD_W*w,y=player.y/WORLD_H*h;c.fillStyle='#f4ffdf';c.fillRect(x-2,y-2,4,4);
  if(!isMini){c.strokeStyle='#f4ffdf';c.strokeRect(x-5,y-5,10,10);}
}
function openPanel(type,detail) {
  if(menu===type&&mode==='pause'){closePanel();return;}
  menu=type;mode=mode==='title'?'title':'pause';input.keys.clear();input.attack=false;input.joyX=input.joyY=0;$('joy-knob').style.transform='none';
  const content=$('panel-content');content.replaceChildren();$('panel').classList.remove('wide');
  $('panel-overlay').classList.remove('hidden');$('interact-prompt').classList.add('hidden');
  const titles={pause:['PAUSED','พักใต้กระแสน้ำ'],help:['FIELD GUIDE','ชีวิตใต้กระแสน้ำ'],body:['BODY / MUTATIONS','ปรับแต่งร่างกาย'],map:['OCEAN ATLAS','แผนที่กระแสน้ำ'],rebirth:['A NEW BEGINNING','อีกชีวิตหนึ่งเริ่มแล้ว'],victory:['THE OCEAN REMEMBERS','ร่องลึกกลับมาสงบ'],new:['NEW LIFE','เริ่มการเดินทางใหม่?']};
  const [kicker,title]=titles[type]||titles.pause;$('panel-kicker').textContent=kicker;$('panel-title').textContent=title;
  if(type==='body')renderBody();
  else if(type==='map')renderMap();
  else if(type==='help') {
    content.innerHTML=`<p>เป็นแมงกะพรุนตัวเล็กที่ว่ายได้ทุกทิศทาง สำรวจทะเล เก็บอวัยวะใหม่ และเติบโตจนพร้อมท้าทายผู้เฝ้าร่องลึก</p><div class="controls-grid"><div><kbd>WASD / ↑↓←→</kbd><span>ว่ายน้ำ</span></div><div><kbd>คลิก / J</kbd><span>โจมตีค้างได้</span></div><div><kbd>SPACE / K</kbd><span>พุ่งหลบ</span></div><div><kbd>E</kbd><span>เก็บของ / พัก</span></div><div><kbd>1–6</kbd><span>เปลี่ยนอวัยวะ</span></div><div><kbd>I / M</kbd><span>ร่างกาย / แผนที่</span></div></div><p>ใช้เมาส์เล็งได้ บนมือถือหรือเมื่อกด J เกมจะช่วยเล็งศัตรูใกล้ตัว พุ่งใช้พลังงาน 22 และหลบความเสียหายได้ช่วงสั้น ๆ</p><div class="stage-list">${stageDefs.map((s,i)=>`<div><strong>${s.name}</strong><small>${fmt(i?stageDefs[i-1].end:0)}–${fmt(s.end)}</small></div>`).join('')}</div><div class="note">หนึ่งชีวิตใช้เวลา 8 นาทีที่กำลังเล่น เมื่อชราหรือพลังชีวิตหมด จะเกิดใหม่เป็นตัวอ่อนที่ปะการังล่าสุด โดยเก็บอวัยวะ ไข่มุก การอัปเกรด และแผนที่ไว้ เมนูและการสลับออกจากเว็บจะพักเวลาให้</div><p>เก็บแพลงก์ตอนสีเขียวเพื่อฟื้นความอิ่มและชีวิต กด E ที่ปะการังเรืองแสงเพื่อพักและตั้งจุดเกิดใหม่ ใช้ไข่มุกอัปเกรดในหน้าร่างกาย</p><p>วงจรชีวิตและการกลายพันธุ์ดัดแปลงเพื่อเกมผจญภัย บอสเริ่มได้เมื่อถึงระยะเอไฟราและมีอวัยวะอย่างน้อย 3 ชนิด</p>`;
    const actions=addActions(content);button(actions,'เข้าใจแล้ว','primary-btn',closePanel);
  }else if(type==='pause') {
    content.innerHTML=`<p>กระแสน้ำจะรอคุณ วงจรชีวิตหยุดระหว่างพักเกม</p><div class="stat-grid"><div><strong>${state.cycle}</strong><small>ชีวิตที่</small></div><div><strong>${state.unlocked.length}/6</strong><small>อวัยวะที่ค้นพบ</small></div><div><strong>${state.pearls}</strong><small>ไข่มุก</small></div></div><p>ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์ของเครื่องนี้</p>`;
    const a=addActions(content);button(a,'ว่ายต่อ','primary-btn',closePanel);button(a,'วิธีเล่น','secondary-btn',()=>openPanel('help'));button(a,'กลับหน้าหลัก','secondary-btn',returnTitle);saveGame();
  }else if(type==='rebirth') {
    content.innerHTML=`<p>${detail==='death'?'ร่างเดิมอ่อนแรงลง แต่การเดินทางยังดำเนินต่อ คุณกลับมาเป็นตัวอ่อนที่ปะการังล่าสุด':'เวลาเปลี่ยนร่างที่ชราให้กลับเป็นตัวอ่อนอีกครั้ง พร้อมออกเดินทางรอบใหม่'}</p><div class="stat-grid"><div><strong>${state.cycle}</strong><small>ชีวิตใหม่</small></div><div><strong>${state.unlocked.length}/6</strong><small>อวัยวะที่เก็บไว้</small></div><div><strong>${state.pearls}</strong><small>ไข่มุกที่เก็บไว้</small></div></div><div class="note">ความทรงจำของทะเลยังอยู่ อวัยวะ การอัปเกรด และแผนที่ที่ค้นพบติดตัวคุณมาด้วย</div>`;
    const a=addActions(content);button(a,'เริ่มว่ายอีกครั้ง','primary-btn',closePanel);button(a,'ปรับแต่งร่างกาย','secondary-btn',()=>openPanel('body'));
  }else if(type==='victory') {
    content.innerHTML=`<p>แสงเก่าแก่ในร่องลึกค่อย ๆ สงบลง ผู้เฝ้าร่องลึกยอมรับแมงกะพรุนตัวเล็กที่เดินทางมาถึงที่นี่</p><div class="stat-grid"><div><strong>+35</strong><small>ไข่มุกรางวัล</small></div><div><strong>${state.cycle}</strong><small>ชีวิตที่ใช้</small></div><div><strong>${fmt(state.totalTime)}</strong><small>เวลาผจญภัย</small></div></div><div class="note">บอสตัวแรกสำเร็จแล้ว คุณยังสำรวจหาอวัยวะให้ครบทั้ง 6 และเล่นวงจรชีวิตต่อได้</div>`;
    const a=addActions(content);button(a,'สำรวจทะเลต่อ','primary-btn',closePanel);button(a,'ดูแผนที่','secondary-btn',()=>openPanel('map'));
  }else if(type==='new') {
    content.innerHTML='<p>เริ่มจากตัวอ่อนตัวแรกอีกครั้ง อวัยวะ ไข่มุก การอัปเกรด และแผนที่เดิมในเครื่องนี้จะถูกแทนที่</p>';
    const a=addActions(content);button(a,'เริ่มใหม่','danger-btn',()=>startGame(false));button(a,'กลับ','secondary-btn',closePanel);
  }
  $('panel-close').focus({preventScroll:true});
}
function addActions(parent){const a=document.createElement('div');a.className='panel-actions';parent.append(a);return a;}
function button(parent,text,cls,action){const b=document.createElement('button');b.textContent=text;b.className=cls;b.addEventListener('click',action);parent.append(b);return b;}
function closePanel() {
  $('panel-overlay').classList.add('hidden');menu=null;input.keys.clear();input.attack=false;
  if(mode!=='title'){mode='play';canvas.focus({preventScroll:true});saveGame();updateHUD();}
  else $('start-btn').focus({preventScroll:true});
}
function returnTitle() {
  saveGame();menu=null;mode='title';$('panel-overlay').classList.add('hidden');$('start-screen').classList.remove('hidden');
  for(const id of ['hud','quest','life-hud','hotbar','touch-controls','game-menu','boss-hud','interact-prompt'])$(id).classList.add('hidden');
  $('continue-btn').classList.remove('hidden');$('start-btn').className='secondary-btn';$('start-btn').textContent='เริ่มใหม่';
  document.body.classList.remove('boss-active');resize();
}
function renderBody() {
  const c=$('panel-content');c.replaceChildren();
  const top=document.createElement('div');top.className='body-top';
  const specimen=document.createElement('canvas');specimen.width=specimen.height=100;drawJelly(specimen.getContext('2d'),50,39,player.stage,state.weapon,1.5,time,0,0,state.upgrades.shell);top.append(specimen);
  const info=document.createElement('div');info.innerHTML=`<strong>${stageDefs[player.stage].name} · ชีวิตที่ ${state.cycle}</strong><p>${stageDefs[player.stage].desc}</p><p>ชีวิต ${maxHP()} · โจมตี ×${bodyDamage().toFixed(2)}</p><p class="pearl-count">◇ ${state.pearls} ไข่มุก</p>`;top.append(info);c.append(top);
  const grid=document.createElement('div');grid.className='organ-grid';c.append(grid);
  organs.forEach((o,i)=>{
    const unlocked=state.unlocked.includes(i),b=document.createElement('button');b.className=`organ-card${i===state.weapon?' equipped':''}${unlocked?'':' locked'}`;b.append(organCanvas(i));
    const text=document.createElement('div');text.innerHTML=`<strong>${o.name}</strong><small>${unlocked?o.desc:o.where}</small><b>${!unlocked?'ยังไม่ค้นพบ':i===state.weapon?'ติดตั้งอยู่':`โจมตี ${Math.round(o.damage*bodyDamage())} · พลังงาน ${o.energy}`}</b>`;b.append(text);b.disabled=!unlocked;b.setAttribute('aria-pressed',i===state.weapon?'true':'false');b.addEventListener('click',()=>equip(i));grid.append(b);
  });
  const ups=document.createElement('div');ups.className='upgrades';c.append(ups);
  upgrades.forEach(u=>{
    const lv=state.upgrades[u.id],cost=u.cost*(lv+1),el=document.createElement('div');el.className='upgrade';
    const text=document.createElement('div');text.innerHTML=`<strong>${u.name} ${lv}/${u.max}</strong><small>${u.desc}</small>`;el.append(text);
    const b=button(el,lv>=u.max?'เต็มแล้ว':`◇ ${cost} อัปเกรด`,'',()=>{
      if(state.pearls<cost||lv>=u.max)return;state.pearls-=cost;state.upgrades[u.id]++;if(u.id==='shell')player.hp+=20;saveGame();renderBody();playTone(530,.12,'sine',.03);
    });b.disabled=lv>=u.max||state.pearls<cost;ups.append(el);
  });
  const a=addActions(c);button(a,'ว่ายต่อ','primary-btn',closePanel);
}
function renderMap() {
  const p=$('panel-content');p.innerHTML='<p>ส่วนมืดคือทะเลที่ยังไม่เคยไป แผนที่จะจดจำสิ่งที่สำรวจไว้ในทุกชีวิต</p>';
  const c=document.createElement('canvas');c.width=660;c.height=260;c.className='map-canvas';c.setAttribute('aria-label','แผนที่แสดงพื้นที่ที่สำรวจ จุดพัก และอวัยวะที่ค้นพบ');p.append(c);drawMap(c.getContext('2d'),660,260);
  const legend=document.createElement('div');legend.className='map-legend';legend.innerHTML='<span><i style="background:#f4ffdf"></i>คุณ</span><span><i style="background:#ffda99"></i>อวัยวะ</span><span><i style="background:#b5f4c0"></i>จุดพัก</span><span><i style="background:#f7a1a5"></i>ประตูบอส</span>';p.append(legend);
  const zonesEl=document.createElement('div');zonesEl.className='zone-progress';p.append(zonesEl);
  zones.forEach(z=>{let seen=0;for(const id of explored){const x=id%COLS;if(x>=z.from&&x<z.to)seen++;}const percent=Math.round(seen/((z.to-z.from)*ROWS)*100),d=document.createElement('div');d.innerHTML=`${percent?z.name:'เขตที่ยังไม่สำรวจ'}<small>${percent?`สำรวจแล้ว ${percent}%`: 'กระแสน้ำพัดไปทางตะวันออก'}</small>`;zonesEl.append(d);});
  const a=addActions(p);button(a,'กลับสู่ทะเล','primary-btn',closePanel);
}
function clearInput() {input.keys.clear();input.attack=false;input.joyX=input.joyY=0;joyPointer=null;$('joy-knob').style.transform='none';}
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const gameKeys=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','KeyE','KeyI','KeyM','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];
  if(!gameKeys.includes(e.code))return;
  if(e.code==='Escape'){e.preventDefault();if(menu)closePanel();else if(mode==='play')openPanel('pause');return;}
  if(mode==='title'){if(e.code==='Space'&&!menu){e.preventDefault();startGame(!!saved);}return;}
  e.preventDefault();
  if(e.code==='KeyI'||e.code==='KeyM'){if(!e.repeat)openPanel(e.code==='KeyI'?'body':'map');return;}
  if(mode!=='play')return;
  input.keys.add(e.code);if(e.code==='KeyJ')input.pointer=false;
  if(e.repeat)return;
  if(e.code==='Space'||e.code==='KeyK')dash();else if(e.code==='KeyE')interact();
  else if(e.code.startsWith('Digit'))equip(Number(e.code.slice(-1))-1);
});
window.addEventListener('keyup',e=>input.keys.delete(e.code));
canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=canvas.getBoundingClientRect();input.mx=(e.clientX-r.left)/r.width*W;input.my=(e.clientY-r.top)/r.height*H;input.pointer=true;});
canvas.addEventListener('pointerdown',e=>{if(mode!=='play'||e.button!==0||e.pointerType==='touch')return;e.preventDefault();input.attack=true;canvas.setPointerCapture(e.pointerId);startAudio();});
canvas.addEventListener('pointerup',()=>input.attack=false);canvas.addEventListener('pointercancel',()=>input.attack=false);canvas.addEventListener('lostpointercapture',()=>input.attack=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
let joyPointer=null;
function joyMove(e){if(e.pointerId!==joyPointer)return;const r=$('joystick').getBoundingClientRect(),limit=r.width*.31;let x=e.clientX-(r.left+r.width/2),y=e.clientY-(r.top+r.height/2);const m=Math.hypot(x,y);if(m>limit){x=x/m*limit;y=y/m*limit;}input.joyX=x/limit;input.joyY=y/limit;input.pointer=false;$('joy-knob').style.transform=`translate(${x}px,${y}px)`;}
$('joystick').addEventListener('pointerdown',e=>{if(mode!=='play')return;e.preventDefault();joyPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);joyMove(e);startAudio();});
$('joystick').addEventListener('pointermove',joyMove);
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(type,e=>{if(e.pointerId===joyPointer){joyPointer=null;input.joyX=input.joyY=0;$('joy-knob').style.transform='none';}});
$('touch-attack').addEventListener('pointerdown',e=>{if(mode!=='play')return;e.preventDefault();input.attack=true;input.pointer=false;$('touch-attack').setPointerCapture(e.pointerId);startAudio();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touch-attack').addEventListener(type,()=>input.attack=false);
$('touch-dash').addEventListener('pointerdown',e=>{e.preventDefault();dash();});$('touch-interact').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
$('start-btn').addEventListener('click',()=>saved?openPanel('new'):startGame(false));$('continue-btn').addEventListener('click',()=>startGame(true));
$('pause-btn').addEventListener('click',()=>{if(menu)closePanel();else if(mode==='play')openPanel('pause');});
$('help-btn').addEventListener('click',()=>openPanel('help'));$('start-help').addEventListener('click',()=>openPanel('help'));
$('body-btn').addEventListener('click',()=>openPanel('body'));$('map-btn').addEventListener('click',()=>openPanel('map'));$('mini-map-btn').addEventListener('click',()=>openPanel('map'));
$('panel-close').addEventListener('click',closePanel);
$('panel-overlay').addEventListener('click',e=>{if(e.target===$('panel-overlay'))closePanel();});
$('panel').addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;const controls=[...$('panel').querySelectorAll('button:not(:disabled),a[href]')],first=controls[0],end=controls.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();end?.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first?.focus();}
});
$('sound-btn').addEventListener('click',()=>{sound=!sound;startAudio();$('sound-btn').textContent=sound?'♫':'♪';$('sound-btn').setAttribute('aria-label',sound?'ปิดเสียง':'เปิดเสียง');if(sound)playTone(440,.15,'sine',.05);});
$('fullscreen-btn').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch{toast('เบราว์เซอร์นี้ไม่รองรับเต็มหน้าจอ');}});
window.addEventListener('blur',()=>{clearInput();if(mode==='play')openPanel('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(mode==='play')openPanel('pause');saveGame();}});
window.addEventListener('pagehide',saveGame);window.addEventListener('resize',resize);
window.addEventListener('error',e=>{if(!e.filename?.includes('game.js'))return;$('fatal-error').classList.remove('hidden');$('error-detail').textContent=e.message;mode='error';});
function frame(now) {
  const dt=Math.min((now-last)/1000||0,.035);last=now;
  if(mode==='play')update(dt);
  else if(mode==='title'&&!menu){time+=dt;updateEffects(dt);}
  render();requestAnimationFrame(frame);
}
resize();requestAnimationFrame(frame);

// Local verification surface, absent on the deployed GitHub Pages origin.
if(['localhost','127.0.0.1'].includes(location.hostname))window.jellyDebug={
  snapshot:()=>({mode,menu,stage:stageIndex(),x:player.x,y:player.y,hp:player.hp,maxHP:maxHP(),energy:player.energy,age:state.age,cycle:state.cycle,unlocked:[...state.unlocked],weapon:state.weapon,pearls:state.pearls,explored:explored.size,checkpoint:state.checkpoint,opened:[...state.opened],boss:{hp:boss.hp,active:boss.active,phase:boss.phase,state:boss.state},bossDefeated:state.bossDefeated,colliding:collides(player.x,player.y,player.r),W,H}),
  advance:(seconds)=>{for(let i=0;i<seconds*60&&mode==='play';i++)update(1/60);},
  teleport:(id)=>{const o=typeof id==='string'?objects.find(o=>o.id===id):id;if(!o)return;player.x=o.x;player.y=o.y-45;player.vx=player.vy=0;camera.x=clamp(player.x-W*.5,0,WORLD_W-W);camera.y=clamp(player.y-H*.5,0,WORLD_H-H);update(.016);updateHUD();},
  setAge:(age)=>{state.age=clamp(age,0,LIFE-.001);const s=stageIndex();if(s!==player.stage)changeStage(s);updateHUD();},
  setHP:(hp)=>{player.hp=hp;},
  hitBoss:(damage)=>hitEnemy(boss,damage),
  objects:()=>objects.map(o=>({...o,colliding:collides(o.x,o.y-45,12)})),
  position:(x,y)=>{player.x=x;player.y=y;player.vx=player.vy=0;},
  save:saveGame,
  graph:()=>({cols:COLS,rows:ROWS,tiles:Array.from(tiles),objects,spawn:{x:15,y:Math.floor((objects[0].y-70)/T)}})
};
