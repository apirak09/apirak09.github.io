import test from 'node:test';
import assert from 'node:assert/strict';
import { Flight, tuning } from '../engine.mjs';
import { Renderer } from '../renderer.mjs';
function recorder() {
 const calls = [], gradient = () => ({addColorStop() {}});
 const c = new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient }, { get(target,key){ if(key in target)return target[key]; return (...args)=>calls.push([key,...args]); } });
 return {c,calls};
}
test('offscreen Wrath always paints its viewport-wide warning and active beam',()=>{
 const r=Object.create(Renderer.prototype);r.width=333;
 for(const time of [90,180,360]){
  const f=new Flight('hell',333);f.threat=tuning('hell',time);f.speed=f.threat.speed;
  const e=f.spawnSin('wrath',r.width+500);e.triggered=true;e.y=320;
  e.timer=e.warning*.3;const warning=recorder();r.drawSin(warning.c,e,f,12);
  assert.ok(warning.calls.some(a=>a[0]==='lineTo' && a[1]===r.width && a[2]===320),`visible dashed warning at ${time}s`);
  e.timer=e.warning+.1;const active=recorder();r.drawSin(active.c,e,f,12);
  assert.ok(active.calls.some(a=>a[0]==='fillRect' && a[1]===0 && a[3]===r.width && a[4]===22),`visible live beam at ${time}s`);
 }
});
