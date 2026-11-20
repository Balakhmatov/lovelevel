import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {once} from 'node:events';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../server/index.mjs';
const origin='http://127.0.0.1:3118';
test('HTTP routing authenticates admin, records real actions and forwards reports without opening sockets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'matchlove-admin-'));
 const instance=createServer({origin,dataDir:directory,secureCookies:false,adminIds:'owner'}),db=instance.sqlite;
 const cookies={};for(const id of ['owner','alice','bob']){
  db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.test','unused',Date.now(),'female');
  const token=randomBytes(32).toString('hex');cookies[id]='lovelevel_local='+token;
  db.prepare('INSERT INTO auth_sessions(token_hash,account,expires,created) VALUES(?,?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+3600000,Date.now());
  db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'',JSON.stringify({self:{name:id}}),new Date().toISOString());
 }
 async function call(path,{user,body,headers={}}={}){
  const bytes=body?Buffer.from(JSON.stringify(body)):null;
  const req=Readable.from(bytes?[bytes]:[]);Object.assign(req,{url:path,method:body?'POST':'GET',headers:{origin,'content-type':'application/json',...(user?{cookie:cookies[user]}:{}),...headers},socket:{remoteAddress:'127.0.0.1'}});
  const chunks=[];const res=new Writable({write(chunk,encoding,next){chunks.push(Buffer.from(chunk));next();}});
  res.writeHead=(status,headers)=>{res.statusCode=status;res.headers=headers;res.headersSent=true;};
  const finished=once(res,'finish');instance.server.emit('request',req,res);await finished;
  return {status:res.statusCode,headers:res.headers,json:()=>JSON.parse(Buffer.concat(chunks).toString())};
 }
 try{
  assert.equal((await call('/api/admin/analytics',{headers:{'x-lovelevel-user-id':'owner'}})).status,403);
  assert.equal((await call('/api/admin/analytics',{user:'alice'})).status,403);
  const sid='route-session-123456';assert.equal((await call('/api/analytics',{user:'alice',body:{session:sid,visitor:'route-visitor-123456',page:'home',seconds:0,source:'vk'}})).status,200);
  for(const [sender,recipient] of [['alice','bob'],['bob','alice']])db.prepare('INSERT INTO likes VALUES(?,?,?)').run(sender,recipient,new Date().toISOString());
  assert.equal((await call('/api/ml-chat',{user:'alice',headers:{'x-analytics-session':sid},body:{target:'bob',body:'Hello'}})).status,200);
  assert.equal(db.prepare('SELECT session FROM analytics_events WHERE name=?').get('message').session,sid);
  assert.equal((await call('/api/report',{user:'alice',body:{target:'bob',reason:'Spam',block:true}})).status,200);
  assert.equal((await call('/api/ml-chat',{user:'bob',body:{target:'alice',body:'Blocked'}})).status,403);
  const queue=await call('/api/admin/queue',{user:'owner'});assert.equal(queue.status,200);assert.equal(queue.json().reports.length,1);
  const report=queue.json().reports[0];assert.equal((await call('/api/admin/resolve',{user:'owner',body:{id:report.id}})).status,200);
  const analytics=await call('/api/admin/analytics?days=30',{user:'owner'});assert.equal(analytics.status,200);assert.equal(analytics.json().totals.visitors,1);
  assert.equal(analytics.headers['cache-control'],'no-store');
  assert.equal((await call('/api/admin/users',{user:'owner'})).json().users.length,2);
 }finally{instance.server.emit('close');await rm(directory,{recursive:true,force:true});}
});
