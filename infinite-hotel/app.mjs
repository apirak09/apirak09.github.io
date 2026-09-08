import {CHAPTERS,affine,destination,occupants,validate,primeAt,decimalRows,missingDigits} from './core.mjs';

const $=id=>document.getElementById(id);
const fmt=n=>BigInt(n).toLocaleString('en-US');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WINDOW=24,MAX_ROOM=1000000;
const state={chapter:0,strategy:'shift',k:40,custom:false,a:1,c:1,stage:0,running:false,start:1,selected:1,completed:new Set(),sound:false,speed:1,seed:2026,digits:0};
let timer=null,audio=null;
const chapter=()=>CHAPTERS[state.chapter];
const config=()=>({chapter:chapter().id,strategy:state.strategy,k:chapter().id==='one'?1:state.k,custom:state.custom,a:state.a,c:state.c});
function stop(){clearTimeout(timer);timer=null;state.running=false;}
function tone(success=true){
  if(!state.sound)return;
  try{
    audio??=new (window.AudioContext||window.webkitAudioContext)();
    audio.resume().catch(()=>{});
    const now=audio.currentTime;
    (success?[440,660]:[220,185]).forEach((f,i)=>{
      const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0,now+i*.09);g.gain.linearRampToValueAtTime(.06,now+i*.09+.015);g.gain.exponentialRampToValueAtTime(.001,now+i*.09+.22);
      o.connect(g);g.connect(audio.destination);o.start(now+i*.09);o.stop(now+i*.09+.24);
    });
  }catch{/* Sound is optional; lack of an audio device never blocks the game. */}
}
function feedback(title,text,kind='info',next=false){
  $('feedback-title').textContent=title;$('feedback-text').textContent=text;
  $('feedback').classList.toggle('error',kind==='error');
  document.querySelector('.feedback-icon').textContent=kind==='error'?'!':kind==='success'?'✓':'i';
  $('next-chapter').hidden=!next||state.chapter===5;
}
function chapterNavigation(){
  $('chapters').innerHTML=CHAPTERS.map((c,i)=>`<button class="chapter ${i===state.chapter?'active':''} ${state.completed.has(i)?'done':''}" data-chapter="${i}" ${i===state.chapter?'aria-current="step"':''}><span class="chapter-number">${state.completed.has(i)?'✓':String(i+1).padStart(2,'0')}</span><span>${c.short}<span class="mark">${c.mark}</span></span></button>`).join('');
  $('completion').textContent=`${state.completed.size} / 6 explored`;
}
function activeRule(){
  const c=config();
  if(c.chapter==='fleet')return c.strategy==='prime'?'n → 2ⁿ':c.strategy==='diagonal'?'n → n(n − 1)/2 + 1':'n → n';
  if(!c.custom&&c.chapter==='one'&&c.strategy==='last')return 'No last room exists';
  if(!c.custom&&c.chapter==='one'&&c.strategy==='local')return 'Only 1 → 2';
  const {a,c:b}=affine(c);return `n → ${a===1n?'':a}n ${b<0n?'−':'+'} ${b<0n?-b:b}`;
}
function referenceFormula(){
  const id=chapter().id,k=state.k;
  if(id==='one')return 'Resident n → n + 1\nNew guest → room 1';
  if(id==='party')return `Resident n → n + ${k}\nNew guest j → j (1 ≤ j ≤ ${k})`;
  if(id==='bus')return 'Resident n → 2n\nBus passenger s → 2s − 1';
  if(id==='buses')return `Resident n → ${k+1}n\nBus b, seat s → ${k+1}(s − 1) + b\n1 ≤ b ≤ ${k}`;
  if(id==='fleet'&&state.strategy==='diagonal')return 'Residents are bus b = 0. Let d = b + s − 1.\nRoom = d(d + 1)/2 + b + 1\nOrder: (0,1), (0,2), (1,1), (0,3), (1,2), (2,1), …';
  if(id==='fleet')return 'Residents: 2ⁿ\nBus 1: 3ˢ; bus 2: 5ˢ; bus 3: 7ˢ; …\npᵦ is the b-th odd prime; n, s ≥ 1.\nRoom 1 and numbers with multiple distinct prime factors stay empty.';
  return 'New digit dᵢ = 2 if listed digit aᵢᵢ = 1; otherwise dᵢ = 1.\nFor every i: new guest ≠ guest in room i.';
}
function syncParameter(){
  const id=chapter().id,show=id==='party'||id==='buses';
  $('parameter').hidden=!show;
  if(show){
    $('parameter-label').textContent=id==='party'?'New guests':'Infinite buses';
    $('count').max=id==='party'?'100':'8';$('count').value=state.k;$('count-value').textContent=state.k;
    $('less').disabled=state.k<=1;$('more').disabled=state.k>=Number($('count').max);
  }
  const arrivals=id==='one'?['1','new guest']:id==='party'?[state.k,'new guests']:id==='bus'?['ℵ₀','passengers']:id==='buses'?[state.k+' × ℵ₀','passengers']:id==='fleet'?['ℵ₀ × ℵ₀','passengers']:['>ℵ₀','guests'];
  $('arrival-count').innerHTML=`${arrivals[0]} <small>${arrivals[1]}</small>`;
  $('formula-detail').textContent=referenceFormula();
}
function selectChapter(index){
  stop();state.chapter=index;state.strategy=chapter().options[0]?.[0]??'';
  state.k=index===3?3:40;state.custom=false;state.a=1;state.c=1;state.stage=0;state.start=1;state.selected=1;state.digits=0;
  $('custom').checked=false;$('sandbox').open=false;$('coefficient').value=1;$('offset').value=1;
  $('hint-text').hidden=true;$('proof').open=false;$('locator').open=false;$('jump').value=1;$('window-error').textContent='';
  $('chapter-number').textContent=`SHIFT ${String(index+1).padStart(2,'0')} / 06`;
  $('title').textContent=chapter().title;$('intro').textContent=chapter().intro;$('identity').textContent=chapter().identity;
  $('options').innerHTML=chapter().options.map(([value,label,formula],i)=>`<label class="option"><input type="radio" name="strategy" value="${value}" ${i===0?'checked':''}><span><strong>${label}</strong><code>${escape(formula)}</code></span></label>`).join('');
  const limit=index===5;
  for(const id of ['strategy-picker','play-controls','hotel-view','timeline','locator'])$(id).hidden=limit;
  $('sandbox').hidden=index>=4;$('limit-controls').hidden=!limit;$('limit-view').hidden=!limit;
  $('sim-title').textContent=limit?'A guest no room can hold':'The room register';
  $('proof-text').textContent=chapter().proof;$('insight').textContent=chapter().insight;
  $('locate-result').textContent='Room numbers are calculated exactly. The visual register can show rooms up to 1,000,000.';
  $('locate-group').value='resident';$('locate-bus').value=1;$('locate-seat').value=index===4?10:100;
  syncParameter();syncLocator();chapterNavigation();render();
}
function shortGuest(g){
  return g.bus===0n?`Guest ${g.seat}`:chapter().id==='one'||chapter().id==='party'?`New ${g.seat}`:`B${g.bus} · S${g.seat}`;
}
function longGuest(g){
  return g.bus===0n?`Resident from room ${fmt(g.seat)}`:chapter().id==='one'||chapter().id==='party'?`New guest ${fmt(g.seat)}`:`Bus ${fmt(g.bus)}, seat ${fmt(g.seat)}`;
}
function roomOccupants(room){return state.stage===0?[{bus:0n,seat:BigInt(room)}]:occupants(config(),BigInt(room),state.stage>=2);}
function renderRooms(){
  const c=config(),html=[];
  for(let r=state.start;r<state.start+WINDOW;r++){
    const list=roomOccupants(r),type=list.length>1?'collision':!list.length?'vacant':list[0].bus===0n?'resident':'arrival';
    const label=list.length>1?'COLLISION':!list.length?'Vacant':shortGuest(list[0]);
    html.push(`<button class="room ${type} ${r>=100000?'distant':''} ${r===state.selected?'selected':''} ${state.stage===2&&type==='arrival'?'just-arrived':''}" data-room="${r}" aria-label="Room ${r}: ${list.length>1?'collision; ':''}${list.map(longGuest).join('; ')||'vacant'}" aria-pressed="${r===state.selected}"><span class="room-number">${r>=100000?r:fmt(r)}</span><span class="room-state" aria-hidden="true">${type==='collision'?'!':type==='vacant'?'○':'•'}</span><span class="occupant">${escape(label)}</span></button>`);
  }
  $('room-grid').innerHTML=html.join('');$('room-grid').classList.toggle('moving',state.stage===1);
  $('room-grid').classList.toggle('wide-numbers',state.start+WINDOW-1>=100000);
  $('window-label').textContent=`${fmt(state.start)}–${fmt(state.start+WINDOW-1)} · …`;
  $('previous').disabled=state.start===1;$('next').disabled=state.start+WINDOW>MAX_ROOM-WINDOW+1;
  $('movement-rule').textContent=activeRule();
  renderDetail();renderMovement(c);
}
function renderDetail(){
  const list=roomOccupants(state.selected),r=state.selected;
  let title=`Room ${fmt(r)} · ${!list.length?'Vacant':list.length>1?'Assignment collision':longGuest(list[0])}`,detail;
  if(state.stage===0)detail='The starting hotel has one resident in every positive integer room. Select a rule to change the assignments.';
  else if(list.length>1){
    const prefix=chapter().id==='fleet'&&state.strategy==='sum'?`${fmt(r)} guests map here. Examples: `:state.custom&&state.a===0?'All residents map here. Examples: ':'';
    detail=prefix+list.map(longGuest).join(' + ')+'. Each room can hold only one guest.';
  }
  else if(!list.length){
    const expected=occupants(config(),BigInt(r),true);
    detail=state.stage===1&&expected.length?'Reserved for '+expected.map(longGuest).join(' and ')+'.':'No guest maps to this room. A successful assignment may leave rooms vacant.';
  }else detail=list[0].bus===0n?`The rule maps original room ${fmt(list[0].seat)} to room ${fmt(r)}. Residents outside this window are included in the same rule.`:`${longGuest(list[0])} has room ${fmt(r)}. Bus and seat numbering continue beyond this window.`;
  $('room-detail').innerHTML=`<strong>${escape(title)}</strong><p>${escape(detail)}</p>`;
}
function renderMovement(c){
  let svg='',description=[];
  for(let i=0;i<6;i++){
    const n=BigInt(i+1),dest=destination(c,0,n),x=56+i*125,label=dest.toString();
    description.push(`Resident ${n}: room ${n} to ${dest}`);
    svg+=`<text x="${x}" y="18" fill="#a6b7b9" font-size="12" font-family="monospace" text-anchor="middle">${n}</text><path d="M ${x} 30 V 82" class="trace-line"/><path d="M ${x-4} 78 L ${x} 83 L ${x+4} 78" fill="none" stroke="#759078"/><circle cx="${x}" cy="${state.stage===0?31:state.stage===1?31:88}" r="5" class="trace-dot"/><rect x="${x-41}" y="99" width="82" height="25" rx="4" fill="#26352c"/><text x="${x}" y="116" fill="${dest>0n?'#dbf786':'#ffaaa0'}" font-size="12" font-family="monospace" text-anchor="middle">${label.length>10?label.slice(0,7)+'…':label}</text>`;
  }
  $('movement-svg').innerHTML=svg;$('movement-description').textContent=description.join('. ');
  document.querySelector('.movement').classList.toggle('is-moving',state.stage===1);
}
function render(){
  $('status-badge').classList.remove('error');
  for(const radio of document.querySelectorAll('input[name="strategy"]'))radio.checked=!state.custom&&radio.value===state.strategy;
  if(state.chapter===5){renderDiagonal();return;}
  renderRooms();
  [...$('timeline').children].forEach((el,i)=>el.classList.toggle('active',i<=state.stage));
  $('run').innerHTML=state.running?'Ⅱ Pause assignment':state.stage===3?'↻ Run again':state.stage>0?'▶ Continue assignment':'▶ Run the assignment';
  $('step').disabled=state.stage===3;
  $('status-badge').textContent=['ALL ROOMS OCCUPIED','RESIDENTS REASSIGNED','NEW GUESTS CHECK IN','ASSIGNMENT COMPLETE'][state.stage];
  if(state.stage===0){feedback('You’re the night manager.','Choose a rule, then run it. Every existing resident must keep a room.');return;}
  if(state.stage===1){feedback('The residents receive their new rooms.','This is a simultaneous reassignment. Empty tiles are available now; a guest moving beyond the window still has a destination.');return;}
  if(state.stage===2){feedback('The arriving guests check in.','Inspect the register. Different groups must never receive the same room.');return;}
  const result=validate(config());
  feedback(result.title,result.detail,result.ok?'success':'error',result.ok);
  $('status-badge').textContent=result.ok?'EVERY GUEST ACCOMMODATED':'RULE NEEDS ANOTHER LOOK';
  $('status-badge').classList.toggle('error',!result.ok);
}
function resetAssignment(){stop();state.stage=0;state.start=1;state.selected=1;$('jump').value=1;$('window-error').textContent='';render();}
function finish(){
  stop();const result=validate(config());
  if(result.ok){state.completed.add(state.chapter);chapterNavigation();}
  else if(result.room&&result.room<=BigInt(MAX_ROOM-WINDOW+1)){
    state.selected=Number(result.room);
    if(state.selected<state.start||state.selected>=state.start+WINDOW)state.start=Math.min(MAX_ROOM-WINDOW+1,Math.floor((state.selected-1)/WINDOW)*WINDOW+1);
  }
  tone(result.ok);render();
}
function advance(){
  if(state.stage>=3)return;
  state.stage++;
  if(state.stage===3){finish();return;}
  render();if(state.running)timer=setTimeout(advance,1250/state.speed);
}
function play(){
  if(state.chapter===5){diagonalPlay();return;}
  if(state.running){stop();render();return;}
  if(state.stage===3)resetAssignment();
  if(state.stage===0&&matchMedia('(max-width: 670px)').matches)document.querySelector('.simulation-panel').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  state.running=true;advance();
}
function changeParameter(value){
  const max=chapter().id==='party'?100:8;state.k=Math.min(max,Math.max(1,Number(value)));
  syncParameter();syncLocator();resetAssignment();
}
function syncLocator(){
  const id=chapter().id,arrival=$('locate-group').value==='arrival';
  $('bus-label').hidden=!arrival||!['fleet','buses'].includes(id);
  $('locate-bus').max=id==='fleet'?500:state.k;
  $('locate-bus').value=Math.min(Number($('locate-bus').value),Number($('locate-bus').max));
  $('seat-label').textContent=arrival?(id==='one'||id==='party'?'New guest number':'Seat number'):'Original room';
}
function locate(e){
  e.preventDefault();const c=config(),arrival=$('locate-group').value==='arrival',text=$('locate-seat').value.trim();
  if(!/^\d{1,18}$/.test(text)||BigInt(text)<1n){$('locate-result').textContent='Enter a positive integer, up to 18 digits.';return;}
  const n=BigInt(text),b=arrival?(['fleet','buses'].includes(c.chapter)?Number($('locate-bus').value):1):0;
  if(!Number.isInteger(b)||b<0||b>500||(arrival&&b<1)||(c.chapter==='buses'&&b>state.k)){$('locate-result').textContent='Choose a bus number within the displayed range.';return;}
  if(arrival&&((c.chapter==='one'&&n>1n)||(c.chapter==='party'&&n>BigInt(state.k)))){$('locate-result').textContent=`There are only ${c.chapter==='one'?1:state.k} new guests in this shift.`;return;}
  try{
    if(!c.custom&&c.chapter==='one'&&c.strategy==='last'&&arrival)throw new Error('There is no last room. Choose a rule with a positive integer destination.');
    const r=destination(c,b,n),result=validate(c);
    $('locate-result').textContent=`${arrival?(c.chapter==='one'||c.chapter==='party'?`New guest ${fmt(n)}`:`Bus ${b}, seat ${fmt(n)}`):`Resident ${fmt(n)}`} → room ${fmt(r)}. ${r<1n?'This is not a valid room.':!result.ok?'This rule fails for the hotel: '+result.detail:'Exact destination under the selected rule.'}`;
  }catch(err){$('locate-result').textContent=err.message;}
}
function renderDiagonal(){
  const rows=decimalRows(state.seed),missing=missingDigits(rows);
  $('decimal-grid').innerHTML=rows.map((row,i)=>`<div class="decimal-row"><span class="decimal-label">R${i+1} · 0.</span>${row.map((d,j)=>`<span class="digit ${i===j?'diagonal':''} ${i===j&&i<state.digits?'flipped':''}" ${i===j?`aria-label="Diagonal digit for room ${i+1}: ${d}"`:''}>${d}</span>`).join('')}<span aria-hidden="true">…</span></div>`).join('');
  $('missing-number').textContent='0.'+missing.map((d,i)=>i<state.digits?d:'?').join('')+'…';
  $('diagonal-run').textContent=state.running?'Pause construction':state.digits===7?'Replay the construction':state.digits>0?'Continue construction':'Find a missing guest';
  $('status-badge').textContent=state.digits===7?'THE LIST IS INCOMPLETE':'A PROPOSED COMPLETE LIST';
  if(state.digits===0){
    $('diagonal-explanation').textContent='Change one diagonal digit in every row.';
    feedback('Can any room list contain every guest?','Press “Find a missing guest” to construct an explicit counterexample to the proposed list.');
  }else if(state.digits<7){
    const i=state.digits-1;
    $('diagonal-explanation').textContent=`Room ${i+1}: its digit ${i+1} is ${rows[i][i]}. Our guest has ${missing[i]} there, so they are different guests.`;
    feedback(`Different from the first ${state.digits} listed guests.`,`Continue this rule for every room i. Changing digit i guarantees a difference from the guest in room i.`);
  }else{
    $('diagonal-explanation').textContent='Different from row 1 at digit 1, row 2 at digit 2, and so on. Continue for every row, forever.';
    feedback('There is a guest missing from every possible list.','This construction works for any proposed enumeration. Adding this one guest does not solve it: the revised list has another missing guest.','success');
  }
}
function diagonalAdvance(){
  state.digits++;
  if(state.digits===7){stop();state.completed.add(5);chapterNavigation();tone();}
  renderDiagonal();if(state.running)timer=setTimeout(diagonalAdvance,700/state.speed);
}
function diagonalPlay(){
  if(state.running){stop();renderDiagonal();return;}
  if(state.digits===7)state.digits=0;
  state.running=true;diagonalAdvance();
}
function moveWindow(start){
  state.start=Math.min(MAX_ROOM-WINDOW+1,Math.max(1,start));state.selected=state.start;$('jump').value=state.start;$('window-error').textContent='';renderRooms();
}
$('chapters').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(b)selectChapter(Number(b.dataset.chapter));});
$('options').addEventListener('change',e=>{if(e.target.name==='strategy'){state.strategy=e.target.value;state.custom=false;$('custom').checked=false;syncParameter();resetAssignment();}});
$('count').addEventListener('input',e=>changeParameter(e.target.value));
$('less').addEventListener('click',()=>changeParameter(state.k-1));$('more').addEventListener('click',()=>changeParameter(state.k+1));
$('custom').addEventListener('change',e=>{state.custom=e.target.checked;resetAssignment();});
for(const [id,key,min,max] of [['coefficient','a',0,12],['offset','c',-10,100]])$(id).addEventListener('change',e=>{
  const number=Number(e.target.value);state[key]=Number.isFinite(number)?Math.min(max,Math.max(min,Math.trunc(number))):key==='a'?1:0;e.target.value=state[key];state.custom=true;$('custom').checked=true;resetAssignment();
});
$('run').addEventListener('click',play);$('reset').addEventListener('click',resetAssignment);
$('step').addEventListener('click',()=>{stop();advance();});
$('hint').addEventListener('click',()=>{$('hint-text').textContent=chapter().hint;$('hint-text').hidden=!$('hint-text').hidden;});
$('speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});
$('next-chapter').addEventListener('click',()=>{selectChapter(state.chapter+1);$('desk').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
$('room-grid').addEventListener('click',e=>{
  const b=e.target.closest('[data-room]');if(!b)return;state.selected=Number(b.dataset.room);
  for(const tile of $('room-grid').children){const yes=Number(tile.dataset.room)===state.selected;tile.classList.toggle('selected',yes);tile.setAttribute('aria-pressed',String(yes));}renderDetail();
});
$('previous').addEventListener('click',()=>moveWindow(state.start-WINDOW));$('next').addEventListener('click',()=>moveWindow(state.start+WINDOW));
$('jump-form').addEventListener('submit',e=>{
  e.preventDefault();const raw=$('jump').value.trim();
  if(!/^\d{1,7}$/.test(raw)||Number(raw)<1||Number(raw)>MAX_ROOM){$('window-error').textContent='Enter a room from 1 to 1,000,000. This is a display limit, not the end of the hotel.';return;}moveWindow(Number(raw));
});
$('locate-form').addEventListener('submit',locate);$('locate-group').addEventListener('change',syncLocator);
$('diagonal-run').addEventListener('click',diagonalPlay);$('shuffle').addEventListener('click',()=>{stop();state.seed++;state.digits=0;renderDiagonal();});
$('sound').addEventListener('click',()=>{state.sound=!state.sound;$('sound').setAttribute('aria-pressed',String(state.sound));$('sound').textContent=state.sound?'Sound on':'Sound off';if(state.sound)tone();});
$('help').addEventListener('click',()=>{stop();render();$('help-dialog').showModal();});
for(const id of ['close-help','begin'])$(id).addEventListener('click',()=>$('help-dialog').close());
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!e.repeat&&!$('help-dialog').open&&!['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY','A'].includes(e.target.tagName)){e.preventDefault();play();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running){stop();render();}});
selectChapter(0);
