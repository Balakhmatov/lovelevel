const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const isAdmin=(id,ids)=>String(ids||'').split(',').map(s=>s.trim()).includes(id);
const allowed="NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.sender=? AND b.recipient=x.sender) OR (b.sender=x.sender AND b.recipient=?))";
export function notifications(db,user,admin=false){
 const likes=db.prepare(`SELECT x.sender||':'||x.created AS item FROM likes x WHERE x.recipient=? AND ${allowed} AND NOT EXISTS(SELECT 1 FROM matchlove_notification_reads r WHERE r.user=? AND r.kind='likes' AND r.item=x.sender||':'||x.created)`).all(user,user,user,user);
 const rows=db.prepare(`SELECT x.sender,COUNT(*) AS n FROM messages x WHERE x.recipient=? AND ${allowed} AND EXISTS(SELECT 1 FROM likes a JOIN likes b ON b.sender=a.recipient AND b.recipient=a.sender WHERE a.sender=? AND a.recipient=x.sender) AND NOT EXISTS(SELECT 1 FROM matchlove_notification_reads r WHERE r.user=? AND r.kind='messages' AND r.item=x.id) GROUP BY x.sender`).all(user,user,user,user,user);
 const chats=Object.fromEntries(rows.map(r=>[r.sender,r.n])),messages=rows.reduce((n,r)=>n+r.n,0);
 const users=admin?db.prepare("SELECT a.id FROM auth_accounts a WHERE a.id<>? AND NOT EXISTS(SELECT 1 FROM matchlove_notification_reads r WHERE r.user=? AND r.kind='users' AND r.item=a.id) ORDER BY a.created DESC LIMIT 1000").all(user,user).map(r=>r.id):[];
 const reports=admin?db.prepare("SELECT COUNT(*) n FROM reports WHERE status='open'").get().n:0;
 return {likes:likes.length,likeItems:likes.map(r=>r.item),messages,chats,users:users.length,userItems:users,reports,total:likes.length+messages,adminTotal:users.length+reports};
}
export async function handleNotifications(request,{sqlite:db,userId,adminIds=''}){
 if(!userId)return json({error:'Войди в аккаунт'},401);const admin=isAdmin(userId,adminIds);
 if(request.method==='GET')return json(notifications(db,userId,admin));
 if(request.method!=='POST')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const b=await request.json().catch(()=>null);if(!b||!['likes','messages','users'].includes(b.kind))return json({error:'Некорректное уведомление'},400);
 if(b.kind==='users'&&!admin)return json({error:'Нет доступа'},403);
 let items=[];
 if(b.kind==='messages'){
  const last=db.prepare('SELECT rowid,sender FROM messages WHERE id=? AND recipient=?').get(String(b.lastMessage||''),userId);if(!last)return json({error:'Сообщение недоступно'},404);
  if(db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(userId,last.sender,last.sender,userId))return json({error:'Переписка недоступна'},403);
  items=db.prepare('SELECT id FROM messages WHERE sender=? AND recipient=? AND rowid<=?').all(last.sender,userId,last.rowid).map(r=>r.id);
 }else{
  if(!Array.isArray(b.items)||b.items.length>1000||b.items.some(x=>typeof x!=='string'||x.length>200))return json({error:'Некорректный список'},400);
  const snapshot=notifications(db,userId,admin),valid=new Set(b.kind==='likes'?snapshot.likeItems:snapshot.userItems);items=b.items.filter(x=>valid.has(x));
 }
 const insert=db.prepare('INSERT OR IGNORE INTO matchlove_notification_reads(user,kind,item) VALUES(?,?,?)');db.exec('BEGIN');try{for(const item of items)insert.run(userId,b.kind,item);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 return json(notifications(db,userId,admin));
}
