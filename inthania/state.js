import { SAVE_KEY, HEROES, getHero, maxHP, levelCost } from './data.js';
const finite=(v,f,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;
export function newState(){return {version:1,crystals:1600,ore:18,pity4:0,pity5:0,totalPulls:0,roster:{in:{level:1,rank:0,hp:210,energy:35},nam:{level:1,rank:0,hp:190,energy:35}},party:['in','nam'],active:0,position:{x:0,z:27},beacons:['campus'],chests:[],kills:[],story:0,bossDefeated:false,history:[],settings:{quality:'auto',sound:true,invert:false,sensitivity:1},playtime:0};}
export function validateSave(s){
  if(!s||s.version!==1||!s.roster||typeof s.roster!=='object')throw Error('รูปแบบไฟล์เซฟไม่รองรับ');
  const n=newState();
  for(const k of ['crystals','ore','pity4','pity5','totalPulls','story','active','playtime']){n[k]=finite(s[k],n[k],0,k==='pity5'?49:k==='pity4'?9:k==='story'?4:k==='active'?3:1e7);if(k!=='playtime')n[k]=Math.floor(n[k]);}
  for(const h of HEROES){const r=s.roster[h.id]; if(r&&typeof r==='object'){const level=Math.floor(finite(r.level,1,1,20)),rank=Math.floor(finite(r.rank,0,0,6));n.roster[h.id]={level,rank,hp:finite(r.hp,maxHP(h,level),0,maxHP(h,level)),energy:finite(r.energy,35,0,100)};}}
  n.party=Array.isArray(s.party)?[...new Set(s.party.filter(id=>HEROES.some(h=>h.id===id)&&Object.hasOwn(n.roster,id)))].slice(0,4):n.party;
  if(!n.party.length)n.party=['in','nam'];n.active=Math.min(Math.floor(n.active),n.party.length-1);if(n.roster[n.party[n.active]].hp<=0){const alive=n.party.findIndex(id=>n.roster[id].hp>0);if(alive>=0)n.active=alive;else n.roster[n.party[n.active]].hp=maxHP(getHero(n.party[n.active]),n.roster[n.party[n.active]].level);}
  n.position={x:finite(s.position?.x,0,-248,248),z:finite(s.position?.z,27,-248,248)};
  n.beacons=[...new Set(['campus',...(Array.isArray(s.beacons)?s.beacons:[]).filter(id=>['forest','wetland','wind','mountain'].includes(id))])];
  n.chests=Array.isArray(s.chests)?[...new Set(s.chests.filter(id=>/^chest-\d+$/.test(id)))].slice(0,50):[];
  n.kills=Array.isArray(s.kills)?[...new Set(s.kills.filter(id=>/^enemy-\d+$/.test(id)))].slice(0,50):[];
  n.bossDefeated=s.bossDefeated===true;
  if(n.bossDefeated)n.story=Math.max(n.story,3);
  n.settings.quality=['auto','low','high'].includes(s.settings?.quality)?s.settings.quality:'auto';
  n.settings.sound=s.settings?.sound!==false;n.settings.invert=s.settings?.invert===true;n.settings.sensitivity=finite(s.settings?.sensitivity,1,.4,2);
  n.history=Array.isArray(s.history)?s.history.filter(r=>r&&typeof r.name==='string'&&[3,4,5].includes(r.rarity)).slice(0,100).map(r=>({name:r.name.slice(0,60),rarity:r.rarity,time:typeof r.time==='string'?r.time.slice(0,40):''})):[];
  return n;
}
export function loadState(){try{const s=localStorage.getItem(SAVE_KEY);return s?{state:validateSave(JSON.parse(s)),error:null}:{state:newState(),error:null};}catch(e){return {state:newState(),error:'อ่านเซฟเดิมไม่ได้ เริ่มการเดินทางใหม่ได้ หรือใช้ไฟล์สำรองในเมนูตั้งค่า'};}}
export function persist(state){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function pullOne(state,random=Math.random){
  state.pity4++;state.pity5++;state.totalPulls++;
  const r=random();let rarity=3;
  if(state.pity5>=50||r<.02){rarity=5;state.pity5=0;state.pity4=0;}
  else if(state.pity4>=10||r<.14){rarity=4;state.pity4=0;}
  let result;
  if(rarity>=4){const pool=HEROES.filter(h=>h.rarity===rarity),h=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
    const duplicate=!!state.roster[h.id];
    if(duplicate){state.roster[h.id].rank=Math.min(6,state.roster[h.id].rank+1);state.ore+=12;}
    else{state.roster[h.id]={level:1,rank:0,hp:h.hp,energy:35};if(state.party.length<4)state.party.push(h.id);}
    result={id:h.id,name:h.name,rarity,duplicate};
  }else{state.ore+=5;result={id:'ore',name:'แร่ปรับแต่ง ×5',rarity:3,duplicate:false};}
  state.history.unshift({name:result.name,rarity,time:new Date().toISOString()});state.history=state.history.slice(0,100);return result;
}
export function summon(state,count,random=Math.random){
  if(![1,10].includes(count)||state.crystals<count*160)return {ok:false,results:[]};
  state.crystals-=count*160;const results=Array.from({length:count},()=>pullOne(state,random));return {ok:true,results};
}
export function upgrade(state,id){const r=state.roster[id];if(!r||r.level>=20||state.ore<levelCost(r.level))return false;state.ore-=levelCost(r.level);r.level++;r.hp=maxHP(getHero(id),r.level);return true;}
