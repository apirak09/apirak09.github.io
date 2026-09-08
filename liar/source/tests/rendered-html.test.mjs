import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {Miniflare} from 'miniflare';

test('compiled Worker renders the game and serves multiplayer against native D1',async()=>{
  const mf=new Miniflare({modules:true,modulesRules:[{type:"ESModule",include:["**/*.js"],fallthrough:true}],scriptPath:new URL('../dist/server/index.js',import.meta.url).pathname,compatibilityDate:'2026-04-01',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],serviceBindings:{ASSETS:async()=>new Response('Not found',{status:404})}});
  try{
    const db=await mf.getD1Database('DB');
    for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql'))){
      for(const sql of readFileSync(new URL(`../drizzle/${f}`,import.meta.url),'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
    }
    const page=await mf.dispatchFetch('https://table.test/');assert.equal(page.status,200);const html=await page.text();
    assert.match(html,/Take a seat\./);assert.match(html,/Create a table/);assert.match(html,/<title>Liar Table/);assert.doesNotMatch(html,/Starter Project/);
    const post=async(token,payload)=>{
      const res=await mf.dispatchFetch('https://table.test/api/game',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,origin:'https://table.test'},body:JSON.stringify(payload)});
      const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result.view;
    };
    const a=await post('1'.repeat(64),{action:'create',name:'Jack'});
    let b=await post('2'.repeat(64),{action:'join',code:a.code,name:'Friend'});assert.equal(b.players.length,2);
    b=await post('2'.repeat(64),{action:'ready',code:a.code,ready:true,version:b.version,requestId:crypto.randomUUID()});
    const game=await post('1'.repeat(64),{action:'start',code:a.code,version:b.version,requestId:crypto.randomUUID()});
    assert.equal(game.phase,'playing');assert.equal(game.hand.length,5);assert.equal(game.players[1].hand,undefined);assert.equal(game.players[1].bullet,undefined);
  }finally{await mf.dispose();}
});
