import {applyGenderDefaults} from './matchlove-ai.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function handleAccountGender(request,{sqlite,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 if(request.method!=='PATCH')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const body=await request.json().catch(()=>({}));if(!['male','female'].includes(body.gender))return json({error:'Выбери пол'},400);
 sqlite.exec('BEGIN IMMEDIATE');try{
  sqlite.prepare('UPDATE auth_accounts SET gender=? WHERE id=?').run(body.gender,userId);
  sqlite.prepare('UPDATE profiles SET gender=? WHERE id=?').run(body.gender==='male'?'man':'woman',userId);
  const row=sqlite.prepare('SELECT parsed FROM matchlove_profiles WHERE user=?').get(userId);
  if(row){const parsed=applyGenderDefaults(JSON.parse(row.parsed),body.gender);sqlite.prepare('UPDATE matchlove_profiles SET parsed=?,updated=? WHERE user=?').run(JSON.stringify(parsed),new Date().toISOString(),userId);}
  sqlite.prepare('DELETE FROM matchlove_vectors WHERE user=?').run(userId);
  sqlite.prepare('DELETE FROM matchlove_ai_cache WHERE viewer=? OR candidate=?').run(userId,userId);
  sqlite.exec('COMMIT');
 }catch(error){sqlite.exec('ROLLBACK');throw error;}
 return json({ok:true,gender:body.gender});
}
