export type Rank = "A" | "K" | "Q" | "J";
export type Card = { id: string; rank: Rank };
export type Player = {
  id: string; key: string; name: string; seat: number; ready: boolean;
  alive: boolean; left: boolean; hand: Card[]; bullet: number; pulls: number;
};
export type Event = { id: number; kind: string; text: string };
export type Penalty = {
  caller: string; accused: string; loser: string; truthful: boolean;
  cards: Card[]; dead: boolean | null; pull: number;
};
export type Room = {
  code: string; host: string; phase: "lobby" | "playing" | "roulette" | "roundEnd" | "finished";
  players: Player[]; round: number; rank: Rank; turn: string;
  last: { player: string; cards: Card[] } | null; pile: number;
  penalty: Penalty | null; deadline: number; winner: string | null;
  events: Event[]; eventId: number; processed: string[];
};
export class GameError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export type Random = (max: number) => number;
export const random: Random = (max) => {
  const range = 0x100000000, cap = range - range % max;
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= cap);
  return a[0] % max;
};
export function shuffle<T>(a: T[], rng: Random = random): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rng(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function deck(): Card[] {
  return (["A", "K", "Q", "J"] as Rank[]).flatMap(rank =>
    Array.from({length: rank === "J" ? 2 : 6}, (_, i) => ({ id: `${rank}${i}`, rank })));
}
function event(s: Room, kind: string, text: string) {
  s.events.push({id: ++s.eventId, kind, text}); s.events = s.events.slice(-24);
}
export function createRoom(code: string, key: string, name: string): Room {
  const p: Player = {id: crypto.randomUUID(), key, name, seat: 0, ready: true, alive: true, left: false, hand: [], bullet: 0, pulls: 0};
  return {code, host:p.id, phase:"lobby", players:[p], round:0, rank:"A", turn:"", last:null, pile:0,
    penalty:null, deadline:0, winner:null, events:[], eventId:0, processed:[]};
}
export function joinRoom(s: Room, key: string, name: string) {
  const existing = s.players.find(p => p.key === key);
  if (existing) { if (existing.left) throw new GameError("You left this match. Join again after the host returns to the lobby."); return existing; }
  if (s.phase !== "lobby") throw new GameError("This match has started. Ask your friends to return to the lobby.", 409);
  if (s.players.length >= 4) throw new GameError("This table is full. Classic mode seats four players.", 409);
  if (s.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new GameError("That name is taken at this table. Choose another.");
  const p: Player = {id:crypto.randomUUID(), key, name, seat:s.players.length, ready:false, alive:true, left:false, hand:[], bullet:0, pulls:0};
  s.players.push(p); event(s,"join",`${name} took a seat.`); return p;
}
const living = (s: Room) => s.players.filter(p => p.alive && !p.left);
function next(s: Room, id: string, withCards = false): Player {
  const at = s.players.findIndex(p => p.id === id);
  for (let n=1;n<=s.players.length;n++) {
    const p=s.players[(at+n)%s.players.length];
    if(p.alive && !p.left && (!withCards || p.hand.length)) return p;
  }
  throw new GameError("No player is available.",409);
}
function finish(s: Room): boolean {
  const alive = living(s);
  if(alive.length > 1) return false;
  s.phase="finished"; s.deadline=0; s.turn=""; s.winner=alive[0]?.id ?? null;
  event(s,"win", alive[0] ? `${alive[0].name} is the last one standing.` : "The table is empty.");
  return true;
}
function deal(s: Room, starter: string, now: number, rng: Random) {
  if(finish(s)) return;
  const cards=shuffle(deck(),rng);
  s.rank=(["A","K","Q"] as Rank[])[rng(3)]; s.round++; s.last=null; s.pile=0; s.penalty=null;
  for(const p of s.players) p.hand=p.alive && !p.left ? cards.splice(0,5) : [];
  const first=s.players.find(p=>p.id===starter && p.alive && !p.left) ?? next(s,starter);
  s.phase="playing"; s.turn=first.id; s.deadline=now+30000;
  event(s,"deal",`Round ${s.round}. ${s.rank === "A" ? "Ace" : s.rank === "K" ? "King" : "Queen"}’s table.`);
}
export function mustCall(s: Room): boolean {
  return !!s.last && living(s).filter(p=>p.hand.length>0).length === 1;
}
function play(s: Room, p: Player, ids: unknown, now: number) {
  if(mustCall(s)) throw new GameError("You are the last player with cards. You must call LIAR.");
  if(!Array.isArray(ids) || ids.length<1 || ids.length>3 || new Set(ids).size!==ids.length) throw new GameError("Choose one to three different cards.");
  const cards=ids.map(id=>p.hand.find(c=>c.id===id));
  if(cards.some(c=>!c)) throw new GameError("Those cards are no longer in your hand.",409);
  p.hand=p.hand.filter(c=>!ids.includes(c.id));
  s.last={player:p.id,cards:cards as Card[]}; s.pile+=cards.length;
  s.turn=next(s,p.id,true).id; s.deadline=now+30000;
  event(s,"play",`${p.name} claims ${cards.length} ${s.rank === "A" ? "Ace" : s.rank === "K" ? "King" : "Queen"}${cards.length>1?"s":""}.`);
}
function call(s: Room, p: Player, now: number) {
  if(!s.last || s.last.player===p.id) throw new GameError("There is no previous claim to challenge.");
  const truthful=s.last.cards.every(c=>c.rank===s.rank || c.rank==="J");
  const loser=s.players.find(x=>x.id===(truthful?p.id:s.last!.player))!;
  s.penalty={caller:p.id,accused:s.last.player,loser:loser.id,truthful,cards:s.last.cards,dead:null,pull:loser.pulls+1};
  s.phase="roulette"; s.deadline=now+14000;
  event(s,"call",`${p.name} calls LIAR. ${truthful?"The claim was true.":"It was a bluff."} ${loser.name} faces roulette.`);
}
function pull(s: Room, now: number) {
  const penalty=s.penalty!; const p=s.players.find(p=>p.id===penalty.loser)!;
  p.pulls++; penalty.dead=p.pulls===p.bullet;
  if(penalty.dead) {p.alive=false;p.hand=[];}
  event(s,penalty.dead?"out":"click",penalty.dead?`${p.name} is eliminated.`:`Click. ${p.name} survives pull ${p.pulls}.`);
  if(!finish(s)) {s.phase="roundEnd";s.deadline=now+6000;}
}
export function advance(s: Room, now: number, rng: Random = random): boolean {
  if(!s.deadline || now<s.deadline) return false;
  if(s.phase==="playing") {
    const p=s.players.find(p=>p.id===s.turn)!;
    event(s,"timeout",`${p.name} ran out of time.`);
    if(mustCall(s)) call(s,p,now); else play(s,p,[p.hand[rng(p.hand.length)].id],now);
  } else if(s.phase==="roulette") pull(s,now);
  else if(s.phase==="roundEnd") deal(s,s.penalty!.loser,now,rng);
  else return false;
  return true;
}
export function act(s: Room, playerId: string, action: string, data: Record<string,unknown>, now: number, rng: Random = random) {
  const p=s.players.find(p=>p.id===playerId && !p.left);
  if(!p) throw new GameError("Your seat is no longer available.",403);
  if(action==="ready") {
    if(s.phase!=="lobby") throw new GameError("The match has already started.",409);
    p.ready=!!data.ready; return;
  }
  if(action==="start") {
    if(p.id!==s.host || s.phase!=="lobby") throw new GameError("Only the host can start from the lobby.",403);
    if(s.players.length<2 || s.players.some(p=>!p.ready)) throw new GameError("At least two players must be ready.");
    shuffle(s.players,rng); s.players.forEach((p,i)=>{p.seat=i;p.bullet=rng(6)+1;p.pulls=0;p.alive=true;});
    deal(s,s.players[rng(s.players.length)].id,now,rng); return;
  }
  if(action==="rematch") {
    if(p.id!==s.host || s.phase!=="finished") throw new GameError("The host can reopen the table after the match.",403);
    s.players=s.players.filter(p=>!p.left); s.players.forEach((p,i)=>{p.hand=[];p.ready=p.id===s.host;p.alive=true;p.bullet=0;p.pulls=0;p.seat=i;});
    s.phase="lobby";s.round=0;s.last=null;s.penalty=null;s.winner=null;s.events=[];s.turn="";s.pile=0;return;
  }
  if(action==="kick") {
    if(p.id!==s.host || s.phase!=="lobby" || data.player===p.id) throw new GameError("Only the host can remove a guest in the lobby.",403);
    s.players=s.players.filter(x=>x.id!==data.player); s.players.forEach((x,i)=>x.seat=i); return;
  }
  if(action==="leave") {
    if(s.phase==="lobby") {s.players=s.players.filter(x=>x.id!==p.id);s.players.forEach((x,i)=>x.seat=i);}
    else {p.left=true;p.alive=false;p.hand=[];event(s,"leave",`${p.name} left the match.`);}
    if(s.host===p.id) s.host=s.players.find(x=>!x.left)?.id ?? "";
    if(s.phase!=="lobby" && s.phase!=="finished" && !finish(s)) {
      deal(s,next(s,p.id).id,now,rng);
    }
    return;
  }
  if(action==="pull") {
    if(s.phase!=="roulette" || s.penalty?.loser!==p.id) throw new GameError("It is not your roulette turn.",409);
    pull(s,now); return;
  }
  if(s.phase!=="playing" || s.turn!==p.id || !p.alive) throw new GameError("Wait for your turn.",409);
  if(action==="play") play(s,p,data.cards,now);
  else if(action==="call") call(s,p,now);
  else throw new GameError("Unknown action.");
}
export function publicView(s: Room, playerId: string, version: number, online: Set<string>, now: number) {
  // Explicit projection: no whole player objects, bullet positions, or uncalled cards.
  return {
    code:s.code,host:s.host,phase:s.phase,round:s.round,rank:s.rank,turn:s.turn,pile:s.pile,
    players:s.players.map(p=>({id:p.id,name:p.name,seat:p.seat,ready:p.ready,alive:p.alive,left:p.left,
      count:p.hand.length,pulls:p.pulls,online:online.has(p.id)})),
    me:playerId,hand:s.players.find(p=>p.id===playerId)?.hand ?? [],
    last:s.last?{player:s.last.player,count:s.last.cards.length}:null,
    penalty:s.penalty,deadline:s.deadline,winner:s.winner,events:s.events,version,serverTime:now,mustCall:mustCall(s),
  };
}
export type View = ReturnType<typeof publicView>;
