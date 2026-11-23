import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../server/index.mjs';
test('Account gender is required, returned in me, editable, and updates defaults without overriding explicit wishes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-gender-'));const origin='http://127.0.0.1:3118',app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 try{
  const account={name:'Тестовый участник',birthdate:'1995-01-01',email:'gender@example.test',password:'test-password-12345',adult:true,terms:true};
  assert.equal((await call('/api/auth/register',{method:'POST',body:account})).status,400);
  let r=await call('/api/auth/register',{method:'POST',body:{...account,gender:'female'}});assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0];let me=await(await call('/api/me',{cookie})).json();assert.equal(me.gender,'female');
  const parsed={self:{gender:'female'},wanted:{gender:'male'},genderPreferenceExplicit:false};app.sqlite.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(me.id,'a'.repeat(100),JSON.stringify(parsed),new Date().toISOString());
  assert.equal((await call('/api/account-gender',{method:'PATCH',body:{gender:'male'}})).status,401);
  assert.equal((await call('/api/account-gender',{method:'PATCH',cookie,body:{gender:'male'},requestOrigin:'https://other.test'})).status,403);
  assert.equal((await call('/api/account-gender',{method:'PATCH',cookie,body:{gender:'invalid'}})).status,400);
  r=await call('/api/account-gender',{method:'PATCH',cookie,body:{gender:'male'}});assert.equal(r.status,200);me=await(await call('/api/me',{cookie})).json();assert.equal(me.gender,'male');
  let stored=JSON.parse(app.sqlite.prepare('SELECT parsed FROM matchlove_profiles WHERE user=?').get(me.id).parsed);assert.equal(stored.self.gender,'male');assert.equal(stored.wanted.gender,'female');
  stored={...stored,genderPreferenceExplicit:true,wanted:{gender:'female'}};app.sqlite.prepare('UPDATE matchlove_profiles SET parsed=? WHERE user=?').run(JSON.stringify(stored),me.id);
  assert.equal((await call('/api/account-gender',{method:'PATCH',cookie,body:{gender:'female'}})).status,200);stored=JSON.parse(app.sqlite.prepare('SELECT parsed FROM matchlove_profiles WHERE user=?').get(me.id).parsed);assert.equal(stored.self.gender,'female');assert.equal(stored.wanted.gender,'female');
  assert.equal((await(await call('/api/auth/session',{cookie})).json()).gender,'female');
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
});
