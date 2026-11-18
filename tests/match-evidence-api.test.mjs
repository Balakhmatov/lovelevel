import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI,handleMatchAI} from '../server/matchlove-ai.mjs';
import {SCORING_VERSION} from '../server/match-scoring.mjs';
const profile=(gender,wantedGender,interests=[])=>({self:{gender,age_min:null,age_max:null,interests,goal:[],personality:[],appearance:[],profession:[],sexual_preferences:[]},wanted:{gender:wantedGender,age_min:null,age_max:null,interests:[],goal:[],personality:[],appearance:[],profession:[],sexual_preferences:[]}});
test('Legacy free-form AI percentages are ignored, and cached evidence always reproduces summed tags',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ml-evidence-'));const {sqlite}=openDatabase(join(dir,'db.sqlite'));const original=globalThis.fetch;
 try{initMatchAI(sqlite);for(const [id,gender] of [['a','male'],['b','female']])sqlite.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.test','unused',0,gender);
 const a=profile('male','female'),b=profile('female','male');for(const [id,p] of [['a',a],['b',b]])sqlite.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'x'.repeat(100),JSON.stringify(p),'first');
 sqlite.prepare('INSERT INTO matchlove_ai_cache(viewer,candidate,viewer_updated,candidate_updated,score,confidence,explanation) VALUES(?,?,?,?,?,?,?)').run('a','b','first','first',55,20,'Пол, возраст и интересы неизвестны');
 const request=()=>new Request('http://localhost/api/ai-match');let data=await(await handleMatchAI(request(),{sqlite,userId:'a'})).json();assert.equal(data.results[0].score,1);assert.equal(data.results[0].matches.length,1);assert.equal(data.results[0].explanation,'');
 a.wanted.interests=['путешествия'];b.self.interests=['поездки за границу'];sqlite.prepare('UPDATE matchlove_profiles SET parsed=?,updated=? WHERE user=?').run(JSON.stringify(a),'second','a');sqlite.prepare('UPDATE matchlove_profiles SET parsed=?,updated=? WHERE user=?').run(JSON.stringify(b),'second','b');
 let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({pairs:[{id:'b',matches:[{category:'interests',direction:'viewer',wantedEvidence:'путешествия',candidateEvidence:'поездки за границу',agreement:1}]}]})}}]}),{headers:{'Content-Type':'application/json'}});};
 data=await(await handleMatchAI(request(),{sqlite,userId:'a',apiKey:'test',model:'test'})).json();const r=data.results[0];assert.equal(r.score,20.8);assert.equal(Math.round(r.matches.reduce((sum,t)=>sum+t.points,0)*100)/100,r.score);assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT scoring_version FROM matchlove_ai_cache').get().scoring_version,SCORING_VERSION);
 data=await(await handleMatchAI(request(),{sqlite,userId:'a',apiKey:'test',model:'test'})).json();assert.equal(data.results[0].score,20.8);assert.equal(calls,1);
 }finally{globalThis.fetch=original;sqlite.close();await rm(dir,{recursive:true,force:true});}
});
