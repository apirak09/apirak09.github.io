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
const SAVE_FILE=process.env.FRONTIA_SAVE_FILE||path.join(WORKSPACE,"cinematic-save.json");

fs.mkdirSync(CODEX_HOME,{recursive:true});
fs.mkdirSync(WORKSPACE,{recursive:true});

function readCloudSave(){
  try{
    if(!fs.existsSync(SAVE_FILE))return null;
    const data=JSON.parse(fs.readFileSync(SAVE_FILE,"utf8"));
    return data&&typeof data==="object"?data:null;
  }catch(e){
    console.error("read save:",e);
    return null;
  }
}

function writeCloudSave(data){
  if(!data||typeof data!=="object")throw new Error("invalid_save");
  const safe={
    version:1,
    episodeId:typeof data.episodeId==="string"?data.episodeId:null,
    scene:data.scene&&typeof data.scene==="object"?data.scene:null,
    progress:data.progress&&typeof data.progress==="object"?data.progress:{},
    recent:Array.isArray(data.recent)?data.recent.slice(-40):[],
    updatedAt:Number(data.updatedAt||Date.now())
  };
  const tmp=SAVE_FILE+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(safe,null,2),"utf8");
  fs.renameSync(tmp,SAVE_FILE);
  return safe;
}

class CodexBridge {
  constructor(){this.seq=1;this.pending=new Map();this.events=new EventEmitter();this.ready=this.start();}
  async start(){
    this.proc=spawn("codex",["app-server"],{
      stdio:["pipe","pipe","inherit"],
      env:{...process.env,CODEX_HOME},
      cwd:WORKSPACE
    });
    this.proc.on("exit",(code)=>{
      for(const [,p] of this.pending)p.reject(new Error("codex app-server exited: "+code));
      this.pending.clear();
    });
    readline.createInterface({input:this.proc.stdout}).on("line",(line)=>{
      let m;try{m=JSON.parse(line)}catch{return}
      if(m.id!==undefined){
        const p=this.pending.get(m.id);if(!p)return;
        this.pending.delete(m.id);
        if(m.error)p.reject(new Error(m.error.message||JSON.stringify(m.error)));
        else p.resolve(m.result);
      }else if(m.method){
        this.events.emit(m.method,m.params||{});
        this.events.emit("*",m);
      }
    });
    await this.rpc("initialize",{clientInfo:{name:"cinematic_play_private",title:"Cinematic Play Private",version:"0.5.0"}});
    this.notify("initialized",{});
  }
  rpc(method,params={}){
    const id=this.seq++;
    return new Promise((resolve,reject)=>{
      this.pending.set(id,{resolve,reject});
      this.proc.stdin.write(JSON.stringify({method,id,params})+"\n");
      setTimeout(()=>{
        if(this.pending.has(id)){
          this.pending.delete(id);
          reject(new Error(method+" timed out"));
        }
      },120000);
    });
  }
  notify(method,params={}){this.proc.stdin.write(JSON.stringify({method,params})+"\n");}
  async account(){await this.ready;return this.rpc("account/read",{refreshToken:false});}
  async loginDevice(){await this.ready;return this.rpc("account/login/start",{type:"chatgptDeviceCode"});}
  async roleplay({model,episode,scene,input,recent}){
    await this.ready;
    const account=await this.account();
    if(!account?.account)throw new Error("ยังไม่ได้เชื่อม ChatGPT");

    const chosen=model||"gpt-5.6-luna";
    const thread=await this.rpc("thread/start",{model:chosen,cwd:WORKSPACE});
    const threadId=thread?.thread?.id;
    if(!threadId)throw new Error("Codex ไม่ได้คืน thread id");

    const system=`คุณคือเครื่องยนต์เขียนนิยายเชิงโต้ตอบสำหรับแอปส่วนตัวแนว cinematic roleplay

กฎสำคัญ:
- เขียนเนื้อหาที่ผู้เล่นเห็นเป็นภาษาไทยธรรมชาติทั้งหมด รวม chapter, location, speaker, body และ choices
- ชื่อเฉพาะต่างประเทศให้ถอดเสียงหรือคงชื่อเดิมได้เมื่อเหมาะสม แต่ประโยคและคำบรรยายต้องเป็นภาษาไทย
- รักษาบุคลิก ความสัมพันธ์ เหตุการณ์ และผลจากการตัดสินใจก่อนหน้าอย่างต่อเนื่อง
- บทสนทนาต้องเป็นธรรมชาติ ไม่ฟังเหมือนผู้ช่วย AI และไม่อธิบายกฎของเรื่องให้ผู้เล่น
- ให้ความสำคัญกับอารมณ์ รายละเอียดฉาก จังหวะของเรื่อง และ agency ของผู้เล่น
- ห้ามใช้ tools, shell, files, web browsing หรือ code execution ใด ๆ งานเดียวคือเขียนฉากถัดไป
- ตอบเป็น JSON ที่ parse ได้เท่านั้น ห้าม markdown และห้ามข้อความนอก JSON

Schema:
{"chapter":"ข้อความภาษาไทย","location":"สถานที่ภาษาไทย","speaker":"ชื่อตัวละครหรือ null","body":"เนื้อเรื่องภาษาไทย","choices":[{"id":"c1","label":"ตัวเลือกภาษาไทย"},{"id":"c2","label":"ตัวเลือกภาษาไทย"},{"id":"c3","label":"ตัวเลือกภาษาไทย"}]}

สร้างตัวเลือก 2-4 ตัวเลือก แต่เปิดทางให้ผู้เล่นพิมพ์การกระทำเองได้เสมอ
ความยาว body โดยทั่วไปประมาณ 120-300 คำภาษาไทย แต่ย่อให้สั้นได้เมื่อจังหวะเรื่องเหมาะสม`;

    const payload={
      episode,
      scene,
      playerAction:input,
      recent:(recent||[]).slice(-12),
      outputLanguage:"Thai"
    };

    let text="";
    let completed=false;
    const onDelta=(p)=>{
      if(p?.threadId===threadId||!p?.threadId)text+=p?.delta||"";
    };

    const done=new Promise((resolve,reject)=>{
      const onDone=(p)=>{
        if(p?.threadId&&p.threadId!==threadId)return;
        cleanup();
        completed=true;
        const status=p?.turn?.status||p?.status;
        if(status==="failed")reject(new Error(p?.turn?.error?.message||"Codex สร้างฉากไม่สำเร็จ"));
        else resolve();
      };
      const cleanup=()=>{
        this.events.off("item/agentMessage/delta",onDelta);
        this.events.off("turn/completed",onDone);
      };
      this.events.on("item/agentMessage/delta",onDelta);
      this.events.on("turn/completed",onDone);
      setTimeout(()=>{
        if(!completed){
          cleanup();
          reject(new Error("Codex ใช้เวลาสร้างฉากนานเกินไป"));
        }
      },120000);
    });

    this.events.on("item/agentMessage/delta",onDelta);
    await this.rpc("turn/start",{
      threadId,
      input:[{type:"text",text:system+"\n\nสถานะเรื่องปัจจุบัน:\n"+JSON.stringify(payload)}]
    });
    await done;

    if(!text.trim())throw new Error("Codex ไม่ได้ส่งเนื้อเรื่องกลับมา");
    const cleaned=text.trim().replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"");
    let parsed;
    try{
      parsed=JSON.parse(cleaned);
    }catch{
      const a=cleaned.indexOf("{"),b=cleaned.lastIndexOf("}");
      if(a<0||b<=a)throw new Error("โมเดลไม่ได้ตอบเป็น JSON");
      parsed=JSON.parse(cleaned.slice(a,b+1));
    }
    if(!Array.isArray(parsed.choices)||!parsed.body)throw new Error("รูปแบบฉากที่โมเดลตอบกลับไม่ถูกต้อง");

    return {
      scene:{
        id:"scene-"+Date.now(),
        chapter:parsed.chapter||"ฉากถัดไป",
        location:parsed.location||scene?.location||"",
        speaker:parsed.speaker??null,
        body:parsed.body,
        choices:parsed.choices.slice(0,4)
      }
    };
  }
}

const codex=new CodexBridge();

function headers(req){
  const origin=req.headers.origin||"";
  const allowed=origin===ALLOWED_ORIGIN||/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "content-type":"application/json; charset=utf-8",
    "access-control-allow-origin":allowed?origin:ALLOWED_ORIGIN,
    "access-control-allow-headers":"content-type,x-app-password",
    "access-control-allow-methods":"GET,POST,OPTIONS",
    "vary":"Origin",
    "cache-control":"no-store"
  };
}

function send(req,res,status,data){
  res.writeHead(status,headers(req));
  res.end(JSON.stringify(data));
}

async function body(req){
  const parts=[];
  for await(const c of req)parts.push(c);
  if(!parts.length)return{};
  const raw=Buffer.concat(parts).toString("utf8");
  if(raw.length>2_000_000)throw new Error("request_too_large");
  return JSON.parse(raw);
}

function authed(req){
  return Boolean(APP_PASSWORD)&&req.headers["x-app-password"]===APP_PASSWORD;
}

const server=http.createServer(async(req,res)=>{
  if(req.method==="OPTIONS"){
    res.writeHead(204,headers(req));
    return res.end();
  }

  const url=new URL(req.url,"http://localhost");

  if(req.method==="GET"&&url.pathname==="/health"){
    return send(req,res,200,{ok:true,codexHome:!!CODEX_HOME,cloudSave:fs.existsSync(SAVE_FILE)});
  }

  if(!authed(req)){
    return send(req,res,401,{error:"unauthorized",message:"รหัสผ่าน Backend ไม่ถูกต้องหรือไม่ได้ระบุ"});
  }

  try{
    if(req.method==="POST"&&url.pathname==="/api/auth/status"){
      const a=await codex.account();
      const account=a?.account||null;
      return send(req,res,200,{
        connected:!!account,
        plan:account?.planType||account?.plan_type||"",
        authMode:account?.type||a?.authMode||""
      });
    }

    if(req.method==="POST"&&url.pathname==="/api/auth/chatgpt/start"){
      const x=await codex.loginDevice();
      return send(req,res,200,{
        loginId:x.loginId,
        verificationUrl:x.verificationUrl,
        userCode:x.userCode
      });
    }

    if(req.method==="POST"&&url.pathname==="/api/save/get"){
      return send(req,res,200,{save:readCloudSave()});
    }

    if(req.method==="POST"&&url.pathname==="/api/save/set"){
      const data=await body(req);
      const saved=writeCloudSave(data.save);
      return send(req,res,200,{ok:true,updatedAt:saved.updatedAt});
    }

    if(req.method==="POST"&&url.pathname==="/api/roleplay"){
      const data=await body(req);
      const result=await codex.roleplay(data);
      return send(req,res,200,result);
    }

    return send(req,res,404,{error:"not_found"});
  }catch(e){
    console.error(e);
    return send(req,res,500,{
      error:"server_error",
      message:e instanceof Error?e.message:String(e)
    });
  }
});

server.listen(PORT,"0.0.0.0",()=>{
  console.log("Cinematic Play backend listening on :"+PORT);
  console.log("Cloud save file:",SAVE_FILE);
});