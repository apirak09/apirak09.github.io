import test from 'node:test';
import assert from 'node:assert/strict';
import {countdown, MEET_AT, buildSchedule, clock} from './core.mjs';
import {stops, legs, meta} from './trip-data.mjs';

test('meeting is Saturday 7 November, 08:35 Bangkok, regardless of browser timezone',()=>{
  const utc=Date.parse('2026-11-07T01:35:00Z');
  assert.equal(Date.parse(MEET_AT),utc);
  assert.equal(new Date(utc).getUTCDay(),6);
  assert.deepEqual(countdown(utc-((86400+2*3600+3*60+4)*1000)),{days:1,hours:2,minutes:3,seconds:4,met:false,ended:false});
  assert.equal(countdown(utc).met,true);
  assert.equal(countdown(utc).seconds,0);
  assert.deepEqual(countdown(Date.parse('2026-11-07T17:40:00+07:00')),{days:0,hours:0,minutes:0,seconds:0,met:true,ended:true});
});

test('every walk fits between departures and arrivals, with the requested stop budgets',()=>{
  const plan=buildSchedule(stops,legs);
  assert.deepEqual(plan.map(s=>clock(s.arrival)),['08:35','08:50','10:30','11:40','13:05','15:40','16:30','17:30']);
  for(let i=0;i<legs.length;i++){
    assert.equal(plan[i+1].arrival-plan[i].departure,legs[i].minutes);
    assert(legs[i].minutes*60>=legs[i].routingSeconds,'budget must cover the routing estimate');
    assert(legs[i].coordinates.length>1);
    for(const [lat,lon] of legs[i].coordinates){assert(lat>13.73&&lat<13.76);assert(lon>100.51&&lon<100.54);}
  }
  assert.equal(plan[1].stay,60);
  assert.equal(plan[2].stay,60);
  assert.equal(plan[4].stay,120);
  assert.equal(clock(plan.at(-1).departure),'17:40');
  assert.equal(meta.distanceMeters,legs.reduce((s,l)=>s+l.distance,0));
  assert.equal(meta.walkingMinutes,145);
});
