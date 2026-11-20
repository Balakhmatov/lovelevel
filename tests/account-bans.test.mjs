import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../server/storage.mjs';
import {initMatchAI,handleMatchAI} from '../server/matchlove-ai.mjs';
import {handleAccountBan,accountBanned} from '../server/account-bans.mjs';
import {canViewProfile} from '../server/matchlove-profile.mjs';
import {handleSocial} from '../server/matchlove-social.mjs';
import {createAuth,hashPassword} from '../server/auth.mjs';
const origin='https://example.test';
const request=body=>new Request(origin+'/api/admin/ban',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('Admin ban revokes sessions, hides profile and social access; unban restores data and login',async()=>{
 const {sqlite:db}=openDatabase(':memory:');initMatchAI(db);
 try{const hash=await hashPassword('account-ban-test-password');for(const id of ['admin','otheradmin','user','viewer']){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,created,gender) VALUES(?,?,?,?,?)').run(id,id+'@example.test',hash,Date.now(),'male');db.prepare('INSERT INTO matchlove_profiles VALUES(?,?,?,?)').run(id,'source',JSON.stringify({self:{gender:'male'},wanted:{gender:'all'}}),new Date().toISOString());}
 const auth=createAuth(db,{origin});const login=()=>auth.route(new Request(origin+'/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:'user@example.test',password:'account-ban-test-password'})}),'127.0.0.1');assert.equal((await login()).status,200);assert.equal(db.prepare("SELECT count(*) n FROM auth_sessions WHERE account='user'").get().n,1);
 const call=(userId,banned=true,target='user')=>handleAccountBan(request({target,banned,reason:'Проверка жалобы'}),{sqlite:db,userId,adminIds:'admin,otheradmin'});
 assert.equal((await call('viewer')).status,403);assert.equal((await call('admin',true,'admin')).status,403);assert.equal((await call('admin',true,'otheradmin')).status,403);
 assert.equal((await call('admin')).status,200);assert(accountBanned(db,'user'));assert.equal(db.prepare("SELECT count(*) n FROM auth_sessions WHERE account='user'").get().n,0);assert.equal((await login()).status,403);assert.equal(canViewProfile(db,'viewer','user'),false);
 const likes=await handleSocial(new Request(origin+'/api/ml-like',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({target:'user'})}),{sqlite:db,userId:'viewer'});assert.equal(likes.status,404);
 const result=await(await handleMatchAI(new Request(origin+'/api/ai-match'),{sqlite:db,userId:'viewer'})).json();assert(!(result.results||[]).some(r=>r.id==='user'));
 assert.equal((await call('admin',false)).status,200);assert(!accountBanned(db,'user'));assert(canViewProfile(db,'viewer','user'));assert.equal((await login()).status,200);assert.equal(db.prepare("SELECT count(*) n FROM audits WHERE action IN ('ban_account','unban_account')").get().n,2);
 }finally{db.close();}
});
