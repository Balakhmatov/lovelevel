import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handleSocial} from '../server/matchlove-social.mjs';
const origin='http://localhost';
function setup(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE matchlove_profiles(user TEXT PRIMARY KEY,parsed TEXT NOT NULL,updated TEXT NOT NULL); CREATE TABLE profiles(id TEXT PRIMARY KEY,name TEXT,city TEXT); CREATE TABLE likes(sender TEXT,recipient TEXT,created TEXT,PRIMARY KEY(sender,recipient)); CREATE TABLE blocks(sender TEXT,recipient TEXT); CREATE TABLE messages(id TEXT PRIMARY KEY,sender TEXT,recipient TEXT,body TEXT,created TEXT);`);for(const user of ['a','b'])db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?)').run(user,JSON.stringify({self:{age_min:25}}),'2026-11-17T09:00:00Z');return db;}
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
 db.prepare('INSERT INTO blocks VALUES(?,?)').run('a','b');
 assert.equal((await handleSocial(req('/api/ml-like','POST',{target:'a'}),{sqlite:db,userId:'b'})).status,404);
 assert.equal((await handleSocial(req('/api/ml-chat?target=b'),{sqlite:db,userId:'a'})).status,403);
}finally{db.close()}});
test('cannot spoof unauthenticated like or chat',async()=>{const db=setup();try{
 assert.equal((await handleSocial(req('/api/ml-like','POST',{target:'b'}),{sqlite:db,userId:null})).status,401);
 assert.equal((await handleSocial(req('/api/ml-chat','POST',{target:'b',body:'hey'}),{sqlite:db,userId:'a'})).status,403);
}finally{db.close()}});
