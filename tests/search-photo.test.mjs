import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from '../server/index.mjs';
const origin='http://127.0.0.1:3118';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhioAAAAASUVORK5CYII=','base64');
test('Gallery converts to WebP, persists, enforces 30, and isolates private and main profile photos',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-search-photo-'));let app,base;
 const start=async()=>{app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base='http://127.0.0.1:'+app.server.address().port;};
 const stop=()=>new Promise(resolve=>{app.server.closeAllConnections();app.server.close(resolve)});
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,...(cookie?{Cookie:cookie}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
 const account=email=>({email,password:'photo-test-password',gender:'female',adult:true,terms:true});
 const upload=(cookie,bytes=png,mime='image/png',requestOrigin=origin)=>{const form=new FormData();form.set('file',new File([bytes],'photo.png',{type:mime}));return call('/api/search-photo',{method:'POST',cookie,body:form,requestOrigin});};
 try{
  await start();let r=await call('/api/auth/register',{method:'POST',body:account('photo-a@example.test')});assert.equal(r.status,201);let a=r.headers.get('set-cookie').split(';')[0];
  r=await call('/api/auth/register',{method:'POST',body:account('photo-b@example.test')});const b=r.headers.get('set-cookie').split(';')[0];
  const aId=app.sqlite.prepare('SELECT id FROM auth_accounts WHERE email=?').get('photo-a@example.test').id;
  const bId=app.sqlite.prepare('SELECT id FROM auth_accounts WHERE email=?').get('photo-b@example.test').id;
  assert.equal((await upload(null)).status,401);assert.equal((await upload(a,png,'image/png','https://other.example')).status,403);
  assert.equal((await upload(a,Buffer.from('<svg/>'),'image/svg+xml')).status,400);
  assert.equal((await upload(a,Buffer.from([137,80,78,71,13,10,26,10]),'image/png')).status,400);
  r=await upload(a);assert.equal(r.status,200);let saved=await r.json();assert.equal(saved.photos.length,1);assert.equal(saved.photos[0].main,true);assert.equal(saved.url,saved.photos[0].url);const first=saved.photos[0];
  r=await call(saved.url,{cookie:a});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/webp');assert.match(r.headers.get('cache-control'),/no-store/);const webp=Buffer.from(await r.arrayBuffer());assert.equal(webp.toString('ascii',8,12),'WEBP');
  assert.equal((await call(saved.url,{cookie:b})).status,404);assert.equal((await call(saved.url)).status,401);assert.equal((await(await call('/api/search-photo-info',{cookie:b})).json()).url,null);
  assert.equal((await upload(a,Buffer.alloc(8*1024*1024+1))).status,413);
  r=await upload(a);assert.equal(r.status,200);saved=await r.json();assert.equal(saved.photos.length,2);assert.equal(saved.url,first.url);const second=saved.photos.find(p=>p.id!==first.id);
  assert.equal((await call('/api/search-photo',{method:'PATCH',cookie:b,body:{id:second.id}})).status,404);
  assert.equal((await call('/api/search-photo',{method:'DELETE',cookie:b,body:{id:first.id}})).status,404);
  r=await call('/api/search-photo',{method:'PATCH',cookie:a,body:{id:second.id}});saved=await r.json();assert.equal(saved.url,second.url);assert.equal(saved.photos.filter(p=>p.main).length,1);
  assert.equal((await call('/api/profile-photo?user='+aId,{cookie:b})).status,404);
  app.sqlite.prepare('INSERT INTO matchlove_profiles(user,source,parsed,updated) VALUES(?,?,?,?)').run(aId,'test','{}',new Date().toISOString());
  assert.equal((await call('/api/profile-photo?user='+aId,{cookie:b})).status,200);
  app.sqlite.prepare('INSERT INTO blocks(sender,recipient,created) VALUES(?,?,?)').run(aId,bId,new Date().toISOString());assert.equal((await call('/api/profile-photo?user='+aId,{cookie:b})).status,404);app.sqlite.prepare('DELETE FROM blocks').run();
  await stop();await start();r=await call('/api/auth/login',{method:'POST',body:account('photo-a@example.test')});assert.equal(r.status,200);a=r.headers.get('set-cookie').split(';')[0];
  saved=await(await call('/api/search-photo-info',{cookie:a})).json();assert.equal(saved.photos.length,2);assert.equal(saved.url,second.url);assert.deepEqual(Buffer.from(await(await call(saved.url,{cookie:a})).arrayBuffer()),webp);
  r=await call('/api/search-photo',{method:'DELETE',cookie:a,body:{id:second.id}});saved=await r.json();assert.equal(saved.url,first.url);assert.equal(saved.photos.length,1);
  for(let i=1;i<30;i++)app.sqlite.prepare('INSERT INTO matchlove_photos VALUES(?,?,?,?,?,?)').run('fill-'+i,aId,'image/webp',webp,0,new Date().toISOString());
  assert.equal((await upload(a)).status,409);assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_photos WHERE user=?').get(aId).n,30);
  await call('/api/auth/logout',{method:'POST',cookie:a,body:{}});assert.equal((await call(saved.url,{cookie:a})).status,401);
  app.sqlite.prepare('DELETE FROM auth_accounts WHERE id=?').run(aId);assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_photos').get().n,0);
 }finally{if(app?.server.listening)await stop();await rm(dir,{recursive:true,force:true});}
});
test('Gallery migration keeps the legacy photo as main without duplicating the original',async()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA foreign_keys=ON;CREATE TABLE auth_accounts(id TEXT PRIMARY KEY);CREATE TABLE matchlove_search_photos(user TEXT PRIMARY KEY,mime TEXT,data BLOB,updated TEXT);');db.prepare('INSERT INTO auth_accounts VALUES(?)').run('legacy');db.prepare('INSERT INTO matchlove_search_photos VALUES(?,?,?,?)').run('legacy','image/png',png,'2026-11-17');db.exec(await readFile('drizzle/0008_photo_gallery.sql','utf8'));const row=db.prepare('SELECT * FROM matchlove_photos').get();assert.equal(row.user,'legacy');assert.equal(row.is_main,1);assert.deepEqual(Buffer.from(row.data),png);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matchlove_search_photos').get().n,0);}finally{db.close();}
});
