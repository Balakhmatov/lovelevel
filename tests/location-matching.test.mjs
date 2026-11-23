import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../server/index.mjs';
import {scoreEvidence} from '../server/match-scoring.mjs';
import {distanceKm,cityKey} from '../server/matching-location.mjs';
const p=(self={})=>({self:{gender:'male',interests:[],...self},wanted:{gender:'female'}});
test('Same city raises score, unrelated Novgorods do not match, and shorter distances score higher',()=>{
 const a=p({location:'Великий Новгород'}),b={self:{gender:'female',location:'Великий Новгород'},wanted:{gender:'male'}},c={...b,self:{...b.self,location:'Нижний Новгород'}};
 assert.equal(scoreEvidence(a,b).score,11);assert.equal(scoreEvidence(a,c).score,1);assert.equal(cityKey('СПб'),cityKey('Санкт-Петербург'));
 a.matchingLocation={latitude:0,longitude:0};b.matchingLocation={latitude:0,longitude:1};c.matchingLocation={latitude:0,longitude:10};
 const near=scoreEvidence(a,b),far=scoreEvidence(a,c);assert.ok(near.score>far.score);assert.ok(near.distanceKm<far.distanceKm);assert.equal(Math.round(near.matches.reduce((s,m)=>s+m.points,0)*100)/100,near.score);
 assert.equal(distanceKm(null,c.matchingLocation),null);
});
test('Location requires login and explicit consent, stores coarse coordinates and never returns them in metadata',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-geo-')),origin='http://127.0.0.1:3118',app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 try{let r=await call('/api/auth/register',{method:'POST',body:{name:'Тестовый участник',birthdate:'1995-01-01',email:'geo@example.test',password:'geo-test-password',adult:true,terms:true,gender:'male'}});const cookie=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/api/location')).status,401);
 assert.equal((await call('/api/location',{cookie,method:'PATCH',body:{latitude:55.7558,longitude:37.6173}})).status,400);
 assert.equal((await call('/api/location',{cookie,method:'PATCH',requestOrigin:'https://other.test',body:{city:'Москва'}})).status,403);
 assert.equal((await call('/api/location',{cookie,method:'PATCH',body:{latitude:91,longitude:0,consent:true}})).status,400);
 r=await call('/api/location',{cookie,method:'PATCH',body:{latitude:55.7558,longitude:37.6173,consent:true}});assert.equal(r.status,200);let meta=await r.json();assert.equal(meta.enabled,true);assert.ok(!('latitude' in meta));assert.ok(!('longitude' in meta));
 const row=app.sqlite.prepare('SELECT * FROM matchlove_locations').get();assert.equal(row.latitude,55.76);assert.equal(row.longitude,37.62);
 assert.equal((await call('/api/location',{cookie,method:'PATCH',body:{city:'Москва'}})).status,200);
 meta=await(await call('/api/location',{cookie,method:'DELETE'})).json();assert.equal(meta.enabled,false);assert.equal(meta.city,'Москва');assert.equal(app.sqlite.prepare('SELECT latitude FROM matchlove_locations').get().latitude,null);
 const html=await(await fetch(base+'/')).text();assert.ok(html.includes('Включить геолокацию'));const policy=(await fetch(base+'/')).headers.get('Permissions-Policy');assert.ok(policy.includes('geolocation=(self)'));
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
});
