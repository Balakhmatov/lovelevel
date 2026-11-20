import {randomUUID} from 'node:crypto';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
export async function handleModeration(request,{sqlite:db,userId:id}){
 if(!id)return json({error:'Войди в аккаунт'},401);
 const url=new URL(request.url),path=url.pathname;
 if(path==='/api/blocks'&&request.method==='GET')return json({blocks:db.prepare("SELECT b.recipient AS id,COALESCE(NULLIF(json_extract(p.parsed,'$.self.name'),''),'Участник') AS name FROM blocks b LEFT JOIN matchlove_profiles p ON p.user=b.recipient WHERE b.sender=? ORDER BY b.created DESC").all(id)});
 if(request.method!=='POST')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник'},403);
 const b=await request.json().catch(()=>null),target=typeof b?.target==='string'?b.target:'';
 if(!target||target.length>100||target===id)return json({error:'Выбери собеседника'},400);
 if(path==='/api/unblock'){db.prepare('DELETE FROM blocks WHERE sender=? AND recipient=?').run(id,target);return json({ok:true});}
 if(!db.prepare('SELECT 1 FROM auth_accounts WHERE id=?').get(target))return json({error:'Анкета недоступна'},404);
 const now=new Date().toISOString();
 if(path==='/api/block'){
  db.prepare('INSERT OR IGNORE INTO blocks(sender,recipient,created) VALUES(?,?,?)').run(id,target,now);
  return json({ok:true});
 }
 if(path==='/api/report'){
  const reason=typeof b.reason==='string'?b.reason.trim():'';
  if(!reason||reason.length>1000)return json({error:'Укажи причину жалобы: до 1000 символов'},400);
  if('block' in b&&typeof b.block!=='boolean')return json({error:'Некорректная настройка блокировки'},400);
  let message=null;
  if(b.message){const row=db.prepare('SELECT id FROM messages WHERE id=? AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))').get(b.message,id,target,target,id);if(!row)return json({error:'Сообщение недоступно'},403);message=row.id;}
  const recent=db.prepare('SELECT COUNT(*) AS n FROM reports WHERE reporter=? AND created>?').get(id,new Date(Date.now()-3600000).toISOString()).n;
  if(recent>=10)return json({error:'Жалобы уже отправлены. Попробуй позже.'},429);
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('INSERT INTO reports(id,reporter,target,reason,message,created) VALUES(?,?,?,?,?,?)').run(randomUUID(),id,target,reason,message,now);
   if(b.block)db.prepare('INSERT OR IGNORE INTO blocks(sender,recipient,created) VALUES(?,?,?)').run(id,target,now);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return json({ok:true,blocked:!!b.block});
 }
 return json({error:'Не найдено'},404);
}
