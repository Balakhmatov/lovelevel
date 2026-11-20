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

export const DIGEST_DAY=86400000;
const enabled=(s,kind)=>kind==='matches'?s.likes:s[kind];
export function enqueueEmail(db,user,kind,now=Date.now(),peer=null){
 if(!['likes','matches','messages'].includes(kind)||!enabled(emailSettings(db,user),kind))return;
 db.prepare('INSERT OR IGNORE INTO matchlove_email_digest_state(user,window_end,next_due) VALUES(?,?,?)').run(user,now+DIGEST_DAY,now+DIGEST_DAY);
 db.prepare('INSERT INTO matchlove_email_events(user,kind,peer,created) VALUES(?,?,?,?)').run(user,kind,peer,now);
}
const escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function digestMail({email,from,origin,counts,start,end}){
 const lines=[['likes','Новые симпатии'],['matches','Взаимные мэтчи'],['messages','Новые сообщения']].filter(([key])=>counts[key]>0).map(([key,label])=>label+': '+counts[key]);
 const date=x=>new Date(x).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
 const subject='Твои итоги за сутки в MatchLove',period=date(start)+' — '+date(end)+' (Москва)',link=new URL('/',origin).href;
 return {from,to:[email],subject,
 text:subject+'\n'+period+'\n\n'+lines.join('\n')+'\n\nОткрыть MatchLove: '+link+'\n\nНастроить или отключить письма: Профиль → Уведомления на email.',
 html:`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#160e14;font-family:Arial,Helvetica,sans-serif;color:#faf8fb"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#160e14"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#21171f;border-radius:24px"><tr><td style="padding:32px 28px 20px"><a href="${escape(link)}" style="text-decoration:none;color:#faf8fb"><img src="${escape(new URL('/android-chrome-192x192.png',origin).href)}" width="56" height="56" alt="MatchLove" style="display:block;border:0;width:56px;height:56px"><span style="display:block;margin-top:10px;font-size:22px;font-weight:bold;color:#faf8fb">Match<span style="color:#ff355f">Love</span></span></a></td></tr><tr><td style="padding:0 28px 32px"><h1 style="margin:0 0 12px;font-size:26px;line-height:1.3;color:#faf8fb">${escape(subject)}</h1><p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#bdb0ba">${escape(period)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${lines.map(line=>'<tr><td style="padding:12px 0;border-bottom:1px solid #44303e;font-size:16px;line-height:1.5;color:#faf8fb">'+escape(line)+'</td></tr>').join('')}</table><table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:28px"><tr><td bgcolor="#b2ff7b" style="border-radius:14px"><a href="${escape(link)}" style="display:inline-block;padding:16px 24px;font-size:16px;font-weight:bold;color:#15200f;text-decoration:none;border-radius:14px">Открыть MatchLove</a></td></tr></table><p style="margin:28px 0 0;font-size:12px;line-height:1.7;color:#bdb0ba">Настроить или отключить письма:<br>Профиль → Уведомления на email.</p></td></tr></table></td></tr></table></body></html>`};
}
function prepareDigests(db,{origin,from,now}){
 // Close full 24h windows; a long outage never produces a stack of old summaries.
 const states=db.prepare("SELECT d.* FROM matchlove_email_digest_state d JOIN matchlove_email_settings s ON s.user=d.user WHERE d.next_due<=? AND (d.last_sent IS NULL OR d.last_sent<=?) AND (s.likes=1 OR s.messages=1) AND NOT EXISTS(SELECT 1 FROM matchlove_email_outbox o WHERE o.user=d.user AND o.kind='digest' AND o.sent IS NULL) ORDER BY d.next_due LIMIT 100").all(now,now-DIGEST_DAY);
 for(const state of states){
  const settings=emailSettings(db,state.user),account=db.prepare('SELECT email FROM auth_accounts WHERE id=?').get(state.user);if(!account)continue;
  const end=now-state.window_end>=DIGEST_DAY?now:state.window_end,start=end-DIGEST_DAY;
  const events=db.prepare('SELECT e.id,e.kind FROM matchlove_email_events e WHERE e.user=? AND e.digest IS NULL AND e.created>=? AND e.created<? AND (e.peer IS NULL OR NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.sender=e.user AND b.recipient=e.peer) OR (b.sender=e.peer AND b.recipient=e.user)))').all(state.user,start,end);
  const selected=events.filter(e=>enabled(settings,e.kind)),counts={likes:0,matches:0,messages:0};for(const event of selected)counts[event.kind]++;
  db.exec('BEGIN IMMEDIATE');try{
   if(selected.length){const id=randomUUID(),payload={likes:settings.likes,messages:settings.messages,mail:digestMail({email:account.email,from,origin,counts,start,end})};
    db.prepare('INSERT INTO matchlove_email_outbox(id,user,kind,created,next_attempt,payload) VALUES(?,?,?,?,?,?)').run(id,state.user,'digest',now,now,JSON.stringify(payload));
    const assign=db.prepare('UPDATE matchlove_email_events SET digest=? WHERE id=?');for(const event of selected)assign.run(id,event.id);
   }
   db.prepare('DELETE FROM matchlove_email_events WHERE user=? AND digest IS NULL AND created<?').run(state.user,end);
   db.prepare('UPDATE matchlove_email_digest_state SET window_end=?,next_due=? WHERE user=?').run(end+DIGEST_DAY,Math.max(end+DIGEST_DAY,now+15000),state.user);
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
}
export async function runEmailDigestTick(db,{origin,fetcher=fetch,now=()=>Date.now(),apiKey=process.env.RESEND_API_KEY,from=process.env.MATCHLOVE_MAIL_FROM,stopped=()=>false}={}){
 if(stopped()||!apiKey||!from)return;
 const time=now();
 // Reuse one immutable payload/key only within the provider's 24h idempotency window.
 db.prepare("DELETE FROM matchlove_email_outbox WHERE kind='digest' AND sent IS NULL AND created<=?").run(time-DIGEST_DAY);
 prepareDigests(db,{origin,from,now:time});
 const rows=db.prepare("SELECT o.* FROM matchlove_email_outbox o JOIN matchlove_email_digest_state d ON d.user=o.user WHERE o.kind='digest' AND o.sent IS NULL AND o.attempts<3 AND o.next_attempt<=? AND (d.last_sent IS NULL OR d.last_sent<=?) ORDER BY o.created LIMIT 5").all(time,time-DIGEST_DAY);
 for(const row of rows){
  if(stopped())break;
  const account=db.prepare('SELECT email FROM auth_accounts WHERE id=?').get(row.user),settings=emailSettings(db,row.user),payload=JSON.parse(row.payload);
  if(!account||settings.likes!==payload.likes||settings.messages!==payload.messages||account.email!==payload.mail.to[0]){db.prepare('DELETE FROM matchlove_email_outbox WHERE id=?').run(row.id);continue;}
  try{
   // Reserve the next daily slot even if provider acceptance is ambiguous.
   db.prepare('UPDATE matchlove_email_digest_state SET next_due=MAX(next_due,?) WHERE user=?').run(now()+DIGEST_DAY,row.user);
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify(payload.mail)});
   if(!response.ok)throw Error('Provider status '+response.status);
   // Persist acceptance even if graceful shutdown started while awaiting the response.
   const sent=now();db.exec('BEGIN IMMEDIATE');try{
    db.prepare('UPDATE matchlove_email_outbox SET sent=? WHERE id=?').run(sent,row.id);
    db.prepare('UPDATE matchlove_email_digest_state SET last_sent=?,next_due=MAX(next_due,?) WHERE user=?').run(sent,sent+DIGEST_DAY,row.user);db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
  }catch{
   db.prepare('UPDATE matchlove_email_outbox SET attempts=attempts+1,next_attempt=? WHERE id=?').run(now()+60000*(row.attempts+1),row.id);
   console.warn('MatchLove daily digest delivery failed; queued for retry');
  }
 }
 db.prepare('DELETE FROM matchlove_email_outbox WHERE created<?').run(time-7*DIGEST_DAY);
 db.prepare('DELETE FROM matchlove_email_events WHERE created<?').run(time-7*DIGEST_DAY);
}
export function startEmailWorker(db,{origin,fetcher=fetch,intervalMs=15000,now=()=>Date.now()}={}){
 let busy=false,stopped=false;
 async function tick(){if(busy||stopped)return;busy=true;try{await runEmailDigestTick(db,{origin,fetcher,now,stopped:()=>stopped});}catch{console.warn('MatchLove email worker failed');}finally{busy=false;}}
 const timer=setInterval(()=>void tick(),intervalMs);timer.unref();return ()=>{stopped=true;clearInterval(timer);};
}

