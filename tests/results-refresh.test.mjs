import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI,handleMatchAI} from '../server/matchlove-ai.mjs';
const source=readFileSync('public/matchlove.js','utf8');
test('Opening matches refreshes candidates even when the viewer has not edited the profile',async()=>{
 const calls=[];let responses=0;const ctx=vm.createContext({S:{logged:true,me:{id:'viewer'},page:'home',query:'',results:[]},searchResultsDirty:false,$:()=>null,captureProfileDraft(){},stopChatActivity(){},render(){},window:{scrollTo(){}},loadMatches:async()=>{},toast:message=>{throw Error(message)},api:async(path,options)=>{calls.push({path,options});return {results:[{id:'candidate-'+ ++responses}],hiddenCount:0};}});
 vm.runInContext(source.slice(source.indexOf('let navigationSequence='),source.indexOf('async function loadMatches()')),ctx);
 await vm.runInContext("go('results')",ctx);assert.equal(ctx.S.results[0].id,'candidate-1');await vm.runInContext("go('home');",ctx);await vm.runInContext("go('results')",ctx);assert.equal(ctx.S.results[0].id,'candidate-2');assert.equal(calls.length,2);assert(calls.every(call=>!call.options?.method));
});
test('Another city and a low score never exclude an otherwise eligible new profile',async()=>{
 const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);try{for(const [id,gender,city] of [['viewer','male','Москва'],['candidate','female','Екатеринбург']]){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.com','unused',Date.now(),gender);db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'',JSON.stringify({self:{name:id,gender,location:city},wanted:{gender:id==='viewer'?'female':'male'}}),'updated');}
 const result=await(await handleMatchAI(new Request('https://example.com/api/ai-match'),{sqlite:db,userId:'viewer'})).json();assert.equal(result.results.length,1);assert.equal(result.results[0].city,'Екатеринбург');assert.equal(result.results[0].score,1);
 }finally{db.close();}
});
test('Admin match diagnostics distinguish incomplete profiles, age, blocks and optional conflicts',async()=>{
 const {matchVisibility}=await import('../server/match-visibility.mjs');const {handleAnalytics}=await import('../server/admin-analytics.mjs');const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);
 try{for(const [id,gender] of [['viewer','male'],['candidate','female']])db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.com','unused',Date.now(),gender);
 const viewer={self:{gender:'male'},wanted:{gender:'female',age_min:25,age_max:35,habits:['не курит']}},candidate={self:{gender:'female',age_min:40,age_max:40,location:'Екатеринбург'},wanted:{}};const set=(id,p)=>db.prepare('INSERT OR REPLACE INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'',JSON.stringify(p),'v1');set('viewer',viewer);assert.match(matchVisibility(db,'viewer','candidate').reason,/ещё не сохранил/);set('candidate',candidate);assert.equal(matchVisibility(db,'viewer','candidate').visible,true);assert.match(matchVisibility(db,'viewer','candidate').reason,/Возраст вне/);candidate.self.age_min=candidate.self.age_max=30;set('candidate',candidate);assert.equal(matchVisibility(db,'viewer','candidate').visible,true);
 db.prepare('INSERT INTO blocks VALUES(?,?,?)').run('candidate','viewer','now');assert.match(matchVisibility(db,'viewer','candidate').reason,/блокировка/);db.prepare('DELETE FROM blocks').run();candidate.self.habits=['курит'];set('candidate',candidate);db.prepare('INSERT INTO matchlove_search_settings(user,hide_habit_conflicts,hide_conflicts) VALUES(?,?,?)').run('viewer',1,1);assert.match(matchVisibility(db,'viewer','candidate').reason,/фильтр нежелательных/);
 const req=new Request('https://example.com/api/admin/match-check?user=candidate');assert.equal((await handleAnalytics(req,{sqlite:db,userId:'candidate',adminIds:'viewer'})).status,403);const r=await handleAnalytics(req,{sqlite:db,userId:'viewer',adminIds:'viewer'});assert.equal(r.status,200);assert.equal((await r.json()).visible,false);assert.equal(db.prepare("SELECT count(*) n FROM audits WHERE action='check_match_visibility'").get().n,1);
 }finally{db.close();}
});
