import {randomUUID} from 'node:crypto';
const J=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const name=(r)=>r.name||'Участник '+r.id.slice(0,6);
const person=(r)=>({id:r.id,name:name(r),city:r.city||'',age:r.age_min||null});
function checkBlocked(db,a,b){return !!db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(a,b,b,a)}
function status(db,a,b){const sent=!!db.prepare('SELECT 1 FROM likes WHERE sender=? AND recipient=?').get(a,b);const received=!!db.prepare('SELECT 1 FROM likes WHERE sender=? AND recipient=?').get(b,a);return {liked:sent,likedMe:received,matched:sent&&received}}
export async function handleSocial(request,{sqlite:db,userId:id}){
 if(!id)return J({error:'Войди в аккаунт'},401);
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(method!=='GET'&&request.headers.get('origin')!==url.origin)return J({error:'Недопустимый источник'},403);
 if(path==='/api/ml-social'&&method==='GET'){
  const rows=db.prepare("SELECT m.user AS id,COALESCE(NULLIF(json_extract(m.parsed,'$.self.name'),''),p.name,'') AS name,COALESCE(NULLIF(json_extract(m.parsed,'$.self.location'),''),p.city,'') AS city,CAST(json_extract(m.parsed,'$.self.age_min') AS INTEGER) AS age_min, (SELECT 1 FROM likes my WHERE my.sender=? AND my.recipient=m.user) AS liked, (SELECT 1 FROM likes theirs WHERE theirs.sender=m.user AND theirs.recipient=?) AS liked_me FROM matchlove_profiles m LEFT JOIN profiles p ON p.id=m.user WHERE m.user<>? AND NOT EXISTS(SELECT 1 FROM blocks WHERE (sender=? AND recipient=m.user) OR (sender=m.user AND recipient=?)) AND (EXISTS(SELECT 1 FROM likes l WHERE l.sender=m.user AND l.recipient=?) OR EXISTS(SELECT 1 FROM likes l WHERE l.sender=? AND l.recipient=m.user)) ORDER BY m.updated DESC").all(id,id,id,id,id,id,id);
  const incoming=[],matches=[],outgoing=[];
  for(const r of rows){const p={...person(r),liked:!!r.liked,likedMe:!!r.liked_me,matched:!!r.liked&&!!r.liked_me};if(p.matched)matches.push(p);else if(p.likedMe)incoming.push(p);else outgoing.push(p)}
  return J({incoming,matches,outgoing});
 }
 if(path==='/api/ml-like'&&method==='POST'){
  const body=await request.json().catch(()=>({})),target=typeof body.target==='string'?body.target.slice(0,100):'';
  if(!target||target===id||!db.prepare('SELECT 1 FROM matchlove_profiles WHERE user=?').get(target)||!db.prepare('SELECT 1 FROM matchlove_profiles WHERE user=?').get(id)||checkBlocked(db,id,target))return J({error:'Анкета недоступна'},404);
  const count=db.prepare('SELECT COUNT(*) AS count FROM likes WHERE sender=? AND created>=?').get(id,new Date(Date.now()-86400000).toISOString()).count;
  if(count>=100&&!status(db,id,target).liked)return J({error:'Лимит 100 новых симпатий за сутки'},429);
  db.prepare('INSERT OR IGNORE INTO likes(sender,recipient,created) VALUES(?,?,?)').run(id,target,new Date().toISOString());
  return J({ok:true,...status(db,id,target)});
 }
 if(path==='/api/ml-chat'&&method==='GET'){
  const target=url.searchParams.get('target')||'';if(!target||checkBlocked(db,id,target)||!status(db,id,target).matched)return J({error:'Переписка доступна после взаимного лайка'},403);
  const messages=db.prepare('SELECT id,sender,recipient,body,created FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC,id DESC LIMIT 150').all(id,target,target,id).reverse();
  return J({messages});
 }
 if(path==='/api/ml-chat'&&method==='POST'){
  const b=await request.json().catch(()=>({}));const target=typeof b.target==='string'?b.target.slice(0,100):'',message=typeof b.body==='string'?b.body.trim().slice(0,3000):'';
  if(!target||checkBlocked(db,id,target)||!status(db,id,target).matched)return J({error:'Переписка доступна после взаимного лайка'},403);
  if(!message)return J({error:'Введите сообщение'},400);
  const sent=db.prepare('SELECT COUNT(*) AS n FROM messages WHERE sender=? AND created>=?').get(id,new Date(Date.now()-60000).toISOString()).n;
  if(sent>=20)return J({error:'Слишком много сообщений'},429);
  const mid=randomUUID();db.prepare('INSERT INTO messages(id,sender,recipient,body,created) VALUES(?,?,?,?,?)').run(mid,id,target,message,new Date().toISOString());return J({ok:true,id:mid});
 }
 return J({error:'Не найдено'},404);
}
