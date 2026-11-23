import {matchVisibility} from './match-visibility.mjs';
import {randomUUID} from 'node:crypto';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{16,64}$/.test(x);
const text=(x,max=100)=>typeof x==='string'?x.trim().slice(0,max):'';
const pages=new Set(['home','results','profile','viewProfile','chats','conversation','premium','login','loading','admin']);
const rates=new WeakMap();
function allowBeat(db,key,now){
 let state=rates.get(db);if(!state){state=new Map();rates.set(db,state);}
 const bucket=Math.floor(now/60000);for(const [k,v] of state)if(v.bucket!==bucket)state.delete(k);
 const entry=state.get(key)||{bucket,count:0};if(!state.has(key)&&state.size>=10000)return false;
 entry.count++;state.set(key,entry);return entry.count<=120;
}
export const isAnalyticsAdmin=(id,ids='')=>!!id&&ids.split(',').map(x=>x.trim()).filter(Boolean).includes(id);
export function recordProductEvent(db,request,userId,response,now=Date.now()){
 if(!response.ok)return;
 const path=new URL(request.url).pathname,method=request.method;
 const events={
  'POST /api/auth/register':'registration', 'POST /api/auth/login':'login',
  'PATCH /api/ml-profile':'profile_saved', 'POST /api/ai-match':'profile_saved',
  'GET /api/ai-match':'search', 'POST /api/ml-like':'like',
  'POST /api/ml-chat':'message', 'POST /api/search-photo':'photo_uploaded',
  'POST /api/block':'block', 'POST /api/report':'report'
 };
 const name=events[method+' '+path];if(!name||!userId)return;
 const sid=request.headers.get('x-analytics-session');
 const session=validId(sid)?db.prepare('SELECT id FROM analytics_sessions WHERE id=? AND user=?').get(sid,userId)?.id:null;
 db.prepare('INSERT INTO analytics_events(user,session,name,created) VALUES(?,?,?,?)').run(userId,session||null,name,now);
}
export async function handleAnalytics(request,{sqlite:db,userId,adminIds='',now=Date.now(),ip=''}={}){
 const url=new URL(request.url);
 if(url.pathname==='/api/analytics'){
  if(request.method!=='POST')return json({error:'Метод недоступен'},405);
  if(request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник'},403);
  if(!allowBeat(db,ip||userId||'local',now))return json({error:'Слишком много событий'},429);
  const b=await request.json().catch(()=>null);
  if(!b||!validId(b.session)||!validId(b.visitor)||!pages.has(b.page)||!Number.isFinite(b.seconds)||b.seconds<0||b.seconds>30)return json({error:'Некорректное событие'},400);
  const old=db.prepare('SELECT * FROM analytics_sessions WHERE id=?').get(b.session);
  if(old&&((old.user&&old.user!==userId)||old.visitor!==b.visitor))return json({error:'Сессия недоступна'},403);
  // Bill only elapsed server time, cap gaps, and never count hidden-tab catch-up.
  const seconds=old?Math.min(Math.floor(b.seconds),Math.max(0,Math.floor((now-old.seen)/1000)),30):0;
  let source=text(b.source)||'direct';if(!/^[\p{L}\p{N}_. -]{1,100}$/u.test(source))source='other';
  const landing=text(b.landing,160);const safeLanding=/^\/[a-zA-Z0-9/_-]*$/.test(landing)?landing:'/';
  db.prepare('INSERT INTO analytics_sessions(id,visitor,user,started,seen,active_seconds,source,medium,campaign,landing,page) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user=COALESCE(analytics_sessions.user,excluded.user),seen=excluded.seen,active_seconds=analytics_sessions.active_seconds+?,page=excluded.page').run(b.session,b.visitor,userId||null,now,now,0,source,text(b.medium),text(b.campaign),safeLanding,b.page,seconds);
  return json({ok:true});
 }
 if(!isAnalyticsAdmin(userId,adminIds))return json({error:'Доступ только для администратора'},403);
 if(request.method!=='GET')return json({error:'Метод недоступен'},405);
 const days=Number(url.searchParams.get('days')||30);if(![7,30,90].includes(days))return json({error:'Выбери 7, 30 или 90 дней'},400);
 const since=now-days*86400000,iso=new Date(since).toISOString();
 const adminList=adminIds.split(',').map(x=>x.trim()).filter(Boolean);
 const excluded=adminList.length?adminList:[''];const marks=excluded.map(()=>'?').join(',');
 const one=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args);
 const sessionFilter=`(user IS NULL OR user NOT IN (${marks}))`;
 if(url.pathname==='/api/admin/match-check'){
  const target=url.searchParams.get('user')||'';if(!db.prepare('SELECT 1 FROM auth_accounts WHERE id=?').get(target))return json({error:'Пользователь не найден'},404);
  const result=matchVisibility(db,userId,target);db.prepare('INSERT INTO audits(id,actor,action,target,created) VALUES(?,?,?,?,?)').run(randomUUID(),userId,'check_match_visibility',target,new Date(now).toISOString());return json(result);
 }
 if(url.pathname==='/api/admin/messages'){
  const target=url.searchParams.get('user')||'';if(!db.prepare('SELECT 1 FROM auth_accounts WHERE id=?').get(target))return json({error:'Пользователь не найден'},404);
  const messages=all('SELECT id,sender,recipient,body,created FROM messages WHERE sender=? OR recipient=? ORDER BY created DESC,id DESC LIMIT 100',target,target).reverse();
  db.prepare('INSERT INTO audits(id,actor,action,target,created) VALUES(?,?,?,?,?)').run(randomUUID(),userId,'view_user_messages',target,new Date(now).toISOString());return json({messages,limit:100});
 }
 if(url.pathname==='/api/admin/users'){
  const query=String(url.searchParams.get('q')||'').trim().slice(0,120),needle=query.toLocaleLowerCase('ru');
  const found=needle?all("SELECT a.id,a.email,COALESCE(json_extract(p.parsed,'$.self.name'),(SELECT json_extract(o.data,'$.self.name') FROM matchlove_profile_overrides o WHERE o.user=a.id),'') AS name FROM auth_accounts a LEFT JOIN matchlove_profiles p ON p.user=a.id ORDER BY a.created DESC").filter(u=>[u.id,u.email,u.name].some(v=>String(v).toLocaleLowerCase('ru').includes(needle))).slice(0,100).map(u=>u.id):[];
  const searchClause=needle?' AND a.id IN ('+(found.length?found.map(()=>'?').join(','):'NULL')+')':'';
  const users=all(`SELECT a.id,a.email,a.gender,a.created,EXISTS(SELECT 1 FROM matchlove_account_bans ban WHERE ban.user=a.id) AS banned,COALESCE(NULLIF(json_extract(p.parsed,'$.self.name'),''),(SELECT json_extract(o.data,'$.self.name') FROM matchlove_profile_overrides o WHERE o.user=a.id),'Участник') AS name,p.user IS NOT NULL AS profile,
   (SELECT MAX(seen) FROM analytics_sessions WHERE user=a.id) AS last_seen,
   (SELECT COALESCE(SUM(active_seconds),0) FROM analytics_sessions WHERE user=a.id) AS active_seconds,
   (SELECT COUNT(*) FROM likes WHERE sender=a.id) AS likes,
   (SELECT COUNT(*) FROM messages WHERE sender=a.id) AS messages
   FROM auth_accounts a LEFT JOIN matchlove_profiles p ON p.user=a.id WHERE a.id NOT IN (${marks})${searchClause}
   ORDER BY COALESCE((SELECT MAX(seen) FROM analytics_sessions WHERE user=a.id),a.created) DESC,a.id LIMIT 100`,...excluded,...found);
  return json({users,limit:100,query});
 }
 if(url.pathname!=='/api/admin/analytics')return json({error:'Не найдено'},404);
 const totals=one(`SELECT COUNT(*) AS sessions,COUNT(DISTINCT visitor) AS visitors,COUNT(DISTINCT user) AS active_users,COALESCE(SUM(active_seconds),0) AS active_seconds FROM analytics_sessions WHERE started>=? AND ${sessionFilter}`,since,...excluded);
 totals.online=one(`SELECT COUNT(DISTINCT user) AS n FROM analytics_sessions WHERE seen>=? AND ${sessionFilter}`,now-45000,...excluded).n;
 totals.registrations=one(`SELECT COUNT(*) AS n FROM auth_accounts WHERE created>=? AND id NOT IN (${marks})`,since,...excluded).n;
 const sources=all(`SELECT source,medium,campaign,COUNT(*) AS sessions,COUNT(DISTINCT visitor) AS visitors,COUNT(DISTINCT user) AS users,COALESCE(SUM(active_seconds),0) AS active_seconds FROM analytics_sessions WHERE started>=? AND ${sessionFilter} GROUP BY source,medium,campaign ORDER BY sessions DESC LIMIT 40`,since,...excluded);
 for(const source of sources)source.registrations=one(`SELECT COUNT(*) AS n FROM auth_accounts a WHERE a.created>=? AND a.id NOT IN (${marks}) AND (SELECT s.source||char(31)||s.medium||char(31)||s.campaign FROM analytics_sessions s WHERE s.user=a.id ORDER BY s.started,s.id LIMIT 1)=?`,since,...excluded,source.source+'\x1f'+source.medium+'\x1f'+source.campaign).n;
 const daily=all(`SELECT date(started/1000,'unixepoch','+3 hours') AS day,COUNT(*) AS sessions,COUNT(DISTINCT visitor) AS visitors,SUM(active_seconds) AS active_seconds FROM analytics_sessions WHERE started>=? AND ${sessionFilter} GROUP BY day ORDER BY day`,since,...excluded);
 const cohort=all(`SELECT a.id,
   EXISTS(SELECT 1 FROM matchlove_profiles p WHERE p.user=a.id) AS profile,
   EXISTS(SELECT 1 FROM likes l WHERE l.sender=a.id) AS liked,
   EXISTS(SELECT 1 FROM likes l JOIN likes r ON r.sender=l.recipient AND r.recipient=l.sender WHERE l.sender=a.id) AS matched,
   EXISTS(SELECT 1 FROM messages m WHERE m.sender=a.id) AS chatted
   FROM auth_accounts a WHERE a.created>=? AND a.id NOT IN (${marks})`,since,...excluded);
 const funnel={registered:cohort.length,profile:0,liked:0,matched:0,chatted:0};
 for(const a of cohort){if(!a.profile)continue;funnel.profile++;if(!a.liked)continue;funnel.liked++;if(!a.matched)continue;funnel.matched++;if(a.chatted)funnel.chatted++;}
 const events=all(`SELECT name,COUNT(*) AS count,COUNT(DISTINCT user) AS users FROM analytics_events WHERE created>=? AND user NOT IN (${marks}) GROUP BY name`,since,...excluded);
 const retention={};
 for(const offset of [1,7])retention['d'+offset]=one(`SELECT COUNT(*) AS eligible,COALESCE(SUM(EXISTS(SELECT 1 FROM analytics_sessions s WHERE s.user=a.id AND date(s.started/1000,'unixepoch','+3 hours')=date(a.created/1000,'unixepoch','+3 hours','+${offset} days'))),0) AS returned FROM auth_accounts a WHERE a.created>=? AND date(a.created/1000,'unixepoch','+3 hours','+${offset} days')<date(?/1000,'unixepoch','+3 hours') AND a.id NOT IN (${marks})`,since,now,...excluded);
 const first=one('SELECT MIN(started) AS started FROM analytics_sessions').started;
 db.prepare('INSERT INTO audits(id,actor,action,target,created) VALUES(?,?,?,?,?)').run(randomUUID(),userId,'view_analytics',String(days),new Date(now).toISOString());
 return json({days,since,now,trackingSince:first,totals,sources,daily,funnel,events,retention,notes:'Посетители — браузеры; время — активные интервалы до 30 секунд. Администраторы исключены. Воронка — зарегистрированные в выбранный период; удержание — только завершённые дни, Москва.'});
}
