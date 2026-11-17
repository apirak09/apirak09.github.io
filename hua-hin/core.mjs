export const minutes = value => value.split(':').reduce((a,v,i)=>a+Number(v)*(i===0?60:1),0);
export function duration(event) { return event.end ? minutes(event.end)-minutes(event.start) : null; }
export function durationLabel(n) {
  if(n===null) return 'พักต่อได้เลย';
  const h=Math.floor(n/60),m=n%60;
  return h?`${h} ชม.${m?` ${m} นาที`:''}`:`${m} นาที`;
}
export function distanceLabel(m) { return m<1000?`${Math.round(m/10)*10} ม.`:`${(m/1000).toFixed(1)} กม.`; }
export function countdown(now,start,end) {
  const a=new Date(start).getTime(),b=new Date(end).getTime(),n=new Date(now).getTime();
  if(n>=b) return {state:'ended'};
  if(n>=a) return {state:'during'};
  const remaining=Math.max(0,Math.floor((a-n)/1000));
  return {state:'before',days:Math.floor(remaining/86400),hours:Math.floor(remaining%86400/3600),minutes:Math.floor(remaining%3600/60)};
}
export function bangkokDay(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function currentEvent(days,now=new Date()) {
  const day=days.find(d=>d.date===bangkokDay(now)); if(!day)return null;
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
  const n=minutes(clock);const event=day.events.find(e=>minutes(e.start)<=n&&(!e.end||minutes(e.end)>n));
  return event?{day,event}:null;
}
export function mapUrl(place) { return `https://www.google.com/maps/search/?api=1&query=${place.coords.join(',')}`; }
export function directionUrl(a,b,mode) { return `https://www.google.com/maps/dir/?api=1&origin=${a.coords.join(',')}&destination=${b.coords.join(',')}&travelmode=${mode==='foot'?'walking':'driving'}`; }
export function rideBreakdown(event,route) {
  const total=duration(event), walk=route?.mode==='foot';
  // A planning assumption, not a live ETA. Urban rides use 30 km/h and
  // round up to 5 minutes; explicit waiting and extra slack are separate.
  const modeled=walk?Math.ceil((route?.modelSeconds??0)/60):Math.max(10,Math.ceil(((route?.distanceMeters??0)/1000/30*60)/5)*5);
  const base=event.wait+(event.exit??0);
  return {total,walk,modeled,wait:event.wait,exit:event.exit??0,extra:Math.max(0,total-base-modeled)};
}
export function calendarFile(days) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hua Hin With You//Trip//TH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  const escape=s=>s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  for(const day of days)for(const e of day.events.filter(e=>e.fixed)) {
    const stamp=t=>new Date(`${day.date}T${t}:00+07:00`).toISOString().replace(/[-:]/g,'').replace('.000','');
    lines.push('BEGIN:VEVENT',`UID:huahin-2026-${e.id}@apirak09.github.io`,'DTSTAMP:20261118T000000Z',`DTSTART:${stamp(e.start)}`,`DTEND:${stamp(e.end)}`,`SUMMARY:${escape(e.title)}`,`DESCRIPTION:${escape(e.text+' เวลาอ้างอิงตามแผนทริป ตรวจตั๋วจริงอีกครั้ง')}`,'BEGIN:VALARM','TRIGGER:-PT60M','ACTION:DISPLAY',`DESCRIPTION:${escape(e.title)}`,'END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.join('\r\n')+'\r\n';
}
