import http from "node:http";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

const PORT=Number(process.env.PORT||8000);
const APP_PASSWORD=process.env.APP_PASSWORD||"";
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||"https://apirak09.github.io";
const CODEX_HOME=process.env.CODEX_HOME||path.join(process.env.HOME||".",".codex");
const WORKSPACE=process.env.FRONTIA_WORKSPACE||"/tmp/frontia-roleplay";
fs.mkdirSync(CODEX_HOME,{recursive:true});
fs.mkdirSync(WORKSPACE,{recursive:true});

class CodexBridge {
  constructor(){ this.seq=1; this.pending=new Map(); this.events=new EventEmitter(); this.ready=this.start(); }
  async start(){
    this.proc=spawn("codex",["app-server"],{
      stdio:["pipe","pipe","inherit"],
      env:{...process.env,CODEX_HOME},
      cwd:WORKSPACE
    });
    this.proc.on("exit",(code)=>{ for(const [,p] of this.pending)p.reject(new Error("codex app-server exited: "+code)); this.pending.clear(); });
    readline.createInterface({input:this.proc.stdout}).on("line",(line)=>{
      let m; try{m=JSON.parse(line)}catch{return}
      if(m.id!==undefined){
        const p=this.pending.get(m.id); if(!p)return;
        this.pending.delete(m.id);
        if(m.error)p.reject(new Error(m.error.message||JSON.stringify(m.error))); else p.resolve(m.result);
      } else if(m.method){ this.events.emit(m.method,m.params||{}); this.events.emit("*",m); }
    });
    await this.rpc("initialize",{clientInfo:{name:"cinematic_play_private",title:"Cinematic Play Private",version:"0.3.0"}});
    this.notify("initialized",{});
  }
  rpc(method,params={}){
    const id=this.seq++;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.proc.stdin.write(JSON.stringify({method,id,params})+"\n");
      setTimeout(()=>{if(this.pending.has(id)){this.pending.delete(id);reject(new Error(method+" timed out"));}},120000);
    });
  }
  notify(method,params={}){ this.proc.stdin.write(JSON.stringify({method,params})+"\n"); }
  async account(){ await this.ready; return this.rpc("account/read",{refreshToken:false}); }
  async loginDevice(){ await this.ready; return this.rpc("account/login/start",{type:"chatgptDeviceCode"}); }
  async roleplay({model,episode,scene,input,recent}){
    await this.ready;
    const account=await this.account();
    if(!account?.account) throw new Error("ChatGPT is not connected");
    const chosen=model||"gpt-5.6-luna";
    const thread=await this.rpc("thread/start",{model:chosen,cwd:WORKSPACE});
    const threadId=thread?.thread?.id;
    if(!threadId)throw new Error("Codex did not return a thread id");

    const system=`You are the narrative engine for a private cinematic interactive-fiction application.
Do not use tools, shell commands, files, web browsing, or code execution. Only write the next story scene.
Maintain character continuity, emotional realism, and consequences from prior choices.
Return ONLY valid JSON. No markdown fences and no commentary.
Schema:
{"chapter":"string","location":"string","speaker":"string|null","body":"string","choices":[{"id":"c1","label":"string"},{"id":"c2","label":"string"},{"id":"c3","label":"string"}]}
Use 2-4 choices. Keep body roughly 100-260 words unless a shorter beat is dramatically appropriate.`;

    const payload={episode,scene,playerAction:input,recent:(recent||[]).slice(-8)};
    let text="";
    let completed=false;
    const onDelta=(p)=>{ if(p?.threadId===threadId || !p?.threadId) text += p?.delta||""; };
    const done=new Promise((resolve,reject)=>{
      const onDone=(p)=>{
        if(p?.threadId && p.threadId!==threadId)return;
        cleanup(); completed=true;
        const status=p?.turn?.status||p?.status;
        if(status==="failed")reject(new Error(p?.turn?.error?.message||"Codex turn failed")); else resolve();
      };
      const cleanup=()=>{this.events.off("item/agentMessage/delta",onDelta);this.events.off("turn/completed",onDone)};
      this.events.on("item/agentMessage/delta",onDelta);
      this.events.on("turn/completed",onDone);
      setTimeout(()=>{if(!completed){cleanup();reject(new Error("Codex generation timed out"));}},120000);
    });

    this.events.on("item/agentMessage/delta",onDelta);
    await this.rpc("turn/start",{threadId,input:[{type:"text",text:system+"\n\nSTORY STATE:\n"+JSON.stringify(payload)}]});
    await done;
    if(!text.trim()) throw new Error("Codex returned an empty scene");
    const cleaned=text.trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"");
    let parsed; try{parsed=JSON.parse(cleaned)}catch{const a=cleaned.indexOf("{"),b=cleaned.lastIndexOf("}"); if(a<0||b<=a)throw new Error("Model did not return JSON"); parsed=JSON.parse(cleaned.slice(a,b+1))}
    if(!Array.isArray(parsed.choices)||!parsed.body)throw new Error("Invalid scene schema");
    return {scene:{id:"scene-"+Date.now(),chapter:parsed.chapter||"NEXT SCENE",location:parsed.location||scene?.location||"",speaker:parsed.speaker??null,body:parsed.body,choices:parsed.choices.slice(0,4)}};
  }
}
const codex=new CodexBridge();

function headers(req){
  const origin=req.headers.origin||"";
  const allowed=origin===ALLOWED_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "content-type":"application/json; charset=utf-8",
    "access-control-allow-origin":allowed?origin:ALLOWED_ORIGIN,
    "access-control-allow-headers":"content-type,x-app-password",
    "access-control-allow-methods":"GET,POST,OPTIONS",
    "vary":"Origin",
    "cache-control":"no-store"
  };
}
function send(req,res,status,body){res.writeHead(status,headers(req));res.end(JSON.stringify(body))}
async function body(req){const parts=[];for await(const c of req)parts.push(c);if(!parts.length)return{};const raw=Buffer.concat(parts).toString("utf8");if(raw.length>1_000_000)throw new Error("request_too_large");return JSON.parse(raw)}
function authed(req){return APP_PASSWORD && req.headers["x-app-password"]===APP_PASSWORD}

const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS"){res.writeHead(204,headers(req));return res.end()}
  const url=new URL(req.url,"http://localhost");
  if(req.method==="GET"&&url.pathname==="/health")return send(req,res,200,{ok:true,codexHome:!!CODEX_HOME});
  if(!authed(req))return send(req,res,401,{error:"unauthorized",message:"Wrong or missing app password"});
  try{
    if(req.method==="POST"&&url.pathname==="/api/auth/status"){
      const a=await codex.account();
      const account=a?.account||null;
      return send(req,res,200,{connected:!!account,plan:account?.planType||account?.plan_type||"",authMode:account?.type||a?.authMode||""});
    }
    if(req.method==="POST"&&url.pathname==="/api/auth/chatgpt/start"){
      const x=await codex.loginDevice();
      return send(req,res,200,{loginId:x.loginId,verificationUrl:x.verificationUrl,userCode:x.userCode});
    }
    if(req.method==="POST"&&url.pathname==="/api/roleplay"){
      const data=await body(req);
      const result=await codex.roleplay(data);
      return send(req,res,200,result);
    }
    return send(req,res,404,{error:"not_found"});
  }catch(e){console.error(e);return send(req,res,500,{error:"server_error",message:e instanceof Error?e.message:String(e)})}
});
server.listen(PORT,"0.0.0.0",()=>console.log("Cinematic Play backend listening on :"+PORT));
