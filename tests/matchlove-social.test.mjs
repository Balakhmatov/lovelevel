import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI} from '../server/matchlove-ai.mjs';
import {handleSocial} from '../server/matchlove-social.mjs';
const origin='http://localhost';
function setup(){const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);for(const [user,gender] of [['a','male'],['b','female']]){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(user,user+'@social.test','unused',0,gender);db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(user,'source',JSON.stringify({self:{age_min:25}}),'2026-11-17T09:00:00Z');}return db;}
const req=(path,method='GET',body=null)=>new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('like is one-sided until recipient likes back; then both see a match and chat opens',async()=>{const db=setup();try{
 let r=await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'});assert.equal(r.status,403);
 r=await handleSocial(req('/api/ml-like','POST',{target:'b'}),{sqlite:db,userId:'a'});assert.equal((await r.json()).matched,false);
 r=await handleSocial(req('/api/ml-social'),{sqlite:db,userId:'b'});let s=await r.json();assert.equal(s.incoming.length,1);assert.equal(s.matches.length,0);
 r=await handleSocial(req('/api/ml-like','POST',{target:'a'}),{sqlite:db,userId:'b'});assert.equal((await r.json()).matched,true);
 r=await handleSocial(req('/api/ml-chat','POST',{target:'b',body:'Привет!'}),{sqlite:db,userId:'a'});assert.equal(r.status,200);
 r=await handleSocial(req('/api/ml-chat?target=a'),{sqlite:db,userId:'b'});assert.equal((await r.json()).messages[0].body,'Привет!');
 r=await handleSocial(req('/api/ml-social'),{sqlite:db,userId:'b'});s=await r.json();assert.equal(s.matches.length,1);assert.equal(s.incoming.length,0);
}finally{db.close()}});
test('block suppresses likes and chats in both directions',async()=>{const db=setup();try{
 db.prepare('INSERT INTO blocks(sender,recipient,created) VALUES(?,?,?)').run('a','b',new Date().toISOString());
 assert.equal((await handleSocial(req('/api/ml-like','POST',{target:'a'}),{sqlite:db,userId:'b'})).status,404);
 assert.equal((await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).status,403);
}finally{db.close()}});
test('cannot spoof unauthenticated like or chat',async()=>{const db=setup();try{
 assert.equal((await handleSocial(req('/api/ml-like','POST',{target:'b'}),{sqlite:db,userId:null})).status,401);
 assert.equal((await handleSocial(req('/api/ml-chat','POST',{target:'b',body:'hey'}),{sqlite:db,userId:'a'})).status,403);
}finally{db.close()}});
test('Presence and typing are limited to mutual unblocked chats; sending clears typing',async()=>{
 const db=setup();try{
  const beat=(user,body,request=req('/api/ml-presence','POST',body))=>handleSocial(request,{sqlite:db,userId:user});
  assert.equal((await beat(null,{client:'browser'})).status,401);
  const foreign=new Request(origin+'/api/ml-presence',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({client:'browser'})});
  assert.equal((await beat('a',{},foreign)).status,403);
  assert.equal((await beat('a',{client:'bad client'})).status,400);
  assert.equal((await beat('b',{client:'b-browser',target:'a',typing:true})).status,403);
  for(const [sender,recipient] of [['a','b'],['b','a']])db.prepare('INSERT INTO likes VALUES(?,?,?)').run(sender,recipient,new Date().toISOString());
  db.prepare('UPDATE matchlove_profiles SET parsed=? WHERE user=?').run(JSON.stringify({self:{name:'Мария'}}),'b');db.prepare('INSERT INTO matchlove_photos VALUES(?,?,?,?,?,?)').run('photo','b','image/webp',Buffer.from('test'),1,new Date().toISOString());
  assert.equal((await beat('b',{client:'b-browser',target:'a',typing:true})).status,200);
  let chat=await(await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).json();assert.equal(chat.peer.name,'Мария');assert.equal(chat.peer.photo,'/api/profile-photo?user=b');assert.equal(chat.peer.online,true);assert.equal(chat.peer.typing,true);
  await handleSocial(req('/api/ml-chat','POST',{target:'a',body:'Привет',client:'b-browser'}),{sqlite:db,userId:'b'});
  chat=await(await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).json();assert.equal(chat.peer.online,true);assert.equal(chat.peer.typing,false);
  await beat('b',{client:'second-tab'});await beat('b',{client:'b-browser',active:false});
  chat=await(await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).json();assert.equal(chat.peer.online,true);
  await beat('b',{client:'second-tab',active:false});chat=await(await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).json();assert.equal(chat.peer.online,false);
  db.prepare('INSERT INTO blocks(sender,recipient,created) VALUES(?,?,?)').run('a','b',new Date().toISOString());assert.equal((await beat('b',{client:'b-browser',target:'a',typing:true})).status,403);assert.equal((await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).status,403);
 }finally{db.close();}
});
