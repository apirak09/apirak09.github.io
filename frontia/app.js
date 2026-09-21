"use strict";
(function(){
const APP=document.getElementById("app");
const FATAL=document.getElementById("fatal");
const KEY="cinematic-play-v5";
const LEGACY_KEY="cinematic-play-v4";
const PASSWORD_KEY="cinematic-backend-password";
let cloudTimer=null;
let cloudBusy=false;

window.addEventListener("error",e=>showFatal(e.error||e.message));
window.addEventListener("unhandledrejection",e=>showFatal(e.reason||"เกิดข้อผิดพลาดที่ไม่ได้จัดการ"));

function showFatal(err){
  if(!FATAL)return;
  FATAL.classList.remove("hidden");
  FATAL.textContent="Cinematic Play เกิดข้อผิดพลาด\n\n"+String(err&&err.stack?err.stack:err);
}

const EPISODES={
  "ep-midnight":{
    id:"ep-midnight",
    title:"สัญญาณเที่ยงคืน",
    subtitle:"เมืองที่จดจำทุกการตัดสินใจของคุณ",
    description:"เรื่องลึกลับเชิงภาพยนตร์ที่ทุกบทสนทนาเปลี่ยนว่าใครจะเชื่อใจคุณ คุณจะค้นพบอะไร และตอนจบแบบไหนจะเกิดขึ้นได้",
    tags:["ลึกลับ","ร่วมสมัย","เลือกเส้นเรื่อง"]
  },
  "ep-summer":{
    id:"ep-summer",
    title:"ฤดูร้อนครั้งสุดท้าย",
    subtitle:"กลับมาเจอกันอีกครั้ง ก่อนทุกคนจะแยกย้าย",
    description:"เหลือเวลาเพียงเจ็ดวัน กลุ่มเพื่อนเก่ากลับมารวมตัวกัน และความลับที่ไม่มีใครอยากพูดถึงกำลังจะถูกเปิดเผย",
    tags:["โรแมนติก","ดราม่า"]
  },
  "ep-orbit":{
    id:"ep-orbit",
    title:"วงโคจร 17",
    subtitle:"สถานีบอกว่าคุณเดินทางมาถึงเพียงลำพัง",
    description:"ทริลเลอร์ไซไฟในสถานีอวกาศโดดเดี่ยว ว่าด้วยความทรงจำ ตัวตน และสัญญาณขอความช่วยเหลือที่ใช้เสียงของคุณเอง",
    tags:["ไซไฟ","ระทึกขวัญ"]
  },
  "ep-house":{
    id:"ep-house",
    title:"บ้านข้าง ๆ",
    subtitle:"มีใครบางคนรอคุณอยู่ที่นั่น",
    description:"เรื่องเหนือธรรมชาติแบบค่อยเป็นค่อยไป ซึ่งจะปรับเปลี่ยนตามสิ่งที่คุณกลัว และสิ่งที่คุณเลือกจะไม่พูดออกมา",
    tags:["สยองขวัญ","จิตวิทยา"]
  }
};

const FIRST={
  id:"scene-1",
  chapter:"บทที่ 1 · 00:17",
  location:"ชานชาลาที่ 4",
  speaker:"มีนา",
  body:"รถไฟเที่ยวสุดท้ายควรผ่านไปตั้งแต่สิบสองนาทีก่อนแล้ว แต่มีนายังคงจ้องเข้าไปในอุโมงค์มืด แสงจากโทรศัพท์ในมือของเธอสั่นเล็กน้อย ก่อนจะหันมาถามคุณเสียงเบา “นายก็ได้ยินใช่ไหม? เสียงประกาศเมื่อกี้...มันเรียกชื่อของนาย”",
  choices:[
    {id:"c1",label:"บอกความจริงกับเธอว่า คุณเคยได้ยินเสียงนี้มาก่อน"},
    {id:"c2",label:"ทำเป็นว่าเมื่อกี้คงเป็นแค่สัญญาณรบกวน"},
    {id:"c3",label:"ถามมีนาว่าทำไมเธอถึงมาที่สถานีดึกขนาดนี้"}
  ]
};

const BASE_STATE={
  view:"home",
  episodeId:null,
  scene:null,
  progress:{},
  recent:[],
  backendUrl:"",
  model:"gpt-5.6-luna",
  auth:null,
  progressUpdatedAt:0,
  cloudLastSync:0
};

let state=readState();
let password=localStorage.getItem(PASSWORD_KEY)||"";

function readState(){
  try{
    let raw=localStorage.getItem(KEY);
    if(!raw){
      const legacy=localStorage.getItem(LEGACY_KEY);
      if(legacy){
        const old=JSON.parse(legacy);
        raw=JSON.stringify(Object.assign({},old,{scene:null,recent:[],progressUpdatedAt:Date.now()}));
      }
    }
    return Object.assign({},BASE_STATE,raw?JSON.parse(raw):{});
  }catch{
    return Object.assign({},BASE_STATE);
  }
}

function saveLocal(){
  localStorage.setItem(KEY,JSON.stringify(state));
}

function markProgressChanged(){
  state.progressUpdatedAt=Date.now();
  saveLocal();
  scheduleCloudSave();
}

function cloudPayload(){
  return {
    version:1,
    episodeId:state.episodeId||null,
    scene:state.scene||null,
    progress:state.progress||{},
    recent:(state.recent||[]).slice(-40),
    updatedAt:Number(state.progressUpdatedAt||Date.now())
  };
}

function applyCloudSave(saveData){
  if(!saveData||typeof saveData!=="object")return false;
  const cloudTs=Number(saveData.updatedAt||0);
  const localTs=Number(state.progressUpdatedAt||0);
  if(cloudTs<=localTs)return false;
  state.episodeId=saveData.episodeId||null;
  state.scene=saveData.scene||null;
  state.progress=saveData.progress&&typeof saveData.progress==="object"?saveData.progress:{};
  state.recent=Array.isArray(saveData.recent)?saveData.recent.slice(-40):[];
  state.progressUpdatedAt=cloudTs;
  state.cloudLastSync=Date.now();
  saveLocal();
  return true;
}

function scheduleCloudSave(){
  clearTimeout(cloudTimer);
  if(!state.backendUrl||!password)return;
  cloudTimer=setTimeout(pushCloudSave,700);
}

async function pushCloudSave(){
  if(cloudBusy||!state.backendUrl||!password)return;
  cloudBusy=true;
  try{
    await api("/api/save/set",{save:cloudPayload()});
    state.cloudLastSync=Date.now();
    saveLocal();
    updateCloudStatus();
  }catch(e){
    console.warn("Cloud save failed:",e);
    updateCloudStatus("บันทึกในเครื่องแล้ว · คลาวด์ยังไม่สำเร็จ");
  }finally{
    cloudBusy=false;
  }
}

async function pullCloudSave(){
  if(!state.backendUrl||!password)return false;
  try{
    const result=await api("/api/save/get",{});
    if(result&&result.save){
      const changed=applyCloudSave(result.save);
      state.cloudLastSync=Date.now();
      saveLocal();
      return changed;
    }
  }catch(e){
    console.warn("Cloud load failed:",e);
  }
  return false;
}

function esc(v){
  return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function ep(id){return EPISODES[id]||EPISODES["ep-midnight"]}

function tabs(active){
  return '<nav class="tabs">'+[
    ["home","⌂","หน้าแรก"],
    ["chat","◌","แชต"],
    ["play","▶","เรื่องของฉัน"],
    ["settings","⚙","ตั้งค่า"]
  ].map(x=>'<button class="tab '+(active===x[0]?"on":"")+'" type="button" data-nav="'+x[0]+'"><span>'+x[1]+'</span><small>'+x[2]+'</small></button>').join("")+'</nav>';
}

function header(){
  return '<div class="top"><div class="brand">cinematic<i>play</i></div><div class="spacer"></div><button class="iconbtn" type="button" data-nav="settings">⚙</button></div>';
}

function home(){
  return '<main class="page">'+header()+
  '<div class="hero"><span class="badge">เรื่องแนะนำ</span><h1>สัญญาณเที่ยงคืน</h1><div class="sub">เมืองที่จดจำทุกการตัดสินใจของคุณ</div><button class="cta" type="button" data-open="ep-midnight">ดูเรื่องนี้</button></div>'+
  '<h2>แนะนำสำหรับคุณ</h2><div class="cards">'+["ep-summer","ep-orbit","ep-house"].map(id=>{
    const x=ep(id);
    return '<button class="card" type="button" data-open="'+id+'"><span class="art '+id.replace("ep-","")+'"></span><span class="cardtitle">'+esc(x.title)+'</span><span class="cardmeta">'+esc(x.subtitle)+'</span></button>';
  }).join("")+'</div>'+
  (Object.keys(state.progress||{}).length?'<h2>เล่นต่อ</h2>'+continueRows():'')+
  '</main>'+tabs("home");
}

function continueRows(){
  return Object.keys(state.progress||{}).slice(0,2).map(id=>{
    const x=ep(id),p=state.progress[id]||0;
    return '<div class="library" data-open="'+id+'"><div class="libart"></div><div class="grow"><div class="rowtitle">'+esc(x.title)+'</div><div class="rowsub">เล่นไปแล้ว '+Math.round(p*100)+'%</div><div class="progress"><div class="fill" style="width:'+Math.round(p*100)+'%"></div></div></div><span>›</span></div>';
  }).join("");
}

function chat(){
  return '<main class="page">'+header()+
  '<h1>แชต</h1><section class="panel"><div style="font-size:29px">✦</div><h2 style="font-size:24px;margin:15px 0 5px">ตัวละครที่จำคุณได้</h2><div class="sub">คุยต่อกับตัวละครที่มีความทรงจำ บุคลิก และความสัมพันธ์ต่อเนื่อง</div><button class="cta" style="width:100%">เริ่มแชตใหม่</button></section>'+
  '<h2>แชตล่าสุด</h2>'+
  ["มีนา · สัญญาณเที่ยงคืน","โนอาห์ · วงโคจร 17","อึน · ฤดูร้อนครั้งสุดท้าย"].map((n,i)=>'<div class="row"><div class="avatar">'+esc(n[0])+'</div><div class="grow"><div class="rowtitle">'+esc(n)+'</div><div class="rowsub">'+(i?"กลับไปคุยต่อ…":"ข้อความนั้นไม่ได้ถูกส่งมาจากฉัน")+'</div></div></div>').join("")+
  '</main>'+tabs("chat");
}

function play(){
  return '<main class="page">'+header()+'<h1>เรื่องของฉัน</h1><div class="sub">เรื่องที่คุณเริ่มเล่นหรือบันทึกไว้</div><div style="margin-top:20px">'+
  Object.values(EPISODES).map(x=>{
    const p=state.progress[x.id]||0;
    return '<div class="library" data-open="'+x.id+'"><div class="libart"></div><div class="grow"><div class="rowtitle">'+esc(x.title)+'</div><div class="rowsub">'+(p?"เล่นไปแล้ว "+Math.round(p*100)+"%":"ยังไม่ได้เริ่ม")+'</div><div class="progress"><div class="fill" style="width:'+Math.round(p*100)+'%"></div></div></div><span>›</span></div>';
  }).join("")+'</div></main>'+tabs("play");
}

function cloudStatusText(){
  if(!state.backendUrl)return "บันทึกในเครื่องอัตโนมัติ";
  if(!password)return "บันทึกในเครื่อง · ใส่รหัส backend เพื่อเปิด Cloud Save";
  if(!state.cloudLastSync)return "พร้อมซิงก์คลาวด์";
  const mins=Math.max(0,Math.floor((Date.now()-state.cloudLastSync)/60000));
  return mins<1?"ซิงก์คลาวด์แล้วเมื่อสักครู่":"ซิงก์คลาวด์แล้ว "+mins+" นาทีที่แล้ว";
}

function settings(){
  const connected=Boolean(state.auth&&state.auth.connected);
  return '<main class="page">'+header()+
  '<h1>ตั้งค่า</h1><div class="row"><div class="avatar">J</div><div class="grow"><div class="rowtitle">ผู้เล่นส่วนตัว</div><div class="rowsub">เวอร์ชันส่วนตัวสำหรับใช้งานคนเดียว</div></div></div>'+
  '<div class="settingsGroup">AI BACKEND</div>'+
  '<input id="backendUrl" class="field" placeholder="https://backend-ของคุณ" value="'+esc(state.backendUrl||"")+'"><div style="height:10px"></div>'+
  '<input id="appPassword" class="field" type="password" placeholder="รหัสผ่าน backend ส่วนตัว" value="'+esc(password)+'">'+
  '<div class="hint">อุปกรณ์นี้จะจำ URL และรหัสผ่านไว้ เพื่อให้โหลด/บันทึกคลาวด์อัตโนมัติ หากเป็นเครื่องสาธารณะไม่ควรเปิดใช้งานด้วยบัญชีส่วนตัว</div>'+
  '<div style="height:10px"></div><select id="model" class="field"><option value="gpt-5.6-luna" '+(state.model==="gpt-5.6-luna"?"selected":"")+'>GPT-5.6 Luna</option><option value="gpt-5.6-sol" '+(state.model==="gpt-5.6-sol"?"selected":"")+'>GPT-5.6 Sol</option></select>'+
  '<div class="btnrow"><button class="btn" id="testBackend">ทดสอบ Backend</button><button class="btn primary" id="connectChatGPT">'+(connected?"เชื่อม ChatGPT ใหม่":"เชื่อม ChatGPT")+'</button></div>'+
  '<div style="margin-top:12px"><span class="status"><span class="dot '+(connected?"ok":"")+'"></span>'+(connected?"ChatGPT "+esc(state.auth.plan||"เชื่อมแล้ว"):"ยังไม่ได้เชื่อม ChatGPT")+'</span></div><div id="settingsError" class="error"></div>'+
  '<div class="settingsGroup">การบันทึก</div><div class="setting"><span>บันทึกอัตโนมัติ</span><span id="cloudSaveStatus" style="margin-left:auto;color:var(--muted);font-size:11px">'+esc(cloudStatusText())+'</span></div>'+
  '<div class="btnrow"><button class="btn" id="syncNow">ซิงก์ตอนนี้</button><button class="btn" id="resetSave">เริ่มเรื่องใหม่ทั้งหมด</button></div>'+
  '<div class="hint">ระบบบันทึกลงเครื่องทันทีทุกครั้ง และส่งขึ้นคลาวด์อัตโนมัติเมื่อ Backend ออนไลน์ Export/Import ไม่จำเป็นสำหรับการเล่นปกติ</div>'+
  '<div class="settingsGroup">เกี่ยวกับ</div><div class="setting"><span>เวอร์ชัน</span><span style="margin-left:auto;color:var(--muted)">0.5.0 ไทย + Cloud Save</span></div></main>'+tabs("settings");
}

function episodeView(){
  const x=ep(state.episodeId),p=state.progress[x.id]||0;
  return '<div><div class="detailCover"></div><button class="iconbtn back" type="button" data-nav="home">←</button><main class="detail"><span class="badge">นิยาย</span><h1>'+esc(x.title)+'</h1><div class="sub">'+esc(x.subtitle)+'</div><div class="chips" style="margin:14px 0">'+x.tags.map(t=>'<span class="chip">'+esc(t)+'</span>').join("")+'</div><p class="sub" style="font-size:14px;color:var(--text2)">'+esc(x.description)+'</p></main><button class="bigcta" type="button" id="startEpisode">'+(p?"เล่นต่อ":"เริ่มเรื่อง")+'</button></div>';
}

function player(){
  const s=state.scene||FIRST;
  return '<div class="player"><section class="stage"><div class="stageTop"><button class="iconbtn" type="button" data-nav="play">←</button><span class="chapter">'+esc(s.chapter||"ฉากถัดไป")+'</span><button class="iconbtn" type="button">•••</button></div><div class="location">'+esc(s.location||"ไม่ทราบสถานที่")+'</div></section><section class="story"><div class="tools"><button class="tool" type="button">▤ บันทึก</button><button class="tool" type="button">⌘ แผนที่</button><button class="tool" type="button">◎ สถานะ</button></div><div class="storybody">'+
  (s.speaker?'<div class="speaker">'+esc(s.speaker)+'</div>':'')+
  '<div class="narrative">'+esc(s.body)+'</div><div class="prompt">คุณจะทำอย่างไร?</div>'+
  (s.choices||[]).map((c,i)=>'<button class="choice" type="button" data-choice="'+esc(c.id)+'"><span class="num">'+(i+1)+'</span><span class="grow">'+esc(c.label)+'</span><span>›</span></button>').join("")+
  '<div class="reply"><textarea id="freeText" placeholder="พิมพ์สิ่งที่อยากพูดหรือทำเอง…"></textarea><button class="send" type="button" id="sendFree">↑</button></div></div></section></div>';
}

function render(){
  if(!APP)throw new Error("ไม่พบ root ของแอป");
  if(state.view==="chat")APP.innerHTML=chat();
  else if(state.view==="play")APP.innerHTML=play();
  else if(state.view==="settings")APP.innerHTML=settings();
  else if(state.view==="episode")APP.innerHTML=episodeView();
  else if(state.view==="player")APP.innerHTML=player();
  else APP.innerHTML=home();
  bind();
}

function bind(){
  document.querySelectorAll("[data-nav]").forEach(el=>el.addEventListener("click",()=>{
    state.view=el.dataset.nav;
    saveLocal();
    render();
  }));
  document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",()=>{
    state.episodeId=el.dataset.open;
    state.view="episode";
    saveLocal();
    render();
  }));

  const start=document.getElementById("startEpisode");
  if(start)start.addEventListener("click",()=>{
    const isNew=!state.progress[state.episodeId];
    if(isNew)state.scene=JSON.parse(JSON.stringify(FIRST));
    else state.scene=state.scene||JSON.parse(JSON.stringify(FIRST));
    state.progress[state.episodeId]=state.progress[state.episodeId]||0.08;
    state.view="player";
    markProgressChanged();
    render();
  });

  document.querySelectorAll("[data-choice]").forEach(el=>el.addEventListener("click",()=>advance(choiceText(el.dataset.choice))));
  const send=document.getElementById("sendFree");
  if(send)send.addEventListener("click",()=>{
    const t=document.getElementById("freeText").value.trim();
    if(t)advance(t);
  });

  const backend=document.getElementById("backendUrl");
  if(backend)backend.addEventListener("change",async()=>{
    state.backendUrl=backend.value.trim().replace(/\/$/,"");
    saveLocal();
    const changed=await pullCloudSave();
    if(changed)render(); else updateCloudStatus();
  });

  const pw=document.getElementById("appPassword");
  if(pw)pw.addEventListener("change",async()=>{
    password=pw.value;
    localStorage.setItem(PASSWORD_KEY,password);
    const changed=await pullCloudSave();
    if(changed)render(); else updateCloudStatus();
  });

  const model=document.getElementById("model");
  if(model)model.addEventListener("change",()=>{state.model=model.value;saveLocal()});

  const test=document.getElementById("testBackend");
  if(test)test.addEventListener("click",testBackend);

  const connect=document.getElementById("connectChatGPT");
  if(connect)connect.addEventListener("click",connectChatGPT);

  const sync=document.getElementById("syncNow");
  if(sync)sync.addEventListener("click",syncNow);

  const reset=document.getElementById("resetSave");
  if(reset)reset.addEventListener("click",()=>{
    if(confirm("ต้องการลบความคืบหน้าของนิยายทั้งหมดและเริ่มใหม่ใช่ไหม?")){
      state.episodeId=null;
      state.scene=null;
      state.progress={};
      state.recent=[];
      markProgressChanged();
      state.view="home";
      render();
    }
  });
}

function updateCloudStatus(custom){
  const n=document.getElementById("cloudSaveStatus");
  if(n)n.textContent=custom||cloudStatusText();
}

function choiceText(id){
  const s=state.scene||FIRST;
  const c=(s.choices||[]).find(x=>x.id===id);
  return c?c.label:id;
}

function mockNext(input){
  return {
    id:"scene-"+Date.now(),
    chapter:"บทที่ 1 · 00:21",
    location:"ชานชาลาที่ 4",
    speaker:"มีนา",
    body:"มีนาจ้องคุณอยู่ครู่หนึ่ง ราวกับพยายามตัดสินว่าคำตอบนั้นจริงแค่ไหน ไฟเหนือชานชาลากะพริบสองครั้ง ก่อนโทรศัพท์ของเธอจะสั่นขึ้นมาอีกครั้ง สิ่งที่คุณเลือกทำ — “"+input+"” — ทำให้สีหน้าของเธอเปลี่ยนไปทันที เพราะข้อความใหม่บนหน้าจอมีเวลาส่งเป็นพรุ่งนี้เช้า ทั้งที่ตอนนี้ยังไม่ถึงตีหนึ่ง",
    choices:[
      {id:"c1",label:"ขอให้มีนาเปิดข้อความให้ดู"},
      {id:"c2",label:"บอกเธอว่าอย่าเพิ่งเปิดข้อความนั้น"},
      {id:"c3",label:"ไปตรวจกล้องวงจรปิดของสถานี"}
    ]
  };
}

async function advance(input){
  const busy=document.createElement("div");
  busy.className="busy";
  busy.textContent="กำลังสร้างฉากถัดไป…";
  document.body.appendChild(busy);
  try{
    let next;
    if(state.backendUrl&&state.auth&&state.auth.connected){
      const result=await api("/api/roleplay",{
        model:state.model,
        episode:ep(state.episodeId),
        scene:state.scene||FIRST,
        input,
        recent:(state.recent||[]).slice(-12),
        language:"th"
      });
      next=result.scene;
    }else{
      await new Promise(r=>setTimeout(r,450));
      next=mockNext(input);
    }
    state.recent=(state.recent||[]).concat([{player:input,scene:next.body}]).slice(-40);
    state.scene=next;
    state.progress[state.episodeId]=Math.min(.98,(state.progress[state.episodeId]||.08)+.05);
    markProgressChanged();
    render();
  }catch(e){
    alert("สร้างฉากไม่สำเร็จ: "+e.message);
  }finally{
    busy.remove();
  }
}

async function api(path,body){
  if(!state.backendUrl)throw new Error("กรุณาตั้งค่า Backend URL ก่อน");
  if(!password)throw new Error("กรุณาใส่รหัสผ่าน Backend ก่อน");
  const r=await fetch(state.backendUrl+path,{
    method:"POST",
    headers:{"content-type":"application/json","x-app-password":password},
    body:JSON.stringify(body||{})
  });
  let data={};
  try{data=await r.json()}catch{}
  if(!r.ok)throw new Error(data.message||data.error||("HTTP "+r.status));
  return data;
}

function setErr(v){
  const n=document.getElementById("settingsError");
  if(n)n.textContent=v;
}

async function testBackend(){
  setErr("");
  try{
    const d=await api("/api/auth/status",{});
    if(d.connected){
      state.auth={connected:true,plan:d.plan||""};
      saveLocal();
      await pullCloudSave();
      render();
    }else{
      setErr("Backend ใช้งานได้แล้ว แต่ยังไม่ได้เชื่อมบัญชี ChatGPT");
      await pullCloudSave();
      updateCloudStatus();
    }
  }catch(e){setErr(e.message)}
}

async function connectChatGPT(){
  setErr("");
  try{
    const d=await api("/api/auth/chatgpt/start",{});
    showLogin(d);
    pollLogin();
  }catch(e){setErr(e.message)}
}

function showLogin(d){
  const modal=document.createElement("div");
  modal.className="modal";
  modal.id="loginModal";
  modal.innerHTML='<div class="sheet"><h2>เชื่อมต่อ ChatGPT</h2><div class="sub">เปิดหน้าล็อกอิน OpenAI แล้วใส่รหัสแบบใช้ครั้งเดียวด้านล่าง</div><div class="code">'+esc(d.userCode||"")+'</div><button class="btn primary" id="openVerify">เปิดหน้า ChatGPT Login</button><button class="btn" style="margin-top:8px" id="closeLogin">ปิด</button><div class="hint" id="loginHint">กำลังรอการอนุญาต…</div></div>';
  document.body.appendChild(modal);
  document.getElementById("openVerify").onclick=()=>window.open(d.verificationUrl,"_blank","noopener");
  document.getElementById("closeLogin").onclick=()=>modal.remove();
}

async function pollLogin(){
  for(let i=0;i<90;i++){
    await new Promise(r=>setTimeout(r,2000));
    try{
      const d=await api("/api/auth/status",{});
      if(d.connected){
        state.auth={connected:true,plan:d.plan||"Plus"};
        saveLocal();
        await pullCloudSave();
        const modal=document.getElementById("loginModal");
        if(modal)modal.remove();
        render();
        return;
      }
    }catch{}
  }
  const hint=document.getElementById("loginHint");
  if(hint)hint.textContent="หมดเวลารอล็อกอิน กรุณากดเชื่อม ChatGPT ใหม่";
}

async function syncNow(){
  setErr("");
  try{
    const changed=await pullCloudSave();
    if(changed){
      render();
      return;
    }
    await pushCloudSave();
    updateCloudStatus("ซิงก์คลาวด์เรียบร้อย");
  }catch(e){setErr(e.message)}
}

async function boot(){
  render();
  if(state.backendUrl&&password){
    const changed=await pullCloudSave();
    if(changed)render();
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js?v=5").catch(()=>{});
  }
}

boot();
})();