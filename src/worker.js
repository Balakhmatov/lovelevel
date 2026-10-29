import { level, age, accessible, rewardTasks, thresholds } from './rules.js';
const J=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const err=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const stamp=()=>new Date().toISOString();
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clean=(s,max=200)=>typeof s==='string'?s.trim().slice(0,max):'';
const all=async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
const one=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
async function points(env,id){return Math.min(100,(await one(env,'SELECT COALESCE(SUM(points),0) AS p FROM rewards WHERE user=?',id)).p);}
async function blocked(env,a,b){return !!await one(env,'SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',a,b,b,a);}
async function matched(env,a,b){return !!await one(env,'SELECT 1 FROM likes a JOIN likes b ON a.sender=b.recipient AND a.recipient=b.sender WHERE a.sender=? AND a.recipient=?',a,b);}
function isAdmin(request,env,id){return (env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean).includes(id);}
async function audit(env,id,action,target){await run(env,'INSERT INTO audits(id,actor,action,target,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),id,action,target,stamp());}
async function publicProfile(env,p,viewer,vlevel){const items=await all(env,'SELECT id,user,min,basic,status FROM media WHERE user=? ORDER BY created,id',p.id);const access=accessible(viewer,p.id,vlevel,items);const own=viewer===p.id;const score=await points(env,p.id);return {id:p.id,name:p.name,age:age(p.birthdate),city:p.city,gender:p.gender,seeking:p.seeking,bio:p.bio,intent:p.intent,interests:JSON.parse(p.interests),level:level(score),paused:!!p.paused,liked:!!await one(env,'SELECT 1 FROM likes WHERE sender=? AND recipient=?',viewer,p.id),matched:await matched(env,viewer,p.id),media:items.filter(m=>own||m.status==='approved').map(m=>({id:m.id,min:m.min,basic:!!m.basic,status:m.status,locked:!access.has(m.id),url:access.has(m.id)?'/api/media/'+m.id:null}))};}
async function api(request,env){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 const id=request.headers.get('x-lovelevel-user-id');
 if(!id)return J({error:'Войдите, чтобы продолжить'},401);
 if(!env.DB||!env.BUCKET)return J({error:'База или хранилище ещё не подключены. Попробуйте позже.'},503);
 if(method!=='GET'&&method!=='HEAD'){
  if(request.headers.get('Origin')!==url.origin)return J({error:'Недопустимый источник запроса'},403);
  const len=Number(request.headers.get('content-length')||0);if(len>6*1024*1024)return J({error:'Файл слишком большой'},413);
 }
 const profile=await one(env,'SELECT * FROM profiles WHERE id=?',id);
 if(path==='/api/me'&&method==='GET'){
  const score=await points(env,id);const count=await one(env,'SELECT COUNT(*) AS n FROM media WHERE user=?',id);const claimed=await all(env,'SELECT key FROM rewards WHERE user=?',id);
  return J({id,admin:isAdmin(request,env,id),profile:profile?await publicProfile(env,profile,id,level(score)):null,points:score,level:level(score),thresholds,tasks:rewardTasks(profile,count.n).map(t=>({...t,claimed:claimed.some(c=>c.key===t.key)})),daily:claimed.some(c=>c.key==='day:'+day()),rulesVersion:'2026-10-mvp'});
 }
 if(path==='/api/birthdate'&&method==='GET')return J({birthdate:profile?.birthdate||null});
 if(path==='/api/profile'&&method==='POST'){
  const b=await request.json();const name=clean(b.name,40),city=clean(b.city,60),bio=clean(b.bio,700),intent=clean(b.intent,80);const a=age(b.birthdate||'');
  if(!name||!city||a<18||a>100||!['woman','man','other'].includes(b.gender)||!['woman','man','all'].includes(b.seeking)||!['Серьёзные отношения','Знакомства и общение','Пока разбираюсь'].includes(intent)||b.adult!==true||b.terms!==true)err('Заполните анкету, подтвердите возраст 18+ и правила');
  if(profile&&profile.birthdate!==b.birthdate)err('Изменить дату рождения можно через поддержку');
  const interests=JSON.stringify([...new Set(Array.isArray(b.interests)?b.interests.map(v=>clean(v,30)).filter(Boolean).slice(0,8):[])]);
  await run(env,'INSERT INTO profiles(id,name,birthdate,city,gender,seeking,bio,intent,interests,created) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,gender=excluded.gender,seeking=excluded.seeking,bio=excluded.bio,intent=excluded.intent,interests=excluded.interests',id,name,b.birthdate,city,b.gender,b.seeking,bio,intent,interests,stamp());
  return J({ok:true});
 }
 if(!profile)err('Сначала создайте анкету',409);
 if(path==='/api/progress'&&method==='POST'){
  const b=await request.json();const count=await one(env,'SELECT COUNT(*) AS n FROM media WHERE user=?',id);const task=rewardTasks(profile,count.n).find(t=>t.key===b.key);
  if(b.key==='daily'){await run(env,'INSERT OR IGNORE INTO rewards(user,key,points,created) VALUES(?,?,2,?)',id,'day:'+day(),stamp());}
  else {if(!task?.ready)err('Сначала завершите действие');await run(env,'INSERT OR IGNORE INTO rewards(user,key,points,created) VALUES(?,?,?,?)',id,task.key,task.points,stamp());}
  return J({ok:true,points:await points(env,id)});
 }
 if(path==='/api/discover'&&method==='GET'){
  const score=await points(env,id);let rows=await all(env,'SELECT * FROM profiles WHERE id<>? AND paused=0 AND NOT EXISTS(SELECT 1 FROM blocks WHERE (sender=? AND recipient=profiles.id) OR (recipient=? AND sender=profiles.id)) ORDER BY created DESC LIMIT 200',id,id,id);
  const city=clean(url.searchParams.get('city'),60);const minimum=Number(url.searchParams.get('minAge')||18),maximum=Number(url.searchParams.get('maxAge')||100);
  rows=rows.filter(p=>(!city||p.city.toLowerCase().includes(city.toLowerCase()))&&(profile.seeking==='all'||p.gender===profile.seeking)&&(p.seeking==='all'||p.seeking===profile.gender)&&age(p.birthdate)>=minimum&&age(p.birthdate)<=maximum);
  return J({profiles:await Promise.all(rows.slice(0,50).map(p=>publicProfile(env,p,id,level(score))))});
 }
 if(path==='/api/upload'&&method==='POST'){
  const count=await one(env,'SELECT COUNT(*) AS n FROM media WHERE user=?',id);if(count.n>=12)err('В тестовой версии доступно 12 фотографий');
  const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||file.size>5*1024*1024||file.size===0)err('Выберите фотографию до 5 МБ');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))err('Поддерживаются JPEG, PNG и WebP');
  const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)err('Формат файла не соответствует изображению');
  const min=Number(form.get('min')||1);if(!Number.isInteger(min)||min<1||min>10)err('Выберите уровень от 1 до 10');
  const mid=crypto.randomUUID(),key='photos/'+id+'/'+mid;const basic=count.n===0?1:0;
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:file.type}});
  try{await run(env,'INSERT INTO media(id,user,key,mime,min,basic,status,created) VALUES(?,?,?,?,?,?,?,?)',mid,id,key,file.type,basic?1:min,basic,'pending',stamp());}catch(e){await env.BUCKET.delete(key);throw e;}
  return J({ok:true,id:mid,status:'pending'});
 }
 const mediaPath=path.match(/^\/api\/media\/([a-zA-Z0-9-]+)$/);
 if(mediaPath){
  const m=await one(env,'SELECT * FROM media WHERE id=?',mediaPath[1]);if(!m||await blocked(env,id,m.user))err('Материал недоступен',404);
  if(method==='DELETE'){if(m.user!==id)err('Нет доступа',403);if(m.basic&&(await one(env,'SELECT COUNT(*) AS n FROM media WHERE user=?',id)).n>1)err('Сначала выберите другое основное фото');await run(env,'DELETE FROM media WHERE id=? AND user=?',m.id,id);await env.BUCKET.delete(m.key);return J({ok:true});}
  if(method==='PATCH'){if(m.user!==id)err('Нет доступа',403);const b=await request.json();if(!Number.isInteger(b.min)||b.min<1||b.min>10)err('Неверный уровень');if(b.basic===true){if(b.min!==1)err('Основное фото всегда доступно с первого уровня');await env.DB.batch([env.DB.prepare('UPDATE media SET basic=0 WHERE user=?').bind(id),env.DB.prepare('UPDATE media SET basic=1,min=1 WHERE id=? AND user=?').bind(m.id,id)]);}else{if(m.basic)err('Сначала выберите другое основное фото');await run(env,'UPDATE media SET min=? WHERE id=? AND user=?',b.min,m.id,id);}return J({ok:true});}
  if(method==='GET'){
   const items=await all(env,'SELECT id,basic,min,status FROM media WHERE user=? ORDER BY created,id',m.user);const access=accessible(id,m.user,level(await points(env,id)),items);
   if(!access.has(m.id))err('Материал откроется на более высоком уровне',403);
   const file=await env.BUCKET.get(m.key);if(!file)err('Файл не найден',404);
   return new Response(file.body,{headers:{'Content-Type':m.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
  }
 }
 if(path==='/api/like'&&method==='POST'){
  const b=await request.json(),target=clean(b.target,200);if(!target||target===id||await blocked(env,id,target)||!await one(env,'SELECT 1 FROM profiles WHERE id=? AND paused=0',target))err('Анкета недоступна',404);
  if(profile.paused)err('Сначала верните анкету в поиск');
  const n=await one(env,"SELECT COUNT(*) AS n FROM likes WHERE sender=? AND created>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')",id);if(n.n>=100)err('На сегодня достаточно новых лайков. Продолжите завтра.',429);
  await run(env,'INSERT OR IGNORE INTO likes(sender,recipient,created) VALUES(?,?,?)',id,target,stamp());return J({ok:true,matched:await matched(env,id,target)});
 }
 if(path==='/api/matches'&&method==='GET'){
  const rows=await all(env,'SELECT p.* FROM profiles p JOIN likes a ON a.recipient=p.id AND a.sender=? JOIN likes b ON b.sender=p.id AND b.recipient=? WHERE NOT EXISTS(SELECT 1 FROM blocks WHERE (sender=? AND recipient=p.id) OR (recipient=? AND sender=p.id)) ORDER BY a.created DESC',id,id,id,id);const score=await points(env,id);
  return J({matches:await Promise.all(rows.map(async p=>({...await publicProfile(env,p,id,level(score)),last:await one(env,'SELECT body,created,sender FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC LIMIT 1',id,p.id,p.id,id)})))});
 }
 const chat=path.match(/^\/api\/chat\/([^/]+)$/);
 if(chat){const target=decodeURIComponent(chat[1]);if(await blocked(env,id,target)||!await matched(env,id,target))err('Переписка доступна после взаимного лайка',403);
  if(method==='GET')return J({messages:(await all(env,'SELECT id,sender,body,created FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC LIMIT 100',id,target,target,id)).reverse()});
  if(method==='POST'){const b=await request.json();const body=clean(b.body,2000);if(!body)err('Введите сообщение');const recent=await one(env,"SELECT COUNT(*) AS n FROM messages WHERE sender=? AND created>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minute')",id);if(recent.n>=20)err('Слишком много сообщений. Подождите минуту.',429);const mid=crypto.randomUUID();await run(env,'INSERT INTO messages(id,sender,recipient,body,created) VALUES(?,?,?,?,?)',mid,id,target,body,stamp());return J({ok:true,id:mid});}
 }
 if(path==='/api/block'&&method==='POST'){const b=await request.json();if(!b.target||b.target===id)err('Неверная анкета');await run(env,'INSERT OR IGNORE INTO blocks(sender,recipient,created) VALUES(?,?,?)',id,clean(b.target,200),stamp());return J({ok:true});}
 if(path==='/api/blocks'&&method==='GET')return J({blocks:await all(env,'SELECT b.recipient AS id,p.name FROM blocks b LEFT JOIN profiles p ON p.id=b.recipient WHERE b.sender=?',id)});
 if(path==='/api/unblock'&&method==='POST'){const b=await request.json();await run(env,'DELETE FROM blocks WHERE sender=? AND recipient=?',id,clean(b.target,200));return J({ok:true});}
 if(path==='/api/report'&&method==='POST'){const b=await request.json();if(!b.target||!clean(b.reason,1000))err('Укажите причину');let message=null;if(b.message){const m=await one(env,'SELECT * FROM messages WHERE id=? AND (sender=? OR recipient=?)',b.message,id,id);if(!m||(m.sender!==b.target&&m.recipient!==b.target))err('Сообщение недоступно',403);message=m.id;}await run(env,'INSERT INTO reports(id,reporter,target,reason,message,created) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,clean(b.target,200),clean(b.reason,1000),message,stamp());return J({ok:true});}
 if(path==='/api/pause'&&method==='POST'){const b=await request.json();await run(env,'UPDATE profiles SET paused=? WHERE id=?',b.paused?1:0,id);return J({ok:true});}
 if(path==='/api/account'&&method==='DELETE'){
  const owned=await all(env,'SELECT key FROM media WHERE user=?',id);await env.DB.batch([['media','user'],['rewards','user'],['profiles','id']].map(([t,c])=>env.DB.prepare('DELETE FROM '+t+' WHERE '+c+'=?').bind(id)).concat(['likes','blocks','messages'].map(t=>env.DB.prepare('DELETE FROM '+t+' WHERE sender=? OR recipient=?').bind(id,id))));for(const m of owned)await env.BUCKET.delete(m.key);return J({ok:true});
 }
 if(path.startsWith('/api/admin')){
  if(!isAdmin(request,env,id))err('Доступ только для модератора',403);
  if(path==='/api/admin/queue'&&method==='GET'){await audit(env,id,'review_queue','pending');return J({media:await all(env,"SELECT m.id,m.user,m.min,m.basic,p.name FROM media m JOIN profiles p ON p.id=m.user WHERE m.status='pending' ORDER BY m.created LIMIT 50"),reports:await all(env,"SELECT id,reporter,target,reason,message,created FROM reports WHERE status='open' ORDER BY created LIMIT 50")});}
  if(path==='/api/admin/photo'&&method==='GET'){const m=await one(env,'SELECT * FROM media WHERE id=?',url.searchParams.get('id'));if(!m)err('Не найдено',404);await audit(env,id,'view_photo',m.id);const file=await env.BUCKET.get(m.key);if(!file)err('Не найдено',404);return new Response(file.body,{headers:{'Content-Type':m.mime,'Cache-Control':'no-store'}});}
  if(path==='/api/admin/review'&&method==='POST'){const b=await request.json();if(!['approved','rejected'].includes(b.status))err('Неверное решение');await run(env,'UPDATE media SET status=? WHERE id=?',b.status,b.id);await audit(env,id,'photo_'+b.status,b.id);return J({ok:true});}
  if(path==='/api/admin/context'&&method==='GET'){const r=await one(env,'SELECT * FROM reports WHERE id=?',url.searchParams.get('id'));if(!r)err('Не найдено',404);await audit(env,id,'view_report_context',r.id);return J({messages:r.message?await all(env,'SELECT id,sender,body,created FROM messages WHERE id=?',r.message):[]});}
  if(path==='/api/admin/resolve'&&method==='POST'){const b=await request.json();await run(env,"UPDATE reports SET status='resolved' WHERE id=?",b.id);await audit(env,id,'resolve_report',b.id);return J({ok:true});}
 }
 return J({error:'Не найдено'},404);
}
export default {async fetch(request,env){try{const path=new URL(request.url).pathname;if(path==='/demo/portraits.jpg')return new Response(Uint8Array.from(atob(DEMO_PORTRAITS),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=86400'}});if(path.startsWith('/api/'))return await api(request,env);if(path==='/health')return J({ok:true,app:'LoveLevel',version:'0.2.0',database:!!env.DB,storage:!!env.BUCKET});if(path==='/favicon.svg')return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="20" fill="#6654dc"/><path d="M32 46S12 34 17 23c4-9 13-5 15 0 2-5 11-9 15 0 5 11-15 23-15 23" fill="white"/></svg>',{headers:{'Content-Type':'image/svg+xml'}});return new Response(HTML,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; frame-src https://oauth.telegram.org https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}});}catch(e){if(!e.status)console.error('Request failed',e.name);return J({error:e.status?e.message:'Не удалось выполнить запрос. Попробуйте ещё раз.'},e.status||500);}}};
