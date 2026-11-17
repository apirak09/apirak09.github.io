import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function setup(){
 const handlers={},entries=new Map(),deleted=[],cachedFiles=[];
 const base='https://example.com/hua-hin/';
 const cache={async addAll(files){cachedFiles.push(...files);for(const f of files)entries.set(new URL(f,base).href,new Response(f));},async match(key){return entries.get(typeof key==='string'?key:key.url)?.clone();},async put(key,r){entries.set(typeof key==='string'?key:key.url,r);}};
 const self={registration:{scope:base},addEventListener(t,fn){handlers[t]=fn;},async skipWaiting(){},clients:{async claim(){},async matchAll(){return [];}}};
 const caches={async open(){return cache;},async keys(){return ['other-app-v1','hh-trip-v0','hh-trip-v1'];},async delete(k){deleted.push(k);}};
 vm.runInNewContext(script,{self,caches,URL,Request,Response,Set,fetch:async()=>{throw Error('offline');}});
 return {handlers,cache,entries,deleted,cachedFiles,base};
}
test('offline install assets exist and activation preserves other apps caches',async()=>{
 const s=setup();let p;s.handlers.install({waitUntil(x){p=x;}});await p;
 for(const f of s.cachedFiles)if(f!=='./')await access(new URL('../'+f,import.meta.url));
 s.handlers.activate({waitUntil(x){p=x;}});await p;assert.deepEqual(s.deleted,['hh-trip-v0']);
});
test('offline deep links return the cached app shell',async()=>{
 const s=setup();await s.cache.addAll(['./index.html','./app.mjs','./routes.json']);let p;
 s.handlers.fetch({request:{method:'GET',url:s.base+'?day=2&view=map',mode:'navigate'},respondWith(x){p=x;}});
 assert.equal(await (await p).text(),'./index.html');
});
test('offline static files return cached bytes',async()=>{
 const s=setup();await s.cache.addAll(['./routes.json']);let p;
 s.handlers.fetch({request:new Request(s.base+'routes.json'),respondWith(x){p=x;}});
 assert.equal(await (await p).text(),'./routes.json');
});
test('service worker leaves third-party tiles and sibling websites untouched',()=>{
 const s=setup();for(const url of ['https://tile.openstreetmap.org/1/1/1.png','https://example.com/siam-walk/app.mjs','https://example.com/']){
  let intercepted=false;s.handlers.fetch({request:new Request(url),respondWith(){intercepted=true;}});assert.equal(intercepted,false,url);
 }
});
