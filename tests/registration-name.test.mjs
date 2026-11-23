import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI} from '../server/matchlove-ai.mjs';
import {createAuth} from '../server/auth.mjs';
import {applyManualProfile,handleProfile} from '../server/matchlove-profile.mjs';
const origin='https://example.test';
test('Registration requires a nonempty name, saves it atomically and preserves it across AI parsing',async()=>{
 const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);const auth=createAuth(db,{origin,secure:false,registration:true});const payload={birthdate:'1995-01-01',email:'name@example.test',password:'registration-name-password',adult:true,terms:true,gender:'female'};const register=name=>auth.route(new Request(origin+'/api/auth/register',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({...payload,...(name===undefined?{}:{name})})}),'test');
 try{for(const name of [undefined,'','  ','x'.repeat(61),'И\u200bмя'])assert.equal((await register(name)).status,400);assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_accounts').get().n,0);
 const response=await register('  Анна  Мария  ');assert.equal(response.status,201);const user=db.prepare('SELECT id FROM auth_accounts WHERE email=?').get(payload.email).id;const own=await(await handleProfile(new Request(origin+'/api/ml-profile'),{sqlite:db,userId:user})).json();assert.equal(own.profile.self.name,'Анна Мария');assert.equal(applyManualProfile(db,user,{self:{name:'Другое имя'},wanted:{}}).self.name,'Анна Мария');assert.equal(db.prepare('SELECT COUNT(*) n FROM matchlove_profiles').get().n,0);
 assert.equal((await register('Копия')).status,409);assert.equal(db.prepare('SELECT COUNT(*) n FROM auth_accounts').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM matchlove_profile_overrides').get().n,1);
 }finally{db.close();}
});
