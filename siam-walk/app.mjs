import {stops,legs,meta} from './trip-data.mjs?v=2';
import {countdown,buildSchedule,clock,distanceLabel} from './core.mjs';
import {basemap} from './basemap.mjs';

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const schedule=buildSchedule(stops,legs);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const compact=()=>matchMedia('(max-width:600px)').matches;
const walk='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="4" r="2"/><path d="m8 12 3-5 4 2 2 4h3M11 8l-1 7-4 6m4-6 5 2 1 5M9 9l-4 3"/></svg>';
const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const external='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></svg>';
const bowl='<svg viewBox="0 0 64 64" fill="none" stroke="#5b4935" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 30h46c-2 15-9 22-23 22S11 45 9 30Z" fill="#bc6e4f"/><path d="M9 30h46M26 52v4h12v-4"/><ellipse cx="32" cy="29" rx="23" ry="5" fill="#f6e7bb"/><path d="M24 9q-6 6 0 11m9-14q-6 7 0 13m9-9q-5 5 0 10" stroke="#9e824e"/><path d="m43 25 11-19m-5 20L61 8"/></svg>';
const panel=$('#panel');
let map,bounds,selection=null,layoutFrame;
const pins=new Map(),routes=[];

function updateCountdown(){const c=countdown();for(const k of ['days','hours','minutes','seconds'])$(`#cd-${k}`).textContent=String(c[k]).padStart(2,'0');$('#countdown-label').textContent=c.ended?'จบทริปแล้ว':c.met?'ถึงเวลานัดแล้ว':'เจอกันในอีก';}
function header(title){return `<div class="sheet-header">${title?`<h2>${esc(title)}</h2>`:`<button type="button" class="back-button" data-schedule>${arrow} ตารางเที่ยว</button>`}<button type="button" class="close-button" data-close aria-label="ปิดรายละเอียด">×</button></div>`;}
function openPanel(html){panel.innerHTML=html;panel.scrollTop=0;if(!panel.open)panel.showModal();}
function placeLink(s){return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapQuery)}`;}
function walkLink(i){return `https://www.google.com/maps/dir/?api=1&origin=${stops[i].coordinates.join(',')}&destination=${stops[i+1].coordinates.join(',')}&travelmode=walking`;}
function updateSelection(){for(const [i,p] of pins){const active=selection?.kind==='stop'&&(selection.i===i||(i===0&&selection.i===7));const b=p.marker.getElement()?.querySelector('button');b?.classList.toggle('active',active);b?.setAttribute('aria-pressed',String(active));}
 routes.forEach((r,i)=>r.visual.setStyle({weight:selection?.kind==='leg'&&selection.i===i?6:4,opacity:selection?.kind==='leg'?(selection.i===i?1:.35):.9}));
 document.querySelectorAll('.route-stop').forEach(b=>b.classList.toggle('selected',selection?.kind==='stop'&&Number(b.dataset.stop)===selection.i));}
function showSchedule(){selection=null;updateSelection();openPanel(`${header('ตารางเที่ยว')}<ol class="schedule-list">${schedule.map((s,i)=>`<li><button type="button" class="stop-row" data-stop="${i}"><span class="stop-num">${i+1}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.subtitle)}</small></span><time class="stop-time">${clock(s.arrival)}</time></button>${i<legs.length?`<div class="walk-row"><button type="button" data-leg="${i}">${walk} เดิน ${legs[i].minutes} นาที · ${distanceLabel(legs[i].distance)} →</button></div>`:''}</li>`).join('')}<li><p class="itinerary-note">ข้าวเช้ายังไม่เลือกร้าน<br>เวลาเดินรวมเผื่อทางข้ามถนนและขึ้นลงชั้นแล้ว</p></li></ol>`);history.replaceState(null,'',location.pathname+location.search);}
function showStop(i){const s=schedule[i];if(!s)return;selection={kind:'stop',i};updateSelection();const initial=i===0;
 openPanel(`${header()}<figure class="detail-photo"><img src="./assets/${s.image}.webp" alt="${esc(s.photoNote||`${s.name} · ${s.subtitle}`)}" width="1200" height="800"></figure><div class="detail-content">
 ${i===0||i===7?`<div class="overlap-options"><button type="button" data-stop="0" class="${i===0?'active':''}">08:35 นัดเจอ</button><button type="button" data-stop="7" class="${i===7?'active':''}">17:30 ขากลับ</button></div>`:''}
 <h2>${esc(s.name)}</h2><p class="detail-subtitle">${esc(s.subtitle)}</p><div class="time-band"><strong>${clock(s.arrival)}${initial?'':`–${clock(s.departure)}`}</strong><span>${initial?'เวลานัดเจอ':`${s.stay} นาที`}</span></div><p class="detail-description">${esc(s.description)}</p>${s.note?`<p class="detail-notice">${esc(s.note)}</p>`:''}<p class="detail-meta">${esc(s.meta)}</p>${s.photoNote?`<p class="photo-note">${esc(s.photoNote)}</p>`:''}<a class="photo-credit" href="${s.credit.url}" target="_blank" rel="noopener noreferrer">ภาพ: ${esc(s.credit.label)} ↗</a><a class="map-link" href="${placeLink(s)}" target="_blank" rel="noopener noreferrer">เปิด Google Maps ${external}</a>
 ${i<legs.length?`<button type="button" class="next-connection" data-leg="${i}">${walk}<span><strong>ไป ${esc(stops[i+1].name)}</strong><em>เดิน ${legs[i].minutes} นาที · ${distanceLabel(legs[i].distance)}</em></span>→</button>`:''}</div><div class="detail-nav"><button type="button" data-stop="${i-1}" ${i===0?'disabled':''}>← ก่อนหน้า</button><span>${i+1} / 8</span><button type="button" data-stop="${i+1}" ${i===7?'disabled':''}>ถัดไป →</button></div>`);
 history.replaceState(null,'',`#${s.id}`);}
function showLeg(i){const l=legs[i];if(!l)return;selection={kind:'leg',i};updateSelection();const a=schedule[i],b=schedule[i+1];
 openPanel(`${header('เส้นทางเดิน')}<div class="detail-content"><div class="route-heading"><h2>${esc(a.name)}</h2><span>→</span><h2>${esc(b.name)}</h2></div>${i===2||i===3?`<div class="overlap-options" style="margin-top:20px"><button type="button" data-leg="2" class="${i===2?'active':''}">ไป Sushiro</button><button type="button" data-leg="3" class="${i===3?'active':''}">กลับ SEA LIFE</button></div>`:''}<div class="route-metrics"><strong>${l.minutes}<small>นาที</small></strong><span>${distanceLabel(l.distance)}<br>โดยประมาณ</span></div><div class="route-times"><div><small>ออก</small><strong>${clock(a.departure)}</strong><span>${esc(a.name)}</span></div><div><small>ถึง</small><strong>${clock(b.arrival)}</strong><span>${esc(b.name)}</span></div></div><p>${esc(l.description)}</p><p class="route-brief">เผื่อเวลาทางข้ามถนน${[1,2,3,4].includes(i)?'และขึ้นลงชั้น':''}แล้ว${i===2||i===3?' ขากลับ SEA LIFE เพิ่มเวลาลงชั้นใต้ดินและแสดงบัตร':''}</p><a class="map-link" href="${walkLink(i)}" target="_blank" rel="noopener noreferrer">เปิดเส้นทางใน Google Maps ${external}</a><button type="button" class="next-connection" data-stop="${i+1}"><span><strong>ดู ${esc(b.name)}</strong><em>${clock(b.arrival)}${b.stay?`–${clock(b.departure)}`:''}</em></span>→</button></div>`);
 history.replaceState(null,'',`#walk-${i+1}`);}

function drawBase(){map.attributionControl.setPrefix(false);map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
 map.createPane('areas');map.getPane('areas').style.zIndex=200;map.createPane('roads');map.getPane('roads').style.zIndex=205;map.createPane('labels');map.getPane('labels').style.zIndex=300;
 const ar=L.canvas({pane:'areas',padding:.3}),rr=L.canvas({pane:'roads',padding:.3});
 for(const f of basemap.features){if(!['park','water','building'].includes(f.k))continue;const colors={park:'#a7b681',water:'#a8bdb1',building:'#beab7c'};const op={renderer:ar,interactive:false,color:colors[f.k],weight:.5,fillColor:colors[f.k],fillOpacity:f.k==='building'?.22:f.k==='water'?.55:.6};if(f.closed)L.polygon(f.c,op).addTo(map);else if(f.k==='water')L.polyline(f.c,{...op,weight:3,opacity:.5}).addTo(map);}
 const roads=basemap.features.filter(f=>['major','street','path','rail'].includes(f.k));
 for(const f of roads){if(f.k==='path')continue;L.polyline(f.c,{renderer:rr,interactive:false,color:f.k==='major'?'#b4a073':f.k==='street'?'#d2bd8e':'#a08c66',weight:f.k==='major'?6:f.k==='street'?2.5:1,opacity:f.k==='rail'?.35:.65,dashArray:f.k==='rail'?'3 5':undefined,lineCap:'round'}).addTo(map);}
 for(const f of roads.filter(f=>f.k==='major'))L.polyline(f.c,{renderer:rr,interactive:false,color:'#f7ecca',weight:3.8,opacity:.9}).addTo(map);
 const labels=[{name:'บรรทัดทอง',c:[13.743881,100.5231],angle:-80},{name:'พระราม 1',c:[13.746620,100.528877],angle:7},{name:'พระราม 4',c:[13.73525,100.5230],angle:22},{name:'พญาไท',c:[13.742256,100.530111],angle:-82},{name:'สยาม',c:[13.7482,100.5328],angle:0,area:true},{name:'จุฬาฯ',c:[13.7402,100.532],angle:0,area:true}];
 for(const l of labels)L.marker(l.c,{pane:'labels',interactive:false,keyboard:false,icon:L.divIcon({className:`basemap-label ${l.area?'area-label':''}`,iconSize:[160,26],iconAnchor:[80,13],html:`<span style="transform:rotate(${l.angle}deg)">${l.name}</span>`})}).addTo(map);}

function layoutPins(){if(!map)return;cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{
 const size=map.getSize(),small=compact(),placed=[],padding=small?16:28;
 const preference=small?[[-18,35],[12,-25],[-30,-65],[-80,45],[35,40],[-55,-40],[55,65]]:[[-30,45],[-50,-35],[-25,-80],[-100,55],[80,40],[-65,-45],[80,55]];
 const priority=[0,1,2,4,3,5,6];
 const overlaps=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 for(const i of priority){const p=pins.get(i),el=p.marker.getElement(),button=el?.querySelector('button');if(!button)continue;
  const point=map.latLngToContainerPoint(stops[i].coordinates),cw=button.offsetWidth,ch=button.offsetHeight,w=cw+16,h=ch+16;
  if(point.x<-70||point.y<-70||point.x>size.x+70||point.y>size.y+70){el.style.display='none';p.leader.setLatLngs([]);continue;}el.style.display='';
  const pref={x:point.x+preference[i][0],y:point.y+preference[i][1]};
  const candidates=[pref,{x:point.x,y:point.y},...[[-1,-1],[1,-1],[-1,1],[1,1],[0,-1],[0,1],[-1,0],[1,0]].flatMap(([x,y])=>[.75,1.25,1.8].map(r=>({x:point.x+x*w*r,y:point.y+y*h*r})))];
  for(let y=60+h/2;y<size.y-36-h/2;y+=30)for(let x=padding+w/2;x<size.x-padding-w/2;x+=32)candidates.push({x,y});
  let best=null;
  for(const c of candidates){const cx=Math.max(padding+w/2,Math.min(size.x-padding-w/2,c.x)),cy=Math.max(58+h/2,Math.min(size.y-35-h/2,c.y));const rect={x:cx-w/2,y:cy-h/2,w,h};let score=(cx-pref.x)**2+(cy-pref.y)**2;
   for(const q of placed)score+=overlaps(rect,q)*1e6;
   score+=overlaps(rect,{x:0,y:size.y-(small?92:125),w:small?84:110,h:small?92:125})*1e5;
   score+=overlaps(rect,small?{x:size.x-170,y:size.y-90,w:170,h:90}:{x:size.x-78,y:size.y-210,w:78,h:210})*1e5;
   if(!best||score<best.score)best={cx,cy,rect,score};}
  placed.push(best.rect);button.style.left=`${best.cx-point.x-cw/2}px`;button.style.top=`${best.cy-point.y-ch/2}px`;
  const endpoint=map.containerPointToLatLng([best.cx,best.cy]);p.leader.setLatLngs([stops[i].coordinates,endpoint]);
 }
 });}

function fitAll(){if(!map||!bounds)return;const narrow=map.getSize().x<900;map.fitBounds(bounds,{paddingTopLeft:compact()?[40,75]:narrow?[80,100]:[160,115],paddingBottomRight:compact()?[45,80]:narrow?[95,110]:[190,110],maxZoom:16.25,animate:false});layoutPins();}
function initMap(){if(!window.L){$('#map').innerHTML='<p class="map-error">โหลดแผนที่ไม่สำเร็จ เปิดดูตารางเที่ยวจากปุ่มด้านบนได้</p>';return;}
 $('#map').innerHTML='';map=L.map('map',{center:[13.742,100.526],zoom:15,zoomControl:false,scrollWheelZoom:false,zoomSnap:.25,minZoom:14,maxZoom:18,tapHold:false,maxBounds:[[13.734,100.514],[13.750,100.538]],maxBoundsViscosity:.7});drawBase();
 map.createPane('routes');map.getPane('routes').style.zIndex=410;map.createPane('route-hit');map.getPane('route-hit').style.zIndex=415;map.createPane('leaders');map.getPane('leaders').style.zIndex=420;
 legs.forEach((l,i)=>{const visual=L.polyline(l.coordinates,{pane:'routes',color:'#a9432f',weight:4,dashArray:'5 9',opacity:.9,lineCap:'round',interactive:false}).addTo(map);const hit=L.polyline(l.coordinates,{pane:'route-hit',weight:44,opacity:0}).addTo(map);hit.on('click',()=>showLeg(i===3?2:i));const path=hit.getElement();if(path){path.setAttribute('data-route',String(i));path.setAttribute('role','button');path.setAttribute('tabindex','0');path.setAttribute('aria-label',`เส้นประ ${stops[i].name} ไป ${stops[i+1].name} เดิน ${l.minutes} นาที`);path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLeg(i);}});}routes.push({visual,hit});});
 stops.slice(0,7).forEach((s,i)=>{const art=i===1?`<span class="pin-art">${bowl}</span>`:`<img src="./assets/${s.image}.webp" width="126" height="60" alt="" aria-hidden="true">`;
  const marker=L.marker(s.coordinates,{keyboard:false,zIndexOffset:100+i,icon:L.divIcon({className:'map-pin',iconSize:[0,0],iconAnchor:[0,0],html:`<button type="button" class="pin-card" style="--tilt:${[-3,2,-2,3,-2,-3,2][i]}deg" data-stop="${i}" aria-label="${esc(s.name)} ${clock(schedule[i].arrival)}" aria-pressed="false"><span class="pin-order">${i===0?'1/8':i+1}</span>${art}<span class="pin-title">${esc(s.mapName)}</span></button>`})}).addTo(map);
  const leader=L.polyline([],{pane:'leaders',color:'#846c44',weight:1.2,opacity:.65,interactive:false}).addTo(map);L.circleMarker(s.coordinates,{pane:'leaders',radius:3,weight:1.2,color:'#8b482e',fillColor:'#fff5d6',fillOpacity:1,interactive:false}).addTo(map);pins.set(i,{marker,leader});
 });
 bounds=L.latLngBounds(legs.flatMap(l=>l.coordinates));fitAll();map.on('moveend zoomend',layoutPins);map.on('resize',fitAll);new ResizeObserver(()=>{map.invalidateSize({pan:false});fitAll();}).observe($('#map'));document.fonts.ready.then(layoutPins);}

$('#map').addEventListener('click',e=>{const b=e.target.closest('button[data-stop]');if(!b)return;e.preventDefault();e.stopPropagation();showStop(Number(b.dataset.stop));},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.hasAttribute('data-close'))panel.close();else if(b.hasAttribute('data-schedule'))showSchedule();else if(b.dataset.stop!==undefined)showStop(Number(b.dataset.stop));else if(b.dataset.leg!==undefined)showLeg(Number(b.dataset.leg));});
panel.addEventListener('close',()=>{selection=null;updateSelection();history.replaceState(null,'',location.pathname+location.search);});
for(const d of [panel,$('#about-dialog')])d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
$('#schedule-button').addEventListener('click',showSchedule);$('#fit-map').addEventListener('click',fitAll);$('#zoom-in').addEventListener('click',()=>map?.zoomIn());$('#zoom-out').addEventListener('click',()=>map?.zoomOut());$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());$('#close-about').addEventListener('click',()=>$('#about-dialog').close());
$('#route-index').innerHTML=schedule.map((s,i)=>`<button type="button" class="route-stop" data-stop="${i}" aria-label="${esc(s.name)} ${clock(s.arrival)} ดูรายละเอียด"><span>${i+1} / 8</span><strong>${clock(s.arrival)}</strong><em>${esc(i===6?'สวน 100 ปี จุฬาฯ':s.name)}</em></button>`).join('');
const sourceRows=[['เส้นทางเดิน · FOSSGIS / OpenStreetMap','https://routing.openstreetmap.de/about.html'],['เวลาเปิด Kinokuniya',stops[2].official],['เวลาเปิด Sushiro',stops[3].official],['เวลาเปิด SEA LIFE',stops[4].official],['เวลาเปิดสวน 100 ปี จุฬาฯ',stops[6].official]];
$('#source-links').innerHTML=`<p class="sources-heading">ข้อมูลสถานที่</p>${sourceRows.map(([t,u])=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`).join('')}<p class="sources-heading">รูปภาพ</p>${Object.values(Object.fromEntries(stops.map(s=>[s.image,s.credit]))).map(c=>`<a href="${c.url}" target="_blank" rel="noopener noreferrer">${esc(c.label)} ↗</a>`).join('')}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">สัญญาอนุญาตภาพ CC BY-SA 4.0 ↗</a><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">แจ้งแก้ไขแผนที่ ↗</a>`;
$('#total-distance').textContent=distanceLabel(meta.distanceMeters);updateCountdown();setInterval(updateCountdown,1000);const hash=location.hash.slice(1);initMap();const first=stops.findIndex(s=>s.id===hash);if(first>=0)showStop(first);else if(/^walk-[1-7]$/.test(hash))showLeg(Number(hash.slice(5))-1);
