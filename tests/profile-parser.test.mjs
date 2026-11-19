import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProfile,PROFILE_SCHEMA_VERSION} from '../server/profile-parser.mjs';
const source='Мне 32 года, живу в Москве. Мечтаю встретить своего человека, с которым можно путешествовать и спокойно обсуждать то, что происходит между нами. '.repeat(35);
const profile={self:{name:'',age_min:32,age_max:32,location:'москва',gender:'male',goal:['серьёзные отношения'],interests:['путешествия'],habits:['не курю'],personality:['спокойный характер'],appearance:[],profession:[],sexual_preferences:[],preferences:[]},wanted:{name:'',age_min:26,age_max:34,location:'',gender:'female',goal:['серьёзные отношения'],interests:['путешествия'],habits:[],personality:[],appearance:[],profession:[],sexual_preferences:[],preferences:[]}};
const completed=()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(profile)}}],usage:{completion_tokens:1200,completion_tokens_details:{reasoning_tokens:300}}}),{headers:{'Content-Type':'application/json','x-request-id':'provider-trace'}});
async function scenario(mock,run){const original=globalThis.fetch;try{globalThis.fetch=mock;await run();}finally{globalThis.fetch=original;}}
const options=(log=()=>{})=>({apiKey:'test-key',model:'test-model',requestId:'test-request',retryDelayMs:0,log});
test('Long descriptive text reaches the parser intact and the schema no longer requests duplicate biographies',async()=>{
 let request;
 await scenario(async(_url,opt)=>{request=JSON.parse(opt.body);return completed();},async()=>{
  const parsed=await parseProfile(source,options());assert.equal(parsed.profileSchemaVersion,PROFILE_SCHEMA_VERSION);assert.equal(parsed.self.age_min,32);assert.deepEqual(parsed.wanted.goal,['серьёзные отношения']);
 });
 assert.ok(source.length>4000);assert.equal(request.messages[1].content,source);assert.equal(request.max_completion_tokens,6000);assert.ok(!request.response_format.json_schema.schema.$defs.profile.required.includes('bio'));
});
test('A truncated reasoning/model response is retried once with a larger output budget',async()=>{
 const requests=[],logs=[];
 await scenario(async(_url,opt)=>{requests.push(JSON.parse(opt.body));return requests.length===1?new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"self":'}}],usage:{completion_tokens:6000,completion_tokens_details:{reasoning_tokens:5700}}})):completed();},async()=>{
  const result=await parseProfile(source,options(row=>logs.push(row)));assert.equal(result.self.age_min,32);
 });
 assert.deepEqual(requests.map(r=>r.max_completion_tokens),[6000,10000]);assert.equal(logs[0].errorCode,'PROFILE_TRUNCATED');assert.equal(logs[0].reasoningTokens,5700);assert.equal(logs[1].result,'ok');assert.ok(!JSON.stringify(logs).includes(source));assert.ok(!JSON.stringify(logs).includes('test-key'));
});
test('An interrupted request can recover on the bounded second attempt',async()=>{
 let calls=0;const logs=[];
 await scenario(async(_url,opt)=>{calls++;if(calls===1)return new Promise((_,reject)=>opt.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));return completed();},async()=>{
  const result=await parseProfile(source,{...options(row=>logs.push(row)),attemptTimeoutMs:10,totalTimeoutMs:3000});assert.equal(result.self.age_min,32);
 });
 assert.equal(calls,2);assert.equal(logs[0].errorCode,'PROFILE_TIMEOUT');
});
test('Transient upstream failure retries, while credentials, quota and explicit refusals do not',async()=>{
 let calls=0;
 await scenario(async()=>++calls===1?new Response('{}',{status:503}):completed(),async()=>{await parseProfile(source,options());});assert.equal(calls,2);
 for(const [status,body,expected] of [[401,{error:{code:'invalid_api_key'}},'PROFILE_UNAVAILABLE'],[429,{error:{code:'insufficient_quota'}},'PROFILE_UNAVAILABLE'],[200,{choices:[{finish_reason:'stop',message:{refusal:'Refusal text'}}]},'PROFILE_REJECTED']]){
  calls=0;await scenario(async()=>{calls++;return new Response(JSON.stringify(body),{status});},async()=>{await assert.rejects(parseProfile(source,options()),e=>e.code===expected&&e.retryable===false);});assert.equal(calls,1);
 }
});
test('Malformed or empty structured responses never replace a saved profile and retries are bounded',async()=>{
 for(const content of ['', '{"self":', '{"unexpected":true}',JSON.stringify({self:{interests:'not an array'},wanted:{}})]){
  let calls=0;await scenario(async()=>{calls++;return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));},async()=>{await assert.rejects(parseProfile(source,options()),e=>e.code==='PROFILE_INVALID_RESPONSE');});assert.equal(calls,2);
 }
});
test('Retry-After beyond the request budget is returned without waiting beyond the proxy timeout',async()=>{
 let calls=0;await scenario(async()=>{calls++;return new Response(JSON.stringify({error:{code:'rate_limit_exceeded'}}),{status:429,headers:{'Retry-After':'120'}});},async()=>{await assert.rejects(parseProfile(source,options()),e=>e.code==='PROFILE_UNAVAILABLE');});assert.equal(calls,1);
});
