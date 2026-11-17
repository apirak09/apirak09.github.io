import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {trip,days,places} from '../trip-data.mjs';
import {minutes,duration,countdown,bangkokDay,currentEvent,directionUrl,rideBreakdown,calendarFile} from '../core.mjs';
const root=new URL('../',import.meta.url);
const routes=JSON.parse(await readFile(new URL('routes.json',root),'utf8')).routes;

test('protected train times and correct local dates',()=>{
 assert.deepEqual(days.map(d=>d.date),['2026-12-05','2026-12-06','2026-12-07']);
 const trains=days.flatMap(d=>d.events).filter(e=>e.fixed);
 assert.deepEqual(trains.map(e=>[e.number,e.start,e.end,e.from,e.to]),[
  ['261','09:20','13:50','bangkok','station'],['262','14:56','19:20','station','bangkok']]);
 assert.equal(days[0].events[0].start,'08:30');
});
test('all schedule events are ordered, continuous, and non-overlapping',()=>{
 const ids=new Set();
 for(const d of days)for(let i=0;i<d.events.length;i++){
  const e=d.events[i];assert(!ids.has(e.id));ids.add(e.id);
  if(e.end)assert(duration(e)>0,`${e.id} needs a positive duration`);
  if(i>0)assert.equal(d.events[i-1].end,e.start,`${e.id} has an unmarked gap or overlap`);
  if(!e.end)assert.equal(i,d.events.length-1);
  for(const p of [e.place,e.from,e.to])if(p)assert(places[p]);
 }
});
test('all rides have real road geometry and enforce the 2 km rule',()=>{
 for(const d of days)for(const e of d.events.filter(e=>e.kind==='transit')){
  const r=routes[e.route];assert(r,`${e.id} missing route`);
  assert.equal(r.from,e.from);assert.equal(r.to,e.to);assert(r.distanceMeters>0);assert(r.coordinates.length>2);
  if(r.distanceMeters>2000)assert.equal(r.mode,'car');
  if(r.mode==='foot')assert(r.distanceMeters<=2000);
  assert(r.waypoints.every(p=>p.distance<100),'route snapping too far from the real place');
 }
});
test('every transfer allowance adds up and includes enough time',()=>{
 for(const d of days)for(const e of d.events.filter(e=>e.kind==='transit')){
  const b=rideBreakdown(e,routes[e.route]);
  assert(b.extra>=0);assert(b.modeled+b.wait+b.exit<=b.total,`${e.id}: insufficient time`);
  assert.equal(b.modeled+b.wait+b.exit+b.extra,b.total);
  if(!b.walk)assert(b.wait>=10);
 }
});
test('rest, checkout and train buffers satisfy the brief',()=>{
 const rest=days[1].events.find(e=>e.id==='slow-sunday');assert.equal(duration(rest),240);
 assert.equal(days[1].events.at(-1).start,'21:30');
 assert.equal(days[2].events.find(e=>e.id==='checkout').end,'12:00');
 assert.equal(duration(days[2].events.find(e=>e.id==='station-buffer')),51);
 assert(minutes(days[0].events.at(-1).start)<=21*60);
});
test('Bangkok timezone at date boundary does not depend on viewer timezone',()=>{
 assert.equal(bangkokDay(new Date('2026-12-04T18:00:00Z')),'2026-12-05');
 assert.equal(currentEvent(days,new Date('2026-12-05T02:20:00Z')).event.id,'train-out');
 assert.equal(currentEvent(days,new Date('2026-12-07T07:56:00Z')).event.id,'train-back');
 assert.equal(currentEvent(days,new Date('2026-12-07T12:20:00Z')).event.id,'arrive-bangkok');
});
test('countdown covers before, during and after without negative values',()=>{
 assert.deepEqual(countdown('2026-12-04T01:30:00Z',trip.start,trip.end),{state:'before',days:1,hours:0,minutes:0});
 assert.equal(countdown(trip.start,trip.start,trip.end).state,'during');
 assert.equal(countdown(trip.end,trip.start,trip.end).state,'ended');
});
test('Google directions use correct coordinates and travel modes',()=>{
 const u=new URL(directionUrl(places.beach,places.night,'foot'));
 assert.equal(u.searchParams.get('travelmode'),'walking');assert.equal(u.searchParams.get('origin'),places.beach.coords.join(','));
 assert.equal(new URL(directionUrl(places.hotel,places.takiab,'car')).searchParams.get('travelmode'),'driving');
});
test('calendar exports both trains in UTC, preserving Bangkok local time',()=>{
 const ics=calendarFile(days);assert.equal(ics.match(/BEGIN:VEVENT/g).length,2);
 assert(ics.includes('DTSTART:20261205T022000Z'));assert(ics.includes('DTEND:20261205T065000Z'));
 assert(ics.includes('DTSTART:20261207T075600Z'));assert(ics.includes('DTEND:20261207T122000Z'));
 assert(!/(?<!\r)\n/.test(ics));
});
test('every location has an actual local photograph and source attribution',async()=>{
 const credits=JSON.parse(await readFile(new URL('photo-credits.json',root),'utf8'));
 for(const p of Object.values(places)){
  assert(p.coords.length===2&&p.coords.every(Number.isFinite));assert(new URL(p.coordSource));
  const c=credits.find(c=>c.id===p.image);assert(c,`missing credit: ${p.image}`);assert(c.author&&c.license&&c.source);
  await access(new URL(`assets/${p.image}.webp`,root));
 }
});
