export const MEET_AT = '2026-11-07T08:35:00+07:00';
export const END_AT = '2026-11-07T17:40:00+07:00';
export function countdown(now = Date.now()) {
  const seconds = Math.max(0, Math.floor((Date.parse(MEET_AT) - Number(now)) / 1000));
  return {days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60, met: Number(now) >= Date.parse(MEET_AT), ended: Number(now) >= Date.parse(END_AT)};
}
export function clock(minutes) {return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}
export function minuteOfDay(time) {const [h,m]=time.split(':').map(Number);return h*60+m;}
export function buildSchedule(stops, legs) {
  let t=minuteOfDay('08:35');
  return stops.map((s,i)=>{const arrival=t;t+=s.stay;if(i<legs.length)t+=legs[i].minutes;return {...s,arrival,departure:arrival+s.stay};});
}
export function distanceLabel(m) {return m >= 1000 ? `${(m/1000).toFixed(1)} กม.` : `${Math.round(m/10)*10} ม.`;}
