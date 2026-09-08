import { act, advance, createRoom, GameError, joinRoom, publicView, random } from "./game.ts";
import type { Room } from "./game.ts";

interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{results:T[]}>;
  run(): Promise<{meta:{changes:number}}>;
}
export interface Database { prepare(sql: string): Statement }
type Row = { code:string; state:string; version:number; expires_at:number };
const TTL=6*60*60*1000;
const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
async function hash(value: string) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
}
async function limit(db:Database, key:string, max:number, period:number, now:number) {
  const k=`${key}:${Math.floor(now/period)}`;
  const row=await db.prepare("INSERT INTO limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits")
    .bind(k,now+period*2).first<{hits:number}>();
  if(row && row.hits>max) throw new GameError("Too many attempts. Please wait a minute and try again.",429);
}
async function save(db:Database,row:Row,s:Room,now:number) {
  const r=await db.prepare("UPDATE rooms SET state=?,version=version+1,expires_at=? WHERE code=? AND version=?")
    .bind(JSON.stringify(s),now+TTL,row.code,row.version).run();
  return r.meta.changes===1;
}
async function readBody(req:Request) {
  const reader=req.body?.getReader(); if(!reader) return {};
  const chunks:Uint8Array[]=[];let length=0;
  while(true) {const {done,value}=await reader.read();if(done)break;length+=value.length;
    if(length>4096) {await reader.cancel();throw new GameError("Request is too large.",413);} chunks.push(value);}
  const bytes=new Uint8Array(length);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
  try {const b=JSON.parse(new TextDecoder().decode(bytes));if(!b || Array.isArray(b) || typeof b!=="object")throw 0;return b as Record<string,unknown>;} catch {throw new GameError("Invalid request.");}
}
export async function handle(req:Request,db:Database,now=Date.now()):Promise<Response> {
  const headers={"Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"same-origin"};
  try {
    if(!["GET","POST"].includes(req.method)) throw new GameError("Method not allowed.",405);
    const url=new URL(req.url),origin=req.headers.get("origin");
    if(origin && origin!==url.origin) throw new GameError("Open the game directly to play.",403);
    const token=req.headers.get("authorization")?.replace(/^Bearer /,"") ?? "";
    if(!/^[a-f0-9]{64}$/.test(token)) throw new GameError("Your session could not be restored. Please join again.",401);
    const key=await hash(token);
    const data=req.method==="POST"?await readBody(req):{};
    const action=req.method==="GET"?"sync":String(data.action??"");
    const rawName=typeof data.name==="string"?data.name.trim().normalize("NFC"):"";
    const name=rawName.replace(/[\p{Cc}\p{Cf}]/gu,"").slice(0,20);
    let code=String(data.code??url.searchParams.get("code")??"").toUpperCase();
    if(["create","join"].includes(action)) {
      if(!name) throw new GameError("Enter a name for your seat.");
      const ip=await hash(req.headers.get("cf-connecting-ip")??"local");
      await limit(db,`${action}:${ip}`,action==="create"?12:60,60000,now);
    } else if(action!=="sync") await limit(db,`action:${key}`,100,60000,now);
    if(action==="create") {
      const existing=await db.prepare("SELECT code,state,version,expires_at FROM rooms WHERE creator_key=? AND expires_at>?").bind(key,now).first<Row>();
      if(existing) code=existing.code;
      else {
        await db.prepare("DELETE FROM rooms WHERE expires_at<?").bind(now).run();
        await db.prepare("DELETE FROM presence WHERE seen_at<?").bind(now-TTL).run();
        await db.prepare("DELETE FROM limits WHERE expires_at<?").bind(now).run();
        let created=false;
        for(let attempt=0;attempt<5;attempt++) {
          code=Array.from({length:6},()=>ALPHABET[random(ALPHABET.length)]).join("");
          const state=createRoom(code,key,name);
          const result=await db.prepare("INSERT OR IGNORE INTO rooms (code,creator_key,state,version,expires_at) VALUES (?,?,?,0,?)")
            .bind(code,key,JSON.stringify(state),now+TTL).run();
          if(result.meta.changes) {created=true;break;}
          const retry=await db.prepare("SELECT code FROM rooms WHERE creator_key=?").bind(key).first<{code:string}>();
          if(retry){code=retry.code;created=true;break;}
        }
        if(!created) throw new GameError("Could not open a table. Please try again.",503);
      }
    }
    if(!/^[A-Z2-9]{6}$/.test(code)) throw new GameError("Enter a six-character room code.");
    for(let attempt=0;attempt<6;attempt++) {
      const row=await db.prepare("SELECT code,state,version,expires_at FROM rooms WHERE code=? AND expires_at>?").bind(code,now).first<Row>();
      if(!row) throw new GameError("This room was not found or has expired. Check the code with your host.",404);
      const s=JSON.parse(row.state) as Room;
      let p=s.players.find(p=>p.key===key);
      if(action==="join" && !p) {
        p=joinRoom(s,key,name);
        if(!await save(db,row,s,now))continue;
        row.version++;
      }
      if(!p || p.left) throw new GameError("Your seat is no longer in this room. Please join again.",403);
      // Presence lives outside the versioned game state: a heartbeat cannot invalidate a card play.
      await db.prepare("INSERT INTO presence (key,code,player_id,seen_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET seen_at=excluded.seen_at WHERE presence.seen_at<?")
        .bind(`${code}:${p.id}`,code,p.id,now,now-8000).run();
      const seen=(await db.prepare("SELECT player_id,seen_at FROM presence WHERE code=?").bind(code).all<{player_id:string;seen_at:number}>()).results;
      const online=new Set(seen.filter(x=>now-x.seen_at<25000).map(x=>x.player_id));
      let changed=advance(s,now);
      const hostSeen=seen.find(x=>x.player_id===s.host)?.seen_at??0;
      if(now-hostSeen>90000 && !online.has(s.host)) {
        const successor=s.players.find(x=>!x.left && online.has(x.id));
        if(successor && successor.id!==s.host) {s.host=successor.id;if(s.phase==="lobby")successor.ready=true;changed=true;}
      }
      if(changed) {
        if(!await save(db,row,s,now))continue;
        row.version++;
      }
      if(!["create","join","sync"].includes(action)) {
        const id=typeof data.requestId==="string"?data.requestId:"";
        if(!/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new GameError("Invalid action. Please refresh the page.");
        const dedupe=`${p.id}:${id}`;
        if(!s.processed.includes(dedupe)) {
          if(data.version!==row.version) throw new GameError("The table moved on. Your view is refreshing; choose your move again.",409);
          act(s,p.id,action,data,now);
          s.processed.push(dedupe);s.processed=s.processed.slice(-40);
          if(!await save(db,row,s,now))continue;
          row.version++;
        }
      }
      return Response.json({view:publicView(s,p.id,row.version,online,now)}, {headers});
    }
    throw new GameError("The table is busy. Please try that move again.",409);
  } catch(error) {
    const expected=error instanceof GameError;
    if(!expected) console.error("Game request failed",error);
    return Response.json({error:expected?error.message:"The table is temporarily unavailable. Your seat is saved; try reconnecting."},
      {status:expected?error.status:503,headers});
  }
}
