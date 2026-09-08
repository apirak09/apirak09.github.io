"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, CircleHelp, Copy, Crown, Eye, EyeOff, Flame, Link as LinkIcon, LoaderCircle, LogOut, Shield, Skull, Sparkles, Spade, Users, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { sound, unlockAudio } from "@/lib/audio";
import type { Card, Rank, View } from "@/lib/game";

const rankName:Record<Rank,string>={A:"Ace",K:"King",Q:"Queen",J:"Joker"};
type Session={code:string;token:string};
function secret(){return crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");}
function remember(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
function recall(key:string){try{return localStorage.getItem(key);}catch{return null;}}
function forget(key:string){try{localStorage.removeItem(key);}catch{}}
function RankIcon({rank}:{rank:Rank}){return rank==="A"?<Spade/>:rank==="J"?<Sparkles/>:<Crown/>;}

function PlayingCard({card,selected=false,hidden=false,disabled=false,onClick,small=false,truth=false}:{card:Card;selected?:boolean;hidden?:boolean;disabled?:boolean;onClick?:()=>void;small?:boolean;truth?:boolean}){
  const body=hidden?<span className="card-back-mark">LT</span>:<><span className="card-corner">{card.rank==="J"?"★":card.rank}</span><span className="card-symbol"><RankIcon rank={card.rank}/></span><span className="card-name">{rankName[card.rank]}</span><span className="card-corner bottom">{card.rank==="J"?"★":card.rank}</span>{selected&&<span className="card-check"><Check size={15}/></span>}</>;
  const cls=`playing-card ${small?"small":""} ${selected?"selected":""} ${hidden?"back":""} ${card.rank==="Q"?"red":""} ${card.rank==="J"?"joker":""} ${truth?"truth-card":""}`;
  return onClick?<button type="button" className={cls} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={hidden?"Hidden card":`${rankName[card.rank]}${truth?", matches this table":""}${selected?", selected":""}`}>{body}</button>:<div className={cls} aria-label={hidden?"Face-down card":rankName[card.rank]}>{body}</div>;
}
function Chambers({pulls,dead=false}:{pulls:number;dead?:boolean}){
  return <div className="chambers" aria-label={`${pulls} of 6 pulls used${dead?", eliminated":""}`}>{Array.from({length:6},(_,i)=><span key={i} className={i<pulls?(dead&&i===pulls-1?"fatal":"spent"):""}/>)}</div>;
}
function Rules(){return <Dialog><DialogTrigger asChild><button className="quiet-button"><CircleHelp size={18}/><span>How to play</span></button></DialogTrigger><DialogContent className="rules-dialog"><DialogHeader><p className="eyebrow">CLASSIC LIAR’S DECK</p><DialogTitle className="serif-title">A good hand. Or a good lie.</DialogTitle><DialogDescription>Two to four friends. One survivor.</DialogDescription></DialogHeader><ol className="rules-list"><li><b>Know the table.</b> Each round is Aces, Kings, or Queens. Each player gets 5 cards from a deck of 6 Aces, 6 Kings, 6 Queens, and 2 Jokers.</li><li><b>Play your claim.</b> On your turn, place 1–3 cards face down, claiming they match the table. Jokers always count. You can bluff.</li><li><b>Call LIAR.</b> Instead of playing, challenge the previous turn’s cards. Any wrong rank catches the liar; an entirely true claim punishes the caller.</li><li><b>Face roulette.</b> The loser pulls once. One bullet occupies a hidden position among six chambers. Surviving advances the chamber; it never resets during a match.</li><li><b>Stay at the table.</b> Empty hands skip turns. The last player still holding cards must challenge. After roulette, survivors get fresh hands. The last survivor wins.</li></ol><details className="connection-rules"><summary>Turns, reconnecting & keyboard controls</summary><p>Turns proceed counterclockwise. You have 30 seconds. For an inactive browser, this edition plays one random card at timeout, or challenges when required. Roulette resolves after 14 seconds if the player does not pull.</p><p>Refresh to restore your seat. A disconnected host transfers after 90 seconds. Leaving during a match forfeits your seat and redeals for the survivors. Rooms expire after six hours without play.</p><p><b>1–5</b> select cards · <b>Enter</b> play · <b>L</b> call liar · <b>H</b> hide hand · <b>M</b> mute</p></details><a className="source-link" href="https://www.debigare.com/how-to-play-liars-deck-from-liars-bar-full-rules-and-variants/" target="_blank" rel="noreferrer">Classic rules reference ↗</a></DialogContent></Dialog>;}

export default function LiarTable(){
  const [session,setSession]=useState<Session|null>(null),[view,setView]=useState<View|null>(null);
  const [name,setName]=useState(""),[code,setCode]=useState(""),[selected,setSelected]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[connected,setConnected]=useState(true);
  const [seatLost,setSeatLost]=useState(false);
  const [hidden,setHidden]=useState(false),[muted,setMuted]=useState(false),[now,setNow]=useState(Date.now()),[restoring,setRestoring]=useState(true);
  const latest=useRef<View|null>(null),working=useRef(false),credential=useRef(""),offset=useRef(0),lastSound=useRef(0),muteRef=useRef(false),active=useRef<Session|null>(null);
  const me=view?.players.find(p=>p.id===view.me),turn=view?.players.find(p=>p.id===view.turn);
  const myTurn=!!view&&view.phase==="playing"&&view.turn===view.me;
  const seconds=view?.deadline?Math.max(0,Math.ceil((view.deadline-now)/1000)):0;

  const accept=useCallback((v:View)=>{
    if(latest.current?.code===v.code&&v.version<latest.current.version)return;
    const before=latest.current;
    if(!before||before.round!==v.round||before.phase!==v.phase||before.hand.map(c=>c.id).join()!==v.hand.map(c=>c.id).join())setSelected([]);
    offset.current=v.serverTime-Date.now();latest.current=v;setView(v);setConnected(true);setError("");
    const event=v.events.at(-1);
    if(event && event.id>lastSound.current){if(before&&!muteRef.current)sound(event.kind);lastSound.current=event.id;}
  },[]);

  useEffect(()=>{
    setName(recall("liar:name")??"");const m=recall("liar:mute")==="true";setMuted(m);muteRef.current=m;
    const incoming=new URLSearchParams(location.search).get("room")?.toUpperCase()??"";setCode(incoming);
    try{
      const raw=recall(incoming?`liar:seat:${incoming}`:"liar:current");
      if(raw){const saved=JSON.parse(raw) as Session;if(/^[A-Z2-9]{6}$/.test(saved.code)&&/^[a-f0-9]{64}$/.test(saved.token)){active.current=saved;setSession(saved);}}
    }catch{}
    setRestoring(false);
    const tick=setInterval(()=>setNow(Date.now()+offset.current),250);
    const unlock=()=>unlockAudio();window.addEventListener("pointerdown",unlock,{once:true});
    return()=>{clearInterval(tick);window.removeEventListener("pointerdown",unlock);};
  },[]);

  async function fetchGame(s:Session,body?:Record<string,unknown>){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{
      const res=await fetch(`/api/game${body?"":`?code=${encodeURIComponent(s.code)}`}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${s.token}`,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:controller.signal});
      const data=await res.json();
      if(!res.ok){const e=new Error(data.error??"Could not reach the table.") as Error&{status:number};e.status=res.status;throw e;}
      return data.view as View;
    }finally{clearTimeout(timer);}
  }
  useEffect(()=>{
    if(!session)return;
    let cancelled=false,timer:ReturnType<typeof setTimeout>,failures=0;
    async function poll(){
      if(cancelled)return;
      if(!working.current){
        try{const v=await fetchGame(session!);if(!cancelled){accept(v);failures=0;}}
        catch(e){if(!cancelled){setConnected(false);failures++;const err=e as Error&{status?:number};
          if([401,403,404].includes(err.status??0)){setSeatLost(true);setError(err.message);return;}
          setError("Connection interrupted. Reconnecting to your seat…");}}
      }
      if(!cancelled)timer=setTimeout(poll,failures?Math.min(8000,1500*failures):document.hidden?3500:1000);
    }
    const reconnect=()=>{clearTimeout(timer);if(!cancelled)timer=setTimeout(poll,100);};
    void poll();window.addEventListener("online",reconnect);
    return()=>{cancelled=true;clearTimeout(timer);window.removeEventListener("online",reconnect);};
  },[session,accept]);

  const toggleMute=useCallback(()=>{setMuted(old=>{muteRef.current=!old;remember("liar:mute",String(!old));if(old)unlockAudio();return !old;});},[]);
  function clearSession(){
    if(active.current)forget(`liar:seat:${active.current.code}`);forget("liar:current");setSession(null);active.current=null;latest.current=null;setView(null);setSelected([]);setError("");setConnected(true);setSeatLost(false);credential.current="";lastSound.current=0;
    history.replaceState(null,"",location.pathname);setCode("");
  }
  async function enter(action:"create"|"join"){
    if(working.current)return;if(!name.trim()){setError("Enter your name to take a seat.");return;}
    if(action==="join"&&!/^[A-Z2-9]{6}$/.test(code)){setError("Enter your friend’s six-character room code.");return;}
    working.current=true;setBusy(true);setError("");unlockAudio();
    credential.current||=secret();const s={code,token:credential.current};
    try{const v=await fetchGame(s,{action,name:name.trim(),code});const saved={...s,code:v.code};
      remember("liar:name",name.trim());remember("liar:current",JSON.stringify(saved));remember(`liar:seat:${v.code}`,JSON.stringify(saved));
      history.replaceState(null,"",`${location.pathname}?room=${v.code}`);active.current=saved;setSession(saved);accept(v);
    }catch(e){setError(e instanceof Error&&e.name!=="AbortError"?e.message:"The table did not respond. Please try again.");}
    finally{working.current=false;setBusy(false);}
  }
  const action=useCallback(async(kind:string,extra:Record<string,unknown>={})=>{
    const s=active.current,v=latest.current;if(!s||!v||working.current)return;
    working.current=true;setBusy(true);setError("");unlockAudio();
    try{const result=await fetchGame(s,{action:kind,code:s.code,version:v.version,requestId:crypto.randomUUID(),...extra});
      if(kind==="leave")clearSession();else accept(result);
    }catch(e){setError(e instanceof Error&&e.name!=="AbortError"?e.message:"Your move could not be confirmed. The table will refresh before you try again.");
      try{accept(await fetchGame(s));}catch{setConnected(false);}
    }finally{working.current=false;setBusy(false);}
  // Session data is read through refs to keep keyboard and polling handlers current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[accept]);
  function select(id:string){if(!myTurn||view?.mustCall||hidden||busy)return;setSelected(old=>old.includes(id)?old.filter(x=>x!==id):old.length<3?[...old,id]:old);if(!muted)sound("tap");}
  useEffect(()=>{
    function key(e:KeyboardEvent){if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)||document.querySelector('[role="dialog"], [role="alertdialog"]'))return;
      if(e.key==="m"||e.key==="M"){toggleMute();return;}
      if(e.key==="h"||e.key==="H"){setHidden(h=>!h);return;}
      if(!myTurn||busy||!view||!connected)return;
      if(/^[1-5]$/.test(e.key)){e.preventDefault();const c=view.hand[Number(e.key)-1];if(c)select(c.id);}
      if(e.key==="Enter"&&selected.length&&!view.mustCall){e.preventDefault();void action("play",{cards:selected});}
      if((e.key==="l"||e.key==="L")&&view.last){e.preventDefault();void action("call");}
    }
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  });
  async function invite(copyCode=false){
    if(!view)return;const link=`${location.origin}${location.pathname}?room=${view.code}`;
    try{if(!copyCode&&navigator.share){await navigator.share({title:"Join my Liar Table",text:`Take a seat. Room ${view.code}`,url:link});return;}
      await navigator.clipboard.writeText(copyCode?view.code:link);toast.success(copyCode?"Room code copied":"Invite link copied");
    }catch(e){if((e as Error).name!=="AbortError")toast.info(`Room ${view.code} — share the address from your browser.`);}
  }

  const canAct=connected&&!busy;
  return <div className="game-shell"><Toaster theme="dark" position="top-center"/>
    <header className="topbar"><a className="brand" href="/" aria-label="Liar Table home" onClick={e=>{if(session)e.preventDefault();}}><Spade className="brand-icon"/><span>LIAR<span className="brand-light">TABLE</span></span></a><div className="top-actions"><Rules/><button className="icon-button" onClick={toggleMute} aria-label={muted?"Enable sound":"Mute sound"} aria-pressed={muted}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>{session&&<AlertDialog><AlertDialogTrigger asChild><button className="icon-button" aria-label="Leave table"><LogOut size={19}/></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Leave this table?</AlertDialogTitle><AlertDialogDescription>{view&&!["lobby","finished"].includes(view.phase)?"Leaving forfeits your seat in this match. Refreshing the page instead keeps your seat.":"You can join again with the room code while the table is in the lobby."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Stay</AlertDialogCancel><AlertDialogAction onClick={()=>void action("leave")}>Leave table</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></header>

    {error&&<div role="alert" className="error-banner"><WifiOff size={18}/><span>{error}</span>{session&&<button onClick={()=>{if(!view||seatLost)clearSession();else setSession(s=>s?{...s}:null);}}>{view&&!seatLost?"Reconnect":"Back to lobby"}</button>}</div>}

    {!session?<main className="entry"><section className="entry-title"><span className="eyebrow"><span className="tiny-diamond">◆</span> A PRIVATE TABLE FOR YOUR FRIENDS</span><h1>Keep your cards close.<br/><em>Your lies closer.</em></h1><p>Classic bluffing cards. Two to four players.<br/>One last seat standing.</p><div className="entry-cards" aria-hidden="true">{(["Q","A","K"] as Rank[]).map((rank,i)=><PlayingCard key={rank} card={{id:String(i),rank}}/>)}</div></section><section className="join-panel" aria-label="Create or join a table"><div className="join-heading"><p className="eyebrow">THE TABLE IS OPEN</p><h2>Take a seat.</h2></div><label className="field-label" htmlFor="player-name">Your name</label><input id="player-name" autoComplete="nickname" maxLength={20} placeholder="What should we call you?" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void enter(code?"join":"create");}} disabled={busy||restoring}/><button className="primary-button create-button" onClick={()=>void enter("create")} disabled={busy||restoring}>{busy?<LoaderCircle className="spin" size={19}/>:<Users size={19}/>}Create a table<ArrowRight size={18}/></button><div className="divider"><span>OR JOIN YOUR FRIENDS</span></div><label className="field-label" htmlFor="room-code">Room code</label><form className="join-row" onSubmit={e=>{e.preventDefault();void enter("join");}}><input id="room-code" className="code-input" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} placeholder="ABC123" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,""))} disabled={busy||restoring}/><button className="secondary-button" disabled={busy||restoring||code.length!==6}>Join<ArrowRight size={17}/></button></form><p className="join-note"><Shield size={15}/> Only people with your code can join.</p></section><footer className="entry-footer"><span>CLASSIC RULES</span><span>PRIVATE ROOMS</span><span>PLAY ON ANY SCREEN</span></footer></main>
    :!view?<main className="loading-state"><LoaderCircle className="spin" size={32}/><h1>Returning to your seat…</h1><p>Your hand stays at the table.</p></main>
    :<main className="match"><div className="room-strip"><div className="room-label"><span className="eyebrow">YOUR PRIVATE TABLE</span><button onClick={()=>void invite(true)} className="room-code" aria-label={`Copy room code ${view.code}`}>{view.code}<Copy size={15}/></button></div><div className="room-tools"><span className={`connection ${connected?"":"offline"}`}>{connected?<Wifi size={15}/>:<WifiOff size={15}/>}<span>{connected?"Connected":"Reconnecting"}</span></span><button className="secondary-button invite-button" onClick={()=>void invite()}><LinkIcon size={16}/><span>Invite friends</span></button></div></div>
      <div className="match-layout"><section className="table-column"><div className="table-meta"><span>CLASSIC MODE <span className="separator">/</span> {view.phase==="lobby"?`${view.players.length} OF 4 SEATS`:`ROUND ${String(view.round).padStart(2,"0")}`}</span><span>{view.phase==="lobby"?"2 players to start":`${view.players.filter(p=>p.alive&&!p.left).length} still standing`}</span></div>
        <div className={`table-scene phase-${view.phase}`}>
          <div className="felt"><div className="felt-inner"/><div className="table-center">
            {view.phase==="lobby"?<div className="lobby-center"><Spade size={30}/><span className="table-wordmark">LIAR TABLE</span><span className="center-caption">A little trust. A lot of bluff.</span><span className="table-rule">◆</span><span className="center-caption">Waiting for everyone to get ready</span></div>:
            view.phase==="playing"?<><span className="eyebrow">YOU’RE AT THE</span><h2 className="table-rank">{rankName[view.rank]}’s table</h2><div className="rank-emblem"><RankIcon rank={view.rank}/></div>{view.last?<div className="last-claim" key={`${view.round}-${view.pile}`}><div className="pile-cards">{Array.from({length:view.last.count},(_,i)=><PlayingCard key={i} small hidden card={{id:String(i),rank:"A"}}/>)}</div><p><b>{view.players.find(p=>p.id===view.last!.player)?.name}</b> claims {view.last.count} {rankName[view.rank]}{view.last.count>1?"s":""}</p><span className="center-caption">{view.pile} cards played this round</span></div>:<p className="first-claim">{turn?.name} makes the first claim.</p>}</>:
            view.phase==="finished"?<div className="winner-center"><Crown size={40}/><span className="eyebrow">LAST ONE STANDING</span><h2>{view.players.find(p=>p.id===view.winner)?.name??"No survivor"}</h2><p>{view.winner===view.me?"That was a convincing performance.":"The table has its winner."}</p></div>:
            <div className="verdict-center"><span className={`eyebrow ${view.penalty?.truthful?"gold":"red-text"}`}>{view.penalty?.truthful?"THE CLAIM WAS TRUE":"BLUFF CAUGHT"}</span><h2>{view.phase==="roundEnd"?(view.penalty?.dead?"Seat eliminated.":"Click. Still alive."):`${view.players.find(p=>p.id===view.penalty?.loser)?.name} faces roulette.`}</h2><div className="reveal-cards">{view.penalty?.cards.map(c=><PlayingCard key={c.id} card={c} small truth={c.rank===view.rank||c.rank==="J"}/>)}</div><p>{view.phase==="roundEnd"?`Fresh hands in ${seconds}s`:`Pull ${view.penalty?.pull} of 6`}</p></div>}
          </div></div>
          {Array.from({length:4},(_,slot)=>{
            const myIndex=view.players.findIndex(p=>p.id===view.me);
            const positions=view.players.length===1?[0]:view.players.length===2?[0,2]:view.players.length===3?[0,1,3]:[0,1,2,3];
            const relative=positions.indexOf(slot);const p=relative>=0?view.players[(myIndex+relative)%view.players.length]:null;
            return <div key={slot} className={`seat seat-${slot} ${p?.id===view.turn&&view.phase==="playing"?"active-seat":""} ${p&&!p.alive?"eliminated-seat":""} ${!p?"empty-seat":""}`}>
              {p?<><div className={`avatar avatar-${p.seat}`}>{!p.alive?<Skull size={22}/>:p.name.slice(0,2).toUpperCase()}{p.id===view.host&&<Crown className="host-crown" size={13}/>}</div><div className="seat-details"><span className="seat-name">{p.name}{p.id===view.me&&<span className="you-label">YOU</span>}</span>{view.phase==="lobby"?<span className={`seat-status ${p.ready?"ready":""}`}>{!p.online?"Reconnecting…":p.ready?<><Check size={12}/>Ready</>:"Getting ready"}</span>:<><span className="seat-status">{p.left?"Left the table":!p.alive?"Eliminated":!p.online?"Reconnecting…":p.count===0?"Hand empty":`${p.count} card${p.count===1?"":"s"}`}</span><Chambers pulls={p.pulls} dead={!p.alive&&!p.left}/></>}</div>{view.phase==="lobby"&&view.host===view.me&&p.id!==view.me&&<button className="remove-seat" aria-label={`Remove ${p.name}`} onClick={()=>void action("kick",{player:p.id})} disabled={!canAct}><X size={14}/></button>}</>:<><div className="empty-avatar"><Users size={20}/></div><span>Open seat</span></>}
            </div>;
          })}
        </div>
        <div className={`turn-banner ${myTurn?"your-turn":""}`} role="status"><span>{view.phase==="lobby"?<><Users size={18}/> {view.players.length<2?"Invite a friend to start playing.":view.players.every(p=>p.ready)?"Everyone’s ready. Let the bluffing begin.":"Waiting for everyone to ready up."}</>:view.phase==="playing"?<><span className="turn-indicator"/>{myTurn?(view.mustCall?"Last hand at the table. You must call LIAR.":"Your move. Play your cards or call their bluff."):`${turn?.name} is thinking…`}</>:view.phase==="roulette"?<><Flame size={18}/>{view.penalty?.loser===view.me?"Your turn to pull. Hold your nerve.":"The next chamber decides."}</>:view.phase==="roundEnd"?"A new round is about to begin.":view.winner===view.me?"You survived the table.":"A new table. A fresh chance."}</span>{view.deadline>0&&<span className={`timer ${seconds<=8?"urgent":""}`} aria-label={`${seconds} seconds remaining`}>{String(seconds).padStart(2,"0")}<small>s</small></span>}</div>
        {view.phase==="lobby"?<div className="lobby-actions">{view.host===view.me?<button className="primary-button" disabled={!canAct||view.players.length<2||!view.players.every(p=>p.ready&&p.online)} onClick={()=>void action("start")}><Spade size={19}/>{busy?"Dealing…":"Deal the cards"}<ArrowRight size={18}/></button>:<button className={`primary-button ${me?.ready?"ready-button":""}`} disabled={!canAct} onClick={()=>void action("ready",{ready:!me?.ready})}>{me?.ready?<Check size={19}/>:<Spade size={19}/>} {me?.ready?"Ready — click to unready":"I’m ready"}</button>}<p>Everyone sees their own cards on their own screen.</p></div>:
        view.phase==="finished"?<div className="lobby-actions">{view.host===view.me?<button className="primary-button" disabled={!canAct} onClick={()=>void action("rematch")}><Spade size={19}/>Play again<ArrowRight size={18}/></button>:<p>Waiting for the host to reopen the table.</p>}</div>:
        <section className="hand-area" aria-label="Your private hand"><div className="hand-heading"><div><span className="eyebrow">YOUR HAND</span><span className="hand-hint">{!me?.alive?"You’re spectating":view.hand.length===0?"No cards left. Watch the table.":hidden?"Hidden from view":"Select 1–3 cards"}</span></div><button className="quiet-button" onClick={()=>setHidden(h=>!h)} aria-pressed={hidden}>{hidden?<EyeOff size={16}/>:<Eye size={16}/>}<span>{hidden?"Show":"Hide"}</span></button></div><div className="hand-cards">{view.hand.map(c=><PlayingCard key={c.id} card={c} selected={selected.includes(c.id)} hidden={hidden} disabled={!myTurn||!canAct||view.mustCall||hidden} onClick={()=>select(c.id)} truth={c.rank===view.rank||c.rank==="J"}/>)}{!view.hand.length&&<p className="empty-hand"><Eye size={23}/>{me?.alive?"Your hand is empty. You may still be challenged.":"Stay to see who survives."}</p>}</div>
          {view.phase==="roulette"?<div className="roulette-actions"><div><span className="eyebrow">{view.penalty?.loser===view.me?"YOUR CHAMBER":"ROULETTE"}</span><b>{view.penalty?.loser===view.me?`1 in ${7-(view.penalty?.pull??1)} chance`:`Waiting for ${view.players.find(p=>p.id===view.penalty?.loser)?.name}`}</b></div><button className="danger-button" disabled={!canAct||view.penalty?.loser!==view.me} onClick={()=>void action("pull")}><Flame size={19}/>Pull the trigger</button></div>:
          <div className="play-actions"><button className="primary-button" onClick={()=>void action("play",{cards:selected})} disabled={!myTurn||!canAct||!selected.length||view.mustCall}><Spade size={18}/>{selected.length?`Play ${selected.length} as ${rankName[view.rank]}${selected.length>1?"s":""}`:"Choose your cards"}<ArrowRight size={18}/></button><button className="danger-button" onClick={()=>void action("call")} disabled={!myTurn||!canAct||!view.last}><Flame size={18}/>Call LIAR</button></div>}
          <p className="hand-footnote">{view.phase==="playing"&&myTurn?"Jokers match every table. All other ranks can be bluffs.":"Your cards are visible only to you."}</p></section>}
      </section><aside className="table-sidebar"><section className="table-note"><div className="eyebrow"><Shield size={15}/> THE HOUSE RULES</div><h3>Make them<br/><em>believe you.</em></h3><p>Play 1–3 cards as the table’s rank. Tell the truth, or sell the lie.</p><div className="mini-rule"><Sparkles size={18}/><span>Jokers always count.</span></div><div className="mini-rule"><Flame size={18}/><span>A wrong call puts you at risk.</span></div><div className="mini-rule"><Crown size={18}/><span>Last survivor wins.</span></div></section><section className="activity"><div className="activity-title"><h3>At the table</h3><span>LIVE</span></div>{view.events.length?<ol>{view.events.slice(-8).reverse().map(e=><li key={e.id} className={`event-${e.kind}`}><span className="event-mark">{e.kind==="call"?"!":e.kind==="win"?"♛":"·"}</span><span>{e.text}</span></li>)}</ol>:<p className="muted">The stories start with the first hand.</p>}</section><p className="table-footer">6 chambers. 1 bullet.<br/>The odds remember.</p></aside></div>
    </main>}
  </div>;
}
