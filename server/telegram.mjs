import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const allowed=new Set(['id','first_name','last_name','username','photo_url','auth_date','hash']);

// Telegram Login Widget protocol: https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegram(data,botToken,now=Date.now()){
 if(!botToken||!data||typeof data!=='object'||Array.isArray(data))return null;
 if(Object.keys(data).some(k=>!allowed.has(k)))return null;
 if(!Object.entries(data).every(([k,v])=>(typeof v==='string'||(typeof v==='number'&&Number.isSafeInteger(v)))&&String(v).length<=2048&&!String(v).includes('\n')))return null;
 const id=String(data.id||''),date=Number(data.auth_date),hash=String(data.hash||'');
 if(!/^[1-9][0-9]{0,15}$/.test(id)||BigInt(id)>BigInt(Number.MAX_SAFE_INTEGER)||!Number.isSafeInteger(date)||date<=0||!data.first_name||!/^([a-f0-9]{64})$/.test(hash))return null;
 const age=Math.floor(now/1000)-date;if(age>300||age< -30)return null;
 const check=Object.keys(data).filter(k=>k!=='hash').sort().map(k=>k+'='+String(data[k])).join('\n');
 const secret=createHash('sha256').update(botToken).digest();
 const expected=createHmac('sha256',secret).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))return null;
 return {id,username:typeof data.username==='string'?data.username.slice(0,64):'',proof:hash,expires:(date+330)*1000};
}

export function createTelegramAuth(sqlite,{current,newSession,consume},{origin,secure,registration,inviteCode,botToken='',botUsername='lovelevel_app_bot',now=()=>Date.now()}={}){
 const username=String(botUsername).replace(/^@/,'');
 const enabled=/^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(botToken)&&/^[A-Za-z0-9_]{5,32}$/.test(username);
 const challengeCookie=secure?'__Host-lovelevel_tg':'lovelevel_tg_local';
 function cookie(token){return `${challengeCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure?'; Secure':''}`;}
 function browserToken(request){return (request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(challengeCookie+'='))?.slice(challengeCookie.length+1)||'';}
 function status(account){const link=account?sqlite.prepare('SELECT telegram_id,username FROM auth_telegram_links WHERE account=?').get(account.id):null;return {enabled,botUsername:username,linked:!!link,username:link?.username||null};}
 async function route(request,ip){
  const path=new URL(request.url).pathname,account=current(request);
  if(path==='/api/auth/telegram/status'&&request.method==='GET')return account?json(status(account)):json({error:'Войдите в аккаунт'},401);
  if(!enabled)return json({error:'Вход через Telegram ещё не настроен'},503);
  if(request.method!=='POST')return json({error:'Метод недоступен'},405);
  if(request.headers.get('origin')!==origin)return json({error:'Недопустимый источник запроса'},403);
  if(!consume('telegram-ip:'+ip,30,15*60*1000))return json({error:'Слишком много попыток. Попробуйте позже.'},429);
  let b;try{b=await request.json();}catch{return json({error:'Некорректный запрос'},400);}
  if(!b||typeof b!=='object')return json({error:'Некорректный запрос'},400);
  sqlite.prepare('DELETE FROM auth_telegram_challenges WHERE expires<=?').run(now());
  sqlite.prepare('DELETE FROM auth_telegram_proofs WHERE expires<=?').run(now());
  if(path==='/api/auth/telegram/challenge'){
   if(!['login','link'].includes(b.mode))return json({error:'Неверное действие'},400);
   if(b.mode==='link'&&!account)return json({error:'Сначала войдите в свой аккаунт'},401);
   if(b.mode==='login'&&account)return json({error:'Вы уже вошли. Привяжите Telegram в профиле.'},409);
   const token=randomBytes(32).toString('hex');
   sqlite.prepare('INSERT INTO auth_telegram_challenges(token_hash,account,mode,expires) VALUES(?,?,?,?)').run(digest(token),account?.id||null,b.mode,now()+600000);
   return json({challenge:token,botUsername:username},200,{'Set-Cookie':cookie(token)});
  }
  const mode=path==='/api/auth/telegram/login'?'login':path==='/api/auth/telegram/link'?'link':null;
  if(!mode)return json({error:'Не найдено'},404);
  if(mode==='link'&&!account)return json({error:'Сначала войдите в свой аккаунт'},401);
  if(mode==='login'&&account)return json({error:'Вы уже вошли. Привяжите Telegram в профиле.'},409);
  const token=browserToken(request);
  if(typeof b.challenge!=='string'||!/^([a-f0-9]{64})$/.test(token)||!timingSafeEqual(Buffer.from(digest(token)),Buffer.from(digest(b.challenge))))return json({error:'Начните вход через Telegram заново'},403);
  const proof=verifyTelegram(b.telegram,botToken,now());if(!proof)return json({error:'Telegram не подтвердил вход. Попробуйте ещё раз.'},401);
  let target;
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   const challenge=sqlite.prepare('SELECT * FROM auth_telegram_challenges WHERE token_hash=? AND mode=? AND expires>?').get(digest(token),mode,now());
   if(!challenge||challenge.account!==(account?.id||null))throw Object.assign(new Error('Начните вход через Telegram заново'),{status:403});
   if(sqlite.prepare('SELECT 1 FROM auth_telegram_proofs WHERE hash=?').get(proof.proof))throw Object.assign(new Error('Это подтверждение уже использовано. Повторите вход через Telegram.'),{status:409});
   const linked=sqlite.prepare('SELECT account FROM auth_telegram_links WHERE telegram_id=?').get(proof.id);
   if(mode==='link'){
    if(linked&&linked.account!==account.id)throw Object.assign(new Error('Этот Telegram уже привязан к другому аккаунту LoveLevel.'),{status:409});
    const own=sqlite.prepare('SELECT telegram_id FROM auth_telegram_links WHERE account=?').get(account.id);
    if(own&&own.telegram_id!==proof.id)throw Object.assign(new Error('К аккаунту уже привязан другой Telegram.'),{status:409});
    target=account.id;
   }else if(linked){target=linked.account;}
   else{
    if(!registration)throw Object.assign(new Error('Регистрация пока закрыта. Сначала войдите по email и привяжите Telegram.'),{status:403});
    if(b.adult!==true||b.terms!==true)throw Object.assign(new Error('Подтвердите возраст 18+ и правила.'),{status:400});
    if(inviteCode&&(typeof b.invite!=='string'||!timingSafeEqual(Buffer.from(digest(b.invite)),Buffer.from(digest(inviteCode)))))throw Object.assign(new Error('Нужен код приглашения'),{status:403});
    target=randomUUID();
    // Internal provider key: not an email and rejected by password-login validation.
    // Telegram does not supply email; no email/username-based account merging occurs.
    sqlite.prepare('INSERT INTO auth_accounts(id,email,password_hash,created) VALUES(?,?,?,?)').run(target,'telegram:'+proof.id,'!telegram-only',now());
   }
   if(!linked)sqlite.prepare('INSERT INTO auth_telegram_links(telegram_id,account,username,created) VALUES(?,?,?,?)').run(proof.id,target,proof.username,now());
   else sqlite.prepare('UPDATE auth_telegram_links SET username=? WHERE telegram_id=?').run(proof.username,proof.id);
   sqlite.prepare('INSERT INTO auth_telegram_proofs(hash,expires) VALUES(?,?)').run(proof.proof,proof.expires);
   sqlite.prepare('DELETE FROM auth_telegram_challenges WHERE token_hash=?').run(digest(token));
   sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');if(error.status)return json({error:error.message},error.status);throw error;}
  return mode==='login'?json({ok:true},200,{'Set-Cookie':newSession(target)}):json({ok:true,linked:true});
 }
 return {enabled,username,route,status};
}
