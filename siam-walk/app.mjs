import {stops, legs, meta} from './trip-data.mjs';
import {countdown, buildSchedule, clock, distanceLabel} from './core.mjs';
import {basemap} from './basemap.mjs';

const $ = (s) => document.querySelector(s);
const escape = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const schedule = buildSchedule(stops, legs);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.matchMedia('(max-width: 760px)').matches;
const walkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="4" r="2"/><path d="m8 12 3-5 4 2 2 4h3M11 8l-1 7-4 6m4-6 5 2 1 5M9 9l-4 3"/></svg>';
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const externalIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/></svg>';
const pinIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
let map, fullBounds;
let selection = {type:'overview',index:null};
const mapStops = new Map();
const routeLayers = [];
const routeBadges = [];

function updateCountdown() {
  const c = countdown();
  for (const key of ['days','hours','minutes','seconds']) $(`#cd-${key}`).textContent = String(c[key]).padStart(2,'0');
  $('#countdown-label').innerHTML = `<span class="status-dot"></span> ${c.ended ? 'เก็บวันนี้ไว้เป็นความทรงจำ' : c.met ? 'ถึงเวลาเดินไปด้วยกันแล้ว' : 'อีกนิดก็ได้เจอกัน'}`;
}

function resetPanel(html) {
  const panel = $('#panel');
  panel.innerHTML=html;
  panel.scrollTop=0;
}

function bringPanelIntoView(fromMap=false) {
  if (fromMap && mobile()) $('#panel').scrollIntoView({behavior:reducedMotion?'instant':'smooth', block:'start'});
}

function backButton() {return `<button class="back-button" type="button" data-overview>${arrow} กลับดูแผนทั้งวัน</button>`;}
function googlePlace(s) {return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.mapQuery)}`;}
function googleWalk(l) {const a=stops[l.id],b=stops[l.id+1];return `https://www.google.com/maps/dir/?api=1&origin=${a.coordinates.join(',')}&destination=${b.coordinates.join(',')}&travelmode=walking`;}
function updateSelectedMap() {
  for (const [i,marker] of mapStops) {
    const button=marker.getElement()?.querySelector('button');
    const active=selection.type==='stop'&&(i===selection.index||(i===0&&selection.index===7));
    button?.classList.toggle('active',active);
    button?.setAttribute('aria-pressed', String(active));
  }
  routeLayers.forEach((layer,i)=>{
    const selected = selection.type==='leg'&&selection.index===i;
    layer.visual.setStyle({opacity:selection.type==='leg'?(selected?1:.2):.85,weight:selected?5:3.2});
    if(selected){layer.visual.bringToFront();layer.hit.bringToFront();}
    routeBadges[i]?.getElement()?.querySelector('button')?.classList.toggle('active',selected);
  });
}

function showOverview() {
  selection={type:'overview',index:null};
  resetPanel(`<div class="panel-inner"><div class="panel-topline"><p class="eyebrow">THE ITINERARY</p><span class="day-tag">07 / 11</span></div><h2>แผนของวัน</h2><p class="panel-intro">เดินเล่น กินข้าว ดูหนังสือ แล้วไปหาฝูงปลา</p>
  <ol class="itinerary">${schedule.map((s,i)=>`<li class="stop-item"><button class="stop-row" type="button" data-stop="${i}" aria-label="${escape(s.name)} ${clock(s.arrival)} ดูรายละเอียด"><span class="stop-num">${String(i+1).padStart(2,'0')}</span><span class="stop-copy"><strong>${escape(s.name)}</strong><small>${escape(s.subtitle)}</small></span><time class="stop-time">${clock(s.arrival)}</time></button>${i<legs.length?`<div class="walk-row"><button type="button" data-leg="${i}" aria-label="เส้นทางจาก ${escape(s.name)} ไป ${escape(stops[i+1].name)} เดินประมาณ ${legs[i].minutes} นาที">${walkIcon} เดิน ${legs[i].minutes} นาที <span>· ${distanceLabel(legs[i].distance)}</span><span class="walk-arrow">↗</span></button></div>`:''}</li>`).join('')}</ol>
  <p class="itinerary-note">เวลาเดินเผื่อทางข้ามถนนและขึ้นลงชั้นแล้ว<br>ข้าวเช้ายังไม่เลือกร้าน · กลับถึงหัวลำโพงก่อน 17:40</p></div>`);
  updateSelectedMap();
  history.replaceState(null,'',location.pathname+location.search);
}

function showStop(index,fromMap=false) {
  if(!schedule[index])return;
  selection={type:'stop',index};
  const s=schedule[index];
  const initial=index===0;
  const next=index<legs.length?legs[index]:null;
  resetPanel(`<div class="detail-top">${backButton()}${index===0||index===7?`<div class="overlap-options"><button type="button" data-stop="0" class="${index===0?'active':''}">นัดเจอ 08:35</button><button type="button" data-stop="7" class="${index===7?'active':''}">กลับถึง 17:30</button></div>`:''}<p class="detail-label">${String(index+1).padStart(2,'0')} / ${escape(s.category)}</p></div>
  <figure class="detail-photo"><img src="./assets/${s.image}.webp" alt="${escape(s.photoNote||s.name+' · '+s.subtitle)}" width="1200" height="800"><a class="photo-credit" href="${s.credit.url}" target="_blank" rel="noopener noreferrer">${escape(s.credit.label)} ↗</a></figure>
  <div class="detail-content"><div class="detail-title-row"><h2 tabindex="-1">${escape(s.name)}</h2></div><p class="detail-subtitle">${escape(s.subtitle)}</p>
  <div class="time-band"><strong>${initial?clock(s.arrival):`${clock(s.arrival)} <small>–</small> ${clock(s.departure)}`}</strong><span>${initial?'เวลานัดเจอ':`ใช้เวลา ${s.stay>=60?(s.stay%60===0?`${s.stay/60} ชม.`:`${Math.floor(s.stay/60)} ชม. ${s.stay%60} นาที`):`${s.stay} นาที`}`}</span></div>
  <p class="detail-description">${escape(s.description)}</p><p class="detail-notice ${s.warm?'warm':''}">${escape(s.note)}</p>
  <div class="detail-meta">${pinIcon}<span>${escape(s.meta)}</span></div>
  ${s.photoNote?`<p class="detail-label" style="font-size:9px;letter-spacing:0;margin-bottom:15px">${escape(s.photoNote)}</p>`:''}
  <a class="map-link" href="${googlePlace(s)}" target="_blank" rel="noopener noreferrer">เปิดสถานที่ใน Google Maps ${externalIcon}</a>
  ${next?`<button class="next-connection" type="button" data-leg="${index}">${walkIcon}<span><strong>ต่อไป ${escape(stops[index+1].name)}</strong>เดิน ${next.minutes} นาที · ${distanceLabel(next.distance)}</span><span>↗</span></button>`:''}</div>
  <div class="detail-nav"><button type="button" data-stop="${index-1}" ${index===0?'disabled':''}>← ก่อนหน้า</button><span>${index+1} / ${stops.length}</span><button type="button" data-stop="${index+1}" ${index===stops.length-1?'disabled':''}>ถัดไป →</button></div>`);
  updateSelectedMap();
  if(map && !fromMap) map.panTo(s.coordinates,{animate:!reducedMotion});
  bringPanelIntoView(fromMap);
  history.replaceState(null,'',`#${s.id}`);
}

function showLeg(index,fromMap=false) {
  const l=legs[index]; if(!l)return;
  selection={type:'leg',index};
  const a=schedule[index],b=schedule[index+1];
  const overlap=index===2||index===3;
  resetPanel(`<div class="panel-inner">${backButton()}<p class="detail-label route-kicker">ON FOOT / ${String(index+1).padStart(2,'0')} → ${String(index+2).padStart(2,'0')}</p>
  <h2>${escape(a.name)}<br><span style="color:#a7b29e">→</span> ${escape(b.name)}</h2>
  ${overlap?`<div class="overlap-options"><button type="button" data-leg="2" class="${index===2?'active':''}">ไปร้านซูชิ · 10 นาที</button><button type="button" data-leg="3" class="${index===3?'active':''}">กลับ SEA LIFE · 15 นาที</button></div>`:''}
  <div class="route-visual" aria-hidden="true"><div class="route-line"></div><span class="route-end">${index+1}</span><span class="walk-symbol">${walkIcon}</span><span class="route-end">${index+2}</span></div>
  <div class="route-metrics"><strong>${l.minutes}<small>นาที</small></strong><span>ระยะเดิน ${distanceLabel(l.distance)}<br>โดยประมาณ · รวมเวลาเผื่อ</span></div>
  <div class="route-times"><div><small>ออกเดิน</small><strong>${clock(a.departure)}</strong><span class="route-dest">${escape(a.name)}</span></div><div><small>ถึงประมาณ</small><strong>${clock(b.arrival)}</strong><span class="route-dest">${escape(b.name)}</span></div></div>
  <p class="route-description">${escape(l.description)}</p>
  <p class="detail-notice">คำนวณจากแนวทางเดิน OpenStreetMap ระยะ ${distanceLabel(l.distance)} เผื่อเดินช้า ทางข้ามถนน${index===1||index===2||index===3||index===4?' และขึ้นลงชั้นในห้าง':''}แล้ว${overlap?' ระยะถนนไป–กลับเท่ากัน แต่ขากลับ SEA LIFE เผื่อลงชั้นใต้ดินและแสดงบัตรเพิ่ม':''}</p>
  <a class="map-link" href="${googleWalk(l)}" target="_blank" rel="noopener noreferrer">เปิดนำทางเดินใน Google Maps ${externalIcon}</a>
  <button class="next-connection" type="button" data-stop="${index+1}">${pinIcon}<span><strong>ดูจุดหมาย ${escape(b.name)}</strong>${clock(b.arrival)}${b.stay?`–${clock(b.departure)}`:''}</span><span>→</span></button></div>`);
  updateSelectedMap();
  if(map && !fromMap) {
    map.fitBounds(l.coordinates,{padding:mobile()?[55,75]:[95,100],maxZoom:17,animate:!reducedMotion});
  }
  bringPanelIntoView(fromMap);
  history.replaceState(null,'',`#walk-${index+1}`);
}

function routeMidpoint(coords) {
  // By path length, so labels sit on the walk rather than a straight-line shortcut.
  const lengths=coords.slice(1).map((p,i)=>Math.hypot((p[1]-coords[i][1])*Math.cos(p[0]*Math.PI/180),p[0]-coords[i][0]));
  const target=lengths.reduce((a,b)=>a+b,0)/2;
  let d=0;
  for(let i=0;i<lengths.length;i++){if(d+lengths[i]>=target){const f=(target-d)/(lengths[i]||1);return coords[i].map((n,k)=>n+(coords[i+1][k]-n)*f);}d+=lengths[i];}
  return coords[0];
}

function initMap() {
  if(!window.L){$('#map').innerHTML='<div class="map-error">แผนที่ยังโหลดไม่สำเร็จ<br>ดูตารางเที่ยวและเปิดสถานที่ใน Google Maps ได้จากด้านข้าง</div>';return;}
  $('#map').innerHTML='';
  map=L.map('map',{center:[13.742,100.526],zoom:15,zoomControl:false,scrollWheelZoom:false,attributionControl:true,zoomSnap:.25,minZoom:14,maxZoom:18,preferCanvas:false,tapHold:false,maxBounds:[[13.734,100.514],[13.750,100.538]],maxBoundsViscosity:.7});
  drawBasemap();
  map.createPane('route-hit');map.getPane('route-hit').style.zIndex='415';
  map.createPane('routes');map.getPane('routes').style.zIndex='410';
  legs.forEach((l,i)=>{
    const color=l.afternoon?'#c18b57':'#568465';
    const visual=L.polyline(l.coordinates,{pane:'routes',color,weight:3.2,opacity:.85,dashArray:'3 8',lineCap:'round',interactive:false}).addTo(map);
    const hit=L.polyline(l.coordinates,{pane:'route-hit',weight:22,opacity:0,interactive:true}).addTo(map);
    hit.on('click',()=>showLeg(i===2||i===3?(selection.type==='leg'&&selection.index===3?3:2):i,true));
    const path=hit.getElement();
    path?.setAttribute('role','button');
    path?.setAttribute('tabindex','0');
    path?.setAttribute('data-route',String(i));
    path?.setAttribute('aria-label',`เส้นประ ${stops[i].name} ไป ${stops[i+1].name} เดิน ${l.minutes} นาที`);
    path?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showLeg(i,true);}});
    routeLayers.push({visual,hit});
    const mid=routeMidpoint(l.coordinates);
    const offsets=mobile()?[[0,0],[-10,0],[-30,-4],[30,10],[35,0],[50,0],[-15,0]]:[[0,0],[0,0],[-35,-3],[35,10],[0,0],[30,0],[-5,0]];
    const badge=L.marker(mid,{keyboard:false,zIndexOffset:-100,icon:L.divIcon({className:'walk-badge',iconSize:[0,0],iconAnchor:[-offsets[i][0],-offsets[i][1]],html:`<button type="button" data-leg="${i}" data-map aria-label="เดิน ${escape(stops[i].name)} ไป ${escape(stops[i+1].name)} ประมาณ ${l.minutes} นาที">${walkIcon}${l.minutes} น.</button>`})}).addTo(map);
    badge.getElement()?.querySelector('button')?.addEventListener('click',e=>{e.stopPropagation();showLeg(i,true);});
    routeBadges.push(badge);
  });
  stops.forEach((s,i)=>{
    if(i===7)return;
    const label=i===0?'1 · 8':String(i+1);
    const marker=L.marker(s.coordinates,{keyboard:false,zIndexOffset:i===2?210:i===4?200:100,icon:L.divIcon({className:'map-pin',iconSize:[0,0],iconAnchor:[0,0],html:`<button type="button" class="pin-button ${s.markerClass} ${s.afternoon?'afternoon':''}" data-stop="${i}" data-map aria-label="${escape(s.name)} ${clock(schedule[i].arrival)}${i===0?' และกลับ 17:30':''}" aria-pressed="false"><span class="pin-number">${label}</span><span>${escape(s.mapName)}</span></button>`})}).addTo(map);
    marker.getElement()?.querySelector('button')?.addEventListener('click',e=>{e.stopPropagation();showStop(i,true);});
    mapStops.set(i,marker);
  });
  fullBounds=L.latLngBounds(legs.flatMap(l=>l.coordinates));
  fitAll();
  new ResizeObserver(()=>{map.invalidateSize({pan:false});}).observe($('#map'));
  map.on('zoomend',()=>{
    const zoom=map.getZoom();
    $('#map').classList.toggle('map-near',zoom>16);
    routeBadges.forEach((b,i)=>{const el=b.getElement();if(el)el.style.display=zoom<14.5&&(i===2||i===3||i===5)?'none':'';});
  });
}

function drawBasemap() {
  // The local vector extract is a real OSM street map. It needs no third-party
  // image server, API key, live geocoding, or visitor location permission.
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>');
  map.createPane('base-areas');map.getPane('base-areas').style.zIndex='200';
  map.createPane('base-roads');map.getPane('base-roads').style.zIndex='205';
  map.createPane('base-labels');map.getPane('base-labels').style.zIndex='300';
  const areaRenderer=L.canvas({pane:'base-areas',padding:.4});
  const roadRenderer=L.canvas({pane:'base-roads',padding:.4});
  const areas=basemap.features.filter(f=>['park','water','building'].includes(f.k));
  for(const f of areas) {
    const colors={park:'#dce7cc',water:'#d1e4e4',building:'#e5e8df'};
    const options={renderer:areaRenderer,interactive:false,color:f.k==='building'?'#dde2d7':colors[f.k],weight:f.k==='building'?.5:1,fillColor:colors[f.k],fillOpacity:f.k==='building'?.7:.85};
    if(f.closed)L.polygon(f.c,options).addTo(map);
    else if(f.k==='water')L.polyline(f.c,{...options,weight:3}).addTo(map);
  }
  const roads=basemap.features.filter(f=>!['park','water','building'].includes(f.k));
  for(const f of roads){
    if(f.k==='major'||f.k==='street')L.polyline(f.c,{renderer:roadRenderer,interactive:false,color:'#dfe4d7',weight:f.k==='major'?11:5.5,opacity:.9,lineCap:'round'}).addTo(map);
  }
  for(const f of roads){
    const options={renderer:roadRenderer,interactive:false,color:f.k==='rail'?'#d3dace':f.k==='path'?'#f9faf5':'#fdfdf8',weight:f.k==='major'?8:f.k==='street'?3.5:f.k==='rail'?1.2:1.4,opacity:f.k==='path'?.65:1,lineCap:'round'};
    if(f.k==='rail')options.dashArray='4 5';
    L.polyline(f.c,options).addTo(map);
  }
  const labels=[...basemap.labels,
    {name:'ถนนบรรทัดทอง',c:[13.743881,100.523100],angle:-80},
    {name:'ถนนพระราม 1',c:[13.746620,100.528877],angle:7},
    {name:'สยาม',c:[13.7485,100.5328],angle:0,type:'area-label'},
    {name:'จุฬาลงกรณ์มหาวิทยาลัย',c:[13.7398,100.5319],angle:0,type:'area-label'},
  ];
  for(const l of labels)L.marker(l.c,{pane:'base-labels',interactive:false,keyboard:false,icon:L.divIcon({className:`basemap-label ${l.type||''}`,iconSize:[150,20],iconAnchor:[75,10],html:`<span style="transform:rotate(${l.angle||0}deg)">${escape(l.name)}</span>`})}).addTo(map);
}

function fitAll() {
  if(!map||!fullBounds)return;
  map.fitBounds(fullBounds,{paddingTopLeft:mobile()?[45,85]:[115,105],paddingBottomRight:mobile()?[75,65]:[155,85],maxZoom:16.3,animate:!reducedMotion});
}

// Capture map controls before Leaflet's event delegation; marker buttons live
// outside their zero-sized icon anchors and must not select the path beneath.
$('#map').addEventListener('click',event=>{
  const button=event.target.closest('button[data-stop],button[data-leg]');
  if(!button)return;
  event.preventDefault();event.stopPropagation();
  if(button.dataset.stop!==undefined)showStop(Number(button.dataset.stop),true);
  else showLeg(Number(button.dataset.leg),true);
},true);
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||target.disabled)return;
  if(target.hasAttribute('data-overview'))showOverview();
  else if(target.dataset.stop!==undefined)showStop(Number(target.dataset.stop),target.hasAttribute('data-map'));
  else if(target.dataset.leg!==undefined)showLeg(Number(target.dataset.leg),target.hasAttribute('data-map'));
});
$('#fit-map').addEventListener('click',()=>{fitAll();showOverview();});
$('#zoom-in').addEventListener('click',()=>map?.zoomIn());
$('#zoom-out').addEventListener('click',()=>map?.zoomOut());
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
$('#close-about').addEventListener('click',()=>$('#about-dialog').close());
$('#about-dialog').addEventListener('click',e=>{if(e.target===$('#about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
const sources=[
  ['เส้นทางเดิน · FOSSGIS / OpenStreetMap','https://routing.openstreetmap.de/about.html'],
  ['เวลาเปิด Kinokuniya · เว็บไซต์ทางการ',stops[2].official],
  ['เวลาเปิด Sushiro · เว็บไซต์ทางการ',stops[3].official],
  ['เวลาเปิด SEA LIFE · เว็บไซต์ทางการ',stops[4].official],
  ['เวลาเปิดสวน · จุฬาลงกรณ์มหาวิทยาลัย',stops[6].official],
];
$('#source-links').innerHTML=`<p class="sources-heading">ข้อมูลสถานที่ · ตรวจสอบ 1 พ.ย. 2026</p>${sources.map(([t,u])=>`<a href="${u}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`).join('')}<p class="sources-heading">ภาพสถานที่จริง · ย่อและปรับขนาดเพื่อแสดงผล</p>${Object.values(Object.fromEntries(stops.map(s=>[s.image,s.credit]))).map(c=>`<a href="${c.url}" target="_blank" rel="noopener noreferrer">${escape(c.label)} ↗</a>`).join('')}<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">ภาพ CC BY-SA 4.0 รวมภาพที่ย่อแล้ว ใช้สัญญาอนุญาตเดียวกัน ↗</a><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">แจ้งแก้ไขแผนที่ ↗</a>`;
$('#total-distance').textContent=distanceLabel(meta.distanceMeters);
const initialHash=location.hash.slice(1);
showOverview();
updateCountdown();
setInterval(updateCountdown,1000);
initMap();
const initialStop=stops.findIndex(s=>s.id===initialHash);
if(initialStop>=0)showStop(initialStop);
else if(/^walk-[1-7]$/.test(initialHash))showLeg(Number(initialHash.slice(5))-1);
