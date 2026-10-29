import {createTelegramAuth} from './telegram.mjs';
import {randomBytes,randomUUID,createHash,scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt);
const digest=s=>createHash('sha256').update(s).digest('hex');
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const emailAddress=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=email=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword=p=>typeof p==='string'&&p.length>=10&&p.length<=128;
const options={N:32768,r:8,p:1,maxmem:64*1024*1024};
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,32,options);return 'scrypt$'+salt+'$'+hash.toString('hex');}
export async function verifyPassword(password,encoded){if(typeof password!=='string'||password.length>128)return false;const [type,salt,hex]=encoded.split('$');if(type!=='scrypt'||!/^[a-f0-9]{64}$/.test(hex||''))return false;const expected=Buffer.from(hex,'hex'),actual=await scrypt(password,salt,32,options);return timingSafeEqual(expected,actual);}

export function createAuth(sqlite,{origin,secure=true,registration=true,inviteCode='',telegramBotToken='',telegramBotUsername='lovelevel_app_bot',now=()=>Date.now()}={}) {
 const cookieName=secure?'__Host-lovelevel':'lovelevel_local';
 const sessionAge=30*24*60*60*1000;
 let activeHashes=0;
 const dummy='scrypt$00000000000000000000000000000000$'+'00'.repeat(32);
 function cookie(token='',age=30*24*60*60){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;}
 function requestToken(request){const authorization=request.headers.get('authorization');if(authorization)return authorization.startsWith('Bearer ')?authorization.slice(7):'';return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';}
 function current(request){const raw=requestToken(request);if(!raw||!/^[a-f0-9]{64}$/.test(raw))return null;const row=sqlite.prepare("SELECT a.id,a.email,(a.password_hash LIKE 'scrypt$%') AS password_available FROM auth_sessions s JOIN auth_accounts a ON a.id=s.account WHERE s.token_hash=? AND s.expires>?").get(digest(raw),now());return row||null;}
 function consume(key,limit,windowMs){const bucket=Math.floor(now()/windowMs);sqlite.prepare('DELETE FROM auth_limits WHERE expires<?').run(now());sqlite.prepare('INSERT INTO auth_limits(key,bucket,count,expires) VALUES(?,?,1,?) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1').run(digest(key),bucket,now()+windowMs*2);return sqlite.prepare('SELECT count FROM auth_limits WHERE key=? AND bucket=?').get(digest(key),bucket).count<=limit;}
 function issueSession(account){sqlite.prepare('DELETE FROM auth_sessions WHERE expires<=?').run(now());const token=randomBytes(32).toString('hex');sqlite.prepare('INSERT INTO auth_sessions(token_hash,account,expires,created) VALUES(?,?,?,?)').run(digest(token),account,now()+sessionAge,now());return {cookie:cookie(token),token};}
 function newSession(account){return issueSession(account).cookie;}
 function signedIn(account,body,status=200){const session=issueSession(account);return json({ok:true,...(body.transport==='miniapp'?{sessionToken:session.token}:{})},status,{'Set-Cookie':session.cookie});}
 const telegram=createTelegramAuth(sqlite,{current,newSession,issueSession,consume},{origin,secure,registration,inviteCode,botToken:telegramBotToken,botUsername:telegramBotUsername,now});
 async function route(request,ip){const url=new URL(request.url),path=url.pathname;
  if(path==='/api/auth/config'&&request.method==='GET')return json({registration,inviteRequired:!!inviteCode,provider:'password',telegram:{enabled:telegram.enabled,botUsername:telegram.username,miniApp:true}});
  if(path==='/api/auth/session'&&request.method==='GET'){const account=current(request);return json({signedIn:!!account,email:account&&validEmail(account.email)?account.email:null,passwordAvailable:!!account&&validEmail(account.email)&&!!account.password_available,telegram:telegram.status(account)});}
  if(path.startsWith('/api/auth/telegram/'))return telegram.route(request,ip);
  if(!['/api/auth/register','/api/auth/login','/api/auth/logout','/api/auth/password'].includes(path))return json({error:'Не найдено'},404);
  if(request.method!=='POST')return json({error:'Метод недоступен'},405);
  if(request.headers.get('origin')!==origin)return json({error:'Недопустимый источник запроса'},403);
  if(path==='/api/auth/logout'){const raw=requestToken(request);if(raw)sqlite.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(raw));return json({ok:true},200,{'Set-Cookie':cookie('',0)});}
  if(!consume('ip:'+ip,40,15*60*1000))return json({error:'Слишком много попыток. Попробуйте позже.'},429);
  let b;try{b=await request.json();}catch{return json({error:'Некорректный запрос'},400);}
  if(!b||typeof b!=='object')return json({error:'Некорректный запрос'},400);
  if(path==='/api/auth/password'){
   const account=current(request);if(!account)return json({error:'Войдите в аккаунт'},401);if(!validPassword(b.password))return json({error:'Новый пароль должен содержать 10–128 символов'},400);
   if(activeHashes>=4)return json({error:'Сервис занят. Повторите через минуту.'},429);activeHashes++;
   try{const a=sqlite.prepare('SELECT password_hash FROM auth_accounts WHERE id=?').get(account.id);if(!await verifyPassword(b.currentPassword,a.password_hash))return json({error:'Текущий пароль неверный'},400);const hash=await hashPassword(b.password);sqlite.exec('BEGIN IMMEDIATE');try{sqlite.prepare('UPDATE auth_accounts SET password_hash=? WHERE id=?').run(hash,account.id);sqlite.prepare('DELETE FROM auth_sessions WHERE account=?').run(account.id);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}return signedIn(account.id,b);}finally{activeHashes--;}
  }
  const email=emailAddress(b.email);
  if(!validEmail(email)||typeof b.password!=='string'||b.password.length>128)return json({error:'Проверьте email и пароль'},400);
  if(!consume('account:'+email,12,15*60*1000))return json({error:'Слишком много попыток. Попробуйте позже.'},429);
  if(activeHashes>=4)return json({error:'Сервис занят. Повторите через минуту.'},429);
  if(path==='/api/auth/register'){
   if(!registration)return json({error:'Регистрация пока закрыта. Обратитесь к организатору теста.'},403);
   if(inviteCode&&(typeof b.invite!=='string'||!timingSafeEqual(Buffer.from(digest(b.invite)),Buffer.from(digest(inviteCode)))))return json({error:'Нужен код приглашения'},403);
   if(!validPassword(b.password)||b.adult!==true||b.terms!==true)return json({error:'Пароль: 10–128 символов. Подтвердите возраст 18+ и правила.'},400);
   activeHashes++;try{const hash=await hashPassword(b.password),id=randomUUID();try{sqlite.prepare('INSERT INTO auth_accounts(id,email,password_hash,created) VALUES(?,?,?,?)').run(id,email,hash,now());}catch(error){if(error.code?.startsWith('ERR_SQLITE')&&sqlite.prepare('SELECT 1 FROM auth_accounts WHERE email=?').get(email))return json({error:'Не удалось создать аккаунт. Попробуйте войти или обратитесь в поддержку.'},409);throw error;}return signedIn(id,b,201);}finally{activeHashes--;}
  }
  activeHashes++;try{const account=sqlite.prepare('SELECT id,password_hash FROM auth_accounts WHERE email=?').get(email);const correct=await verifyPassword(b.password,account?.password_hash||dummy);if(!account||!correct)return json({error:'Неверный email или пароль'},401);return signedIn(account.id,b);}finally{activeHashes--;}
 }
 return {route,current,cookieName};
}
