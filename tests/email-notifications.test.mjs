import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI} from '../server/matchlove-ai.mjs';
import {handleSocial} from '../server/matchlove-social.mjs';
import {emailSettings,enqueueEmail,handleEmailSettings,runEmailDigestTick,DIGEST_DAY} from '../server/email-notifications.mjs';
const base=Date.parse('2026-11-20T09:00:00Z'),origin='https://example.com',from='MatchLove <test@example.com>';
function database(){const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);for(const user of ['recipient','peer']){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(user,user+'@example.com','unused',base,'female');db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(user,'',JSON.stringify({self:{name:user}}),new Date(base).toISOString());}return db;}
function optin(db,user='recipient',likes=1,messages=1){db.prepare('INSERT INTO matchlove_email_settings VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET likes=excluded.likes,messages=excluded.messages').run(user,likes,messages);}
const tick=(db,time,sent,fetcher)=>runEmailDigestTick(db,{origin,from,apiKey:'test-only',now:()=>time,fetcher:fetcher||(async(url,options)=>{sent.push({url,options,payload:JSON.parse(options.body)});return new Response('{}');})});
test('Events require opt-in and retain every event for accurate daily counts; account deletion cascades',()=>{const db=database();try{
 assert.equal(emailSettings(db,'recipient').likes,false);enqueueEmail(db,'recipient','likes',base);assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_events').get().n,0);
 optin(db);for(const kind of ['likes','messages','messages','matches'])enqueueEmail(db,'recipient',kind,base);
 assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_events').get().n,4);assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_outbox').get().n,0);
 db.prepare("DELETE FROM auth_accounts WHERE id='recipient'").run();assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_events').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_digest_state').get().n,0);
}finally{db.close();}});
test('Email preferences require authenticated same-origin requests and valid booleans',async()=>{const db=database();try{
 const req=(source,body)=>new Request(origin+'/api/ml-email-settings',{method:'PATCH',headers:{origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handleEmailSettings(req(origin,{likes:true,messages:true}),{sqlite:db})).status,401);
 assert.equal((await handleEmailSettings(req('https://evil.test',{likes:true,messages:true}),{sqlite:db,userId:'recipient'})).status,403);
 assert.equal((await handleEmailSettings(req(origin,{likes:'true',messages:false}),{sqlite:db,userId:'recipient'})).status,400);
 assert.equal((await handleEmailSettings(req(origin,{likes:true,messages:false}),{sqlite:db,userId:'recipient'})).status,200);
 assert.equal(emailSettings(db,'recipient').likes,true);
}finally{db.close();}});
test('One daily email combines likes, matches and messages with an HTML button and no private content',async()=>{const db=database(),sent=[];try{
 optin(db);for(const kind of ['likes','matches','messages','messages','messages'])enqueueEmail(db,'recipient',kind,base,'peer');
 await tick(db,base+DIGEST_DAY-1,sent);assert.equal(sent.length,0);
 await tick(db,base+DIGEST_DAY,sent);assert.equal(sent.length,1);
 const {payload,options}=sent[0];assert.deepEqual(payload.to,['recipient@example.com']);
 for(const line of ['Новые симпатии: 1','Взаимные мэтчи: 1','Новые сообщения: 3'])assert(payload.text.includes(line));
 assert(payload.html.includes('Открыть MatchLove'));assert(payload.html.includes('src="https://example.com/android-chrome-192x192.png"'));assert(payload.html.includes('alt="MatchLove"'));assert(payload.html.includes('role="presentation"'));assert(payload.html.includes('href="https://example.com/"'));assert(options.headers['Idempotency-Key']);
 assert(!payload.text.includes('peer'));assert(!payload.text.includes('password'));assert.equal(db.prepare('SELECT sent FROM matchlove_email_outbox').get().sent,base+DIGEST_DAY);
 // A fresh worker/tick and a burst of new events cannot send another message the same day.
 enqueueEmail(db,'recipient','messages',base+DIGEST_DAY+1000);
 await tick(db,base+DIGEST_DAY+15000,sent);await tick(db,base+2*DIGEST_DAY-1,sent);assert.equal(sent.length,1);
 await tick(db,base+2*DIGEST_DAY,sent);assert.equal(sent.length,2);assert(sent[1].payload.text.includes('Новые сообщения: 1'));assert(!sent[1].payload.text.includes('Новые симпатии'));
 await tick(db,base+3*DIGEST_DAY,sent);assert.equal(sent.length,2);
}finally{db.close();}});
test('Events on the exact daily boundary are included only in the next daily digest',async()=>{const db=database(),sent=[];try{
 optin(db);enqueueEmail(db,'recipient','likes',base);enqueueEmail(db,'recipient','messages',base+DIGEST_DAY);
 await tick(db,base+DIGEST_DAY,sent);assert(!sent[0].payload.text.includes('Новые сообщения'));
 await tick(db,base+2*DIGEST_DAY,sent);assert(sent[1].payload.text.includes('Новые сообщения: 1'));assert.equal(sent.length,2);
}finally{db.close();}});
test('Retry reuses immutable body and key; arrivals during failure go into the next summary',async()=>{const db=database(),attempts=[];try{
 optin(db);enqueueEmail(db,'recipient','messages',base);
 const mock=async(url,options)=>{attempts.push(options);return new Response('{}',{status:attempts.length===1?503:200});};
 await tick(db,base+DIGEST_DAY,[],mock);enqueueEmail(db,'recipient','messages',base+DIGEST_DAY+1000);
 await tick(db,base+DIGEST_DAY+60000,[],mock);assert.equal(attempts.length,2);assert.equal(attempts[0].body,attempts[1].body);assert.equal(attempts[0].headers['Idempotency-Key'],attempts[1].headers['Idempotency-Key']);
 await tick(db,base+2*DIGEST_DAY,[],mock);assert.equal(attempts.length,2);
 await tick(db,base+2*DIGEST_DAY+60000,[],mock);assert.equal(attempts.length,3);assert(JSON.parse(attempts[2].body).text.includes('Новые сообщения: 1'));
}finally{db.close();}});
test('Disabled types, blocked peers, and disabled or changed pending preferences do not send unwanted mail',async()=>{const db=database(),sent=[];try{
 optin(db,'recipient',1,0);enqueueEmail(db,'recipient','messages',base);enqueueEmail(db,'recipient','likes',base,'peer');
 db.prepare('INSERT INTO blocks VALUES(?,?,?)').run('recipient','peer',new Date(base).toISOString());
 await tick(db,base+DIGEST_DAY,sent);assert.equal(sent.length,0);
 db.prepare('DELETE FROM blocks').run();optin(db);enqueueEmail(db,'recipient','messages',base+DIGEST_DAY+1);
 await tick(db,base+2*DIGEST_DAY,[],async()=>new Response('{}',{status:503}));
 optin(db,'recipient',0,0);await tick(db,base+2*DIGEST_DAY+60000,sent);assert.equal(sent.length,0);assert.equal(db.prepare('SELECT count(*) n FROM matchlove_email_outbox WHERE sent IS NULL').get().n,0);
}finally{db.close();}});
test('Long outage skips stale days and only sends a single latest-day summary',async()=>{const db=database(),sent=[];try{
 optin(db);enqueueEmail(db,'recipient','likes',base);enqueueEmail(db,'recipient','messages',base+4*DIGEST_DAY-1000);
 await tick(db,base+4*DIGEST_DAY,sent);assert.equal(sent.length,1);assert(sent[0].payload.text.includes('Новые сообщения: 1'));assert(!sent[0].payload.text.includes('Новые симпатии'));
}finally{db.close();}});
test('Repeated likes do not inflate digest; mutual match is recorded for both users',async()=>{const db=database();try{
 optin(db);optin(db,'peer');const like=(userId,target)=>handleSocial(new Request(origin+'/api/ml-like',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({target})}),{sqlite:db,userId});
 await like('peer','recipient');await like('peer','recipient');await like('recipient','peer');await like('recipient','peer');
 const counts=db.prepare('SELECT user,kind,count(*) n FROM matchlove_email_events GROUP BY user,kind').all();
 assert.equal(counts.find(r=>r.user==='recipient'&&r.kind==='likes').n,1);assert.equal(counts.find(r=>r.user==='recipient'&&r.kind==='matches').n,1);assert.equal(counts.find(r=>r.user==='peer'&&r.kind==='matches').n,1);
}finally{db.close();}});
test('Migration cancels legacy instant notices and preserves delivered history',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec("PRAGMA foreign_keys=ON;CREATE TABLE auth_accounts(id TEXT PRIMARY KEY);INSERT INTO auth_accounts VALUES('recipient');");
  db.exec(readFileSync('drizzle/0016_email_notifications.sql','utf8'));
  const insert=db.prepare('INSERT INTO matchlove_email_outbox VALUES(?,?,?,?,?,?,?)');insert.run('pending','recipient','likes',base,base,0,null);insert.run('delivered','recipient','messages',base,base,0,base);
  db.exec(readFileSync('drizzle/0018_daily_email_digest.sql','utf8'));
  assert.deepEqual(db.prepare('SELECT id FROM matchlove_email_outbox').all().map(r=>r.id),['delivered']);
 }finally{db.close();}
});
test('Exhausted ambiguous attempts never allow a new digest within 24h of the final attempt',async()=>{const db=database(),attempts=[];try{
 optin(db);enqueueEmail(db,'recipient','likes',base);
 const fail=async(url,options)=>{attempts.push(options);throw Error('Response lost');};
 await tick(db,base+DIGEST_DAY,[],fail);await tick(db,base+DIGEST_DAY+60000,[],fail);await tick(db,base+DIGEST_DAY+180000,[],fail);assert.equal(attempts.length,3);
 enqueueEmail(db,'recipient','messages',base+2*DIGEST_DAY-1000);
 const sent=[];await tick(db,base+2*DIGEST_DAY,sent);assert.equal(sent.length,0);
 await tick(db,base+2*DIGEST_DAY+180000,sent);assert.equal(sent.length,1);
}finally{db.close();}});

