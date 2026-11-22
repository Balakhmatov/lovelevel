import test from 'node:test';
import assert from 'node:assert/strict';
import {zodiacComparison} from '../server/zodiac.mjs';
import {rankMatch} from '../server/match-scoring.mjs';
import {mergeManualProfile,handleProfile} from '../server/matchlove-profile.mjs';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI} from '../server/matchlove-ai.mjs';
test('Zodiac is directional, never weighted and missing signs are not conflicts',()=>{
 const viewer={self:{gender:'female',interests:['прогулки']},wanted:{gender:'male',zodiac:['Лев','Овен']}},base={self:{gender:'male',interests:['прогулки']},wanted:{}};
 const matching={...base,self:{...base.self,zodiac:['Лев']}},different={...base,self:{...base.self,zodiac:['Рак']}};
 const a=rankMatch(viewer,matching),b=rankMatch(viewer,different),c=rankMatch(viewer,base);assert.equal(a.score,b.score);assert.equal(b.score,c.score);assert.equal(a.zodiacMatch.status,'match');assert.equal(b.zodiacMatch.status,'mismatch');assert(b.conflicts.some(f=>f.category==='zodiac'&&f.label==='Рак'));assert(!a.matches.some(m=>m.category==='zodiac'));assert(!c.conflicts.some(f=>f.category==='zodiac'));assert.equal(c.zodiacMatch,null);assert.equal(zodiacComparison({wanted:{}},matching),null);assert.equal(zodiacComparison(matching,viewer),null);
});
test('Manual zodiac selection validates, clears and survives subsequent AI updates',async()=>{
 const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);try{db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run('a','a@example.com','unused',Date.now(),'female');const patch=body=>handleProfile(new Request('https://example.test/api/ml-profile',{method:'PATCH',headers:{origin:'https://example.test','Content-Type':'application/json'},body:JSON.stringify(body)}),{sqlite:db,userId:'a'});
 assert.equal((await patch({self:{zodiac:['Лев','Овен']}})).status,400);assert.equal((await patch({self:{zodiac:['Неправильный']}})).status,400);const saved=await(await patch({self:{zodiac:['Рыбы']},wanted:{zodiac:['Лев','Овен']}})).json();assert.deepEqual(saved.profile.self.zodiac,['Рыбы']);assert.deepEqual(saved.profile.wanted.zodiac,['Лев','Овен']);const overrides=JSON.parse(db.prepare('SELECT data FROM matchlove_profile_overrides WHERE user=?').get('a').data);const merged=mergeManualProfile({self:{zodiac:['Рак']},wanted:{}},overrides);assert.deepEqual(merged.self.zodiac,['Рыбы']);assert.deepEqual(merged.wanted.zodiac,['Лев','Овен']);const clear=await(await patch({wanted:{zodiac:[]}})).json();assert.deepEqual(clear.profile.wanted.zodiac,[]);
 }finally{db.close();}
});
