import { REGIONS } from './data.js';
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gauss=(x,z,cx,cz,r)=>Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
function rawHeight(x,z){
  const noise=Math.sin(x*.033)*Math.cos(z*.026)*2.2+Math.sin(x*.091+z*.068)*.6;
  let h=2.3+noise;
  h+=gauss(x,z,-140,-100,93)*7;
  h+=gauss(x,z,-155,140,90)*18+gauss(x,z,-220,180,45)*10;
  h+=gauss(x,z,150,-155,70)*46+gauss(x,z,210,-200,42)*28+gauss(x,z,92,-222,45)*31;
  h-=gauss(x,z,135,110,83)*7;
  // Land around the wetland terminal and islands makes both paths and swimming meaningful.
  h+=gauss(x,z,135,115,19)*7+gauss(x,z,185,75,19)*7+gauss(x,z,95,165,22)*7;
  const central=smooth(46,76,Math.hypot(x,z));h=2*(1-central)+h*central;
  return h;
}
export function height(x,z){const h=rawHeight(x,z),flat=1-smooth(17,30,Math.hypot(x-140,z+145));return h*(1-flat)+rawHeight(140,-145)*flat;}
export function regionAt(x,z){if(Math.hypot(x,z)<74)return REGIONS[0];if(z<0)return x<0?REGIONS[1]:REGIONS[4];return x<0?REGIONS[3]:REGIONS[2];}
export function terrainColor(x,z){const r=regionAt(x,z),h=height(x,z);if(r.id==='campus')return [0.48,.60,.47];
  if(r.id==='forest')return [.32+(h/110),.52+(h/110),.31];
  if(r.id==='wetland')return h<.45?[.29,.42,.40]:[.49,.66,.44];
  if(r.id==='wind')return [.67+h*.001,.66+h*.001,.40];
  const snow=smooth(26,40,h);return [.49*(1-snow)+.88*snow,.55*(1-snow)+.93*snow,.56*(1-snow)+.97*snow];
}
export function seeded(seed=1913){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
