import {randomUUID} from 'node:crypto';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function accountBanned(db,id){return !!db.prepare('SELECT 1 FROM matchlove_account_bans WHERE user=?').get(id);}
export async function handleAccountBan(request,{sqlite:db,userId,adminIds=''}){
 const admins=adminIds.split(',').map(s=>s.trim()).filter(Boolean);if(!userId||!admins.includes(userId))return json({error:'Доступ только для администратора'},403);
 if(request.method!=='POST')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const b=await request.json().catch(()=>null);if(!b||typeof b.target!=='string'||typeof b.banned!=='boolean'||typeof b.reason!=='string'||b.reason.length>1000||(b.banned&&!b.reason.trim()))return json({error:'Укажи причину блокировки'},400);
 if(b.target===userId||admins.includes(b.target))return json({error:'Нельзя блокировать администратора'},403);
 if(!db.prepare('SELECT 1 FROM auth_accounts WHERE id=?').get(b.target))return json({error:'Пользователь не найден'},404);
 const now=new Date().toISOString();db.exec('BEGIN IMMEDIATE');try{
 if(b.banned){db.prepare('INSERT INTO matchlove_account_bans(user,reason,actor,created) VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET reason=excluded.reason,actor=excluded.actor,created=excluded.created').run(b.target,b.reason.trim(),userId,now);db.prepare('DELETE FROM auth_sessions WHERE account=?').run(b.target);db.prepare('DELETE FROM matchlove_email_events WHERE user=?').run(b.target);db.prepare('DELETE FROM matchlove_email_outbox WHERE user=? AND sent IS NULL').run(b.target);}else db.prepare('DELETE FROM matchlove_account_bans WHERE user=?').run(b.target);
 db.prepare('INSERT INTO audits(id,actor,action,target,created) VALUES(?,?,?,?,?)').run(randomUUID(),userId,b.banned?'ban_account':'unban_account',b.target,now);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 return json({ok:true,banned:b.banned});
}
