import {randomUUID} from 'node:crypto';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function emailSettings(db,user){const r=db.prepare('SELECT likes,messages FROM matchlove_email_settings WHERE user=?').get(user);return {likes:!!r?.likes,messages:!!r?.messages,available:!!(process.env.RESEND_API_KEY&&process.env.MATCHLOVE_MAIL_FROM)};}
export async function handleEmailSettings(request,{sqlite:db,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 if(request.method==='GET')return json(emailSettings(db,userId));
 if(request.method!=='PATCH')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const b=await request.json().catch(()=>null);if(!b||typeof b.likes!=='boolean'||typeof b.messages!=='boolean'||Object.keys(b).some(k=>!['likes','messages'].includes(k)))return json({error:'Проверь настройки'},400);
 const account=db.prepare('SELECT email FROM auth_accounts WHERE id=?').get(userId);if((b.likes||b.messages)&&! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account?.email||''))return json({error:'Для уведомлений нужен аккаунт с email'},400);
 db.prepare('INSERT INTO matchlove_email_settings(user,likes,messages) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET likes=excluded.likes,messages=excluded.messages').run(userId,+b.likes,+b.messages);
 return json(emailSettings(db,userId));
}
export function enqueueEmail(db,user,kind,now=Date.now()){
 const settings=emailSettings(db,user);if(!settings[kind])return;
 // One generic notice per event type in ten minutes, never message contents.
 if(db.prepare('SELECT 1 FROM matchlove_email_outbox WHERE user=? AND kind=? AND created>?').get(user,kind,now-600000))return;
 db.prepare('INSERT INTO matchlove_email_outbox(id,user,kind,created,next_attempt) VALUES(?,?,?,?,?)').run(randomUUID(),user,kind,now,now);
}
export function startEmailWorker(db,{origin,fetcher=fetch,intervalMs=15000}={}){
 let busy=false,stopped=false;
 async function tick(){if(busy||stopped||!process.env.RESEND_API_KEY||!process.env.MATCHLOVE_MAIL_FROM)return;busy=true;
 try{const rows=db.prepare('SELECT * FROM matchlove_email_outbox WHERE sent IS NULL AND attempts<3 AND next_attempt<=? ORDER BY created LIMIT 5').all(Date.now());for(const row of rows){if(stopped)break;const account=db.prepare('SELECT email FROM auth_accounts WHERE id=?').get(row.user);if(!account||!emailSettings(db,row.user)[row.kind]){db.prepare('DELETE FROM matchlove_email_outbox WHERE id=?').run(row.id);continue;}
 const subject=row.kind==='likes'?'У тебя новая симпатия в MatchLove':'У тебя новое сообщение в MatchLove';
 try{const r=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify({from:process.env.MATCHLOVE_MAIL_FROM,to:[account.email],subject,text:subject+'.\n\nОткрой MatchLove: '+origin+'/\n\nОтключить эти письма можно в профиле, в разделе «Уведомления на email».'})});if(!r.ok)throw Error('Provider status '+r.status);if(!stopped)db.prepare('UPDATE matchlove_email_outbox SET sent=? WHERE id=?').run(Date.now(),row.id);}catch{if(!stopped){db.prepare('UPDATE matchlove_email_outbox SET attempts=attempts+1,next_attempt=? WHERE id=?').run(Date.now()+60000*(row.attempts+1),row.id);console.warn('MatchLove email delivery failed; queued for retry');}}
 }if(!stopped)db.prepare('DELETE FROM matchlove_email_outbox WHERE created<?').run(Date.now()-7*86400000);
 }finally{busy=false;}}
 const timer=setInterval(()=>void tick().catch(()=>console.warn('MatchLove email worker failed')),intervalMs);timer.unref();return ()=>{stopped=true;clearInterval(timer);};
}
