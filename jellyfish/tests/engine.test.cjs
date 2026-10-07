const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Drawing calls are stubbed; these tests verify gameplay, not browser layout.
const path=require('node:path'),root=path.resolve(__dirname,'..');
class Canvas{
  constructor(w,h){this.width=w;this.height=h;this.ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}})}
  getContext(){return this.ctx}
}
class ClassList{constructor(c=''){this.s=new Set(c.split(' ').filter(Boolean))}add(...v){v.forEach(x=>this.s.add(x))}remove(...v){v.forEach(x=>this.s.delete(x))}contains(x){return this.s.has(x)}toggle(x,v){if(v===undefined)v=!this.s.has(x);v?this.s.add(x):this.s.delete(x);return v}}
const storage=new Map();
function runtime(width=1440,height=785,touch=false){
  const els=new Map(),listeners={},errors=[];
  const enhance=(e)=>{e.style={};e.classList=new ClassList();e.children=[];e.listeners={};e.attrs={};e.append=(...v)=>e.children.push(...v);e.replaceChildren=(...v)=>e.children=[...v];e.addEventListener=(k,v)=>e.listeners[k]=v;e.setAttribute=(k,v)=>e.attrs[k]=v;e.focus=()=>{};e.setPointerCapture=()=>{};e.getBoundingClientRect=()=>({left:0,top:0,width,height});e.querySelectorAll=()=>[];e.offsetWidth=width;e.innerHTML='';e.textContent='';return e;};
  const create=(tag)=>tag==='canvas'?enhance(new Canvas(32,32)):enhance({});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/<(\w+)[^>]*id="([^"]+)"[^>]*>/g)){const e=create(match[1]);const cls=match[0].match(/class="([^"]+)"/);if(cls)e.classList=new ClassList(cls[1]);els.set(match[2],e);}
  els.get('game').width=width;els.get('game').height=height;els.get('minimap').width=180;els.get('minimap').height=76;
  const stages=Array.from({length:6},()=>create('span'));
  const window={addEventListener:(k,v)=>listeners[k]=v};
  const doc={getElementById:id=>els.get(id),createElement:create,querySelectorAll:()=>stages,body:enhance({}),addEventListener:(k,v)=>listeners[k]=v,hidden:false};
  const sandbox={document:doc,window,navigator:{maxTouchPoints:touch?5:0},matchMedia:(q)=>({matches:touch&&q.includes('coarse')}),location:{hostname:'localhost'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},requestAnimationFrame:()=>{},setTimeout:()=>1,clearTimeout:()=>{},Math,console,Set,Map,Uint8Array,Int16Array};
  const context=vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),context,{filename:'game.js'});
  const run=s=>vm.runInContext(s,context);return {run,els,window,errors,canvas:els.get('game'),snapshot:()=>window.jellyDebug.snapshot()};
}
(async()=>{
  const results=[];const test=(name,fn)=>{fn();results.push({name,pass:true});};
  const game=runtime(),run=game.run;
  run('render()');
  run('startGame(false)');
  test('initial state is a living, unembedded larva',()=>{assert.equal(game.snapshot().stage,0);assert.equal(game.snapshot().colliding,false);});
  test('all organs, anchors and boss gate are reachable through open water',()=>{
    const g=game.window.jellyDebug.graph(),{cols,rows,tiles,spawn,objects}=g,visited=new Set(),q=[spawn.y*cols+spawn.x];visited.add(q[0]);
    for(let i=0;i<q.length;i++){const id=q[i],x=id%cols,y=Math.floor(id/cols);for(const [nx,ny]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(nx>=0&&nx<cols&&ny>=0&&ny<rows){const n=ny*cols+nx;if(!tiles[n]&&!visited.has(n)){visited.add(n);q.push(n);}}}
    for(const o of objects)assert.ok(visited.has(Math.floor((o.y-45)/24)*cols+Math.floor(o.x/24)),o.id+' unreachable');
  });
  test('swimming and dash move the player',()=>{const x=game.snapshot().x;run("input.keys.add('KeyD');for(let i=0;i<60;i++)update(1/60);input.keys.clear();");assert.ok(game.snapshot().x>x+100);const x2=game.snapshot().x;run('dash();for(let i=0;i<12;i++)update(1/60)');assert.ok(game.snapshot().x>x2+50);});
  test('pause stops the lifecycle',()=>{run("openPanel('pause')");const age=game.snapshot().age;run('frame(1000);frame(2000)');assert.equal(game.snapshot().age,age);run('closePanel()');});
  test('first organ interaction unlocks and equips body weapon',()=>{run("window.jellyDebug.teleport('barbs');interact()");assert.ok(game.snapshot().unlocked.includes(1));assert.equal(game.snapshot().weapon,1);});
  run('render()');
  test('every discoverable organ can be collected',()=>{for(const id of ['frost','venom','sonar','electric'])run(`window.jellyDebug.teleport('${id}');interact()`);assert.equal(game.snapshot().unlocked.length,6);});
  test('six lifecycle stages follow the new timeline',()=>{for(const [age,expected]of[[34,0],[35.1,1],[55.1,2],[130.1,3],[420.1,4],[465.1,5]]){run(`window.jellyDebug.setAge(${age})`);assert.equal(game.snapshot().stage,expected);assert.equal(game.snapshot().colliding,false);}});
  test('cyst returns to polyp and preserves organs, pearls and map',()=>{const before=game.snapshot();run('window.jellyDebug.setAge(479.99);update(.02)');const after=game.snapshot();assert.equal(after.stage,1);assert.equal(after.cycle,before.cycle+1);assert.equal(after.unlocked.length,6);assert.equal(after.pearls,before.pearls);assert.ok(after.explored>=before.explored);run('closePanel()');});
  test('all six organs deal damage through actual combat updates',()=>{
    const damages=[];
    for(let i=0;i<6;i++){
      run(`player.x=1000;player.y=500;player.vx=player.vy=0;player.hp=150;player.energy=100;state.age=150;player.stage=3;player.cool=0;shots=[];enemies=[{id:999,x:1060,y:500,homeX:1060,homeY:500,vx:0,vy:0,r:15,type:'shrimp',hp:200,max:200,damage:8,timer:0,phase:0,poison:0,slow:0,flash:0,shot:4}];state.weapon=${i};input.pointer=false;attack();for(let k=0;k<18;k++)update(1/60);`);
      const hp=run('enemies[0].hp');assert.ok(hp<200,`weapon ${i} caused no damage`);damages.push(Math.round(200-hp));
    }results.push({name:'damage per weapon (sting, barbs, venom, sonar, electric, frost)',damages});
  });
  test('shell upgrade increases max health and persists',()=>{const hp=game.snapshot().maxHP;run('state.upgrades.shell++;player.hp+=20;saveGame()');assert.equal(game.snapshot().maxHP,hp+20);});
  test('boss requires stage and organ preparation',()=>{run("window.jellyDebug.teleport('gate');state.age=0;player.stage=0;interact()");assert.equal(game.snapshot().boss.active,false);run("window.jellyDebug.setAge(150);window.jellyDebug.teleport('gate');interact()");assert.equal(game.snapshot().boss.active,true);});
  run('render()');
  test('boss telegraphs attacks and enters second phase',()=>{run("for(let i=0;i<115;i++)update(1/60)");assert.equal(game.snapshot().boss.state,'warning');run('hitEnemy(boss,650)');run('update(.016)');assert.equal(game.snapshot().boss.phase,2);});
  test('boss victory awards reward and records completion',()=>{const before=game.snapshot().pearls;run('hitEnemy(boss,2000)');assert.equal(game.snapshot().bossDefeated,true);assert.equal(game.snapshot().boss.active,false);assert.equal(game.snapshot().pearls,before+35);run('closePanel()');});
  test('death loads polyp backup at latest anchor and preserves completion',()=>{run("window.jellyDebug.teleport('ruin-home');interact();player.inv=0;hurt(9999,player.x-40,player.y)");assert.equal(game.snapshot().stage,1);assert.equal(game.snapshot().checkpoint,'ruin-home');assert.equal(game.snapshot().bossDefeated,true);assert.equal(game.snapshot().menu,'rebirth');run('closePanel()');});
  test('saved game reload restores organs, position and upgrades',()=>{run('saveGame()');const after=runtime();after.run('startGame(true)');assert.equal(after.snapshot().unlocked.length,6);assert.equal(after.snapshot().checkpoint,'ruin-home');assert.equal(after.snapshot().maxHP,110);assert.equal(after.snapshot().bossDefeated,true);});
  test('dash cannot tunnel into terrain',()=>{run('window.jellyDebug.setAge(55.1);player.x=950;player.y=floorAt(950)-35;player.vx=0;player.vy=0;player.energy=100;player.dashCool=0;input.dx=0;input.dy=1;dash();for(let i=0;i<20;i++)update(.035)');assert.equal(game.snapshot().colliding,false);});
  test('portrait and landscape renders do not throw',()=>{storage.clear();for(const [w,h]of[[390,752],[844,300],[768,910]]){const m=runtime(w,h,true);m.run('startGame(false);render();openPanel("body");openPanel("map");closePanel();render()');assert.equal(m.snapshot().colliding,false);}});
  test('low frame rates preserve elapsed life time',()=>{storage.clear();const m=runtime();m.run('startGame(false);last=1000;frame(1100)');assert.ok(Math.abs(m.snapshot().age-.1)<.00001);});
  test('attached polyp and cyst cannot swim or dash',()=>{storage.clear();const m=runtime();m.run('startGame(false)');for(const age of [35.1,465.1]){m.run(`window.jellyDebug.setAge(${age});input.keys.add('KeyD');dash()`);const before=m.snapshot();m.run('for(let i=0;i<120;i++)update(1/60);input.keys.clear()');assert.equal(m.snapshot().x,before.x);assert.equal(m.snapshot().y,before.y);assert.equal(m.snapshot().colliding,false);if(age>460){m.run('player.cool=0;player.energy=100;attack()');assert.equal(m.run('shots.length'),0);assert.equal(m.snapshot().energy,100);}}});
  test('scanner opens fog and enforces energy and cooldown',()=>{storage.clear();const m=runtime();m.run('startGame(false)');const before=m.snapshot();m.run('scan()');assert.ok(m.snapshot().explored>before.explored*2);assert.equal(m.snapshot().energy,90);m.run('scan()');assert.equal(m.snapshot().energy,90);m.run('for(let i=0;i<361;i++)update(1/60);scan()');assert.equal(m.run('scanCooldown'),6);});
  test('mission paths fit adult medusa and avoid terrain throughout',()=>{storage.clear();const m=runtime();m.run('startGame(false)');for(const id of ['home','barbs','frost','kelp-home','venom','ruin-home','sonar','electric','deep-home','gate']){m.run(`window.jellyDebug.setAge(150);window.jellyDebug.teleport('${id}');refreshNavigation()`);assert.ok(m.run('navPath.length')>0,id);assert.ok(m.run('navPath.every(p=>!collides(p.x,p.y,22))'),id);assert.ok(m.run('navPath.every((p,i)=>!i||dist(p,navPath[i-1])<=T+.01)'),id);}});
  test('express route enables a two-module juvenile to start boss',()=>{storage.clear();const m=runtime();m.run("startGame(false);window.jellyDebug.teleport('barbs');interact();window.jellyDebug.setAge(55.1);window.jellyDebug.teleport('express');interact()");assert.equal(m.snapshot().checkpoint,'deep-home');assert.equal(m.run('state.travelUsed'),true);assert.equal(m.snapshot().unlocked.length,2);assert.ok(m.run('dist(player,objects.find(o=>o.id==="gate"))')<300);m.run("window.jellyDebug.teleport('gate');interact()");assert.equal(m.snapshot().boss.active,true);assert.equal(m.snapshot().stage,2);});
  test('old v1 save maps age while retaining progression',()=>{for(const [age,stage]of [[20,0],[50,1],[90,2],[250,3],[470,4],[999,4],[-1,0]]){storage.clear();storage.set('apirak-jelly-reborn-v1',JSON.stringify({version:1,age,cycle:7,pearls:123,unlocked:[0,1,4],weapon:4,upgrades:{shell:2,power:1,flow:3},opened:['barbs','electric'],anchors:['home','ruin-home'],checkpoint:'ruin-home',bossDefeated:true,explored:[2,3,4]}));const m=runtime();m.run('startGame(true)');assert.equal(m.snapshot().stage,stage);assert.equal(m.snapshot().pearls,123);assert.equal(m.snapshot().cycle,7);assert.equal(m.snapshot().weapon,4);assert.equal(m.snapshot().checkpoint,'ruin-home');assert.equal(m.snapshot().bossDefeated,true);assert.equal(m.run('state.version'),2);}});
  test('research logs and mission panel open and pause safely',()=>{storage.clear();const m=runtime();m.run("startGame(false);window.jellyDebug.teleport('log-01');interact()");assert.equal(m.snapshot().menu,'log');assert.equal(m.run('state.visitedLogs[0]'),0);m.run("closePanel();openPanel('mission');openPanel('help');openPanel('map');closePanel()");assert.equal(m.snapshot().mode,'play');});
  test('telemetry computes increasing hydrostatic pressure with depth',()=>{storage.clear();const m=runtime();const a=m.run('environmentAt(400,100)'),b=m.run('environmentAt(400,1600)');assert.ok(b.pressure>a.pressure);assert.ok(b.temperature<a.temperature);assert.ok(Math.abs(b.pressure-21.12375)<.01);});
  test('following the actual route reaches the boss without teleporting',()=>{storage.clear();const m=runtime();m.run(`startGame(false);for(let i=0;i<120*60&&!boss.active&&mode==='play';i++){if(!isAnchoredStage()){const p=navigationPoint();if(p){const d=dist(player,p)||1;input.joyX=(p.x-player.x)/d;input.joyY=(p.y-player.y)/d;}}if(nearest&&nearest===navTarget)interact();update(1/60);}input.joyX=input.joyY=0;`);assert.equal(m.snapshot().boss.active,true);assert.ok(m.snapshot().age<85);results.push({name:'first boss reached by swimming and express tube',elapsedSeconds:Math.round(m.snapshot().age)});});
  console.log(`${results.filter(r=>r.pass).length} engine checks passed`);
})().catch(e=>{console.error(e);process.exit(1)});
