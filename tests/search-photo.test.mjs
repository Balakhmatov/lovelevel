import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../server/index.mjs';
const origin='http://127.0.0.1:3118';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhioAAAAASUVORK5CYII=','base64');
test('Search photo persists across restart and login, is private, and is replaced atomically',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-search-photo-'));let app,base;
 const start=async()=>{app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base='http://127.0.0.1:'+app.server.address().port;};
 const stop=()=>new Promise(resolve=>{app.server.closeAllConnections();app.server.close(resolve)});
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const account=email=>({email,password:'photo-test-password',gender:'female',adult:true,terms:true});
 const upload=(cookie,bytes=png,mime='image/png',requestOrigin=origin)=>{const form=new FormData();form.set('file',new File([bytes],'photo.png',{type:mime}));return call('/api/search-photo',{method:'POST',cookie,body:form,requestOrigin});};
 try{
  await start();let r=await call('/api/auth/register',{method:'POST',body:account('photo-a@example.test')});assert.equal(r.status,201);let a=r.headers.get('set-cookie').split(';')[0];
  r=await call('/api/auth/register',{method:'POST',body:account('photo-b@example.test')});const b=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await upload(null)).status,401);assert.equal((await upload(a,png,'image/png','https://other.example')).status,403);
  assert.equal((await upload(a,Buffer.from('<svg/>'),'image/svg+xml')).status,400);
  r=await upload(a);assert.equal(r.status,200);const saved=await r.json();assert.ok(saved.url.startsWith('/api/search-photo?v='));
  r=await call(saved.url,{cookie:a});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.match(r.headers.get('cache-control'),/no-store/);assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);
  assert.equal((await call(saved.url,{cookie:b})).status,404);assert.equal((await call(saved.url)).status,401);assert.equal((await(await call('/api/search-photo-info',{cookie:b})).json()).url,null);
  assert.equal((await upload(a,Buffer.alloc(8*1024*1024+1))).status,413);assert.deepEqual(Buffer.from(await(await call(saved.url,{cookie:a})).arrayBuffer()),png);
  await stop();await start();
  r=await call('/api/auth/login',{method:'POST',body:account('photo-a@example.test')});assert.equal(r.status,200);a=r.headers.get('set-cookie').split(';')[0];
  const info=await(await call('/api/search-photo-info',{cookie:a})).json();assert.ok(info.url);assert.deepEqual(Buffer.from(await(await call(info.url,{cookie:a})).arrayBuffer()),png);
  assert.equal((await upload(a,png)).status,200);assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_search_photos').get().n,1);
  await call('/api/auth/logout',{method:'POST',cookie:a,body:{}});assert.equal((await call(info.url,{cookie:a})).status,401);
  app.sqlite.prepare('DELETE FROM auth_accounts WHERE email=?').run('photo-a@example.test');assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_search_photos').get().n,0);
 }finally{if(app?.server.listening)await stop();await rm(dir,{recursive:true,force:true});}
});
