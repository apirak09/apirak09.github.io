/* Jelly: Reborn — a dependency-free, side-view ocean RPG. */
const $ = (id) => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
const mini = $('minimap').getContext('2d');
const TAU = Math.PI * 2, T = 24, COLS = 264, ROWS = 112;
const WORLD_W = COLS * T, WORLD_H = ROWS * T, LIFE = 480;
const SAVE_KEY = 'apirak-jelly-reborn-v1';
const RELEASE = '02 · BIOHYBRID';
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
let scanTime=0,scanCooldown=0,navTime=0,navPath=[],navTarget=null;
let tiles = new Uint8Array(COLS * ROWS), floors = new Int16Array(COLS);
const zones = [
  { name: 'สวนปะการัง', en: 'CORAL GARDEN', from: 0, to: 77, sky: '#236574', deep: '#103a47', rock: '#1c4550', top: '#43836b', accent: '#ffc397', plants: '#86ad75' },
  { name: 'ป่าสาหร่าย', en: 'KELP FOREST', from: 77, to: 145, sky: '#144652', deep: '#0d2c39', rock: '#143942', top: '#347167', accent: '#c2dda2', plants: '#62997b' },
  { name: 'สถานีวิจัยจม', en: 'PELAGIC STATION', from: 145, to: 207, sky: '#193345', deep: '#101f30', rock: '#243b53', top: '#52747f', accent: '#a9bcdd', plants: '#7ea5b6' },
  { name: 'เขต NAUTILUS', en: 'NAUTILUS SECTOR', from: 207, to: COLS, sky: '#102538', deep: '#071423', rock: '#282e46', top: '#696072', accent: '#e5a2b2', plants: '#9979a8' }
];
const stageDefs = [
  { name: 'ตัวอ่อน', en: 'PLANULA', end: 35, icon: '◌', hp: 75, speed: 175, damage: .8, radius: 11, color: '#c6f0d7', desc: 'ว่ายด้วยซิเลีย ก่อนลงเกาะวัสดุพื้นทะเล' },
  { name: 'โพลิป', en: 'POLYP', end: 55, icon: '✣', hp: 90, speed: 0, damage: .95, radius: 13, color: '#f4d7b0', desc: 'เกาะพื้น 20 วินาที เก็บอาหารด้วยหนวด แล้วแตกหน่อเมดูซา' },
  { name: 'เมดูซาวัยอ่อน', en: 'JUVENILE MEDUSA', end: 130, icon: '✧', hp: 115, speed: 175, damage: 1.1, radius: 16, color: '#b6e8d0', desc: 'เมดูซาหลุดจากโคโลนี พร้อมสำรวจและท้าทาย NAUTILUS' },
  { name: 'โตเต็มวัย', en: 'MEDUSA', end: 420, icon: '◈', hp: 150, speed: 190, damage: 1.35, radius: 21, color: '#b5f4c0', desc: 'ร่างแข็งแกร่งที่สุด เหมาะกับการท้าทายบอส' },
  { name: 'เครียดสะสม', en: 'STRESS RESPONSE', end: 465, icon: '◇', hp: 130, speed: 155, damage: 1.05, radius: 18, color: '#d8c1c4', desc: 'การเสื่อมและความเครียดกระตุ้นกระบวนการย้อนวัย' },
  { name: 'ซีสต์ย้อนวัย', en: 'REVERSAL CYST', end: LIFE, icon: '○', hp: 150, speed: 0, damage: 0, radius: 9, color: '#dcc8ad', desc: 'หยุดว่าย จัดโครงสร้างเนื้อเยื่อใหม่ แล้วกลับเป็นโพลิป' }
];
const organs = [
  { id: 'sting', name: 'เข็มพิษสัมผัส', short: 'เข็มพิษ', color: '#d2f3c5', damage: 22, cool: .33, energy: 2, type: 'touch', desc: 'เซลล์เข็มพิษทำงานระยะใกล้ โจมตีรอบตัว 80 หน่วย', where: 'ชุดเซลล์และหัวเข็มจิ๋วเริ่มต้น', origin:'BIO / nematocyst-inspired' },
  { id: 'barbs', name: 'หนวดเสริมใย', short: 'หนวด', color: '#f3b391', damage: 34, cool: .52, energy: 7, type: 'melee', desc: 'เส้นใยช่วยยืดหนวด ฟาด 150 หน่วยและผลักศัตรู', where: 'แท่นเพาะเลี้ยงทางขวาของจุดเกิด', origin:'BIOHYBRID / reinforced tentacle' },
  { id: 'venom', name: 'ไมโครแคปซูลพิษ', short: 'แคปซูล', color: '#c5df8a', damage: 21, cool: .55, energy: 8, type: 'venom', speed: 360, desc: 'อุปกรณ์ปล่อยแคปซูลพิษ กระจายเมื่อกระทบเป้าหมาย', where: 'ใต้รากไม้ใหญ่ในป่าสาหร่าย', origin:'ENGINEERED / microcapsule' },
  { id: 'sonar', name: 'ทรานสดิวเซอร์', short: 'คลื่น', color: '#a5dce7', damage: 28, cool: .95, energy: 15, type: 'wave', desc: 'อุปกรณ์สร้างชีพจรแรงดันน้ำรอบตัว ระยะ 200 หน่วย', where: 'สถานีวิจัย PELAGIC', origin:'ENGINEERED / acoustic actuator' },
  { id: 'electric', name: 'ขั้วไฟฟ้าชีวกล', short: 'ไฟฟ้า', color: '#f8dd89', damage: 30, cool: .64, energy: 11, type: 'chain', desc: 'โมดูลปล่อยกระแสไฟ เชื่อมเป้าหมายใกล้กันได้ 3 จุด', where: 'แท่นซ่อมบำรุงหน้าประตู NAUTILUS', origin:'ENGINEERED / electrodes' },
  { id: 'frost', name: 'เจลไฮโดรเจล', short: 'ไฮโดรเจล', color: '#b5c6f3', damage: 13, cool: .62, energy: 9, type: 'frost', speed: 430, desc: 'ปล่อยเจล 3 หยด เพิ่มแรงต้านน้ำเพื่อชะลอเป้าหมาย', where: 'ถ้ำตัวอย่างใต้สวนปะการัง', origin:'ENGINEERED / drag-inducing gel' }
];
const upgrades = [
  { id: 'shell', name: 'โครงพยุงไฮโดรเจล', desc: 'พลังชีวิต +20 ต่อระดับ', max: 5, cost: 8 },
  { id: 'power', name: 'ตัวขยายสัญญาณ', desc: 'พลังโจมตี +10% ต่อระดับ', max: 5, cost: 10 },
  { id: 'flow', name: 'แหล่งจ่ายชีวกล', desc: 'ฟื้นพลังงานเร็วขึ้น +15% ต่อระดับ', max: 4, cost: 8 }
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
    {id:'home',kind:'anchor',x:15*T,y:floorAt(15*T)-29,name:'ฐานเพาะเลี้ยง C-01'},
    {id:'barbs',kind:'organ',x:32*T,y:floorAt(32*T)-55,organ:1,name:'หนวดเสริมใย'},
    {id:'frost',kind:'organ',x:49*T,y:48*T,organ:5,name:'เจลไฮโดรเจล'},
    {id:'kelp-home',kind:'anchor',x:88*T,y:floorAt(88*T)-30,name:'ฐานเพาะเลี้ยง K-02'},
    {id:'venom',kind:'organ',x:113*T,y:floorAt(113*T)-68,organ:2,name:'ไมโครแคปซูลพิษ'},
    {id:'ruin-home',kind:'anchor',x:152*T,y:floorAt(152*T)-30,name:'สถานีซ่อม P-03'},
    {id:'sonar',kind:'organ',x:172*T,y:65*T,organ:3,name:'ทรานสดิวเซอร์'},
    {id:'electric',kind:'organ',x:217*T,y:73*T,organ:4,name:'ขั้วไฟฟ้าชีวกล'},
    {id:'deep-home',kind:'anchor',x:216*T,y:82*T,name:'ฐานหน้าเขต NAUTILUS'},
    {id:'gate',kind:'gate',x:226*T,y:83*T,name:'เชื่อมต่อ NAUTILUS-01'},
    {id:'express',kind:'transit',x:43*T,y:floorAt(43*T)-65,name:'ท่อกระแสไปเขต NAUTILUS'},
    {id:'log-01',kind:'log',x:23*T,y:floorAt(23*T)-40,name:'บันทึกโครงการ REBORN',entry:0},
    {id:'log-02',kind:'log',x:155*T,y:floorAt(155*T)-48,name:'บันทึกเหตุขัดข้อง',entry:1}
  ];
}
buildWorld();
function defaultState() {
  return {version:2,cycle:1,age:0,pearls:0,unlocked:[0],weapon:0,upgrades:{shell:0,power:0,flow:0},explored:[],opened:[],anchors:['home'],checkpoint:'home',bossDefeated:false,kills:0,deaths:0,totalTime:0,travelUsed:false,visitedLogs:[],trackBoss:true};
}
function stageIndex(age = state?.age || 0) { return Math.max(0, stageDefs.findIndex(s => age < s.end)); }
function isAnchoredStage(){return [1,5].includes(stageIndex());}
function maxHP() {return stageDefs[stageIndex()].hp + state.upgrades.shell*20;}
function environmentAt(x=player.x,y=player.y){
  const depth=Math.max(0,y/8),zi=zoneAt(x),temperature=clamp(27-depth*.065+[0,-1,-2,-3][zi],5,28);
  return {depth,temperature,pressure:1.01325+1025*9.81*depth/100000,currentX:Math.sin(y*.008+time*.22)*[14,24,10,7][zi],currentY:Math.sin(x*.005+time*.17)*5};
}
function settlePlayer(){
  // Polyps settle on a solid substrate. The protective mesh is a fictional
  // nursery attachment; attached stages stay interactive but cannot swim.
  let found=false;
  for(let dy=0;dy<ROWS*T;dy+=T){const y=Math.floor((player.y+dy)/T)*T;
    if(y>=WORLD_H-T)break;
    for(const dx of [0,-T,T,-2*T,2*T]){const x=clamp(Math.floor((player.x+dx)/T)*T+T/2,T*2,WORLD_W-T*2),yy=y-player.r-2;
      if(at(x,y+1)&&!collides(x,yy,player.r)){player.x=x;player.y=yy;found=true;break;}}
    if(found)break;
  }
  if(!found){const home=objects.find(o=>o.id===state.checkpoint)||objects[0];player.x=home.x;player.y=home.y-70;}
  player.rootX=player.x;player.rootY=player.y;player.vx=player.vy=0;player.dashTime=0;
}
function nurseryShield(){return isAnchoredStage();}
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
    // The nursery and first transit tube form a safe tutorial area: waiting
    // to settle should not require fighting a swarm before the first mission.
    const x=1700+r()*(WORLD_W-2450),zi=zoneAt(x),y=Math.max(130,floorAt(x)-90-r()*440);
    if(at(x,y)||x>223*T)continue;
    const type=zi===0?'shrimp':zi===1?(r()<.55?'fish':'urchin'):zi===2?(r()<.55?'eel':'urchin'):'angler';
    const hp={shrimp:38,fish:54,urchin:65,eel:80,angler:95}[type];
    enemies.push({id:i,x,y,homeX:x,homeY:y,vx:0,vy:0,r:type==='eel'?19:15,type,hp,max:hp,damage:8+zi*3,timer:r()*3,phase:r()*TAU,alert:false,poison:0,slow:0,flash:0,shot:1+r()*2});
  }
  boss={x:245*T,y:83*T,vx:0,vy:0,r:68,hp:900,max:900,active:false,phase:1,pattern:0,timer:2.5,warn:0,state:'idle',poison:0,slow:0,flash:0,targetX:0,targetY:0,attackTime:0};
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
    if(![1,2].includes(data.version)||!Array.isArray(data.unlocked)||!Number.isFinite(data.age)||!Number.isFinite(data.pearls))return null;
    const s={...defaultState(),...data};
    if(data.version===1){const age=clamp(data.age,0,LIFE-.01),oldEnds=[0,35,70,140,420,480],newEnds=[0,35,55,130,420,465];const i=Math.min(4,Math.max(0,oldEnds.findIndex((end,k)=>k>0&&age<end)-1));s.age=newEnds[i]+(age-oldEnds[i])/(oldEnds[i+1]-oldEnds[i])*(newEnds[i+1]-newEnds[i]);}
    s.version=2;
    s.age=clamp(s.age,0,LIFE-.01);s.cycle=clamp(Math.floor(s.cycle)||1,1,10000);s.pearls=clamp(Math.floor(s.pearls),0,999999);
    s.unlocked=[...new Set([0,...s.unlocked.filter(v=>Number.isInteger(v)&&v>=0&&v<organs.length)])];
    s.weapon=s.unlocked.includes(s.weapon)?s.weapon:0;
    s.upgrades=Object.fromEntries(upgrades.map(u=>[u.id,clamp(Math.floor(s.upgrades?.[u.id])||0,0,u.max)]));
    for(const key of ['opened','anchors','explored','visitedLogs'])s[key]=Array.isArray(s[key])?s[key]:[];
    s.checkpoint=objects.some(o=>o.kind==='anchor'&&o.id===s.checkpoint)?s.checkpoint:'home';
    s.trackBoss=s.trackBoss!==false;
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
  if(isAnchoredStage())settlePlayer();
  if(boss.active)boss.active=false;
  camera.x=clamp(player.x-W/2,0,WORLD_W-W);camera.y=clamp(player.y-H*.52,0,WORLD_H-H);
  mode='play';menu=null;lastBiome=-1;input.keys.clear();shots=[];particles=[];labels=[];
  $('start-screen').classList.add('hidden');$('panel-overlay').classList.add('hidden');
  for(const id of ['hud','quest','life-hud','hotbar','game-menu','signal-hud'])$(id).classList.remove('hidden');
  if(touch)$('touch-controls').classList.remove('hidden');
  navPath=[];navTime=0;scanTime=0;scanCooldown=0;refreshNavigation();buildHotbar();updateHUD();reveal();saveGame();
  canvas.focus({preventScroll:true});startAudio();
  toast(resume?'กลับสู่โครงการ REBORN · เซฟเดิมพร้อมใช้':'กู้ระบบ NAUTILUS · เก็บหนวดเสริมใยทางขวาก่อน',4);
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
function reveal(rx=15,ry=12) {
  const cx=Math.floor(player.x/T),cy=Math.floor(player.y/T);
  for(let x=cx-rx;x<=cx+rx;x++)for(let y=cy-ry;y<=cy+ry;y++)if(x>=0&&x<COLS&&y>=0&&y<ROWS&&((x-cx)/rx)**2+((y-cy)/ry)**2<1)explored.add(y*COLS+x);
}
function scan(){
  if(mode!=='play')return;
  if(scanCooldown>0){toast(`โซนาร์กำลังชาร์จ · ${Math.ceil(scanCooldown)} วินาที`,1.5);return;}
  if(player.energy<10){toast('โซนาร์ใช้พลังงาน 10 · รอให้แหล่งจ่ายฟื้น');return;}
  player.energy-=10;scanTime=3;scanCooldown=6;reveal(34,26);ripple(player.x,player.y,'#91dddf',650);refreshNavigation();saveGame();playTone(800,.18,'sine',.03);toast('สแกนพื้นที่แล้ว · เส้นสีส้มคือเส้นทางภารกิจ',2.5);updateHUD();
}
// A known station survey provides the mission route even through unexplored
// water. Grid clearance fits the largest medusa; no arrows lead through rock.
let navWalk=null;
function nearestNavCell(p){
  const cx=clamp(Math.floor(p.x/T),1,COLS-2),cy=clamp(Math.floor(p.y/T),1,ROWS-2);
  let best=-1,bestD=Infinity;
  for(let r=0;r<9;r++){
    for(let x=Math.max(1,cx-r);x<=Math.min(COLS-2,cx+r);x++)for(let y=Math.max(1,cy-r);y<=Math.min(ROWS-2,cy+r);y++){
      const id=y*COLS+x;if(!navWalk[id])continue;const d=(x*T+T/2-p.x)**2+(y*T+T/2-p.y)**2;
      if(d<bestD){best=id;bestD=d;}
    }
    if(best>=0&&r>=2)return best;
  }
  return best;
}
function refreshNavigation(){
  navTime=0;navTarget=questData().target;navPath=[];
  if(!state.trackBoss||!navTarget||boss.active||isAnchoredStage())return;
  if(!navWalk){navWalk=new Uint8Array(COLS*ROWS);for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)navWalk[y*COLS+x]=!collides(x*T+T/2,y*T+T/2,22)?1:0;}
  const source=nearestNavCell(player),goal=nearestNavCell(navTarget);if(source<0||goal<0)return;
  const from=new Int32Array(COLS*ROWS);from.fill(-1);const q=new Int32Array(COLS*ROWS);let head=0,tail=1;q[0]=source;from[source]=source;
  while(head<tail&&from[goal]<0){const id=q[head++];for(const n of [id-1,id+1,id-COLS,id+COLS])if(n>=0&&n<navWalk.length&&navWalk[n]&&from[n]<0){from[n]=id;q[tail++]=n;}}
  if(from[goal]<0)return;
  for(let id=goal;;id=from[id]){navPath.push({x:id%COLS*T+T/2,y:Math.floor(id/COLS)*T+T/2});if(id===source)break;}
  navPath.reverse();
}
function navigationPoint(){
  let point=navPath[0]||navTarget;
  for(const p of navPath){if(dist(player,p)<34)continue;
    const length=dist(player,p),n=Math.ceil(length/8);let clear=true;
    for(let i=1;i<=n;i++)if(collides(lerp(player.x,p.x,i/n),lerp(player.y,p.y,i/n),player.r)){clear=false;break;}
    if(!clear)break;point=p;if(length>115)break;
  }
  return point;
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
  if(player.inv>0||mode!=='play'||nurseryShield())return;
  player.hp-=damage;player.inv=.9;
  const a=Math.atan2(player.y-y,player.x-x);player.vx+=Math.cos(a)*140;player.vy+=Math.sin(a)*140;
  shake=reducedMotion?0:5;particlesAt(player.x,player.y,'#f2adb0',10,90);playTone(100,.13,'triangle',.06);label(player.x,player.y-28,`−${Math.round(damage)}`,'#ffadb7');
  if(player.hp<=0)rebirth('death');
}
function rebirth(reason='age') {
  if(reason==='death')deaths++;
  if(boss.active){boss.active=false;boss.hp=boss.max;boss.state='idle';boss.phase=1;boss.timer=2.5;}
  state.cycle++;state.age=35;
  const old={x:player.x,y:player.y};player=makePlayer(reason==='age'?old:null);shots=[];
  settlePlayer();refreshNavigation();
  particlesAt(old.x,old.y,'#d0efc8',30,140);ripple(player.x,player.y,'#d0efc8',180);
  $('boss-hud').classList.add('hidden');document.body.classList.remove('boss-active');
  saveGame();
  openPanel('rebirth',reason);
  playTone(262,.25,'sine',.04);playTone(392,.35,'sine',.04,.1);
}
function changeStage(idx) {
  const oldMax=stageDefs[player.stage].hp+state.upgrades.shell*20;
  player.stage=idx;player.r=stageDefs[idx].radius;player.hp=clamp(player.hp+(maxHP()-oldMax),1,maxHP());
  if(idx===5&&boss.active){boss.active=false;boss.hp=boss.max;boss.state='idle';$('boss-hud').classList.add('hidden');document.body.classList.remove('boss-active');const home=objects.find(o=>o.id===state.checkpoint)||objects[0];player.x=home.x;player.y=home.y-70;}
  // Growth beside rocks must not embed the larger body in terrain.
  if(collides(player.x,player.y,player.r)) {
    for(let r=T;r<=T*5;r+=T) {let moved=false;for(let a=0;a<TAU;a+=TAU/8){const x=player.x+Math.cos(a)*r,y=player.y+Math.sin(a)*r;if(!collides(x,y,player.r)){player.x=x;player.y=y;moved=true;break;}}if(moved)break;}
  }
  if(isAnchoredStage())settlePlayer();
  else{player.rootX=null;player.rootY=null;}
  ripple(player.x,player.y,stageDefs[idx].color,160);particlesAt(player.x,player.y,stageDefs[idx].color,28,120);
  toast(`${idx===5?'เริ่มจัดโครงสร้างเนื้อเยื่อใหม่':`เข้าสู่${stageDefs[idx].name}`} · ${stageDefs[idx].desc}`,4);playTone(520,.2,'sine',.04);
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
  if(stageIndex()===5){toast('ระยะซีสต์กำลังจัดโครงสร้างเนื้อเยื่อ · รอคืนสู่โพลิป',1.5);player.cool=.5;return;}
  const o=organs[state.weapon];if(player.energy<o.energy){if(player.cool<=0)toast('พลังงานต่ำ · หยุดโจมตีสักครู่เพื่อฟื้นพลัง',1.2);player.cool=.25;return;}
  player.energy-=o.energy;player.cool=o.cool;player.attackFlash=.2;
  const a=aim();player.aim=a;const dmg=o.damage*bodyDamage();
  const targets=[...enemies,...(boss.active?[boss]:[])].filter(e=>e.hp>0);
  if(o.type==='melee'||o.type==='touch') {
    const range=o.type==='touch'?80:150;
    ripple(player.x+(o.type==='touch'?0:Math.cos(a)*45),player.y+(o.type==='touch'?0:Math.sin(a)*45),o.color,range);
    for(const e of targets)if(dist(player,e)<range+e.r){let da=Math.atan2(e.y-player.y,e.x-player.x)-a;da=Math.atan2(Math.sin(da),Math.cos(da));if(o.type==='touch'||Math.abs(da)<1.8){hitEnemy(e,dmg);if(e!==boss){e.vx+=Math.cos(a)*160;e.vy+=Math.sin(a)*160;}}}
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
  if(isAnchoredStage()){toast(stageIndex()===1?'โพลิปเกาะพื้น · เก็บอาหารหรือปรับโมดูลระหว่างรอแตกหน่อ':'ซีสต์ไม่สามารถว่ายได้',1.8);return;}
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
    refreshNavigation();toast(`ติดตั้ง ${organs[o.organ].name} · ${organs[o.organ].desc}`,4.5);playTone(660,.2,'sine',.04);saveGame();
  }else if(o.kind==='anchor') {
    if(!state.anchors.includes(o.id))state.anchors.push(o.id);
    state.checkpoint=o.id;player.hp=maxHP();player.energy=100;player.food=Math.max(player.food,65);
    ripple(o.x,o.y,'#b5f4c0',140);toast('เชื่อมฐานเพาะเลี้ยง · ฟื้นพลังและบันทึกโพลิปสำรอง');saveGame();
  }else if(o.kind==='transit'){
    if(state.unlocked.length<2){toast('ติดตั้งหนวดเสริมใยจากแท่นทางซ้ายก่อนใช้ท่อกระแส');return;}
    if(stageIndex()<2||isAnchoredStage()){toast('รอแตกหน่อเมดูซาก่อนเดินทางด้วยท่อกระแส');return;}
    const destination=objects.find(o=>o.id==='deep-home');state.travelUsed=true;state.checkpoint=destination.id;if(!state.anchors.includes(destination.id))state.anchors.push(destination.id);
    player.x=destination.x;player.y=destination.y-90;player.vx=player.vy=0;player.inv=2;player.hp=maxHP();player.food=100;player.energy=100;
    camera.x=clamp(player.x-W*.5,0,WORLD_W-W);camera.y=clamp(player.y-H*.5,0,WORLD_H-H);reveal();refreshNavigation();ripple(player.x,player.y,'#91dddf',150);saveGame();toast('ถึงฐานหน้า NAUTILUS · ตามไฟสีส้มทางขวาสู่บอส',4);
  }else if(o.kind==='log'){
    if(!state.visitedLogs.includes(o.entry))state.visitedLogs.push(o.entry);saveGame();openPanel('log',o.entry);
  }else if(o.kind==='gate') {
    if(state.bossDefeated){toast('NAUTILUS กลับสู่โหมดสำรวจ · ฐานข้อมูลปลอดภัยแล้ว');return;}
    if(stageIndex()<2||isAnchoredStage()){toast('พร้อมสู้เมื่อเป็นเมดูซาวัยอ่อน · ไม่ต้องรอโตเต็มวัย',3);return;}
    if(state.unlocked.length<2){toast('ติดตั้งหนวดเสริมใยอีก 1 โมดูล ก็พร้อมท้าทายบอส',3);return;}
    activateBoss();
  }
}
function activateBoss() {
  boss.active=true;boss.hp=boss.max;boss.phase=1;boss.pattern=0;boss.timer=1.5;boss.state='idle';boss.poison=0;boss.slow=0;
  boss.x=246*T;boss.y=83*T;player.x=230*T;player.y=83*T;
  player.hp=maxHP();player.energy=100;player.inv=1;shots=[];
  $('boss-hud').classList.remove('hidden');document.body.classList.add('boss-active');
  navPath=[];toast('NAUTILUS-01 · หลบแนวสีแดงก่อนโดรนพุ่ง แล้วโจมตีช่วงพัก',4);ripple(boss.x,boss.y,'#eea0ad',220);playTone(65,.8,'triangle',.07);
}
function updateBoss(dt) {
  if(!boss.active||boss.hp<=0)return;
  boss.flash=Math.max(0,boss.flash-dt);boss.slow=Math.max(0,boss.slow-dt);
  if(boss.poison>0){boss.poison-=dt;boss.hp-=5*bodyDamage()*dt;if(boss.hp<=0){defeatBoss();return;}}
  if(boss.hp<boss.max*.5&&boss.phase===1){boss.phase=2;toast('NAUTILUS เปลี่ยนโหมดป้องกัน · การโจมตีเร็วขึ้น',3);particlesAt(boss.x,boss.y,'#f69c9b',35,150);}
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
  moveEntity(boss,dt);boss.x=clamp(boss.x,230*T,254*T);boss.y=clamp(boss.y,71*T,96*T);
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
  scanTime=Math.max(0,scanTime-dt);scanCooldown=Math.max(0,scanCooldown-dt);navTime+=dt;if(navTime>1)refreshNavigation();
  player.food=clamp(player.food+dt*(nurseryShield()?2:-.095),0,100);if(player.food<=0)player.hp-=dt*1.8;
  if(player.food>60&&player.hp<maxHP()&&!boss.active)player.hp=Math.min(maxHP(),player.hp+dt*.8);
  if(player.hp<=0){rebirth('death');return;}
  let ix=input.joyX+(input.keys.has('KeyD')||input.keys.has('ArrowRight')?1:0)-(input.keys.has('KeyA')||input.keys.has('ArrowLeft')?1:0);
  let iy=input.joyY+(input.keys.has('KeyS')||input.keys.has('ArrowDown')?1:0)-(input.keys.has('KeyW')||input.keys.has('ArrowUp')?1:0);
  const mag=Math.hypot(ix,iy);if(mag>1){ix/=mag;iy/=mag;}
  if(mag>.05){input.dx=ix/(mag>1?1:mag);input.dy=iy/(mag>1?1:mag);}
  if(isAnchoredStage()){player.x=player.rootX;player.y=player.rootY;player.vx=player.vy=0;}
  else {
    if(player.dashTime>0) {player.dashTime-=dt;particlesAt(player.x,player.y,stageDefs[st].color,2,25);}
    else {const e=environmentAt(),pulse=st===0?1:.86+.14*Math.sin(time*4.8),speed=stageDefs[st].speed*pulse*(player.food<20?.8:1);player.vx=lerp(player.vx,ix*speed+e.currentX,Math.min(1,dt*5));player.vy=lerp(player.vy,iy*speed+e.currentY,Math.min(1,dt*5));}
    moveEntity(player,dt);
  }
  player.aim=aim();
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
    px(ctx,'#426478',x-20,y-h,40,h);px(ctx,'#132a3d',x-15,y-h+8,30,h-16);px(ctx,'#708998',x-25,y-h,50,8);px(ctx,'#537b85',x-25,y-8,50,8);
    for(let i=0;i<5;i++){px(ctx,'#456175',x-12,y-h+17+i*19,24,12);px(ctx,i===2?'#f0b07c':'#91dddf',x-8,y-h+20+i*19,4,3);px(ctx,'#799caa',x+1,y-h+20+i*19,9,2);}
    line(ctx,'#2f6474',[[x+20,y-35],[x+68,y-35],[x+68,y-4]],3);
    ctx.font='8px monospace';ctx.textAlign='center';ctx.fillStyle='#bdd9d8';ctx.fillText('P-LAB',x,y-h-8);
    if(wx===178*T){px(ctx,'#527687',x-80,y-h+2,130,11);px(ctx,'#91dddf',x-48,y-h-3,74,3);}
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
  const color=flash>0?'#f4ffe2':stageDefs[st].color,accent=organs[weapon].color,pulse=st===1||st===5?1:1+Math.sin(anim*4.8)*.07;
  c.scale(pulse,1/pulse);
  if(st===0) {
    px(c,color,-11,-7,22,14);px(c,color,-8,-10,16,20);px(c,'#85bcb38c',-9,4,18,5);px(c,'#f0fff18e',-5,-6,10,3);
    for(let i=0;i<7;i++){const a=i*TAU/7+anim*.1;line(c,accent+'c0',[[Math.cos(a)*11,Math.sin(a)*8],[Math.cos(a)*17,Math.sin(a)*13]],1);}
    px(c,'#bf84818c',-3,-2,6,4);
  }else if(st===1) {
    px(c,'#91b7a0',-5,-3,10,19);px(c,color,-11,-8,22,10);px(c,color,-7,-12,14,6);px(c,'#f6eccac0',-4,-8,8,3);
    for(let i=0;i<6;i++){const a=-Math.PI+i*Math.PI/5,wx=Math.sin(anim*2+i)*2;line(c,accent,[[Math.cos(a)*9,Math.sin(a)*5-7],[Math.cos(a)*17+wx,Math.sin(a)*17-7]],2);}
    px(c,color,-8,13,16,3);px(c,'#bd8e88',-2,-7,4,7);px(c,'#8cb7a0',-2,4,4,8);
    if(Math.sin(anim*1.6)>.2){px(c,color,5,4,7,6);line(c,color,[[9,5],[14,1],[16,3]],1);}
  }else if(st===5){
    px(c,color+'9a',-9,-7,18,14);px(c,color+'bc',-6,-9,12,18);px(c,'#bda58c',-10,8,20,3);
    for(let i=0;i<3;i++)px(c,'#d99d91',-5+i*4,-3+Math.sin(anim+i)*2,3,3);
    line(c,'#ead4b68a',[[-7,2],[-2,-4],[5,3],[7,-2]],1);
  }else {
    const r=stageDefs[st].radius,count=st===2?8:12;
    const tentLen=weapon===1?46:weapon===3?25:32;
    for(let i=0;i<count;i++) {
      const xx=(i-(count-1)/2)*r*1.65/count,len=tentLen+(i%3)*5+Math.sin(anim*2+i)*3,wiggle=Math.sin(anim*2+i*.85)*4;
      const points=[[xx,r*.18],[xx+wiggle,r*.5+len*.3],[xx-wiggle*.3,r*.5+len*.65],[xx+wiggle*.8,r*.5+len]];
      line(c,i%2===0?accent+'b0':color+'85',points,weapon===1?3:2);
      if(weapon===1){px(c,accent,xx+wiggle-3,r*.5+len*.3,7,3);px(c,accent,xx-wiggle*.3-3,r*.5+len*.65,7,3);}
      if(weapon===4&&i%2===0)px(c,'#fff3b9',points[2][0],points[2][1],3,3);
    }
    px(c,color+'50',-r,-r*.48,r*2,r*.7);px(c,color+'64',-r*.76,-r*.76,r*1.52,r*.4);px(c,color+'80',-r*.47,-r*.92,r*.94,r*.26);
    line(c,color+'dc',[[-r,3],[-r,-r*.48],[-r*.72,-r*.76],[-r*.4,-r*.93],[r*.4,-r*.93],[r*.72,-r*.76],[r,-r*.48],[r,3]],2);
    px(c,color+'c0',-r-2,3,r*2+4,3);px(c,'#edffe180',-r*.55,-r*.65,r*.55,2);
    for(let i of [-1,1])line(c,color+'aa',[[0,1],[i*r*.36,-r*.37],[i*r*.72,-r*.54]],1);
    line(c,color+'b0',[[0,3],[0,-r*.8]],1);px(c,'#dc9c91',-3,-r*.2,6,r*.48);px(c,'#f2ba9b',-2,-r*.3,4,4);
    // The external actuator ring and asymmetric sensor are fictional equipment.
    if(weapon>0||armor>0){px(c,'#527b87',-r-3,6,r*2+6,3);px(c,accent,-r-4,3,5,8);px(c,'#e5f3e1',r,3,5,5);}
    if(weapon===2){px(c,accent+'c4',-r*.42,-r*.48,8,8);px(c,'#ebf5bf6a',-r*.37,-r*.43,3,3);}
    if(weapon===3){px(c,'#bfe2e8',-r*.75,-r*.76,r*1.5,4);px(c,'#7bafb6',-3,-r*.82,6,9);}
    if(weapon===4)for(let i of [-1,1]){px(c,'#72838e',i*(r+5)-3,-7,6,12);px(c,accent,i*(r+5)-2,-5,4,5);}
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
    px(ctx,'#315d64',x-28,y+5,56,12);px(ctx,'#90b4b6',x-23,y-52,46,5);px(ctx,'#90b4b6',x-23,y-52,5,56);px(ctx,'#90b4b6',x+18,y-52,5,56);
    px(ctx,'#91dddf28',x-18,y-47,36,51);drawJelly(ctx,x,y-11,1,0,.7,time);px(ctx,color,x+25,y-30,4,18);px(ctx,'#172f3c',x+25,y-14,14,8);px(ctx,color,x+28,y-12,4,3);
    if(active){for(let i=0;i<4;i++){const a=time*.7+i*TAU/4;px(ctx,'#d8f6b687',x+Math.cos(a)*28,y-29+Math.sin(a)*20,2,2);}}
  }else if(o.kind==='transit'){
    glow(ctx,x,y-22,130,'#91dddf',.24);px(ctx,'#365e70',x-32,y+18,64,12);px(ctx,'#a8c9ca',x-30,y-70,8,90);px(ctx,'#a8c9ca',x+22,y-70,8,90);px(ctx,'#718e9d',x-35,y-77,70,9);px(ctx,'#91dddf28',x-22,y-68,44,88);
    for(let i=0;i<5;i++){const yy=y+12-((time*40+i*20)%78);line(ctx,'#91dddf9e',[[x-10,yy+4],[x,yy],[x+10,yy+4]],2);}
    px(ctx,'#f1b78c',x+31,y-40,6,20);ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillStyle='#b9e3e3';ctx.fillText('NAUTILUS →',x,y-89);
  }else if(o.kind==='log'){
    px(ctx,'#4c6a82',x-14,y-19,28,37);px(ctx,'#092b3c',x-10,y-15,20,27);px(ctx,'#91dddf',x-7,y-11,14,3);for(let i=0;i<3;i++)px(ctx,'#7fbdc6',x-6,y-4+i*5,10-i*2,1);px(ctx,'#9db4bd',x-3,y+20,6,18);
    if(!state.visitedLogs.includes(o.entry))glow(ctx,x,y,50,'#a8dce2',.2);
  }else if(o.kind==='gate'){
    const defeated=state.bossDefeated,cc=defeated?'#a9dbc7':'#ffae84';glow(ctx,x,y-25,150,cc,.2);
    px(ctx,'#444354',x-36,y-93,15,124);px(ctx,'#444354',x+21,y-93,15,124);px(ctx,'#696779',x-45,y-99,27,8);px(ctx,'#696779',x+18,y-99,27,8);
    px(ctx,cc,x-31,y-71,5,17);px(ctx,cc,x+26,y-71,5,17);px(ctx,'#36384b',x-43,y+24,86,8);
    if(!defeated){for(let i=-2;i<=2;i++)px(ctx,cc+'85',x+i*8,y-65+Math.sin(time*2+i)*9,3,3);}
    else{px(ctx,'#cce5b3',x-5,y-27,10,4);px(ctx,'#cce5b3',x+1,y-34,4,8);}
    px(ctx,'#607a8a',x-38,y-106,76,8);ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle=cc;ctx.fillText('NAUTILUS-01',x,y-115);
  }
  if((scanTime>0||navTarget===o)&&!(o.kind==='organ'&&state.opened.includes(o.id))){ctx.strokeStyle='#ffc08c';ctx.lineWidth=1;ctx.strokeRect(x-37,y-80,74,113);}
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
  const cc=boss.flash>0?'#ffe3bd':'#a4b2bd',dir=player.x<boss.x?-1:1,sensor=boss.phase===2?'#ff887c':'#ffbc86';
  glow(ctx,x,y,180,boss.phase===2?'#d39c93':'#a5a1ce',.18);
  if(boss.active&&boss.state==='warning') {
    ctx.save();ctx.globalAlpha=.2+Math.sin(time*18)*.08;
    if(boss.pattern===0){const a=Math.atan2(boss.targetY-boss.y,boss.targetX-boss.x);ctx.translate(x,y);ctx.rotate(a);px(ctx,'#ff9c91',0,-32,580,64);line(ctx,'#ffe8bb',[[0,0],[580,0]],2);}
    else if(boss.pattern===1){const a=Math.atan2(boss.targetY-boss.y,boss.targetX-boss.x);ctx.strokeStyle='#f8b199';ctx.lineWidth=2;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a+i*.18)*440,y+Math.sin(a+i*.18)*440);ctx.stroke();}}
    else {ctx.strokeStyle='#efa8a8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,200+Math.sin(time*10)*14,0,TAU);ctx.stroke();}
    ctx.restore();
  }
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(dir,1);
  // ROV frame, thruster housings, sampling arms and optical sensor.
  px(ctx,'#3e5469',-78,-48,151,96);px(ctx,cc,-78,-48,151,8);px(ctx,cc,-78,40,151,8);px(ctx,cc,-78,-48,8,96);px(ctx,cc,65,-48,8,96);
  for(const yy of [-47,47]){px(ctx,'#1d334a',-54,yy-12,55,24);px(ctx,'#657f91',-57,yy-16,62,7);px(ctx,'#657f91',-57,yy+10,62,7);line(ctx,'#90c6d0',[[Math.sin(time*18)*17-27,yy-9],[-27-Math.sin(time*18)*17,yy+9]],3);}
  px(ctx,cc,-36,-32,89,64);px(ctx,'#788a98',-28,-24,66,48);px(ctx,'#243e52',-20,-15,42,30);px(ctx,'#9acec8',-15,-10,20,4);px(ctx,'#608c9e',-15,-1,29,2);px(ctx,'#608c9e',-15,6,20,2);
  px(ctx,'#192c43',35,-20,25,40);px(ctx,sensor,41,-12,17,24);px(ctx,'#fce8ce',46,-5,7,10);px(ctx,'#ffe2b9',52,-11,3,4);
  for(let i=0;i<4;i++)px(ctx,sensor,-20+i*12,-35,6,3);
  line(ctx,cc,[[-40,35],[-34,62],[-5,73],[12,62]],5);line(ctx,'#576f83',[[12,62],[25,68],[25,76]],3);line(ctx,'#576f83',[[12,62],[18,52],[27,55]],3);
  line(ctx,cc,[[-52,-48],[-52,-74],[-35,-74]],3);px(ctx,'#91dddf',-39,-78,10,8);
  ctx.restore();ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillStyle='#273f51';ctx.fillText('NAUTILUS',x,y+28);glow(ctx,x+dir*50,y,65,sensor,.28);
  if(!boss.active){ctx.font='10px monospace';ctx.textAlign='center';ctx.fillStyle='#ffc08c';ctx.fillText('NAUTILUS-01 / STANDBY',x,y+100);}
}
function drawNavigation(){
  if(mode==='title'||boss.active||!state.trackBoss||isAnchoredStage()||!navTarget)return;
  ctx.save();ctx.strokeStyle='#ffc08c';ctx.lineWidth=2;ctx.globalAlpha=.34;ctx.beginPath();let started=false;
  for(const p of navPath){const x=p.x-camera.x,y=p.y-camera.y;if(x<-30||x>W+30||y<-30||y>H+30){started=false;continue;}ctx[started?'lineTo':'moveTo'](x,y);started=true;}ctx.stroke();
  const target=navigationPoint();if(target&&dist(player,target)>42){const a=Math.atan2(target.y-player.y,target.x-player.x),x=player.x-camera.x+Math.cos(a)*65,y=player.y-camera.y+Math.sin(a)*65;ctx.globalAlpha=.95;ctx.translate(x,y);ctx.rotate(a);line(ctx,'#ffc08c',[[-6,-7],[3,0],[-6,7]],3);}
  ctx.restore();
  const gate=objects.find(o=>o.id==='gate');if(player.x>209*T&&!state.bossDefeated){for(let i=0;i<11;i++){const wx=(216+i)*T,x=wx-camera.x,y=gate.y+25-camera.y;if(x<0||x>W||y<0||y>H)continue;px(ctx,'#ffc08c',x,y,7,3);if(i%2===0)line(ctx,'#ffad86',[[x-2,y-13],[x+3,y-9],[x-2,y-5]],2);}}
}
function render() {
  ctx.imageSmoothingEnabled=false;renderBackground();
  ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  for(const d of decorations)drawPlant(d);
  drawRuins();drawTerrain();
  for(const o of objects)drawObject(o);
  drawNavigation();
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
    if(isAnchoredStage()){const x=player.x-camera.x,y=player.y-camera.y;px(ctx,'#6f98a4',x-28,y+player.r,56,4);line(ctx,'#91dddf65',[[x-27,y+player.r],[x-27,y-22],[x,y-34],[x+27,y-22],[x+27,y+player.r]],1);px(ctx,'#91dddf',x-30,y-5,4,6);px(ctx,'#91dddf',x+26,y-5,4,6);ctx.font='8px monospace';ctx.textAlign='center';ctx.fillStyle='#91dddf';ctx.fillText('NURSERY MESH',x,y-43);}
    drawJelly(ctx,player.x-camera.x,player.y-camera.y,player.stage,state.weapon,1,time,player.inv,player.attackFlash,state.upgrades.shell,player.aim);
    const ax=player.x-camera.x+Math.cos(player.aim)*42,ay=player.y-camera.y+Math.sin(player.aim)*42;
    if(!touch&&mode==='play'){ctx.globalAlpha=.5;line(ctx,'#dce8c9',[[ax-3,ay],[ax+3,ay]],1);line(ctx,'#dce8c9',[[ax,ay-3],[ax,ay+3]],1);ctx.globalAlpha=1;}
  }
  if(scanTime>0&&mode!=='title'){ctx.save();ctx.globalAlpha=scanTime/3*.2;ctx.strokeStyle='#91dddf';ctx.lineWidth=1;const radius=(3-scanTime)*260;ctx.beginPath();ctx.arc(player.x-camera.x,player.y-camera.y,radius,0,TAU);ctx.stroke();for(let x=0;x<W;x+=T*3)line(ctx,'#91dddf',[[x,0],[x,H]],1);ctx.restore();}
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
  const object=id=>objects.find(o=>o.id===id),st=stageIndex();
  if(state.bossDefeated)return {title:'กู้ NAUTILUS สำเร็จ',detail:'สำรวจโมดูลที่เหลือและบันทึกวิจัยต่อได้',target:null};
  if(boss.active)return {title:'หยุดโหมดป้องกัน NAUTILUS',detail:'หลบแนวแดง · โจมตีช่วงโดรนพัก',target:boss};
  if(st===5)return {title:'จัดโครงสร้างเนื้อเยื่อใหม่',detail:`ซีสต์ → โพลิปใน ${Math.ceil(LIFE-state.age)} วินาที · ตาข่ายกำลังป้องกัน`,target:null};
  if(st===1)return {title:'โพลิปเกาะพื้นแล้ว',detail:`แตกหน่อเมดูซาใน ${Math.ceil(55-state.age)} วินาที · เปิด I ปรับโมดูลได้`,target:null};
  if(state.unlocked.length<2)return {title:'ติดตั้งหนวดเสริมใย',detail:'ตามเส้นสีส้ม · กด E ที่แท่นโมดูล',target:object('barbs')};
  if(st===0)return {title:'เตรียมแตกหน่อเมดูซา',detail:'โพลิปจะเกาะพื้นก่อนออกเดินทาง · บอสเริ่มได้ที่ 00:55',target:object('express')};
  if(!state.travelUsed&&player.x<160*T)return {title:'ใช้ทางลัดสู่บอส',detail:'กด E ที่ท่อกระแส · ถึงฐานหน้า NAUTILUS ทันที',target:object('express')};
  return {title:'พร้อมกู้ NAUTILUS-01',detail:'ตามไฟสีส้ม · กด E ที่ประตูเพื่อเริ่มสู้',target:object('gate')};
}
function updateHUD() {
  const mh=maxHP(),st=stageIndex(),def=stageDefs[st];
  $('health-fill').style.width=`${clamp(player.hp/mh,0,1)*100}%`;$('health-text').textContent=`${Math.ceil(player.hp)} / ${mh}`;
  $('energy-fill').style.width=`${player.energy}%`;$('energy-text').textContent=`${Math.floor(player.energy)}`;
  $('food-fill').style.width=`${player.food}%`;$('food-text').textContent=`อิ่ม ${Math.floor(player.food)}%`;
  $('stage-icon').textContent=def.icon;$('stage-name').textContent=def.name;$('cycle-text').textContent=`ชีวิตที่ ${state.cycle}`;
  $('stage-time').textContent=fmt(def.end-state.age);$('stage-time').title=st===5?'เวลาจนกลับเป็นโพลิป':'เวลาจนเข้าสู่ระยะถัดไป (เวลาย่อสำหรับเกม)';
  $('life-fill').style.width=`${state.age/LIFE*100}%`;
  document.querySelectorAll('.life-stages span').forEach((el,i)=>el.classList.toggle('active',i===st));
  const zi=zoneAt(player.x),z=zones[zi];$('biome-tag').textContent=`0${zi+1} / ${z.en}`;$('biome-name').textContent=z.name;
  const env=environmentAt();$('depth-text').textContent=`SIM DEPTH ${Math.round(env.depth)} m / ${env.pressure.toFixed(1)} bar`;
  $('env-text').textContent=`${env.temperature.toFixed(1)} °C · กระแส ${env.currentX>0?'→':'←'} · แบบจำลอง`;
  $('footer-status').textContent=`◇ ${state.pearls} · ${state.unlocked.length}/6 โมดูล`;
  const gate=objects.find(o=>o.id==='gate');$('signal-text').textContent=state.bossDefeated?'กู้ระบบแล้ว':boss.active?'เชื่อมต่อแล้ว':`พบสัญญาณ · ${Math.round(dist(player,gate)/8)} m`;
  $('signal-hud').classList.toggle('tracking-off',!state.trackBoss);
  $('scan-btn').textContent=scanCooldown>0?`สแกน ${Math.ceil(scanCooldown)}s`:'สแกน R';$('scan-btn').disabled=scanCooldown>0||mode!=='play';
  if(zi!==lastBiome){lastBiome=zi;if(mode==='play')showArea(zi);}
  const q=questData();$('quest-title').textContent=q.title;
  let direction='';if(q.target&&!boss.active){direction=` · ${Math.round(dist(player,q.target)/8)} m`;}
  $('quest-detail').textContent=q.detail+direction;
  if(nearest&&mode==='play'){
    const prompt=$('interact-prompt');prompt.classList.remove('hidden');
    const key=touch?'สำรวจ':'[E]';
    prompt.textContent=`${key} ${nearest.kind==='anchor'?'พักและบันทึก':nearest.kind==='organ'?'เก็บ':''} ${nearest.name}`;
  }else $('interact-prompt').classList.add('hidden');
  if(boss.active){$('boss-fill').style.width=`${boss.hp/boss.max*100}%`;$('boss-phase').textContent=`DEFENSE MODE · ${boss.phase===1?'I':'II'}`;}
  $('touch-dash').style.opacity=player.dashCool>0||player.energy<22||isAnchoredStage()?'.4':'1';
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
  if(state.trackBoss&&navPath.length){c.strokeStyle='#ffc08e';c.globalAlpha=.65;c.lineWidth=isMini?1:2;c.beginPath();navPath.forEach((p,i)=>c[i?'lineTo':'moveTo'](p.x/WORLD_W*w,p.y/WORLD_H*h));c.stroke();c.globalAlpha=1;}
  for(const o of objects)if(visible(o)||['gate','transit'].includes(o.kind)){
    const color=o.kind==='organ'?(state.opened.includes(o.id)?'#86a299':'#ffda99'):o.kind==='anchor'?'#b5f4c0':o.kind==='transit'?'#91dddf':o.kind==='log'?'#a9bcdd':'#ffad86';
    px(c,color,o.x/WORLD_W*w-1,o.y/WORLD_H*h-1,isMini?2:4,isMini?2:4);
    if(o.kind==='gate'){const x=o.x/WORLD_W*w,y=o.y/WORLD_H*h;c.strokeStyle=color;c.lineWidth=1;c.strokeRect(x-(isMini?3:7),y-(isMini?3:7),isMini?6:14,isMini?6:14);if(!isMini){c.font='bold 12px monospace';c.textAlign='center';c.fillStyle=color;c.fillText('NAUTILUS / BOSS',x,y-12);}}
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
  const titles={pause:['PAUSED','พักใต้กระแสน้ำ'],help:['BIOLOGY / ENGINEERING','คู่มือ J-01'],body:['BODY / BIOHYBRID','ปรับแต่งร่างกาย'],map:['PELAGIC SURVEY','แผนที่และสัญญาณ'],mission:['RECOVERY PROTOCOL','ภารกิจกู้ NAUTILUS'],log:['PELAGIC / RESEARCH LOG','บันทึกวิจัย'],rebirth:['REVERSE DEVELOPMENT','กลับสู่โพลิป'],victory:['CONNECTION RESTORED','กู้ระบบ NAUTILUS สำเร็จ'],new:['NEW SPECIMEN','เริ่มการเดินทางใหม่?']};
  const [kicker,title]=titles[type]||titles.pause;$('panel-kicker').textContent=kicker;$('panel-title').textContent=title;
  if(type==='body')renderBody();
  else if(type==='map')renderMap();
  else if(type==='mission')renderMission();
  else if(type==='log'){
    const logs=[['REBORN PROJECT / 2147','J-01 เป็นตัวอย่าง Turritopsis dohrnii ที่ติดชุดควบคุม biohybrid สำหรับสำรวจสถานี PELAGIC ใต้ทะเล โพลิปสำรองถูกเก็บในฐานเพาะเลี้ยงทุกเขต','เมดูซาสามารถย้อนพัฒนาเป็นซีสต์แล้วกลับสู่โพลิป โครงการนี้จึงใช้วงจรดังกล่าวเป็นพื้นฐานการดูแลตัวอย่าง ส่วนโมดูลสู้รบและฐานสำรองเป็นเทคโนโลยีสมมติในเกม'],['NAUTILUS-01 / INCIDENT 07','โดรนเก็บตัวอย่าง NAUTILUS-01 ขาดการติดต่อ และเปิดโหมดป้องกันอัตโนมัติ เราจะตัดแหล่งจ่ายชั่วคราวแล้วกู้ฐานข้อมูล ไม่ต้องทำลายสิ่งมีชีวิตขนาดยักษ์','พบพิกัดแล้วตั้งแต่เริ่มภารกิจ ท่อกระแส C-01 ไปถึงฐานหน้าได้ทันทีหลังติดตั้งโมดูลที่สองและเข้าสู่ระยะเมดูซาวัยอ่อน เก็บขั้วไฟฟ้าใกล้ประตูได้ถ้าต้องการระยะโจมตีเพิ่ม']];
    const entry=logs[detail===1?1:0];content.innerHTML=`<div class="mission-card"><small>${entry[0]}</small><p>${entry[1]}</p></div><p>${entry[2]}</p>`;const a=addActions(content);button(a,'กลับสู่ทะเล','primary-btn',closePanel);button(a,'คู่มือวิทยาศาสตร์','secondary-btn',()=>openPanel('help'));
  }
  else if(type==='help') {
    content.innerHTML=`<p>ปี 2147 คุณคือ J-01 แมงกะพรุนพร้อมอุปกรณ์ biohybrid ภารกิจคือกู้โดรน NAUTILUS-01 ที่เสียการควบคุม ภาพตัวอย่างถูกขยายเพื่อให้เล่นได้</p><div class="controls-grid"><div><kbd>WASD / ↑↓←→</kbd><span>ว่าย / แรงหดตัวของกระดิ่ง</span></div><div><kbd>คลิก / J</kbd><span>โจมตีค้างได้</span></div><div><kbd>SPACE / K</kbd><span>พุ่งด้วยชุดขับเคลื่อน</span></div><div><kbd>E</kbd><span>ติดตั้ง / ฐาน / ท่อกระแส</span></div><div><kbd>R / B</kbd><span>สแกน / ภารกิจบอส</span></div><div><kbd>1–6 / I / M</kbd><span>เลือกโมดูล / ร่างกาย / แผนที่</span></div></div><p>มือถือใช้จอยและปุ่มบนหน้าจอ J ช่วยเล็งศัตรูใกล้ตัว ขณะเป็นโพลิปหรือซีสต์จะว่ายไม่ได้ มีตาข่ายเพาะเลี้ยงสมมติป้องกันและให้อาหารระหว่างรอ</p><div class="science-grid"><article><h3>พื้นฐานชีววิทยา</h3><p>T. dohrnii เป็นไฮโดรซัว โพลิปเกาะวัสดุและแตกหน่อเมดูซา จึงใช้ “เมดูซาวัยอ่อน” แทนเอไฟรา เมดูซาที่ได้รับความเครียดสามารถย้อนพัฒนาผ่านซีสต์สู่โพลิป ไม่ย้อนกลับเป็นตัวอ่อนโดยตรง และยังถูกฆ่าได้</p></article><article><h3>จินตนาการ sci-fi</h3><p>โครงพยุง ขั้วไฟฟ้า ไมโครแคปซูลและโดรนเป็นอุปกรณ์ที่สร้างขึ้น เวลา 8 นาที ความทนแรงดัน และการโหลดโพลิปสำรองเมื่อเสียชีวิตดัดแปลงเพื่อเกม งาน biohybrid จริงเป็นแรงบันดาลใจของชุดควบคุม</p></article></div><div class="stage-list">${stageDefs.map((s,i)=>`<div><strong>${s.name}</strong><small>${fmt(i?stageDefs[i-1].end:0)}–${fmt(s.end)}</small></div>`).join('')}</div><div class="note">ตัวอ่อนปรากฏเมื่อเริ่มเซฟใหม่ หลังซีสต์จะกลับเป็นโพลิป 20 วินาทีแล้วแตกหน่อเมดูซารอบใหม่ เวลาเดินเฉพาะขณะเล่น เซฟเดิมและอุปกรณ์ยังเก็บไว้</div><p>แรงดันประมาณจาก P = P₀ + ρgh โดยใช้น้ำทะเล 1,025 kg/m³ อุณหภูมิและกระแสเป็นแบบจำลองสำหรับโลกเกม ไม่ใช่ข้อมูลวัดทะเลจริง เข็มพิษเริ่มต้นใช้ระยะใกล้ ส่วนการยิงไกลมาจากอุปกรณ์</p><p>บอสอยู่ในแผนที่ตั้งแต่เริ่ม ติดตั้งหนวดเสริมใย แล้วใช้ท่อกระแสทางขวาเมื่อเป็นเมดูซาวัยอ่อน (00:55) หรือสำรวจตามเส้นสีส้ม กด E ที่ประตู ไม่ต้องเก็บครบ 6 โมดูล</p><p class="science-sources">อ่านงานต้นทาง: <a href="https://pubmed.ncbi.nlm.nih.gov/31619459/" target="_blank" rel="noopener noreferrer">การย้อนพัฒนา (G3, 2019)</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9459311/" target="_blank" rel="noopener noreferrer">จีโนม (PNAS, 2022)</a> · <a href="https://arxiv.org/abs/2311.06363" target="_blank" rel="noopener noreferrer">อุปกรณ์ biohybrid</a></p>`;
    const actions=addActions(content);button(actions,'เข้าใจแล้ว','primary-btn',closePanel);
  }else if(type==='pause') {
    content.innerHTML=`<p>กระแสน้ำจะรอคุณ วงจรชีวิตหยุดระหว่างพักเกม</p><div class="stat-grid"><div><strong>${state.cycle}</strong><small>ชีวิตที่</small></div><div><strong>${state.unlocked.length}/6</strong><small>อวัยวะที่ค้นพบ</small></div><div><strong>${state.pearls}</strong><small>ไข่มุก</small></div></div><p>ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์ของเครื่องนี้</p>`;
    const a=addActions(content);button(a,'ว่ายต่อ','primary-btn',closePanel);button(a,'วิธีเล่น','secondary-btn',()=>openPanel('help'));button(a,'กลับหน้าหลัก','secondary-btn',returnTitle);saveGame();
  }else if(type==='rebirth') {
    content.innerHTML=`<p>${detail==='death'?'ร่างเดิมเสียชีวิต ฐานเพาะเลี้ยงจึงเปิดโพลิปสำรองและย้ายข้อมูลโมดูลกลับมา ระบบสำรองนี้เป็นเทคโนโลยีสมมติ แมงกะพรุนจริงไม่ได้ฟื้นจากการถูกฆ่า':'ซีสต์จัดโครงสร้างเนื้อเยื่อใหม่แล้ว กลับเป็นโพลิปที่เกาะพื้น ก่อนแตกหน่อเมดูซาอีกครั้ง'}</p><div class="stat-grid"><div><strong>${state.cycle}</strong><small>รอบใหม่</small></div><div><strong>${state.unlocked.length}/6</strong><small>โมดูลที่เก็บไว้</small></div><div><strong>${state.pearls}</strong><small>ไข่มุกที่เก็บไว้</small></div></div><div class="note">โพลิปเกาะพื้น 20 วินาที ตาข่ายเพาะเลี้ยงกำลังป้องกันและให้อาหาร เปิดหน้าร่างกายเพื่ออัปเกรดได้ระหว่างรอ</div>`;
    const a=addActions(content);button(a,'ดูแลโพลิปต่อ','primary-btn',closePanel);button(a,'ปรับแต่งร่างกาย','secondary-btn',()=>openPanel('body'));
  }else if(type==='victory') {
    content.innerHTML=`<p>โหมดป้องกันถูกตัดแล้ว NAUTILUS-01 กลับมาเชื่อมต่อสถานี PELAGIC พร้อมส่งฐานข้อมูลตัวอย่างทะเล คุณกู้ระบบสำเร็จ</p><div class="stat-grid"><div><strong>+35</strong><small>ไข่มุกรางวัล</small></div><div><strong>${state.cycle}</strong><small>รอบที่ใช้</small></div><div><strong>${fmt(state.totalTime)}</strong><small>เวลาผจญภัย</small></div></div><div class="note">ยังสำรวจหาโมดูลครบทั้ง 6 อ่านบันทึกวิจัย และเล่นวงจรชีวิตต่อได้</div>`;
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
  for(const id of ['hud','quest','life-hud','hotbar','touch-controls','game-menu','boss-hud','interact-prompt','signal-hud'])$(id).classList.add('hidden');
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
    const text=document.createElement('div');text.innerHTML=`<strong>${o.name}</strong><span class="origin">${o.origin}</span><small>${unlocked?o.desc:o.where}</small><b>${!unlocked?'ยังไม่ค้นพบ':i===state.weapon?'ติดตั้งอยู่':`โจมตี ${Math.round(o.damage*bodyDamage())} · พลังงาน ${o.energy}`}</b>`;b.append(text);b.disabled=!unlocked;b.setAttribute('aria-pressed',i===state.weapon?'true':'false');b.addEventListener('click',()=>equip(i));grid.append(b);
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
  refreshNavigation();const p=$('panel-content');p.innerHTML='<p>พิกัดบอสและท่อกระแสมาจากแผนสำรวจสถานี จึงมองเห็นได้แม้ยังไม่สำรวจ ส่วนมืดเปิดเพิ่มด้วยการเดินทางหรือสแกน R</p>';
  const c=document.createElement('canvas');c.width=660;c.height=260;c.className='map-canvas';c.setAttribute('aria-label','แผนที่แสดงพื้นที่ที่สำรวจ จุดพัก และอวัยวะที่ค้นพบ');p.append(c);drawMap(c.getContext('2d'),660,260);
  const legend=document.createElement('div');legend.className='map-legend';legend.innerHTML='<span><i style="background:#f4ffdf"></i>คุณ</span><span><i style="background:#ffda99"></i>โมดูล</span><span><i style="background:#b5f4c0"></i>ฐาน</span><span><i style="background:#91dddf"></i>ทางลัด</span><span><i style="background:#ffad86"></i>บอส / เส้นทาง</span>';p.append(legend);
  const zonesEl=document.createElement('div');zonesEl.className='zone-progress';p.append(zonesEl);
  zones.forEach(z=>{let seen=0;for(const id of explored){const x=id%COLS;if(x>=z.from&&x<z.to)seen++;}const percent=Math.round(seen/((z.to-z.from)*ROWS)*100),d=document.createElement('div');d.innerHTML=`${z.name}<small>สำรวจแล้ว ${percent}%</small>`;zonesEl.append(d);});
  const a=addActions(p);button(a,'กลับสู่ทะเล','primary-btn',closePanel);button(a,'ภารกิจบอส','secondary-btn',()=>openPanel('mission'));
}
function renderMission(){
  const p=$('panel-content'),q=questData();p.innerHTML=`<div class="mission-card"><small>KNOWN SIGNAL / NAUTILUS SECTOR</small><strong>NAUTILUS-01</strong><p>${state.bossDefeated?'กู้ระบบสำเร็จแล้ว สำรวจต่อได้':q.title+' · '+q.detail}</p></div><ol class="mission-steps"><li>ติดตั้งหนวดเสริมใยจากแท่นใกล้จุดเกิด</li><li>รอเมดูซาวัยอ่อนที่ 00:55 (โพลิปเกาะพื้น 20 วินาที)</li><li>กด E ที่ท่อกระแสในสวนปะการังเพื่อเดินทางเร็ว</li><li>ตามไฟสีส้มจากฐานหน้า แล้วกด E ที่ประตูบอส</li></ol><div class="note">มีโมดูลรวม 2 ชนิดก็เริ่มสู้ได้ ไฟฟ้าหน้าประตูเป็นตัวเลือกเสริม หลบแนวแดงและโจมตีช่วงโดรนพัก ไม่ต้องรอโตเต็มวัย</div>`;
  const a=addActions(p);button(a,'ตามสัญญาณ','primary-btn',()=>{state.trackBoss=true;refreshNavigation();saveGame();closePanel();});button(a,'ดูแผนที่','secondary-btn',()=>openPanel('map'));button(a,state.trackBoss?'ซ่อนเส้นทาง':'แสดงเส้นทาง','secondary-btn',()=>{state.trackBoss=!state.trackBoss;refreshNavigation();saveGame();renderMission();});
}
function clearInput() {input.keys.clear();input.attack=false;input.joyX=input.joyY=0;joyPointer=null;$('joy-knob').style.transform='none';}
window.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const gameKeys=['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','KeyE','KeyI','KeyM','KeyR','KeyB','Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6'];
  if(!gameKeys.includes(e.code))return;
  if(e.code==='Space'&&menu&&document.activeElement?.tagName==='BUTTON')return;
  if(e.code==='Escape'){e.preventDefault();if(menu)closePanel();else if(mode==='play')openPanel('pause');return;}
  if(mode==='title'){if(e.code==='Space'&&!menu){e.preventDefault();startGame(!!saved);}return;}
  e.preventDefault();
  if(['KeyI','KeyM','KeyB'].includes(e.code)){if(!e.repeat)openPanel(e.code==='KeyI'?'body':e.code==='KeyM'?'map':'mission');return;}
  if(mode!=='play')return;
  input.keys.add(e.code);if(e.code==='KeyJ')input.pointer=false;
  if(e.repeat)return;
  if(e.code==='Space'||e.code==='KeyK')dash();else if(e.code==='KeyE')interact();else if(e.code==='KeyR')scan();
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
$('scan-btn').addEventListener('click',scan);$('mission-btn').addEventListener('click',()=>openPanel('mission'));$('signal-hud').addEventListener('click',()=>openPanel('mission'));
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
  const dt=clamp((now-last)/1000||0,0,.15);last=now;
  if(mode==='play') {
    // Keep life and movement at real speed on slower phones; small physics steps
    // retain reliable collision and boss/projectile behaviour at low frame rates.
    let remaining=dt;
    while(remaining>0&&mode==='play'){const step=Math.min(remaining,1/60);update(step);remaining-=step;}
  }
  else if(mode==='title'&&!menu){time+=dt;updateEffects(dt);}
  render();requestAnimationFrame(frame);
}
resize();requestAnimationFrame(frame);

// Local verification surface, absent on the deployed GitHub Pages origin.
if(['localhost','127.0.0.1'].includes(location.hostname))window.jellyDebug={
  snapshot:()=>({mode,menu,stage:stageIndex(),x:player.x,y:player.y,hp:player.hp,maxHP:maxHP(),energy:player.energy,age:state.age,cycle:state.cycle,unlocked:[...state.unlocked],weapon:state.weapon,pearls:state.pearls,explored:explored.size,checkpoint:state.checkpoint,opened:[...state.opened],boss:{hp:boss.hp,active:boss.active,phase:boss.phase,state:boss.state},bossDefeated:state.bossDefeated,colliding:collides(player.x,player.y,player.r),scanCooldown,navTarget:navTarget?.id,navLength:navPath.length,travelUsed:state.travelUsed,environment:environmentAt(),W,H}),
  advance:(seconds)=>{for(let i=0;i<seconds*60&&mode==='play';i++)update(1/60);},
  teleport:(id)=>{const o=typeof id==='string'?objects.find(o=>o.id===id):id;if(!o)return;player.x=o.x;player.y=o.y-45;player.vx=player.vy=0;if(isAnchoredStage())settlePlayer();camera.x=clamp(player.x-W*.5,0,WORLD_W-W);camera.y=clamp(player.y-H*.5,0,WORLD_H-H);update(.016);refreshNavigation();updateHUD();},
  setAge:(age)=>{state.age=clamp(age,0,LIFE-.001);const s=stageIndex();if(s!==player.stage)changeStage(s);updateHUD();},
  setHP:(hp)=>{player.hp=hp;},
  hitBoss:(damage)=>hitEnemy(boss,damage),
  objects:()=>objects.map(o=>({...o,colliding:collides(o.x,o.y-45,12)})),
  position:(x,y)=>{player.x=x;player.y=y;player.vx=player.vy=0;},
  save:saveGame,
  graph:()=>({cols:COLS,rows:ROWS,tiles:Array.from(tiles),objects,spawn:{x:15,y:Math.floor((objects[0].y-70)/T)}})
};
