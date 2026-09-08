import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS,destination,occupants,validate,primeAt,pair,unpair,decimalRows,missingDigits} from '../core.mjs';
const config=(chapter,strategy,k=3,extra={})=>({chapter,strategy,k,custom:false,...extra});
const successful=[config('one','shift'),config('party','shift',40),config('bus','double'),config('buses','lanes',3),config('fleet','prime'),config('fleet','diagonal')];

test('all six chapters exist and explain the whole set, not only a finite sample',()=>{
  assert.equal(CHAPTERS.length,6);for(const c of CHAPTERS)assert.ok(c.proof.length>100);
});
test('canonical countable assignments preserve distinct guests across groups',()=>{
  for(const c of successful){
    assert.ok(validate(c).ok);const used=new Set();
    const groups=c.chapter==='fleet'?25:c.chapter==='buses'?c.k:1;
    for(let b=0;b<=groups;b++)for(let s=1;s<=(b>0&&c.chapter==='one'?1:b>0&&c.chapter==='party'?c.k:80);s++){
      const room=destination(c,b,s);assert.ok(room>0n);assert.ok(!used.has(room.toString()),JSON.stringify(c)+` collision at ${room}`);used.add(room.toString());
    }
  }
});
test('inverse room lookup agrees with forward assignment, including distant residents',()=>{
  for(const c of successful){
    const groups=c.chapter==='fleet'?8:c.chapter==='buses'?c.k:1;
    for(let b=0;b<=groups;b++)for(let s=1;s<=(b>0&&c.chapter==='one'?1:b>0&&c.chapter==='party'?c.k:15);s++){
      const r=destination(c,b,s);if(r>1000000n)continue;
      assert.deepEqual(occupants(c,r),[{bus:BigInt(b),seat:BigInt(s)}]);
    }
  }
  assert.deepEqual(occupants(config('party','shift',40),999999n),[{bus:0n,seat:999959n}]);
});
test('prime powers preserve gaps and decode large primes and powers correctly',()=>{
  const c=config('fleet','prime');
  for(const room of [1n,6n,10n,12n,15n,30n,1000000n])assert.deepEqual(occupants(c,room),[]);
  assert.deepEqual(occupants(c,59049n),[{bus:1n,seat:10n}]);
  assert.deepEqual(occupants(c,524288n),[{bus:0n,seat:19n}]);
  const last=occupants(c,999983n)[0];assert.equal(last.seat,1n);assert.equal(last.bus,78497n);
  assert.equal(primeAt(0),2n);assert.equal(primeAt(1),3n);assert.equal(primeAt(5),13n);
  assert.throws(()=>occupants(c,1000001n),RangeError);
});
test('the diagonal pairing is a bijection through 20,000 rooms',()=>{
  for(let r=1n;r<=20000n;r++){const {bus,seat}=unpair(r);assert.equal(pair(bus,seat),r);}
  for(let b=0n;b<80n;b++)for(let s=1n;s<80n;s++)assert.deepEqual(unpair(pair(b,s)),{bus:b,seat:s});
});
test('BigInt keeps distant destinations exact beyond floating point precision',()=>{
  const n=900719925474099312n;
  assert.equal(destination(config('bus','double'),0,n),1801439850948198624n);
  const r=10n**100n+123456n,g=unpair(r);assert.equal(pair(g.bus,g.seat),r);
  assert.equal(destination(config('fleet','prime'),1,100),3n**100n);
});
test('known wrong strategies produce explicit mathematical counterexamples',()=>{
  for(const c of [config('one','local'),config('party','small',40),config('bus','small'),config('bus','triple'),config('buses','double',3),config('fleet','sum')]){
    const result=validate(c);assert.equal(result.ok,false);assert.ok(result.room>0n);assert.ok(occupants(c,result.room).length>1);
  }
  assert.equal(validate(config('one','last')).ok,false);
  assert.throws(()=>destination(config('one','last'),1,1),/no last room/);
  assert.deepEqual(occupants(config('one','last'),1n),[{bus:0n,seat:1n}]);
});
test('custom affine rules are validated for positivity, injectivity and disjoint groups',()=>{
  for(const id of ['one','party','bus','buses'])for(let a=0;a<=12;a++)for(let c=-10;c<=100;c++){
    const setup=config(id,'shift',7,{custom:true,a,c});
    const actual=validate(setup).ok;
    const assigned=new Set();let sampledValid=true;
    for(let n=1;n<=110;n++){
      const r=destination(setup,0,n);
      if(r<1n||assigned.has(r.toString())||occupants(setup,r).some(g=>g.bus>0n)){sampledValid=false;break;}
      assigned.add(r.toString());
    }
    assert.equal(actual,sampledValid,`${id}, a=${a}, c=${c}`);
  }
});
test('correct but sparse custom assignments are allowed',()=>{
  for(const c of [config('one','shift',1,{custom:true,a:3,c:0}),config('bus','double',1,{custom:true,a:4,c:2}),config('buses','lanes',3,{custom:true,a:8,c:4})])assert.ok(validate(c).ok);
  assert.equal(occupants(config('bus','double',1,{custom:true,a:4,c:2}),4n).length,0);
});
test('residents move before arrivals and no sampled cutoff drops guests',()=>{
  const c=config('bus','double');
  assert.deepEqual(occupants(c,999999n,false),[]);
  assert.deepEqual(occupants(c,999998n,false),[{bus:0n,seat:499999n}]);
  assert.deepEqual(occupants(c,999999n,true),[{bus:1n,seat:500000n}]);
});
test('Cantor construction differs from each displayed row at its own diagonal',()=>{
  for(let seed=1;seed<=100;seed++){
    const rows=decimalRows(seed),missing=missingDigits(rows);
    rows.forEach((row,i)=>{assert.notEqual(row[i],missing[i]);assert.ok([1,2].includes(missing[i]));});
  }
  assert.notDeepEqual(decimalRows(5),decimalRows(6));assert.deepEqual(decimalRows(5),decimalRows(5));
  assert.equal(validate(config('limit','')).ok,false);
});
test('bounded prime queries fail clearly rather than freezing on unbounded input',()=>{
  assert.throws(()=>primeAt(501),RangeError);
  assert.throws(()=>destination(config('fleet','prime'),1,1001),RangeError);
  assert.throws(()=>pair(-1,1),RangeError);assert.throws(()=>unpair(0),RangeError);
});
