import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../server/index.mjs';
import {handleMatchAI} from '../server/matchlove-ai.mjs';
import {applyManualProfile} from '../server/matchlove-profile.mjs';
const origin='http://127.0.0.1:3118';
test('Profiles support manual creation, protected AI merges, gallery access and ownership checks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-profile-')),app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 try{
 const accounts=[];for(const [i,gender] of ['male','female'].entries()){const response=await call('/api/auth/register',{method:'POST',body:{name:'Тестовый участник',birthdate:(new Date().getUTCFullYear()-28)+'-01-01',email:'profile'+i+'@test.example',password:'profile-test-password',gender,adult:true,terms:true}});assert.equal(response.status,201);accounts.push({cookie:response.headers.get('set-cookie').split(';')[0],id:app.sqlite.prepare('SELECT id FROM auth_accounts WHERE email=?').get('profile'+i+'@test.example').id});}
 const [a,b]=accounts;
 assert.equal((await call('/api/ml-profile')).status,401);
 assert.equal((await call('/api/ml-profile?user='+b.id,{cookie:a.cookie})).status,404);
 assert.equal((await call('/api/ml-profile',{method:'PATCH',cookie:a.cookie,requestOrigin:'https://evil.test',body:{self:{name:'Алиса'}}})).status,403);
 assert.equal((await call('/api/ml-profile',{method:'PATCH',cookie:a.cookie,body:{self:{age_min:16}}})).status,400);
 assert.equal((await call('/api/ml-profile',{method:'PATCH',cookie:a.cookie,body:{self:{gender:'female'}}})).status,400);
 let response=await call('/api/ml-profile',{method:'PATCH',cookie:a.cookie,body:{self:{name:'Марк',bio:'Люблю лес и кофе',age_min:28,age_max:28,interests:['лес','кофе'],habits:['не курю']},wanted:{gender:'female',interests:['путешествия'],age_min:24,age_max:32}}});assert.equal(response.status,200);
 let own=await(await call('/api/ml-profile',{cookie:a.cookie})).json();assert.equal(own.name,'Марк');assert.equal(own.profile.self.gender,'male');assert.deepEqual(own.locked.self.habits,['не курю']);
 const merged=applyManualProfile(app.sqlite,a.id,{self:{name:'Ошибка ИИ',interests:['танцы'],habits:['курю'],profession:['врач']},wanted:{interests:['спорт'],personality:['юмор'],preferences:[{category:'interests',preferred:['спорт']} ]}});
 assert.equal(merged.self.name,'Марк');assert.deepEqual(merged.self.habits,['не курю']);assert.deepEqual(merged.self.profession,['врач']);assert.deepEqual(merged.wanted.interests,['путешествия']);assert.deepEqual(merged.wanted.personality,['юмор']);assert.deepEqual(merged.wanted.preferences,[]);
 response=await call('/api/ml-profile',{method:'PATCH',cookie:a.cookie,body:{self:{habits:[]}}});assert.equal(response.status,200);assert.deepEqual(applyManualProfile(app.sqlite,a.id,{self:{habits:['курю']}}).self.habits,[]);
 const realFetch=globalThis.fetch;try{
 globalThis.fetch=async(url,options)=>url.endsWith('/embeddings')?new Response(JSON.stringify({data:JSON.parse(options.body).input.map((_,index)=>({index,embedding:Array.from({length:512},(_,i)=>i===0?1:0)}))})):new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({self:{name:'Ошибка',bio:'Описание ИИ',interests:['танцы'],habits:['курю'],profession:['врач']},wanted:{interests:['спорт']}})}}]}));
 const request=new Request(origin+'/api/ai-match',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text:'Новое описание для ИИ. '.repeat(8),confirmAdult:true})});
 const result=await handleMatchAI(request,{sqlite:app.sqlite,userId:a.id,apiKey:'test',model:'test'});assert.equal(result.status,200);const parsed=(await result.json()).profile;
 assert.equal(parsed.self.name,'Марк');assert.equal(parsed.self.bio,'Люблю лес и кофе');assert.deepEqual(parsed.self.interests,['лес','кофе']);assert.deepEqual(parsed.self.habits,[]);assert.deepEqual(parsed.self.profession,['врач']);assert.deepEqual(parsed.wanted.interests,['путешествия']);
 }finally{globalThis.fetch=realFetch;}
 response=await call('/api/ml-profile?user='+a.id,{method:'PATCH',cookie:b.cookie,body:{self:{name:'Взлом'}}});assert.equal(response.status,403);
 const bytes=Buffer.from('image-test');for(const [id,user] of [['main',a.id],['second',a.id],['foreign',b.id]])app.sqlite.prepare('INSERT INTO matchlove_photos VALUES(?,?,?,?,?,?)').run(id,user,'image/webp',bytes,id==='main'?1:0,new Date().toISOString());
 const visitor=await(await call('/api/ml-profile?user='+a.id,{cookie:b.cookie})).json();assert.equal(visitor.photos.length,2);assert.equal(visitor.own,false);assert.ok(!('locked' in visitor));assert.ok(!('source' in visitor));assert.equal(visitor.profile.self.bio,'Люблю лес и кофе');
 assert.equal((await call(visitor.photos[1].url,{cookie:b.cookie})).status,200);assert.equal((await call('/api/profile-photo?user='+a.id+'&id=foreign',{cookie:b.cookie})).status,404);
 app.sqlite.prepare('INSERT INTO blocks VALUES(?,?,?)').run(a.id,b.id,new Date().toISOString());assert.equal((await call('/api/ml-profile?user='+a.id,{cookie:b.cookie})).status,404);assert.equal((await call(visitor.photos[1].url,{cookie:b.cookie})).status,404);app.sqlite.prepare('DELETE FROM blocks').run();
 app.sqlite.prepare('DELETE FROM auth_accounts WHERE id=?').run(a.id);assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_profile_overrides WHERE user=?').get(a.id).n,0);
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
});
test('AI wishes stored in preferences become editable category tags without resurrecting manual deletions',async()=>{
 const {mergeManualProfile}=await import('../server/matchlove-profile.mjs');
 const parsed={self:{interests:['лес']},wanted:{interests:[],personality:[],preferences:[{category:'interests',preferred:['путешествия','кино'],importance:'normal'},{category:'personality',preferred:['чувство юмора'],importance:'strong'}]}};
 let profile=mergeManualProfile(parsed);assert.deepEqual(profile.wanted.interests,['путешествия','кино']);assert.deepEqual(profile.wanted.personality,['чувство юмора']);
 profile=mergeManualProfile(parsed,{wanted:{interests:[]}});assert.deepEqual(profile.wanted.interests,[]);assert.deepEqual(profile.wanted.personality,['чувство юмора']);assert.equal(profile.wanted.preferences.length,1);
});
