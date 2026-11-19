import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI,handleMatchAI} from '../server/matchlove-ai.mjs';
const origin='http://localhost';
const request=text=>new Request(origin+'/api/ai-match',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text,confirmAdult:true})});
function setup(){const {sqlite}=openDatabase(':memory:');initMatchAI(sqlite);sqlite.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run('viewer','parser@test.example','unused',0,'male');return sqlite;}
test('Parser failure has a friendly actionable response and leaves an existing profile untouched',async()=>{
 const db=setup(),original=globalThis.fetch,old={self:{gender:'male',interests:['лес']},wanted:{gender:'female'}};
 try{
  db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run('viewer','previous description',JSON.stringify(old),'previous');
  globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429});
  const response=await handleMatchAI(request('Новое подробное описание '.repeat(10)),{sqlite:db,userId:'viewer',apiKey:'test'}),body=await response.json();
  assert.equal(response.status,503);assert.equal(body.code,'PROFILE_UNAVAILABLE');assert.match(body.error,/Попробуй ещё раз/);assert.ok(!body.error.includes('OpenAI'));assert.ok(body.requestId);
  assert.deepEqual(JSON.parse(db.prepare('SELECT parsed FROM matchlove_profiles WHERE user=?').get('viewer').parsed),old);
  assert.equal(db.prepare('SELECT source FROM matchlove_profiles WHERE user=?').get('viewer').source,'previous description');
 }finally{globalThis.fetch=original;db.close();}
});
test('Text beyond the supported limit is rejected explicitly, never silently truncated',async()=>{
 const db=setup(),original=globalThis.fetch;let calls=0;
 try{globalThis.fetch=async()=>{calls++;throw Error('unexpected');};const response=await handleMatchAI(request('я'.repeat(12001)),{sqlite:db,userId:'viewer',apiKey:'test'});assert.equal(response.status,400);assert.equal((await response.json()).code,'PROFILE_TOO_LONG');assert.equal(calls,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matchlove_profiles').get().n,0);}finally{globalThis.fetch=original;db.close();}
});
test('Successful parsing saves the full long description even if optional embedding or suggestion indexing fails',async()=>{
 const db=setup(),original=globalThis.fetch,text='Мне 32 года, хочу встретить человека для серьёзных отношений и вместе путешествовать. '.repeat(65);let received='';
 try{
  db.exec('DROP TABLE matchlove_tag_usage');
  globalThis.fetch=async(url,opt)=>{
   if(url.endsWith('/embeddings'))return new Response('{}',{status:503});
   received=JSON.parse(opt.body).messages[1].content;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({self:{age_min:32,age_max:32,interests:['путешествия']},wanted:{goal:['серьёзные отношения']}})}}]}));
  };
  const response=await handleMatchAI(request(text),{sqlite:db,userId:'viewer',apiKey:'test'});assert.equal(response.status,200);assert.equal(received,text);const row=db.prepare('SELECT source,parsed FROM matchlove_profiles WHERE user=?').get('viewer');assert.equal(row.source,text);assert.deepEqual(JSON.parse(row.parsed).self.interests,['путешествия']);
 }finally{globalThis.fetch=original;db.close();}
});
