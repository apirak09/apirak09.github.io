import assert from 'node:assert/strict';
import test from 'node:test';
import {createRoom,joinRoom,act,advance,deck,mustCall,publicView} from '../lib/game.ts';

function table(n=4){const s=createRoom('ABC234','a'.repeat(64),'Jack');for(let i=1;i<n;i++)joinRoom(s,String(i).repeat(64),`Friend ${i}`);s.players.forEach(p=>p.ready=true);act(s,s.host,'start',{},1000);return s;}
const current=s=>s.players.find(p=>p.id===s.turn);
test('classic deck and 2–4 player deals contain no duplicate cards',()=>{
  assert.deepEqual(Object.fromEntries(['A','K','Q','J'].map(r=>[r,deck().filter(c=>c.rank===r).length])),{A:6,K:6,Q:6,J:2});
  for(let n=2;n<=4;n++){const s=table(n),cards=s.players.flatMap(p=>p.hand);assert.equal(cards.length,n*5);assert.equal(new Set(cards.map(c=>c.id)).size,n*5);assert.ok(s.players.every(p=>p.bullet>=1&&p.bullet<=6));}
});
test('private projections reveal only the recipient hand and called cards',()=>{
  const s=table();const actor=current(s);act(s,actor.id,'play',{cards:[actor.hand[0].id]},1100);
  for(const p of s.players){const v=publicView(s,p.id,1,new Set(),1200);assert.deepEqual(v.hand,p.hand);assert.deepEqual(Object.keys(v.last).sort(),['count','player']);
    for(const other of v.players){assert.equal(other.hand,undefined);assert.equal(other.key,undefined);assert.equal(other.bullet,undefined);}
    assert.equal(JSON.stringify(v).includes(p.key),false);
  }
});
test('any wrong card catches liar; all matching cards and Jokers punish caller',()=>{
  for(const ranks of [['A','J'],['A','Q'],['J','J']]){
    const s=table();s.rank='A';const actor=current(s);actor.hand=ranks.map((rank,i)=>({rank,id:`x${i}`}));
    act(s,actor.id,'play',{cards:actor.hand.map(c=>c.id)},1200);const caller=current(s);
    act(s,caller.id,'call',{},1400);const trueClaim=!ranks.includes('Q');
    assert.equal(s.penalty.truthful,trueClaim);assert.equal(s.penalty.loser,trueClaim?caller.id:actor.id);assert.equal(s.penalty.cards.length,2);
  }
});
test('cannot play another player’s cards, duplicates, zero or four cards, or out of turn',()=>{
  const s=table();const p=current(s),other=s.players.find(x=>x.id!==p.id);
  for(const cards of [[],p.hand.slice(0,4).map(c=>c.id),[p.hand[0].id,p.hand[0].id],[other.hand[0].id]])assert.throws(()=>act(structuredClone(s),p.id,'play',{cards},1200));
  assert.throws(()=>act(s,other.id,'call',{},1200));assert.throws(()=>act(s,p.id,'call',{},1200));
});
test('last remaining hand must call; finishing a hand is not a win',()=>{
  const s=table(2),p=current(s);p.hand=[{id:'a',rank:'A'}];
  act(s,p.id,'play',{cards:['a']},1200);assert.equal(s.phase,'playing');assert.equal(s.winner,null);assert.ok(mustCall(s));
  assert.throws(()=>act(s,s.turn,'play',{cards:[current(s).hand[0].id]},1300));
  act(s,s.turn,'call',{},1400);assert.equal(s.phase,'roulette');
});
test('empty hands are skipped in seat order',()=>{
  const s=table();const i=s.players.findIndex(p=>p.id===s.turn);s.players[(i+1)%4].hand=[];
  const p=current(s);act(s,p.id,'play',{cards:[p.hand[0].id]},1200);assert.equal(s.turn,s.players[(i+2)%4].id);
});
test('roulette advances fixed hidden chamber across rounds; sixth pull always eliminates',()=>{
  const s=table(2),p=s.players[0];p.bullet=6;
  for(let i=1;i<=6;i++){
    s.phase='roulette';s.penalty={caller:s.players[1].id,accused:p.id,loser:p.id,truthful:false,cards:[{id:'q',rank:'Q'}],dead:null,pull:i};
    act(s,p.id,'pull',{},i*10000);assert.equal(p.pulls,i);assert.equal(s.penalty.dead,i===6);
    if(i<6){advance(s,i*10000+6000);assert.equal(s.phase,'playing');assert.equal(s.turn,p.id);assert.equal(p.hand.length,5);assert.equal(p.bullet,6);}
  }
  assert.equal(s.phase,'finished');assert.equal(s.winner,s.players[1].id);
});
test('inactivity progresses play, forced challenge, roulette and redeal',()=>{
  const s=table(2);assert.equal(advance(s,30999),false);assert.equal(advance(s,31000),true);assert.ok(s.last);
  current(s).hand=[{id:'x',rank:'A'}];const nextPlayer=current(s);act(s,nextPlayer.id,'play',{cards:['x']},32000);
  assert.ok(mustCall(s));advance(s,62000);assert.equal(s.phase,'roulette');
  const loser=s.players.find(p=>p.id===s.penalty.loser);loser.bullet=6;advance(s,76000);assert.equal(s.phase,'roundEnd');advance(s,82000);assert.equal(s.phase,'playing');
});
test('host-only lobby operations, full rooms and rematch readiness',()=>{
  const s=createRoom('ABC234','k','Jack');const p=joinRoom(s,'l','Friend');
  assert.throws(()=>act(s,p.id,'start',{},1000));assert.throws(()=>act(s,s.host,'start',{},1000));
  act(s,p.id,'ready',{ready:true},1000);act(s,s.host,'start',{},1000);assert.throws(()=>joinRoom(s,'m','Late'));
  s.phase='finished';act(s,s.host,'rematch',{},2000);assert.equal(s.phase,'lobby');assert.equal(s.players.find(x=>x.id===p.id).ready,false);assert.ok(s.players.every(x=>x.hand.length===0&&x.pulls===0));
});
test('many complete games reach exactly one survivor while conserving secrecy',()=>{
  for(let game=0;game<80;game++){
    const s=table(2+game%3);let now=2000,steps=0;
    while(s.phase!=='finished'&&steps++<800){
      if(s.phase==='playing'){const p=current(s);if(s.last&&(mustCall(s)||steps%3===0))act(s,p.id,'call',{},now);else act(s,p.id,'play',{cards:p.hand.slice(0,Math.min(3,p.hand.length)).map(c=>c.id)},now);}
      else if(s.phase==='roulette')act(s,s.penalty.loser,'pull',{},now);
      else advance(s,s.deadline);
      assert.ok(s.players.every(p=>p.pulls<=6));now+=10000;
    }
    assert.equal(s.phase,'finished');assert.equal(s.players.filter(p=>p.alive).length,1);
  }
});
