import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createServer} from '../server/index.mjs';
import {mark,alice} from './fixtures/directional-profiles.mjs';
test('Directional scores survive likes; confirmed habit conflicts stay visible unless viewer opts out',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-directional-')),origin='http://127.0.0.1:3118',app=createServer({origin,dataDir:dir,secureCookies:false,registration:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');const base='http://127.0.0.1:'+app.server.address().port;
 const call=(path,{method='GET',cookie,body,requestOrigin=origin}={})=>fetch(base+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
 try{
 const users=[];for(const [i,profile] of [mark,alice].entries()){
  const r=await call('/api/auth/register',{method:'POST',body:{name:'Тестовый участник',email:'direction'+i+'@test.example',password:'directional-search-password',gender:profile.self.gender,adult:true,terms:true}});assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0],id=app.sqlite.prepare('SELECT id FROM auth_accounts WHERE email=?').get('direction'+i+'@test.example').id;
  app.sqlite.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'Saved original description '.repeat(5),JSON.stringify(profile),'first');app.sqlite.prepare('INSERT INTO matchlove_photos(id,user,mime,data,is_main,created) VALUES(?,?,?,?,?,?)').run('photo-'+i,id,'image/webp',Buffer.from('test-photo'),1,'first');users.push({id,cookie});
 }
 const [a,b]=users;
 let results=await(await call('/api/ai-match',{cookie:a.cookie})).json();assert.equal(results.results[0].score,82.2);assert.equal(results.results[0].conflicts[0].label,'Курит');
 results=await(await call('/api/ai-match',{cookie:b.cookie})).json();assert.equal(results.results[0].score,73);assert.deepEqual(results.results[0].conflicts,[]);
 await call('/api/ml-like',{method:'POST',cookie:a.cookie,body:{target:b.id}});
 let social=await(await call('/api/ml-social',{cookie:b.cookie})).json();assert.equal(social.incoming[0].score,73);assert.equal(social.incoming[0].id,a.id);assert.deepEqual(social.incoming[0].conflicts,[]);
 await call('/api/ml-like',{method:'POST',cookie:b.cookie,body:{target:a.id}});
 social=await(await call('/api/ml-social',{cookie:a.cookie})).json();assert.equal(social.matches[0].score,82.2);
 let profile=await(await call('/api/ml-profile?user='+b.id,{cookie:a.cookie})).json();assert.equal(profile.conflicts[0].label,'Курит');assert.ok(!('searchSettings' in profile));
 assert.equal((await call('/api/ml-search-settings')).status,401);
 assert.equal((await call('/api/ml-search-settings',{method:'PATCH',cookie:a.cookie,requestOrigin:'https://evil.test',body:{hideHabitConflicts:true}})).status,403);
 assert.equal((await call('/api/ml-search-settings',{method:'PATCH',cookie:a.cookie,body:{hideHabitConflicts:'yes'}})).status,400);
 assert.equal((await(await call('/api/ml-search-settings',{cookie:a.cookie})).json()).hideHabitConflicts,false);
 await call('/api/ml-search-settings',{method:'PATCH',cookie:a.cookie,body:{hideHabitConflicts:true}});
 results=await(await call('/api/ai-match',{cookie:a.cookie})).json();assert.equal(results.results.length,0);assert.equal(results.hiddenCount,1);
 profile=await(await call('/api/ml-profile',{cookie:a.cookie})).json();assert.equal(profile.searchSettings.hideHabitConflicts,true);
 results=await(await call('/api/ai-match',{cookie:b.cookie})).json();assert.equal(results.results[0].score,73);
 social=await(await call('/api/ml-social',{cookie:a.cookie})).json();assert.equal(social.matches[0].score,82.2); // Search filter cannot erase an existing conversation.
 await call('/api/ml-search-settings',{method:'PATCH',cookie:a.cookie,body:{hideHabitConflicts:false}});
 results=await(await call('/api/ai-match',{cookie:a.cookie})).json();assert.equal(results.results[0].score,82.2);
 const markWithExclusion=structuredClone(mark),aliceWithoutHabitConflict=structuredClone(alice);
 markWithExclusion.wanted.preferences=[{category:'goal',preferred:[],excluded:['встречи без обязательств'],importance:'normal'}];aliceWithoutHabitConflict.self.goal=['встречи без обязательств'];aliceWithoutHabitConflict.self.habits=['не курю','иногда употребляю алкоголь'];
 app.sqlite.prepare('UPDATE matchlove_profiles SET parsed=?,updated=? WHERE user=?').run(JSON.stringify(markWithExclusion),'next',a.id);app.sqlite.prepare('UPDATE matchlove_profiles SET parsed=?,updated=? WHERE user=?').run(JSON.stringify(aliceWithoutHabitConflict),'next',b.id);
 results=await(await call('/api/ai-match',{cookie:a.cookie})).json();assert.equal(results.results.length,1);assert.equal(results.results[0].conflicts[0].category,'goal');assert.equal(results.results[0].conflicts.length,1);
 await call('/api/ml-search-settings',{method:'PATCH',cookie:a.cookie,body:{hideConflicts:true}});
 results=await(await call('/api/ai-match',{cookie:a.cookie})).json();assert.equal(results.results.length,0);assert.equal(results.hiddenCount,1);assert.equal((await(await call('/api/ml-search-settings',{cookie:a.cookie})).json()).hideConflicts,true);
 app.sqlite.prepare('DELETE FROM auth_accounts WHERE id=?').run(a.id);assert.equal(app.sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_search_settings').get().n,0);
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await rm(dir,{recursive:true,force:true});}
});
