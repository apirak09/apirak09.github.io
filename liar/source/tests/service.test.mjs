import assert from 'node:assert/strict';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handle} from '../lib/service.ts';

function setup(){
  const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync(new URL(`../drizzle/${f}`,import.meta.url),'utf8'));
  const db={prepare(sql){let values=[];return{bind(...v){values=v;return this;},async first(){return sqlite.prepare(sql).get(...values)??null;},async all(){return{results:sqlite.prepare(sql).all(...values)};},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};}};
  return{db,sqlite};
}
const origin='https://example.test';
function token(n){return n.toString(16).padStart(64,'0');}
async function request(db,t,body,now=1000000){const req=new Request(`${origin}/api/game${typeof body==='string'?`?code=${body}`:''}`,{method:typeof body==='string'?'GET':'POST',headers:{authorization:`Bearer ${t}`,origin,...(typeof body==='string'?{}:{'content-type':'application/json'})},body:typeof body==='string'?undefined:JSON.stringify(body)});const r=await handle(req,db,now);return{status:r.status,...await r.json()};}
function command(v,action,extra={}){return{code:v.code,version:v.version,action,requestId:crypto.randomUUID(),...extra};}
test('four independent devices create, join, ready, deal, reconnect and challenge through persisted API',async()=>{
  const {db,sqlite}=setup();let res=await request(db,token(1),{action:'create',name:'Jack'});assert.equal(res.status,200);const code=res.view.code;
  const same=await request(db,token(1),{action:'create',name:'Jack'});assert.equal(same.view.code,code);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM rooms').get().n,1);
  for(let i=2;i<=4;i++){const joined=await request(db,token(i),{action:'join',code,name:`P${i}`});assert.equal(joined.status,200);const ready=await request(db,token(i),command(joined.view,'ready',{ready:true}));assert.equal(ready.status,200);}
  assert.equal((await request(db,token(5),{action:'join',code,name:'Extra'})).status,409);
  assert.equal((await request(db,token(6),code)).status,403);
  let v=(await request(db,token(1),code)).view;res=await request(db,token(1),command(v,'start'));assert.equal(res.status,200);
  const views=[];for(let i=1;i<=4;i++)views.push((await request(db,token(i),code)).view);
  assert.equal(new Set(views.flatMap(v=>v.hand.map(c=>c.id))).size,20);
  for(const v of views){assert.equal(v.hand.length,5);assert.equal(JSON.stringify(v.players).includes('bullet'),false);assert.equal(JSON.stringify(v.players).includes('key'),false);}
  const index=views.findIndex(v=>v.turn===v.me),actor=views[index],payload=command(actor,'play',{cards:[actor.hand[0].id]});
  const played=await request(db,token(index+1),payload);assert.equal(played.status,200);
  const repeated=await request(db,token(index+1),payload);assert.equal(repeated.status,200);assert.equal(repeated.view.pile,1);assert.equal(repeated.view.hand.length,4);
  const reloaded=(await request(db,token(index+1),code)).view;assert.deepEqual(reloaded.hand,repeated.view.hand);
  let caller;for(let i=1;i<=4;i++){const x=(await request(db,token(i),code)).view;if(x.me===x.turn)caller={i,v:x};}
  const called=await request(db,token(caller.i),command(caller.v,'call'));assert.equal(called.status,200);assert.equal(called.view.phase,'roulette');assert.equal(called.view.penalty.cards.length,1);
});
test('stale actions, invalid authentication and cross-origin writes are rejected',async()=>{
  const {db}=setup();const a=await request(db,token(1),{action:'create',name:'Jack'});const b=await request(db,token(2),{action:'join',code:a.view.code,name:'Friend'});
  assert.equal((await request(db,token(1),command(a.view,'start'))).status,409);
  assert.equal((await request(db,'not-a-token',a.view.code)).status,401);
  const r=await handle(new Request(origin+'/api/game',{method:'POST',headers:{origin:'https://evil.test',authorization:`Bearer ${token(1)}`},body:JSON.stringify(command(b.view,'leave'))}),db);assert.equal(r.status,403);
});
test('simultaneous joins cannot overfill a room or drop a player',async()=>{
  const {db}=setup();const a=await request(db,token(1),{action:'create',name:'Jack'});
  const results=await Promise.all([2,3,4,5,6].map(i=>request(db,token(i),{action:'join',code:a.view.code,name:`P${i}`})));
  assert.equal(results.filter(r=>r.status===200).length,3);const state=(await request(db,token(1),a.view.code)).view;assert.equal(state.players.length,4);
});
test('disconnected host transfers to an active guest without exposing secrets',async()=>{
  const {db}=setup();const a=await request(db,token(1),{action:'create',name:'Jack'});const b=await request(db,token(2),{action:'join',code:a.view.code,name:'Friend'});
  const v=(await request(db,token(2),a.view.code,1100000)).view;assert.equal(v.host,b.view.me);assert.equal(v.players.find(p=>p.id===a.view.me).online,false);
});
