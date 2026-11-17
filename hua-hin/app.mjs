import {trip,places,days,packing,sources} from './trip-data.mjs';
import {duration,durationLabel,distanceLabel,countdown,bangkokDay,currentEvent,mapUrl,directionUrl,rideBreakdown} from './core.mjs';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconPaths={
 heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
 waves:'M2 8c3-4 5 4 9 0s6 4 11 0M2 14c3-4 5 4 9 0s6 4 11 0M2 20c3-4 5 4 9 0s6 4 11 0',
 train:'M5 16V6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2ZM5 10h14M8 14h.01M16 14h.01M8 18l-3 3m11-3 3 3M12 3v7',
 car:'M5 6h14l2 7v6h-3v-3H6v3H3v-6l2-7ZM3 12h18M7 14h.01M17 14h.01',
 walk:'M13 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 22l3-7 3 2 2 5M7 13l2-5 4-1 2 5 4 2M11 15l2-8',
 bed:'M3 18V6m0 8h18v6m0-6V9H8v5M3 9h5v5M3 18h18',
 food:'M5 2v6m3-6v6M2 2v6a3 3 0 0 0 6 0M5 11v11M20 2c-4 3-4 9 0 10V2Zm0 10v10',
 bag:'M5 7h14l2 14H3L5 7Zm3 0V5a4 4 0 0 1 8 0v2M8 11h.01M16 11h.01',
 sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
 share:'M12 16V3m-5 5 5-5 5 5M5 13H3v8h18v-8h-2',
 map:'m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17',
 list:'M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01',
 grid:'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
 info:'M12 16v-4m0-4h.01M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',
 clock:'M12 6v6l4 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',
 compass:'m16 8-3 5-5 3 3-5 5-3ZM22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z',
 expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
 locate:'M12 3v3m0 12v3M3 12h3m12 0h3M18 12a6 6 0 1 0-12 0 6 6 0 0 0 12 0ZM12 10v4m-2-2h4',
 layers:'m12 2 10 5-10 5L2 7l10-5ZM2 12l10 5 10-5M2 17l10 5 10-5',
 'arrow-right':'M4 12h16m-6-6 6 6-6 6',
 'arrow-down':'M12 4v16m-6-6 6 6 6-6',
 'arrow-up-right':'M6 18 18 6M6 6h12v12',
 download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
 check:'m5 12 4 4L19 6',
 calendar:'M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4',
 note:'M4 3h16v18H4V3Zm4 5h8m-8 4h8m-8 4h5',
 pin:'M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 1 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
};
function icon(name){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name]??iconPaths.pin}"/></svg>`;}
function mountIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));}
const params=new URLSearchParams(location.search);
let selectedDay=Number(params.get('day'));
if(!days.some(d=>d.id===selectedDay)) selectedDay=days.find(d=>d.date===bangkokDay())?.id??1;
let view=['timeline','map','overview'].includes(params.get('view'))?params.get('view'):'timeline';
let allMap=false,includeBangkok=false,map,routeData={},credits=[],tileLayer,geoMarker;
let routeLayer,markerLayer,tileLoads=0,tileErrors=0,toastTimer,dialogType='',lastFocused=null;
const markers=new Map();
const dialog=$('#detail-dialog');
let storageAvailable=true;
function readLocal(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{storageAvailable=false;return fallback;}}
let checked=readLocal('hh-trip-packing-v1',{});if(!checked||typeof checked!=='object'||Array.isArray(checked))checked={};
let note=readLocal('hh-trip-note-v1','');if(typeof note!=='string')note='';
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageAvailable=false;return false;}}
function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function selected(){return days.find(d=>d.id===selectedDay);}
function findEvent(id){for(const day of days){const event=day.events.find(e=>e.id===id);if(event)return {day,event};}return null;}
function syncUrl(place=null){const p=new URLSearchParams();p.set('day',String(selectedDay));p.set('view',view);if(place)p.set('place',place);history.replaceState(null,'',`${location.pathname}?${p}`);}
function visitTimes(place,dayId=selectedDay){return days.find(d=>d.id===dayId).events.filter(e=>e.place===place&&['place','rest'].includes(e.kind));}
function eventTime(e){return `${e.start}${e.end?`–${e.end}`:''}`;}
function currentState(){const c=currentEvent(days);return c?.day.id===selectedDay?c:null;}
function imageTag(p,cls='',lazy=true){const c=credits.find(c=>c.id===p.image);return `<img class="${cls}" src="./assets/${esc(p.image)}.webp" width="${c?.width??1200}" height="${c?.height??800}" alt="${esc(p.name)}" ${lazy?'loading="lazy"':''}>`;}
function transitTitle(e){const r=routeData[e.route];const foot=r?.mode==='foot'||e.route==='beach-night'||e.route==='cicada-tamarind';return `${foot?'เดิน':'Grab / Bolt'}${r?` · ${distanceLabel(r.distanceMeters)}`:''}`;}
function renderTimeline(){
 const day=selected(),current=currentState();
 $('#day-title').textContent=day.title;$('#day-subtitle').textContent=day.subtitle;
 $('#day-eyebrow').textContent=`${['SATURDAY','SUNDAY','MONDAY'][day.id-1]} · 0${day.id+4} DECEMBER`;
 $('#day-highlight').innerHTML=`${icon('heart')}<span>${esc(day.highlight)}</span>`;
 $('#timeline').innerHTML=day.events.map(e=>{
  const r=routeData[e.route];
  let content='';
  if(e.kind==='transit'){
   const foot=r?.mode==='foot'||e.route.includes('beach-night')||e.route.includes('cicada-tamarind');
   content=`<button class="transit-button" type="button" data-leg="${e.id}">${icon(foot?'walk':'car')}<span><strong>${transitTitle(e)} → ${esc(places[e.to].short)}</strong><small>${e.start}–${e.end} · กันไว้ ${duration(e)} นาที${foot?' รวมเผื่อทางข้าม':` · รอเรียกรถ ${e.wait} นาที`}</small></span></button>`;
  }else if(e.kind==='train'){
   content=`<button class="event-card" type="button" data-train="${day.id}"><span class="event-kind">${icon('train')} ORDINARY TRAIN ${e.number}</span><span class="event-title">${esc(e.title)}</span><span class="event-copy">${esc(e.text)}</span><span class="train-route"><span><strong>${e.start}</strong>${esc(places[e.from].short)}</span>${icon('arrow-right')}<span><strong>${e.end}</strong>${esc(places[e.to].short)}</span></span><span class="event-meta"><span>${durationLabel(duration(e))}</span><span class="fixed-badge">เวลาหลักของทริป</span></span></button>`;
  }else{
   const p=places[e.place];
   const kind=e.kind==='rest'?'เวลาอยู่โรงแรม':e.kind==='flexible'?'ช่วงเวลายืดหยุ่น':e.kind==='buffer'?'เวลาเผื่อ':'แวะที่นี่';
   const thumb=e.id==='beach-time'||e.id==='cicada-time'||e.id==='slow-sunday';
   content=`<button class="event-card" type="button" data-event="${e.id}"><span class="event-kind">${icon(e.kind==='buffer'?'clock':e.kind==='rest'?'bed':p.type)} ${kind}</span><span class="event-title">${esc(e.title)}</span><span class="event-copy">${esc(e.text)}</span>${thumb?imageTag(p,'event-thumb'):''}<span class="event-meta"><span>${icon('clock')}${e.end?durationLabel(duration(e)):e.kind==='rest'?'ที่เหลือของคืนนี้':'ถึงแล้ว'}</span>${e.kind==='flexible'?'<span>ยังไม่ล็อกสถานที่</span>':`<span>${esc(p.short)}</span>`}<span class="event-chevron" aria-hidden="true">↗</span></span></button>`;
  }
  return `<li class="timeline-item ${e.kind} ${e.featured?'featured':''} ${current?.event.id===e.id?'is-current':''}" id="event-${e.id}"><span class="timeline-time"><time datetime="${day.date}T${e.start}:00+07:00">${e.start}</time>${e.end?`<small>${e.end}</small>`:''}</span><i class="timeline-dot" aria-hidden="true"></i>${content}</li>`;
 }).join('');
 renderCurrent();
}
function renderCurrent(){
 const c=currentEvent(days),banner=$('#current-banner');
 banner.hidden=!c;
 if(c)banner.innerHTML=`<span>ตอนนี้ตามแผน: <strong>${esc(c.event.title??`เดินทางไป ${places[c.event.to].short}`)}</strong> · ${eventTime(c.event)}</span><button type="button" data-action="current">ดูช่วงนี้</button>`;
}
function updateCountdown(){const c=countdown(new Date(),trip.start,trip.end);const value=$('#countdown-value'),label=$('#countdown-label');
 if(c.state==='before'){label.textContent='ออกเดินทางในอีก';value.innerHTML=`<b>${c.days}</b> วัน <b>${c.hours}</b> ชม. <b>${c.minutes}</b> นาที`;}
 else if(c.state==='during'){label.textContent='ถึงเวลาของเราแล้ว';value.textContent='อยู่หัวหินด้วยกัน';}
 else{label.textContent='ทริปนี้กลายเป็นความทรงจำ';value.textContent='5–7 ธันวาคม 2026';}
}
function setView(next,{scroll=false}={}){
 view=next;document.body.dataset.view=view;
 $('#daily-section').hidden=view==='overview';$('#overview-section').hidden=view!=='overview';
 document.querySelectorAll('button[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
 if(view==='overview')renderOverview();
 syncUrl();
 if(scroll)$('#plan').scrollIntoView({behavior:'smooth',block:'start'});
 if(view!=='overview')requestAnimationFrame(()=>{map?.invalidateSize();fitMap();});
}
function chooseDay(id,{scroll=false}={}){
 selectedDay=id;allMap=false;
 document.querySelectorAll('[data-day]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.day)===id);b.setAttribute('aria-pressed',String(Number(b.dataset.day)===id));});
 if(view==='overview')setView('timeline');
 $('#map-all').setAttribute('aria-pressed','false');
 $('#map-all').innerHTML=`ดูทุกวัน ${icon('layers')}`;
 renderTimeline();drawMap();syncUrl();
 if(scroll)$('#plan').scrollIntoView({behavior:'smooth',block:'start'});
}
function overviewStops(d){return d.events.filter(e=>e.kind==='place'&&!['bangkok','hotel','station'].includes(e.place)).map(e=>places[e.place].short).join(' → ')||'อาหารเช้า → พักโรงแรม → รถไฟกลับกรุงเทพฯ';}
function renderOverview(){
 $('#overview-section').innerHTML=`<div class="overview-heading"><div><p class="eyebrow">THREE DAYS, AT OUR OWN PACE</p><h2 id="overview-title" lang="en">Our days by the sea.</h2><p>5–7 ธันวาคม 2026 · ทริปหัวหินที่มีเวลาให้เราสองคน</p></div><span class="overview-tag">${icon('heart')} 2 คืนที่ Ayrest · 3 ตลาดกลางคืน</span></div><div class="overview-days">${days.map(d=>`<article class="overview-day"><div class="overview-day-photo"><img src="./assets/${d.image}.webp" alt="${esc(d.id===1?'หาดหัวหิน':d.id===2?'Cicada Market':'Ayrest Hua Hin')}" width="1200" height="800" loading="lazy"><span>DAY 0${d.id} · ${d.weekday} ${d.label}</span></div><div class="overview-day-content"><h3>${esc(d.title)}</h3><div class="overview-stops"><span>${d.id===1?'09:20 รถไฟ 261 → 13:50 หัวหิน':d.id===2?'ตื่นสาย · ออกเที่ยวช่วงบ่าย':'14:56 รถไฟ 262 → 19:20 หัวลำโพง'}</span>${overviewStops(d)}</div><button type="button" class="secondary-button" data-open-day="${d.id}">เปิดแผนวันที่ ${d.label} ${icon('arrow-right')}</button></div></article>`).join('')}</div><div class="overview-slow"><div><h3>บ่ายวันอาทิตย์ เก็บไว้ให้โรงแรม</h3><p>10:30–14:30 นอนเล่น ว่ายน้ำ กินข้าว แล้วค่อยออกไปเที่ยว<br>ถ้าฝนตกหรืออยากพักต่อ ข้ามเขาตะเกียบแล้วไปตลาดได้เลย</p></div><span>4 hours<small>with nowhere to rush.</small></span></div><div class="tool-grid"><button type="button" class="secondary-button" data-action="calendar">${icon('calendar')} เก็บเวลารถไฟลงปฏิทิน</button><button type="button" class="secondary-button" data-action="essentials">${icon('bag')} เตรียมกระเป๋าทริป</button></div>`;
}

function mapPlaces(){const list=allMap?days:[selected()];const ids=[];for(const d of list)for(const e of d.events){for(const id of [e.place,e.from,e.to])if(id&&!ids.includes(id)&&(includeBangkok||id!=='bangkok'))ids.push(id);}return ids;}
function fitMap(){if(!map)return;const ids=mapPlaces();if(ids.length)map.fitBounds(L.latLngBounds(ids.map(id=>places[id].coords)),{paddingTopLeft:[45,75],paddingBottomRight:[60,58],maxZoom:14.5,animate:false});renderMarkers();}
function initMap(){
 if(!window.L){$('#map').innerHTML='<p class="map-loading">เปิดแผนที่ไม่สำเร็จ ใช้ลิงก์ Google Maps ในรายละเอียดสถานที่ได้</p>';return;}
 $('#map').innerHTML='';
 map=L.map('map',{zoomControl:false,scrollWheelZoom:false,zoomSnap:.25,center:places.beach.coords,zoom:13,minZoom:5,maxZoom:19,attributionControl:true,tapHold:false});
 map.attributionControl.setPrefix(false);
 tileLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'});
 tileLayer.on('tileload',()=>{tileLoads++;if(tileLoads>0)$('#map-status').hidden=true;});
 tileLayer.on('tileerror',()=>{tileErrors++;if(!tileLoads&&tileErrors>=4){$('#map-status').textContent='โหลดพื้นหลังแผนที่ไม่ได้ ยังดูหมุดและเส้นทางได้ หรือเปิด Google Maps ในรายละเอียด';$('#map-status').hidden=false;}});
 tileLayer.addTo(map);routeLayer=L.layerGroup().addTo(map);markerLayer=L.layerGroup().addTo(map);
 map.on('zoomend',renderMarkers);drawMap();
 new ResizeObserver(()=>{map.invalidateSize({pan:false});}).observe($('#map'));
}
function drawMap(){
 const title=allMap?'เส้นทางตลอด 3 วัน':['หัวหินในวันแรก','วันอาทิตย์ของเรา','ก่อนกลับกรุงเทพฯ'][selectedDay-1];$('#map-title').textContent=title;
 $('#all-day-key').hidden=!allMap;
 $('#all-day-key').innerHTML=days.map(d=>`<span><i style="background:${d.color}"></i>${d.label}</span>`).join('');
 const ids=mapPlaces();
 $('#place-rail').innerHTML=ids.map((id,i)=>`<button class="rail-place" type="button" data-place="${id}"><span class="rail-number">${id==='hotel'?icon('bed'):String(i+1).padStart(2,'0')}</span>${esc(places[id].short)} ${icon('arrow-up-right')}</button>`).join('');
 if(!map)return;
 routeLayer.clearLayers();markerLayer.clearLayers();markers.clear();
 const ds=allMap?days:[selected()];
 for(const d of ds){
  for(const e of d.events){
   if(e.kind==='transit'&&routeData[e.route]){
    const r=routeData[e.route];const coords=r.coordinates.map(c=>[c[1],c[0]]);
    L.polyline(coords,{color:'#fffefa',weight:8,opacity:.9,interactive:false}).addTo(routeLayer);
    const line=L.polyline(coords,{color:r.mode==='foot'?'#a2553e':allMap?d.color:'#28676b',weight:4,opacity:.85,dashArray:r.mode==='foot'?'3 7':undefined,lineCap:'round'}).addTo(routeLayer);
    line.on('click',()=>showLeg(e.id));line.bindTooltip(`${transitTitle(e)} · กันไว้ ${duration(e)} นาที`,{sticky:true,direction:'top'});
   }else if(e.kind==='train'&&includeBangkok){
    L.polyline([places[e.from].coords,places[e.to].coords],{color:'#856c38',weight:2,dashArray:'7 9',opacity:.65}).bindTooltip('เส้นเชื่อมสถานีเท่านั้น ไม่ใช่แนวรางจริง').addTo(routeLayer);
   }
  }
 }
 fitMap();
 if(includeBangkok){$('#map-status').textContent='เส้นประกรุงเทพฯ–หัวหินเป็นเส้นเชื่อมสถานี ไม่ใช่แนวรางจริง';$('#map-status').hidden=false;}
 else if(tileLoads||!tileErrors)$('#map-status').hidden=true;
}
function renderMarkers(){
 if(!map||!markerLayer)return;markerLayer.clearLayers();markers.clear();
 const ids=mapPlaces(),groups=ids.map(id=>[id]);
 // Merge pins that overlap at the current zoom. Every cluster can be expanded
 // by a real button; individual places are always available in the stop rail.
 for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
  if(groups[i].some(a=>groups[j].some(b=>map.latLngToContainerPoint(places[a].coords).distanceTo(map.latLngToContainerPoint(places[b].coords))<53))){groups[i].push(...groups[j]);groups.splice(j,1);i=-1;break;}
 }
 for(const group of groups){
  if(group.length>1){
   const center=L.latLngBounds(group.map(id=>places[id].coords)).getCenter();
   const numbers=group.map(id=>ids.indexOf(id)+1).join(' · ');
   const m=L.marker(center,{keyboard:false,zIndexOffset:300,icon:L.divIcon({className:'map-marker',iconSize:[58,44],iconAnchor:[29,22],html:`<button class="pin-cluster" type="button" data-cluster="${group.join(',')}" aria-label="ขยายกลุ่ม ${esc(group.map(id=>places[id].short).join(' และ '))}"><strong>${numbers}</strong><span>แตะขยาย</span></button>`})}).addTo(markerLayer);
   for(const id of group)markers.set(id,m);
  }else{
   const id=group[0],p=places[id],hotel=id==='hotel',i=ids.indexOf(id);
   const m=L.marker(p.coords,{keyboard:false,zIndexOffset:hotel?200:100+i,icon:L.divIcon({className:'map-marker',iconSize:hotel?[44,44]:[38,38],iconAnchor:hotel?[22,44]:[19,38],html:`<button class="pin-button ${hotel?'hotel-pin':''}" type="button" data-place="${id}" aria-label="${esc(p.name)} เปิดรายละเอียด"><span>${hotel?icon('bed'):i+1}</span></button>${hotel?'<span class="pin-name">Ayrest</span>':''}`})});
   m.bindTooltip(p.name,{direction:'top',offset:[0,-32]});m.addTo(markerLayer);markers.set(id,m);
  }
 }
}
function showDialog(html,type){
 if(!dialog.open)lastFocused=document.activeElement;dialogType=type;$('#detail-body').innerHTML=html;dialog.scrollTop=0;
 if(!dialog.open)dialog.showModal();
}
function dialogTop(label){return `<div class="dialog-top"><span>${esc(label)}</span><button class="close-button" type="button" data-action="close" aria-label="ปิดรายละเอียด">×</button></div>`;}
function showPlace(id,eventId=null){
 const p=places[id];if(!p)return;
 const active=eventId?findEvent(eventId):null;
 const context=allMap&&!visitTimes(id).length?days.find(d=>d.events.some(e=>e.place===id)):null;
 const day=active?.day??context??selected();
 const slots=active?[active.event]:visitTimes(id,day.id);
 const time=slots.length?`${slots[0].start}${slots[0].end?`–${slots[0].end}`:''}`:'';
 showDialog(`${dialogTop(`${day.weekday} ${day.label} · ${p.area}`)}${imageTag(p,'dialog-photo',false)}<div class="detail-content"><p class="eyebrow">${p.area}</p><h2 id="detail-title">${p.name}</h2><p class="detail-en" lang="en">${p.en}</p>${time?`<div class="detail-time"><span>แผนวันนี้ · ${active?esc(active.event.title):'ช่วงแวะหลัก'}</span><strong>${time}</strong></div>`:''}<p class="detail-description">${p.description}</p><div class="detail-hours"><strong>${icon('clock')}${p.hours}</strong><small>${p.hoursNote}</small></div><ul class="detail-tips">${p.tips.map(t=>`<li>${t}</li>`).join('')}</ul>${active?.event.kind==='flexible'?'<p class="notice warm">หมุดนี้เป็นจุดอ้างอิงโรงแรม ยังไม่ได้เลือกร้านอาหาร ระยะและเวลาไปร้านจะขึ้นกับร้านที่เลือกจริง</p>':''}<div class="detail-actions"><a class="primary-button" href="${mapUrl(p)}" target="_blank" rel="noopener noreferrer">เปิด Google Maps ${icon('arrow-up-right')}</a><button class="secondary-button" type="button" data-show-on-map="${id}">${icon('map')} ดูจุดนี้บนแผนที่ทริป</button></div><p class="detail-source-note">ข้อมูลตรวจเมื่อ ${trip.checked} · เวลาเปิดอาจเปลี่ยนในวันหยุด<br>พิกัดเป็นจุดอ้างอิงสถานที่ ตรวจจุดรับส่งกับคนขับอีกครั้ง</p><a class="detail-link" href="${p.source}" target="_blank" rel="noopener noreferrer">ข้อมูลสถานที่จากต้นทาง ${icon('arrow-up-right')}</a>${p.hoursSource?`<a class="detail-link" href="${p.hoursSource}" target="_blank" rel="noopener noreferrer">ที่มาของเวลาเปิด / เงื่อนไข ${icon('arrow-up-right')}</a>`:''}<button class="text-button" type="button" data-action="sources">ดูเครดิตภาพและที่มาทั้งหมด ${icon('arrow-right')}</button></div>`,'place');
 syncUrl(id);markers.forEach((m,k)=>m.getElement()?.querySelector('button')?.setAttribute('data-active',String(k===id)));
}
function showLeg(id){
 const found=findEvent(id);if(!found)return;const {event:e,day}=found,r=routeData[e.route];
 if(!r){notify('ข้อมูลเส้นทางยังไม่พร้อม ลองโหลดหน้าใหม่ขณะออนไลน์');return;}
 const b=rideBreakdown(e,r);
 showDialog(`${dialogTop(`${day.weekday} ${day.label} · ${e.start}–${e.end}`)}<div class="detail-content"><p class="eyebrow">${b.walk?'A SHORT WALK':'A LITTLE RIDE'}</p><h2 id="detail-title">${esc(places[e.from].short)}<br>ไป ${esc(places[e.to].short)}</h2><div class="detail-duration"><strong>${b.total}</strong><span>นาทีที่กันไว้ในแผน</span></div><p class="detail-en">${b.walk?'เดิน':'Grab / Bolt'} · ${distanceLabel(r.distanceMeters)} ตามเส้นทาง OSM</p><div class="route-labels"><span>เริ่ม${b.walk?'เดิน':'ออก / เรียกรถ'}<strong>${e.start}</strong></span>${icon('arrow-right')}<span>ถึงตามแผน<strong>${e.end}</strong></span></div><div class="breakdown">${b.exit?`<div><span>เดินออกจากสถานี / หาจุดรับรถ</span><strong>${b.exit} นาที</strong></div>`:''}${!b.walk?`<div><span>เผื่อเรียกรถและรอคนขับ</span><strong>${b.wait} นาที</strong></div>`:''}<div><span>${b.walk?'เวลาเดินจากแบบจำลอง':'เวลาในรถเพื่อวางแผน'} (ประมาณ)</span><strong>${b.modeled} นาที</strong></div><div><span>${b.walk?'เผื่อทางข้ามและเดินหาทาง':'เผื่อรถติดและหาจุดรับส่ง'}</span><strong>${b.extra} นาที</strong></div></div><p class="notice">${b.walk?'เส้นทางนี้ไม่เกิน 2 กม. จึงวางแผนให้เดิน ถ้าอากาศร้อนหรือเหนื่อย เปลี่ยนไปเรียกรถได้':'ระยะเกิน 2 กม. จึงใช้ Grab / Bolt ตามเงื่อนไขทริป'} เวลาเป็นประมาณการสำหรับวางแผน ไม่ใช่ ETA หรือสถานะรถแบบสด</p><div class="detail-actions"><a class="primary-button" href="${directionUrl(places[e.from],places[e.to],r.mode)}" target="_blank" rel="noopener noreferrer">เปิดเส้นทางใน Google Maps ${icon('arrow-up-right')}</a><button class="secondary-button" type="button" data-place="${e.to}">ดู ${esc(places[e.to].short)} ${icon('arrow-right')}</button></div><p class="detail-source-note">ระยะถนนและแนวเส้นจาก FOSSGIS / OpenStreetMap ตรวจ ${trip.checked}${b.walk?' · ความเร็วเดินตามแบบจำลอง FOSSGIS':' · เวลาในรถคำนวณเพื่อวางแผนที่ความเร็วสมมติ 30 กม./ชม. ปัดขึ้นทีละ 5 นาที ขั้นต่ำ 10 นาที แล้วแยกเวลาเผื่อเพิ่ม'}<br>สภาพการจราจรและรถที่พร้อมรับจริงอาจทำให้ใช้เวลามากกว่านี้</p><a class="detail-link" href="${r.source}" target="_blank" rel="noopener noreferrer">ข้อมูลเส้นทางต้นฉบับ ${icon('arrow-up-right')}</a></div>`,'route');
}
function trainCard(day){const e=day.events.find(e=>e.fixed);return `<div class="train-summary"><p class="eyebrow">${day.weekday} ${day.label} · ขบวน ${e.number}</p><h3>${places[e.from].short} → ${places[e.to].short}</h3><div class="train-route"><span><strong>${e.start}</strong>ออกเดินทาง</span>${icon('train')}<span><strong>${e.end}</strong>ถึงตามแผน</span></div><p>${day.id===1?'นัดหัวลำโพง 08:30 · เข้าชานชาลา 09:00':'เริ่มเรียกรถจาก Ayrest 13:20 · ถึงสถานี 14:05'}</p></div>`;}
function showTrains(day=0){
 const ds=day?days.filter(d=>d.id===day):days.filter(d=>d.events.some(e=>e.fixed));
 showDialog(`${dialogTop('ตั๋วเวลาเดินทางของเรา')}<div class="detail-content"><p class="eyebrow">TO THE SEA & BACK</p><h2 id="detail-title">รถไฟของทริปนี้</h2>${ds.map(trainCard).join('')}<p class="notice warm">เวลานี้เป็นกำหนดการที่ให้มาสำหรับทริป ยึดตั๋วและประกาศการรถไฟฯ ในวันเดินทางเป็นหลัก รถไฟอาจล่าช้า</p><div class="detail-actions"><button class="primary-button" type="button" data-action="calendar">${icon('calendar')} เก็บเวลาลงปฏิทิน</button><a class="secondary-button" href="https://ttsview.railway.co.th/" target="_blank" rel="noopener noreferrer">ติดตามขบวนรถไฟ ${icon('arrow-up-right')}</a><a class="secondary-button" href="https://ttsview.railway.co.th/SRT_Schedule2022.php" target="_blank" rel="noopener noreferrer">ตรวจตารางจากการรถไฟฯ ${icon('arrow-up-right')}</a></div></div>`,'trains');
}
function packingCount(){return packing.filter(([key])=>checked[key]===true).length;}
function showEssentials(){
 showDialog(`${dialogTop('พร้อมแล้วค่อยออกเดินทาง')}<div class="detail-content"><p class="eyebrow">THE LITTLE THINGS, ALL HERE</p><h2 id="detail-title">กระเป๋าทริป</h2><p class="detail-en">Tickets, notes & a few essentials.</p><div class="tool-grid"><button class="secondary-button" type="button" data-train="0">${icon('train')} เวลารถไฟ</button><button class="secondary-button" type="button" data-place="hotel">${icon('bed')} โรงแรมของเรา</button><button class="secondary-button" type="button" data-action="calendar">${icon('calendar')} ลงปฏิทิน</button><button class="secondary-button" type="button" data-action="install">${icon('download')} เพิ่มในหน้าจอหลัก</button></div><h3 class="detail-section-title">เช็กของก่อนออก <small id="packing-count">${packingCount()} / ${packing.length}</small></h3><div class="packing-list">${packing.map(([id,label])=>`<label class="packing-row"><input type="checkbox" name="${id}" data-pack="${id}" ${checked[id]===true?'checked':''}><span>${label}</span></label>`).join('')}</div><h3 class="detail-section-title">โน้ตของเรา</h3><label class="note-label" for="trip-note">ร้านที่อยากกิน หรืออะไรที่ไม่อยากลืม</label><textarea id="trip-note" class="trip-note" name="trip-note" maxlength="5000" placeholder="เจอร้านน่ากิน จดไว้ตรงนี้ได้เลย…">${esc(note)}</textarea><p class="note-status" id="note-status" role="status">${storageAvailable?'บันทึกอัตโนมัติในเครื่องนี้ · ไม่ส่งขึ้นเซิร์ฟเวอร์':'เบราว์เซอร์นี้ไม่ให้บันทึกข้อมูลในเครื่อง โน้ตอาจหายเมื่อปิดหน้า'}</p><p class="notice">เมื่อเปิดออนไลน์และเก็บไฟล์ครบแล้ว จะเปิดแผน ตั๋วเวลา และโน้ตในเครื่องได้แม้ออฟไลน์ พื้นหลังแผนที่ Google Maps และตำแหน่งสดต้องใช้อินเทอร์เน็ต</p><button class="detail-link" type="button" data-action="sources">วิธีคำนวณเวลาและเครดิตภาพ ${icon('arrow-right')}</button></div>`,'essentials');
}
function showSources(){
 showDialog(`${dialogTop('ข้อมูลที่ใช้วางแผน')}<div class="detail-content"><p class="eyebrow">A FEW NOTES ON THE PLAN</p><h2 id="detail-title">ข้อมูล เส้นทาง และภาพ</h2><p class="detail-description">ตรวจข้อมูลเมื่อ ${trip.checked} แผนนี้ตั้งใจให้ยืดหยุ่น ยกเว้นเวลารถไฟที่เก็บตามกำหนดการของทริป</p><h3 class="detail-section-title">ระยะและเวลาเดินทาง</h3><p class="notice">ระยะทางและเส้นทางถนนมาจาก OpenStreetMap ผ่าน FOSSGIS / OSRM เก็บไว้ในเว็บ จึงไม่ต้องรอคำนวณเส้นทางใหม่ทุกครั้ง แต่ไม่ใช่ข้อมูลจราจรแบบสด</p><p class="detail-description">เวลาในรถใช้สมมติฐานเพื่อวางแผนที่ 30 กม./ชม. จากระยะถนนจริง ปัดขึ้นทีละ 5 นาที ขั้นต่ำ 10 นาที ส่วนเวลาเดินใช้แบบจำลองเส้นทางเดินของ FOSSGIS แล้วเพิ่มเวลาเผื่อในแผน แยกเวลารอรถ รถติด เดินออกจากสถานี และทางข้ามไว้ในรายละเอียดแต่ละช่วง</p><p class="detail-description">ทุกเส้นทางที่เกิน 2 กม. ใช้ Grab / Bolt ร้านอาหารเช้าและมื้อกลางวันยังไม่เลือก หมุดในช่วงนั้นอ้างอิงโรงแรม จึงยังไม่มีระยะไปร้าน สมมติฐานเรื่องเวลาอาจคลาดเคลื่อน ตรวจ ETA ในแอปจริงก่อนออก</p><p class="notice warm">เส้นประที่เชื่อมกรุงเทพฯ กับหัวหินใช้บอกสถานีต้นทางและปลายทางเท่านั้น ไม่ใช่แนวรางจริง ไม่ได้ใช้เส้นตรงนั้นคำนวณระยะเดินทาง</p><h3 class="detail-section-title">แหล่งข้อมูล</h3>${sources.map(s=>`<a class="detail-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ${icon('arrow-up-right')}</a>`).join('')}<h3 class="detail-section-title">พิกัดสถานที่</h3>${Object.values(places).map(p=>`<a class="detail-link" href="${p.coordSource}" target="_blank" rel="noopener noreferrer">${p.name} · ${p.coords.join(', ')} ${icon('arrow-up-right')}</a>`).join('')}<h3 class="detail-section-title">เครดิตภาพสถานที่จริง</h3><p class="detail-source-note">ภาพใช้ประกอบสถานที่ บรรยากาศอาจเปลี่ยนจากวันที่ถ่าย ย่อและแปลงเป็น WebP; หน้าจอครอปตามกรอบ ภาพโรงแรมและ ททท. มีลิขสิทธิ์ของต้นทาง ส่วนภาพ Commons ใช้ตามสัญญาอนุญาตด้านล่าง</p>${credits.map(c=>`<div class="credit-row"><img src="./${esc(c.file)}" width="75" height="63" alt="${esc(c.id)}" loading="lazy"><div><p>${esc(c.author)}</p><a href="${esc(c.source)}" target="_blank" rel="noopener noreferrer">${esc(c.id)} · ดูภาพต้นฉบับ ↗</a><small>${esc(c.license)}${c.licenseUrl?` · <a href="${esc(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">สัญญาอนุญาต</a>`:''}</small></div></div>`).join('')}<h3 class="detail-section-title">ข้อมูลในมือถือ</h3><p class="detail-source-note">เช็กลิสต์และโน้ตเก็บในเบราว์เซอร์เครื่องนี้ ไม่ได้ซิงก์ไปหาอีกคน การแชร์ลิงก์แชร์เพียงหน้าแผนและวันที่เลือก การล้างข้อมูลเว็บไซต์จะลบโน้ตและรายการที่ติ๊กไว้ แผนที่พื้นหลัง © OpenStreetMap contributors · ตัวแสดงผล Leaflet · ฟอนต์ IBM Plex Sans Thai (OFL)</p></div>`,'sources');
}
function downloadCalendar(){const a=document.createElement('a');a.href='./train-times.ics';a.download='hua-hin-trains-5-7-dec-2026.ics';document.body.append(a);a.click();a.remove();notify('เปิดไฟล์ปฏิทินเพื่อนำเข้าเวลาเดินทาง 2 ขบวน');}
async function share(){
 const data={title:'Hua Hin, with you. · 5–7 ธ.ค. 2026',text:'แผนทริปหัวหินของเรา',url:location.href};
 try{if(navigator.share){await navigator.share(data);return;}await navigator.clipboard.writeText(data.url);notify('คัดลอกลิงก์แผนนี้แล้ว');}
 catch(e){if(e.name==='AbortError')return;showDialog(`${dialogTop('แชร์ลิงก์ทริป')}<div class="detail-content"><h2 id="detail-title">ลิงก์แผนของเรา</h2><label class="note-label" for="share-link">คัดลอกลิงก์นี้ไปส่งได้เลย</label><input class="trip-note" id="share-link" name="share-link" value="${esc(data.url)}" readonly></div>`,'share');}
}
let installPrompt;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
async function install(){if(installPrompt){await installPrompt.prompt();installPrompt=null;}else notify('เมนูเบราว์เซอร์ ⋮ หรือปุ่มแชร์ → เพิ่มลงในหน้าจอหลัก');}
function closeDialog(){if(dialog.open)dialog.close();syncUrl();}
dialog.addEventListener('close',()=>{dialogType='';syncUrl();markers.forEach(m=>m.getElement()?.querySelector('button')?.removeAttribute('data-active'));if(lastFocused?.isConnected)lastFocused.focus({preventScroll:true});});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.cluster){const ids=b.dataset.cluster.split(',').filter(id=>places[id]);if(ids.length&&map)map.fitBounds(L.latLngBounds(ids.map(id=>places[id].coords)),{padding:[90,90],maxZoom:17.5,animate:false});return;}
 if(b.dataset.day){chooseDay(Number(b.dataset.day));return;}
 if(b.dataset.openDay){chooseDay(Number(b.dataset.openDay));setView('timeline',{scroll:true});return;}
 if(b.dataset.view){setView(b.dataset.view,{scroll:window.matchMedia('(max-width:700px)').matches});return;}
 if(b.dataset.place){showPlace(b.dataset.place);return;}
 if(b.dataset.event){const found=findEvent(b.dataset.event);if(found)showPlace(found.event.place,b.dataset.event);return;}
 if(b.dataset.leg){showLeg(b.dataset.leg);return;}
 if(b.dataset.train!==undefined){showTrains(Number(b.dataset.train));return;}
 if(b.dataset.showOnMap){const id=b.dataset.showOnMap;closeDialog();if(id==='bangkok')includeBangkok=true;setView('map',{scroll:true});drawMap();requestAnimationFrame(()=>{map?.setView(places[id].coords,id==='bangkok'?14:15,{animate:false});markers.get(id)?.openTooltip();});return;}
 const action=b.dataset.action;
 if(action==='close')closeDialog();
 else if(action==='essentials')showEssentials();
 else if(action==='sources')showSources();
 else if(action==='share')await share();
 else if(action==='calendar')downloadCalendar();
 else if(action==='install')await install();
 else if(action==='today'){const d=days.find(d=>d.date===bangkokDay());chooseDay(d?.id??1);setView('timeline',{scroll:true});if(!d)notify('เปิดวันแรกของทริปให้แล้ว · 5 ธันวาคม 2026');}
 else if(action==='current'){const c=currentEvent(days);if(c){chooseDay(c.day.id);setView('timeline',{scroll:true});requestAnimationFrame(()=>$('#event-'+c.event.id)?.scrollIntoView({behavior:'smooth',block:'center'}));}}
});
document.addEventListener('change',e=>{const input=e.target;if(!input.matches('[data-pack]'))return;checked[input.dataset.pack]=input.checked;const ok=writeLocal('hh-trip-packing-v1',checked);const count=$('#packing-count');if(count)count.textContent=`${packingCount()} / ${packing.length}`;if(!ok)notify('เครื่องนี้ไม่ให้บันทึกเช็กลิสต์ การติ๊กจะอยู่เฉพาะตอนเปิดหน้านี้');});
document.addEventListener('input',e=>{if(e.target.id!=='trip-note')return;note=e.target.value;const ok=writeLocal('hh-trip-note-v1',note);$('#note-status').textContent=ok?'บันทึกแล้วในเครื่องนี้ · ไม่ส่งขึ้นเซิร์ฟเวอร์':'บันทึกไม่ได้ คัดลอกโน้ตเก็บไว้ก่อนปิดหน้า';});
$('#map-all').addEventListener('click',()=>{allMap=!allMap;$('#map-all').setAttribute('aria-pressed',String(allMap));$('#map-all').innerHTML=`${allMap?'กลับมาดูวันนี้':'ดูทุกวัน'} ${icon('layers')}`;drawMap();});
$('#bangkok-toggle').addEventListener('click',()=>{includeBangkok=!includeBangkok;$('#bangkok-toggle').setAttribute('aria-pressed',String(includeBangkok));$('#bangkok-toggle').innerHTML=`${includeBangkok?'เฉพาะหัวหิน':'รวมกรุงเทพฯ'} ${icon('train')}`;drawMap();});
$('#fit-map').addEventListener('click',fitMap);$('#zoom-in').addEventListener('click',()=>map?.zoomIn());$('#zoom-out').addEventListener('click',()=>map?.zoomOut());
$('#locate').addEventListener('click',()=>{
 if(!navigator.geolocation){notify('เบราว์เซอร์นี้ไม่รองรับตำแหน่ง ใช้หมุดสถานที่แทนได้');return;}
 const b=$('#locate');b.disabled=true;notify('กำลังหาตำแหน่งของคุณ…');
 navigator.geolocation.getCurrentPosition(p=>{b.disabled=false;if(!map)return;const point=[p.coords.latitude,p.coords.longitude];geoMarker?.remove();geoMarker=L.circleMarker(point,{radius:7,weight:3,color:'#fff',fillColor:'#3676c7',fillOpacity:1}).addTo(map).bindTooltip('ตำแหน่งของฉัน · คลาดเคลื่อนประมาณ '+Math.round(p.coords.accuracy)+' ม.');map.setView(point,15);notify('แสดงตำแหน่งแล้ว ไม่ได้บันทึกหรือส่งไปเก็บที่เซิร์ฟเวอร์');},error=>{b.disabled=false;notify(error.code===1?'ยังไม่ได้อนุญาตตำแหน่ง ดูจากหมุดสถานที่หรือเปิด Google Maps ได้':'หาตำแหน่งไม่สำเร็จ ลองอีกครั้งเมื่อสัญญาณดีขึ้น');},{timeout:12000,maximumAge:60000,enableHighAccuracy:false});
});
window.addEventListener('popstate',()=>{const p=new URLSearchParams(location.search),day=Number(p.get('day'));if(days.some(d=>d.id===day))selectedDay=day;view=['timeline','map','overview'].includes(p.get('view'))?p.get('view'):'timeline';if(dialog.open)closeDialog();chooseDay(selectedDay);setView(view);if(p.get('place')&&places[p.get('place')])showPlace(p.get('place'));});
function connectivity(){const foot=$('#offline-state');if(!navigator.onLine){foot.textContent='ออฟไลน์ · เปิดแผนและโน้ตได้ แผนที่พื้นหลังต้องใช้อินเทอร์เน็ต';if(map){$('#map-status').textContent='ออฟไลน์ · เส้นทางและหมุดยังดูได้ พื้นหลังแผนที่ต้องใช้อินเทอร์เน็ต';$('#map-status').hidden=false;}}}
window.addEventListener('offline',()=>{connectivity();notify('ออฟไลน์ · ยังดูแผนและโน้ตที่เก็บไว้ได้');});
window.addEventListener('online',()=>{$('#offline-state').textContent='กลับมาออนไลน์แล้ว';tileLayer?.redraw();notify('กลับมาออนไลน์แล้ว');});

const initialView=view;
mountIcons();updateCountdown();renderTimeline();chooseDay(selectedDay);setView(initialView);
const firstPlace=params.get('place');
Promise.allSettled([fetch('./routes.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}),fetch('./photo-credits.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();})]).then(results=>{
 if(results[0].status==='fulfilled')routeData=results[0].value.routes;else notify('ข้อมูลระยะทางโหลดไม่สำเร็จ ลองเปิดใหม่ขณะออนไลน์');
 if(results[1].status==='fulfilled')credits=results[1].value;
 renderTimeline();initMap();if(view==='overview')renderOverview();
 if(firstPlace&&places[firstPlace])showPlace(firstPlace);
 connectivity();
});
setInterval(()=>{updateCountdown();renderCurrent();},60000);
if('serviceWorker' in navigator)window.addEventListener('load',async()=>{try{
 const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
 const updateState=async()=>{const ready=await caches.has('hh-trip-v1');if(ready&&navigator.onLine)$('#offline-state').textContent='เก็บแผนในเครื่องแล้ว · แผนที่พื้นหลังใช้อินเทอร์เน็ต';};
 navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='HH_CACHE_READY')updateState();});await reg.update();updateState();
 }catch{$('#offline-state').textContent='ใช้งานออนไลน์ · เครื่องนี้ยังเก็บแผนออฟไลน์ไม่ได้';}});
