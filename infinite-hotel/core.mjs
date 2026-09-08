// Rooms and guest indices start at 1. Bus 0 denotes the existing residents.
// Every mapping is symbolic: the visible tiles are never the whole hotel.
export const CHAPTERS = [
  {id:'one', name:'One more guest', short:'One guest', mark:'+1', arrivals:'1 guest', title:'Every room is taken. One guest arrives.', intro:'Give the newcomer a room without evicting anyone. You can change every resident’s room with one rule.', identity:'ℵ₀ + 1 = ℵ₀', options:[['shift','Shift every resident','n → n + 1'],['last','Use the last room','n → n; guest → last'],['local','Move only resident 1','1 → 2; others stay']], hint:'There is no last room. What if every resident moves one room forward?', proof:'For any resident n, the destination n + 1 exists. Distinct residents get distinct rooms, and none gets room 1. The newcomer takes room 1. This rule accounts for every resident, even though there is no final resident.', insight:'“Every room is occupied” does not mean “no one else can fit.”'},
  {id:'party', name:'A finite crowd', short:'A crowd', mark:'+k', arrivals:'k guests', title:'Now a whole party needs rooms.', intro:'Choose the size of the party, then make room for all of them. New guest j will take room j.', identity:'ℵ₀ + k = ℵ₀', options:[['shift','Shift by the party size','n → n + k'],['small','Shift just one room','n → n + 1'],['stay','Keep everyone in place','n → n']], hint:'Reserve rooms 1 through k. Where should the first resident go?', proof:'With k new guests, resident n moves to n + k and new guest j takes j, for 1 ≤ j ≤ k. The residents occupy exactly the rooms above k; newcomers occupy exactly the first k. The sets are disjoint and together fill the hotel.', insight:'Any finite number of extra guests fits using the same idea.'},
  {id:'bus', name:'An infinite bus', short:'One bus', mark:'+∞', arrivals:'ℵ₀ passengers', title:'One bus. Infinitely many passengers.', intro:'Seats are numbered 1, 2, 3, … with no last seat. Passenger s will take odd room 2s − 1. Find a rule for the residents.', identity:'ℵ₀ + ℵ₀ = ℵ₀', options:[['double','Move residents to even rooms','n → 2n'],['small','Move one room forward','n → n + 1'],['triple','Triple their room numbers','n → 3n']], hint:'The odd rooms are reserved. Which infinite set of rooms remains?', proof:'Resident n takes 2n. Passenger s takes 2s − 1. The even and odd positive integers never overlap, and each set can be numbered 1, 2, 3, … . Every old guest and every passenger gets exactly one room.', insight:'An infinite set can have the same size as a proper subset of itself.'},
  {id:'buses', name:'Several infinite buses', short:'Many buses', mark:'k × ∞', arrivals:'k infinite buses', title:'Several buses. Every one is infinite.', intro:'Give each bus its own repeating lane of room numbers, and leave one lane for the existing residents.', identity:'(k + 1) × ℵ₀ = ℵ₀', options:[['lanes','Create a lane for every group','resident n → (k + 1)n'],['double','Use only even and odd rooms','resident n → 2n'],['small','Shift by the number of buses','resident n → n + k']], hint:'For k buses you need k + 1 lanes, including the hotel residents.', proof:'Put m = k + 1. Residents take mn. Passenger s on bus b takes m(s − 1) + b, where 1 ≤ b ≤ k. Every positive room number has exactly one remainder modulo m. Remainder 0 is for residents; remainder b is for bus b.', insight:'A finite number of countably infinite groups is still countable.'},
  {id:'fleet', name:'Infinitely many buses', short:'Infinite buses', mark:'∞ × ∞', arrivals:'ℵ₀ infinite buses', title:'An infinite queue of infinite buses.', intro:'There is no largest bus number. Give every pair (bus, seat) its own room. Compare the video’s prime powers with a compact diagonal assignment.', identity:'ℵ₀ × ℵ₀ = ℵ₀', options:[['prime','Prime powers · from the video','resident → 2ⁿ; bus b → pᵦˢ'],['diagonal','Diagonal order · explore further','enumerate (bus, seat) pairs'],['sum','Add bus and seat numbers','room = bus + seat']], hint:'A pair needs a unique address. Can different primes share a positive power? Can you list a grid along diagonals?', proof:'Prime powers: assign residents base 2 and each bus a distinct odd prime pᵦ. Seat s takes pᵦˢ. Unique prime factorization prevents collisions, but rooms such as 1, 6 and 10 stay empty. Diagonal order: treat residents as bus 0 and enumerate pairs by increasing b + s − 1. Each diagonal is finite, so every pair is reached.', insight:'Infinitely many infinite buses fit. Some correct assignments leave infinitely many rooms empty.'},
  {id:'limit', name:'A bigger infinity', short:'The limit', mark:'>ℵ₀', arrivals:'Uncountably many guests', title:'Is there an infinity that cannot fit?', intro:'Imagine a guest for every infinite decimal made only of 1s and 2s. Try listing them by room. We can always construct a guest missing from that list.', identity:'|{1, 2}ᴺ| > ℵ₀', options:[], hint:'Change digit i of the guest in room i. The new guest differs from every listed guest in at least one place.', proof:'For any proposed complete list, define a new decimal: its i-th digit is 2 if room i’s guest has digit 1 there, and 1 otherwise. It differs from the guest in every room i at digit i, so it cannot be on the list. Digits 1 and 2 avoid the ambiguity of decimal expansions ending in 9s. The table illustrates finitely many steps; the argument applies to every i.', insight:'“Infinity” is not a single size. This hotel has countably many rooms.'}
];

const primes=[2,3];
export function primeAt(bus){
  const index=Number(bus);
  if(!Number.isInteger(index)||index<0||index>500)throw new RangeError('Bus must be 0–500.');
  for(let x=primes.at(-1)+2;primes.length<=index;x+=2){
    if(primes.every(p=>p*p>x||x%p!==0))primes.push(x);
  }
  return BigInt(primes[index]);
}
export function pair(bus,seat){
  const b=BigInt(bus), s=BigInt(seat);
  if(b<0n||s<1n)throw new RangeError('Bus ≥ 0 and seat ≥ 1.');
  const d=b+s-1n;
  return d*(d+1n)/2n+b+1n;
}
export function sqrtBigInt(n){
  if(n<0n)throw new RangeError('Nonnegative integer required.');
  if(n<2n)return n;
  let x=n, y=(x+1n)/2n;
  while(y<x){x=y;y=(x+n/x)/2n;}
  return x;
}
export function unpair(room){
  const r=BigInt(room);if(r<1n)throw new RangeError('Room ≥ 1.');
  const z=r-1n, d=(sqrtBigInt(8n*z+1n)-1n)/2n, b=z-d*(d+1n)/2n;
  return {bus:b,seat:d-b+1n};
}
export function affine(config){
  if(config.custom)return {a:BigInt(config.a),c:BigInt(config.c)};
  const {chapter,strategy,k}=config, K=BigInt(k);
  if(chapter==='one')return {a:1n,c:strategy==='shift'?1n:0n};
  if(chapter==='party')return {a:1n,c:strategy==='shift'?K:strategy==='small'?1n:0n};
  if(chapter==='bus')return {a:strategy==='double'?2n:strategy==='triple'?3n:1n,c:strategy==='small'?1n:0n};
  return {a:strategy==='lanes'?K+1n:strategy==='double'?2n:1n,c:strategy==='small'?K:0n};
}
export function destination(config,bus,seat){
  const b=BigInt(bus),s=BigInt(seat),K=BigInt(config.k);
  if(b<0n||s<1n)throw new RangeError('Bus ≥ 0 and guest ≥ 1.');
  if(!config.custom&&config.chapter==='one'&&config.strategy==='last'&&b>0n)throw new RangeError('There is no last room.');
  if(config.chapter==='fleet'){
    if(config.strategy==='prime'){
      if(s>1000n)throw new RangeError('Preview supports seats up to 1,000.');
      return primeAt(b)**s;
    }
    return config.strategy==='diagonal'?pair(b,s):b+s;
  }
  if(b===0n){
    if(!config.custom&&config.chapter==='one'&&config.strategy==='local')return s===1n?2n:s;
    const {a,c}=affine(config);return a*s+c;
  }
  if(config.chapter==='one'||config.chapter==='party')return s;
  if(config.chapter==='bus')return 2n*s-1n;
  return (K+1n)*(s-1n)+b;
}
export const guestName=(g)=>g.bus===0n?`Resident ${g.seat}`:`${g.bus===1n?'Bus 1':`Bus ${g.bus}`} · seat ${g.seat}`;
const guest=(bus,seat)=>({bus:BigInt(bus),seat:BigInt(seat)});
function arrivalsAt(config,r){
  const {chapter,k}=config,K=BigInt(k);
  if(chapter==='one'||chapter==='party')return r<=BigInt(chapter==='one'?1:k)?[guest(1,r)]:[];
  const m=chapter==='bus'?2n:K+1n, b=r%m;
  return b===0n?[]:[guest(b,(r-b)/m+1n)];
}
// Prime-power inverse for room windows ≤ 1,000,000. It factors the room,
// not a finite prefix of guests, so distant residents are not dropped.
let sieveLimit=0,smallestFactor,primeRank;
function ensureSieve(limit){
  if(limit<=sieveLimit)return;
  sieveLimit=Math.min(1000000,Math.max(256,limit,sieveLimit*2));
  smallestFactor=new Uint32Array(sieveLimit+1);primeRank=new Uint32Array(sieveLimit+1);
  let rank=0;
  for(let i=2;i<=sieveLimit;i++){
    if(!smallestFactor[i]){
      smallestFactor[i]=i;primeRank[i]=rank++;
      if(i*i<=sieveLimit)for(let j=i*i;j<=sieveLimit;j+=i)if(!smallestFactor[j])smallestFactor[j]=i;
    }
  }
}
function primeOccupant(r){
  let n=Number(r);if(n<2)return [];
  ensureSieve(n);const p=smallestFactor[n];
  let e=0;while(n%p===0){n/=p;e++;}
  if(n!==1)return [];
  return [guest(primeRank[p],e)];
}
const primeCache=new Map();
export function occupants(config,room,includeArrivals=true){
  const r=BigInt(room);if(r<1n)return [];
  if(!config.custom&&config.chapter==='one'&&config.strategy==='last')return [guest(0,r)];
  if(config.chapter==='fleet'){
    if(config.strategy==='diagonal'){
      const g=unpair(r);return includeArrivals||g.bus===0n?[g]:[];
    }
    if(config.strategy==='prime'){
      if(r>1000000n)throw new RangeError('Prime room window is limited to 1,000,000.');
      const key=r.toString();
      if(!primeCache.has(key)){
        if(primeCache.size>300)primeCache.clear();
        primeCache.set(key,primeOccupant(r));
      }
      return primeCache.get(key).filter(g=>includeArrivals||g.bus===0n);
    }
    const result=[guest(0,r)];
    if(includeArrivals)for(let b=1n;b<r&&b<5n;b++)result.push(guest(b,r-b));
    return result;
  }
  const result=[];
  if(!config.custom&&config.chapter==='one'&&config.strategy==='local'){
    if(r===2n)result.push(guest(0,1));
    if(r>1n)result.push(guest(0,r));
  }else{
    const {a,c}=affine(config),x=r-c;
    if(a===0n&&r===c)result.push(guest(0,1),guest(0,2));
    if(a>0n&&x>=a&&x%a===0n)result.push(guest(0,x/a));
  }
  return includeArrivals?result.concat(arrivalsAt(config,r)):result;
}
export function validate(config){
  const bad=(title,detail,room=null)=>({ok:false,title,detail,room});
  if(config.chapter==='limit')return bad('There is always a missing guest.','A room list cannot include every infinite sequence of 1s and 2s.');
  if(config.chapter==='fleet'){
    if(config.strategy==='sum')return bad('Two guests, one room.','Resident 2 and bus 1, seat 1 both get room 2. Addition loses the identity of the pair.',2n);
    return {ok:true,title:config.strategy==='prime'?'Everyone fits. Gaps are allowed.':'Every pair fits. Every room is used.',detail:config.strategy==='prime'?'Distinct prime bases have no equal positive powers. Empty rooms such as 6 do not mean guests were lost.':'Each finite diagonal is completed before the next. Every (bus, seat) pair appears exactly once.'};
  }
  if(!config.custom&&config.chapter==='one'){
    if(config.strategy==='last')return bad('There is no last room.','For every room n there is another room n + 1. “The last room” is not a valid address.');
    if(config.strategy==='local')return bad('Room 2 has two residents.','Resident 1 moves into resident 2’s room. The move must apply to everyone.',2n);
  }
  const {a,c}=affine(config);
  if(a===0n)return bad('All residents get the same room.','A constant rule cannot assign distinct rooms to distinct residents.',c>0n?c:null);
  if(a<0n)return bad('Room numbers eventually become negative.','Every resident needs a positive integer destination.');
  if(a+c<1n)return bad('Resident 1 has no valid room.',`This rule sends resident 1 to ${a+c}. Room numbers start at 1.`);
  if(config.chapter==='one'||config.chapter==='party'){
    const count=BigInt(config.chapter==='one'?1:config.k);
    if(a+c<=count)return bad('A resident meets a newcomer.',`Resident 1 and new guest ${a+c} both receive room ${a+c}.`,a+c);
    return {ok:true,title:'Every guest has a unique room.',detail:`Resident destinations strictly increase, starting at ${a+c}. New guests use rooms 1–${count}, so the two groups cannot overlap.`};
  }
  const m=BigInt(config.chapter==='bus'?2:config.k+1);
  if(a%m!==0n||c%m!==0n){
    for(let n=1n;n<=m;n++){
      const r=a*n+c,b=r%m;
      if(b>0n)return bad('Two groups share a room.',`Resident ${n} and bus ${b}, seat ${(r-b)/m+1n} both receive room ${r}.`,r);
    }
  }
  return {ok:true,title:'Every group has its own lane.',detail:`Resident rooms are positive multiples of ${m}. Bus passengers use all the other remainders. Each rule is one-to-one, and the groups never overlap.`};
}
export function decimalRows(seed=1,size=7){
  let x=seed>>>0;
  return Array.from({length:size},()=>Array.from({length:size},()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return (x>>>30)%2+1;}));
}
export const missingDigits=rows=>rows.map((row,i)=>row[i]===1?2:1);
