import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI} from '../server/matchlove-ai.mjs';
import {handleAnalytics,recordProductEvent} from '../server/admin-analytics.mjs';
import {handleModeration} from '../server/moderation.mjs';
import {handleSocial} from '../server/matchlove-social.mjs';
const origin='https://example.test',now=Date.parse('2026-11-20T12:00:00Z');
const request=(path,body,foreign=false)=>new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:foreign?'https://other.test':origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
function setup(){const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);for(const [id,created] of [['a',now-9*86400000],['b',now-86400000],['admin',now]]){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.test','unused',created,'female');db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'source',JSON.stringify({self:{name:id}}),new Date(now).toISOString());}return db;}
const beat={session:'test-session-123456',visitor:'test-visitor-123456',page:'home',seconds:0,source:'vk',medium:'cpc',campaign:'test',landing:'/'};
test('Analytics requires same origin, validates events, binds sessions, caps time and rate-limits',async()=>{
 const db=setup();try{const call=(body,userId='a',time=now,foreign=false)=>handleAnalytics(request('/api/analytics',body,foreign),{sqlite:db,userId,now:time,ip:'test'});
 assert.equal((await call(beat,'a',now,true)).status,403);
 assert.equal((await call({...beat,seconds:31})).status,400);
 assert.equal((await call({...beat,page:'secret?email=test'})).status,400);
 assert.equal((await call(beat)).status,200);
 await call({...beat,seconds:30},'a',now+5000);
 await call({...beat,seconds:30},'a',now+6000);
 assert.equal(db.prepare('SELECT active_seconds FROM analytics_sessions').get().active_seconds,6);
 assert.equal((await call(beat,'b',now+7000)).status,403);
 assert.equal((await call(beat,null,now+7000)).status,403);
 for(let i=0;i<125;i++)await call(beat,'a',now+8000);
 assert.equal((await call(beat,'a',now+8000)).status,429);
 }finally{db.close();}
});
test('Owner analytics excludes admins and calculates registration cohort, attribution, retention and users',async()=>{
 const db=setup();try{
 const insert=db.prepare('INSERT INTO analytics_sessions(id,visitor,user,started,seen,active_seconds,source,medium,campaign) VALUES(?,?,?,?,?,?,?,?,?)');
 insert.run('a-start','v-a','a',now-9*86400000,now-9*86400000,30,'vk','cpc','test');
 insert.run('a-d1','v-a','a',now-8*86400000,now-8*86400000,20,'direct','','');
 insert.run('a-d7','v-a','a',now-2*86400000,now,40,'direct','','');
 insert.run('admin-start','v-admin','admin',now-1000,now,300,'internal','','');
 insert.run('guest-start','v-guest',null,now-1000,now,15,'direct','','');
 for(const [sender,recipient] of [['a','b'],['b','a']])db.prepare('INSERT INTO likes VALUES(?,?,?)').run(sender,recipient,new Date(now).toISOString());
 db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run('m','a','b','Hi',new Date(now).toISOString());
 const req=request('/api/admin/analytics?days=30');
 assert.equal((await handleAnalytics(req,{sqlite:db,userId:'a',adminIds:'admin',now})).status,403);
 assert.equal((await handleAnalytics(req,{sqlite:db,adminIds:'admin',now})).status,403);
 const result=await(await handleAnalytics(req,{sqlite:db,userId:'admin',adminIds:'admin',now})).json();
 assert.equal(result.totals.sessions,4);assert.equal(result.totals.visitors,2);assert.equal(result.totals.active_seconds,105);assert.equal(result.totals.online,1);
 assert.deepEqual(result.funnel,{registered:2,profile:2,liked:2,matched:2,chatted:1});
 assert.deepEqual(result.retention.d1,{eligible:1,returned:1});assert.deepEqual(result.retention.d7,{eligible:1,returned:1});
 assert.equal(result.sources.find(s=>s.source==='vk').registrations,1);
 const users=await(await handleAnalytics(request('/api/admin/users'),{sqlite:db,userId:'admin',adminIds:'admin',now})).json();assert.equal(users.users.length,2);assert.equal(users.users.find(u=>u.id==='a').active_seconds,90);
 assert.equal((await handleAnalytics(request('/api/admin/analytics?days=abc'),{sqlite:db,userId:'admin',adminIds:'admin',now})).status,400);
 }finally{db.close();}
});
test('Only successful server actions become product events; account deletion removes analytics data',()=>{
 const db=setup();try{const req=request('/api/ml-chat',{target:'b',body:'hello'});recordProductEvent(db,req,'a',new Response('{}',{status:403}),now);assert.equal(db.prepare('SELECT count(*) n FROM analytics_events').get().n,0);recordProductEvent(db,req,'a',new Response('{}'),now);assert.equal(db.prepare('SELECT name FROM analytics_events').get().name,'message');db.prepare("DELETE FROM auth_accounts WHERE id='a'").run();assert.equal(db.prepare('SELECT count(*) n FROM analytics_events').get().n,0);}finally{db.close();}
});
test('Report validates ownership and CSRF, and atomic block stops actual chat and likes in both directions',async()=>{
 const db=setup();try{
 for(const [sender,recipient] of [['a','b'],['b','a']])db.prepare('INSERT INTO likes VALUES(?,?,?)').run(sender,recipient,new Date().toISOString());
 db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run('m','b','a','message',new Date().toISOString());
 const call=(path,body,userId='a',foreign=false)=>handleModeration(request(path,body,foreign),{sqlite:db,userId});
 assert.equal((await call('/api/block',{target:'b'},null)).status,401);assert.equal((await call('/api/block',{target:'b'},'a',true)).status,403);assert.equal((await call('/api/block',{target:'a'})).status,400);
 assert.equal((await call('/api/report',{target:'b',reason:'Spam',message:'unrelated'})).status,403);
 assert.equal((await call('/api/report',{target:'b',reason:'Spam',message:'m',block:true})).status,200);
 assert.equal(db.prepare('SELECT reason FROM reports').get().reason,'Spam');
 for(const [userId,target] of [['a','b'],['b','a']]){assert.equal((await handleSocial(request('/api/ml-chat',{target,body:'Blocked'}),{sqlite:db,userId})).status,403);assert.equal((await handleSocial(request('/api/ml-like',{target}),{sqlite:db,userId})).status,404);}
 const list=await(await call('/api/blocks',null)).json();assert.equal(list.blocks[0].name,'b');
 await call('/api/unblock',{target:'b'});assert.equal((await handleSocial(request('/api/ml-chat',{target:'b',body:'Allowed'}),{sqlite:db,userId:'a'})).status,200);
 }finally{db.close();}
});
test('Admin participant search supports Cyrillic names, email and ID without wildcard interpretation',async()=>{
 const db=setup();try{db.prepare('UPDATE matchlove_profiles SET parsed=? WHERE user=?').run(JSON.stringify({self:{name:'Мария Новгородская'}}),'a');
 const find=async q=>(await(await handleAnalytics(request('/api/admin/users?q='+encodeURIComponent(q)),{sqlite:db,userId:'admin',adminIds:'admin',now})).json()).users;
 assert.deepEqual((await find('мАРИЯ')).map(u=>u.id),['a']);assert.deepEqual((await find('b@example')).map(u=>u.id),['b']);assert.equal((await find("%' OR 1=1 --")).length,0);assert.equal((await find('admin')).length,0);
 assert.equal((await handleAnalytics(request('/api/admin/users?q=Мария'),{sqlite:db,userId:'b',adminIds:'admin',now})).status,403);
 }finally{db.close();}
});
