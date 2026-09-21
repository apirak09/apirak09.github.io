"use strict";
(function(){
const APP=document.getElementById("app");
const FATAL=document.getElementById("fatal");
window.addEventListener("error",e=>showFatal(e.error||e.message));
window.addEventListener("unhandledrejection",e=>showFatal(e.reason||"Unhandled promise rejection"));
function showFatal(err){if(!FATAL)return;FATAL.classList.remove("hidden");FATAL.textContent="Cinematic Play error\n\n"+String(err&&err.stack?err.stack:err)}
const KEY="cinematic-play-v4";
const EPISODES={
 "ep-midnight":{id:"ep-midnight",title:"Midnight Signal",subtitle:"A city that remembers your choices",description:"A cinematic mystery where every conversation changes who trusts you, what you discover, and which ending becomes possible.",tags:["Mystery","Modern","Choice-driven"]},
 "ep-summer":{id:"ep-summer",title:"After the Last Summer",subtitle:"Reconnect before everyone leaves",description:"Seven days, one old friend group, and a secret nobody wanted to bring up again.",tags:["Romance","Drama"]},
 "ep-orbit":{id:"ep-orbit",title:"Orbit 17",subtitle:"The station says you arrived alone",description:"An isolated sci-fi thriller about memory, identity, and a distress call carrying your own voice.",tags:["Sci-fi","Thriller"]},
 "ep-house":{id:"ep-house",title:"The House Next Door",subtitle:"Someone has been waiting for you",description:"A slow-burn supernatural story that adapts to what you fear and what you refuse to say.",tags:["Horror","Psychological"]}
};
const FIRST={id:"scene-1",chapter:"CHAPTER 1 · 00:17",location:"Platform 4",speaker:"Mina",body:"The final train should have passed twelve minutes ago. Mina keeps staring at the dark tunnel, phone light trembling in her hand. “You heard it too, right? That announcement said your name.”",choices:[{id:"c1",label:"Tell her the truth: you have heard the voice before."},{id:"c2",label:"Pretend it was only interference."},{id:"c3",label:"Ask why she came to the station this late."}]};
let state=readState();
let password=sessionStorage.getItem("cinematic-password")||"";
function readState(){try{return Object.assign({view:"home",episodeId:null,scene:null,progress:{},recent:[],backendUrl:"",model:"gpt-5.6-luna",auth:null},JSON.parse(localStorage.getItem(KEY)||"{}"))}catch{return {view:"home",progress:{},recent:[],backendUrl:"",model:"gpt-5.6-luna",auth:null}}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function ep(id){return EPISODES[id]||EPISODES["ep-midnight"]}
function tabs(active){return '<nav class="tabs">'+[["home","⌂","Home"],["chat","◌","Chat"],["play","▶","Play"],["settings","⚙","Settings"]].map(x=>'<button class="tab '+(active===x[0]?"on":"")+'" type="button" data-nav="'+x[0]+'"><span>'+x[1]+'</span><small>'+x[2]+'</small></button>').join("")+'</nav>'}
function header(){return '<div class="top"><div class="brand">cinematic<i>play</i></div><div class="spacer"></div><button class="iconbtn" type="button" data-nav="settings">⚙</button></div>'}
function home(){return '<main class="page">'+header()+'<div class="hero"><span class="badge">NEW</span><h1>Midnight Signal</h1><div class="sub">A city that remembers your choices</div><button class="cta" type="button" data-open="ep-midnight">View story</button></div><h2>Recommended for you</h2><div class="cards">'+["ep-summer","ep-orbit","ep-house"].map(id=>{const x=ep(id);return '<button class="card" type="button" data-open="'+id+'"><span class="art '+id.replace("ep-","")+'"></span><span class="cardtitle">'+esc(x.title)+'</span><span class="cardmeta">'+esc(x.subtitle)+'</span></button>'}).join("")+'</div></main>'+tabs("home")}
function chat(){return '<main class="page">'+header()+'<h1>Chat</h1><section class="panel"><div style="font-size:29px">✦</div><h2 style="font-size:24px;margin:15px 0 5px">Characters who remember</h2><div class="sub">Continue conversations with persistent memory and personality.</div><button class="cta" style="width:100%">New chat</button></section><h2>Recent chats</h2>'+["Mina · Midnight Signal","Noah · Orbit 17","Eun · After the Last Summer"].map((n,i)=>'<div class="row"><div class="avatar">'+n[0]+'</div><div class="grow"><div class="rowtitle">'+esc(n)+'</div><div class="rowsub">'+(i?"Continue your conversation…":"That message was not sent by me.")+'</div></div></div>').join("")+'</main>'+tabs("chat")}
function play(){return '<main class="page">'+header()+'<h1>My stories</h1><div class="sub">Episodes you started or saved.</div><div style="margin-top:20px">'+Object.values(EPISODES).slice(0,3).map(x=>{const p=state.progress[x.id]||0;return '<div class="library" data-open="'+x.id+'"><div class="libart"></div><div class="grow"><div class="rowtitle">'+esc(x.title)+'</div><div class="rowsub">'+(p?Math.round(p*100)+"% complete":"Not started")+'</div><div class="progress"><div class="fill" style="width:'+Math.round(p*100)+'%"></div></div></div><span>›</span></div>'}).join("")+'</div></main>'+tabs("play")}
function settings(){
const connected=Boolean(state.auth&&state.auth.connected);
return '<main class="page">'+header()+'<h1>Settings</h1><div class="row"><div class="avatar">J</div><div class="grow"><div class="rowtitle">Private Player</div><div class="rowsub">Personal clean-room build</div></div></div><div class="settingsGroup">AI BACKEND</div><input id="backendUrl" class="field" placeholder="https://your-backend.example.com" value="'+esc(state.backendUrl||"")+'"><div style="height:10px"></div><input id="appPassword" class="field" type="password" placeholder="Private app password" value="'+esc(password)+'"><div class="hint">The password is stored only for this browser session.</div><div style="height:10px"></div><select id="model" class="field"><option value="gpt-5.6-luna" '+(state.model==="gpt-5.6-luna"?"selected":"")+'>GPT-5.6 Luna</option><option value="gpt-5.6-terra" '+(state.model==="gpt-5.6-terra"?"selected":"")+'>GPT-5.6 Terra</option><option value="gpt-5.6-sol" '+(state.model==="gpt-5.6-sol"?"selected":"")+'>GPT-5.6 Sol</option></select><div class="btnrow"><button class="btn" id="testBackend">Test backend</button><button class="btn primary" id="connectChatGPT">'+(connected?"Reconnect ChatGPT":"Connect ChatGPT")+'</button></div><div style="margin-top:12px"><span class="status"><span class="dot '+(connected?"ok":"")+'"></span>'+(connected?"ChatGPT "+esc(state.auth.plan||"connected"):"Not connected")+'</span></div><div id="settingsError" class="error"></div><div class="settingsGroup">DATA</div><div class="btnrow"><button class="btn" id="exportSave">Export save</button><button class="btn" id="resetSave">Reset progress</button></div><div class="settingsGroup">ABOUT</div><div class="setting"><span>Version</span><span style="margin-left:auto;color:var(--muted)">0.4.0 web</span></div></main>'+tabs("settings")}
function episodeView(){
const x=ep(state.episodeId);const p=state.progress[x.id]||0;
return '<div><div class="detailCover"></div><button class="iconbtn back" type="button" data-nav="home">←</button><main class="detail"><span class="badge">STORY</span><h1>'+esc(x.title)+'</h1><div class="sub">'+esc(x.subtitle)+'</div><div class="chips" style="margin:14px 0">'+x.tags.map(t=>'<span class="chip">'+esc(t)+'</span>').join("")+'</div><p class="sub" style="font-size:14px;color:var(--text2)">'+esc(x.description)+'</p></main><button class="bigcta" type="button" id="startEpisode">'+(p?"Continue story":"Start story")+'</button></div>'
}
function player(){
const s=state.scene||FIRST;
return '<div class="player"><section class="stage"><div class="stageTop"><button class="iconbtn" type="button" data-nav="play">←</button><span class="chapter">'+esc(s.chapter||"NEXT SCENE")+'</span><button class="iconbtn" type="button">•••</button></div><div class="location">'+esc(s.location||"Unknown")+'</div></section><section class="story"><div class="tools"><button class="tool" type="button">▤ Journal</button><button class="tool" type="button">⌘ Map</button><button class="tool" type="button">◎ State</button></div><div class="storybody">'+(s.speaker?'<div class="speaker">'+esc(s.speaker)+'</div>':'')+'<div class="narrative">'+esc(s.body)+'</div><div class="prompt">What do you do?</div>'+s.choices.map((c,i)=>'<button class="choice" type="button" data-choice="'+esc(c.id)+'"><span class="num">'+(i+1)+'</span><span class="grow">'+esc(c.label)+'</span><span>›</span></button>').join("")+'<div class="reply"><textarea id="freeText" placeholder="Say or do something else…"></textarea><button class="send" type="button" id="sendFree">↑</button></div></div></section></div>'
}
function render(){
if(!APP)throw new Error("App root not found");
if(state.view==="chat")APP.innerHTML=chat();
else if(state.view==="play")APP.innerHTML=play();
else if(state.view==="settings")APP.innerHTML=settings();
else if(state.view==="episode")APP.innerHTML=episodeView();
else if(state.view==="player")APP.innerHTML=player();
else APP.innerHTML=home();
bind();
}
function bind(){
document.querySelectorAll("[data-nav]").forEach(el=>el.addEventListener("click",()=>{state.view=el.dataset.nav;save();render()}));
document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",()=>{state.episodeId=el.dataset.open;state.view="episode";save();render()}));
const start=document.getElementById("startEpisode");if(start)start.addEventListener("click",()=>{state.scene=state.scene||JSON.parse(JSON.stringify(FIRST));state.progress[state.episodeId]=state.progress[state.episodeId]||0.08;state.view="player";save();render()});
document.querySelectorAll("[data-choice]").forEach(el=>el.addEventListener("click",()=>advance(choiceText(el.dataset.choice))));
const send=document.getElementById("sendFree");if(send)send.addEventListener("click",()=>{const t=document.getElementById("freeText").value.trim();if(t)advance(t)});
const backend=document.getElementById("backendUrl");if(backend)backend.addEventListener("change",()=>{state.backendUrl=backend.value.trim().replace(/\/$/,"");save()});
const pw=document.getElementById("appPassword");if(pw)pw.addEventListener("change",()=>{password=pw.value;sessionStorage.setItem("cinematic-password",password)});
const model=document.getElementById("model");if(model)model.addEventListener("change",()=>{state.model=model.value;save()});
const test=document.getElementById("testBackend");if(test)test.addEventListener("click",testBackend);
const connect=document.getElementById("connectChatGPT");if(connect)connect.addEventListener("click",connectChatGPT);
const exp=document.getElementById("exportSave");if(exp)exp.addEventListener("click",exportSave);
const reset=document.getElementById("resetSave");if(reset)reset.addEventListener("click",()=>{if(confirm("Reset story progress?")){const b=state.backendUrl,m=state.model,a=state.auth;state=readState();state.progress={};state.recent=[];state.scene=null;state.backendUrl=b;state.model=m;state.auth=a;save();render()}});
}
function choiceText(id){const s=state.scene||FIRST;const c=(s.choices||[]).find(x=>x.id===id);return c?c.label:id}
function mockNext(input){return {id:"scene-"+Date.now(),chapter:"CHAPTER 1 · 00:21",location:"Platform 4",speaker:"Mina",body:"Mina studies your reaction. The station lights flicker twice. Your decision — “"+input+"” — changes her expression before a notification appears on her phone. The timestamp is tomorrow morning.",choices:[{id:"c1",label:"Ask to read the message."},{id:"c2",label:"Tell Mina not to open it yet."},{id:"c3",label:"Check the platform cameras."}]}}
async function advance(input){
const busy=document.createElement("div");busy.className="busy";busy.textContent="Generating the next scene…";document.body.appendChild(busy);
try{
let next;
if(state.backendUrl&&state.auth&&state.auth.connected){const result=await api("/api/roleplay",{model:state.model,episode:ep(state.episodeId),scene:state.scene||FIRST,input,recent:(state.recent||[]).slice(-8)});next=result.scene}else{await new Promise(r=>setTimeout(r,450));next=mockNext(input)}
state.recent=(state.recent||[]).concat([{player:input,scene:next.body}]).slice(-12);state.scene=next;state.progress[state.episodeId]=Math.min(.98,(state.progress[state.episodeId]||.08)+.05);save();render();
}catch(e){alert("Generation failed: "+e.message)}finally{busy.remove()}
}
async function api(path,body){
if(!state.backendUrl)throw new Error("Set Backend URL first.");
if(!password)throw new Error("Enter the private app password first.");
const r=await fetch(state.backendUrl+path,{method:"POST",headers:{"content-type":"application/json","x-app-password":password},body:JSON.stringify(body||{})});
let data={};try{data=await r.json()}catch{}
if(!r.ok)throw new Error(data.message||data.error||("HTTP "+r.status));return data;
}
function setErr(v){const n=document.getElementById("settingsError");if(n)n.textContent=v}
async function testBackend(){setErr("");try{const d=await api("/api/auth/status",{});if(d.connected){state.auth={connected:true,plan:d.plan||""};save();render()}else setErr("Backend reachable. ChatGPT is not connected yet.")}catch(e){setErr(e.message)}}
async function connectChatGPT(){setErr("");try{const d=await api("/api/auth/chatgpt/start",{});showLogin(d);pollLogin()}catch(e){setErr(e.message)}}
function showLogin(d){
const modal=document.createElement("div");modal.className="modal";modal.id="loginModal";modal.innerHTML='<div class="sheet"><h2>Connect ChatGPT</h2><div class="sub">Open the OpenAI device page and enter this code.</div><div class="code">'+esc(d.userCode||"")+'</div><button class="btn primary" id="openVerify">Open ChatGPT login</button><button class="btn" style="margin-top:8px" id="closeLogin">Close</button><div class="hint" id="loginHint">Waiting for authorization…</div></div>';document.body.appendChild(modal);
document.getElementById("openVerify").onclick=()=>window.open(d.verificationUrl,"_blank","noopener");document.getElementById("closeLogin").onclick=()=>modal.remove();
}
async function pollLogin(){for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,2000));try{const d=await api("/api/auth/status",{});if(d.connected){state.auth={connected:true,plan:d.plan||"Plus"};save();const modal=document.getElementById("loginModal");if(modal)modal.remove();render();return}}catch{}}const hint=document.getElementById("loginHint");if(hint)hint.textContent="Login timed out. Start again."}
function exportSave(){const copy=JSON.parse(JSON.stringify(state));delete copy.auth;const blob=new Blob([JSON.stringify(copy,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cinematic-play-save-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
render();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js?v=4").catch(()=>{})}
})();