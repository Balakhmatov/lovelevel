import {isMain} from './entrypoint.mjs';
import http from 'node:http';
import {statfs} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {openDatabase,diskBucket} from './storage.mjs';
import {createAuth} from './auth.mjs';
import {botMenu} from './bot-menu.mjs';
import {inspectClip} from './media-probe.mjs';
import app from '../dist/server/index.js';

export function createServer({origin,dataDir,secureCookies=true,registration=false,inviteCode='',adminIds='',telegramBotToken='',telegramBotUsername='lovelevel_app_bot',host='127.0.0.1'}={}){
 const url=new URL(origin);if(url.origin!==origin||!['https:','http:'].includes(url.protocol))throw new Error('PUBLIC_ORIGIN must be an exact http(s) origin');
 if(!secureCookies&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Insecure cookies are permitted only on loopback');
 const {sqlite,DB}=openDatabase(resolve(dataDir,'lovelevel.sqlite'),resolve(dirname(fileURLToPath(import.meta.url)),'../drizzle'));
 const auth=createAuth(sqlite,{origin,secure:secureCookies,registration,inviteCode,telegramBotToken,telegramBotUsername});
 const env={DB,BUCKET:diskBucket(resolve(dataDir,'uploads')),ADMIN_USER_IDS:adminIds};
 let uploads=0;
 const server=http.createServer({requestTimeout:180000,headersTimeout:10000,maxHeaderSize:16*1024},async(req,res)=>{
  let uploadSlot=false;
  try{
   const path=new URL(req.url,origin);if(!req.url.startsWith('/')||req.url.startsWith('//')||path.origin!==origin){res.writeHead(400);res.end();return;}
   // Nginx overwrites this header. The service itself must bind only to loopback.
   const ip=req.socket.remoteAddress==='127.0.0.1'||req.socket.remoteAddress==='::1'?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
   if(path.pathname==='/api/upload'){
    const early=auth.current(new Request(path,{headers:{Cookie:req.headers.cookie||'',Authorization:req.headers.authorization||''}}));
    const status=!early?401:req.headers.origin!==origin?403:!sqlite.prepare('SELECT 1 FROM profiles WHERE id=?').get(early.id)?409:uploads>=1?429:0;
    if(status){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:status===401?'Войдите в аккаунт':status===403?'Недопустимый источник запроса':status===409?'Сначала создайте анкету':'Загружается другой файл. Повторите через несколько секунд.'}));req.resume();return;}
    uploads++;uploadSlot=true;
    const space=await statfs(dataDir);if(space.bavail*space.bsize<1024**3+50*1024**2){res.writeHead(507,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'На сервере недостаточно свободного места. Загрузки временно недоступны.'}));req.resume();return;}
   }
   const limit=path.pathname==='/api/upload'?52*1024*1024:64*1024;
   if(Number(req.headers['content-length']||0)>limit){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"Запрос слишком большой"}');req.resume();return;}
   const chunks=[];let total=0;for await(const c of req){total+=c.length;if(total>limit){res.writeHead(413,{'Content-Type':'application/json'});res.end('{"error":"Запрос слишком большой"}');return;}chunks.push(c);}
   const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value!==undefined&&!key.toLowerCase().startsWith('oai-')&&!key.toLowerCase().startsWith('x-lovelevel-'))headers.set(key,Array.isArray(value)?value.join(', '):value);}
   const method=req.method;let request=new Request(path,{method,headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});
   const identity=auth.current(request);
   if(identity)headers.set('x-lovelevel-user-id',identity.id);
   let processedForm=null;
   if(path.pathname==='/api/upload'&&method==='POST'&&identity&&headers.get('origin')===origin){
    const form=await request.clone().formData(),file=form.get('file');
    if(file instanceof File&&!file.type.startsWith('image/')){try{const info=await inspectClip(file);headers.set('x-lovelevel-media-duration',String(info.duration));headers.set('x-lovelevel-media-compressed','1');form.set('file',new File([info.bytes],info.mime==='video/mp4'?'video.mp4':'voice.m4a',{type:info.mime}));processedForm=form;}catch(error){res.writeHead(error.status||400,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:error.message}));return;}}
   }
   if(processedForm){headers.delete('content-type');headers.delete('content-length');}
   request=new Request(path,{method,headers,body:processedForm||(['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks))});
   let response;
   if(path.pathname==='/api/telegram/webhook')response=await botMenu(request,{token:telegramBotToken,origin});
   else if(path.pathname.startsWith('/api/auth/'))response=await auth.route(request,ip);
   else if(path.pathname==='/api/account'&&method==='DELETE'){
    if(!identity)response=new Response('{"error":"Войдите в аккаунт"}',{status:401,headers:{'Content-Type':'application/json'}});
    else{response=await app.fetch(request,env);if(response.ok){sqlite.prepare('DELETE FROM auth_accounts WHERE id=?').run(identity.id);response.headers.set('Set-Cookie',`${auth.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies?'; Secure':''}`);}}
   }else response=await app.fetch(request,env);
   const responseHeaders=Object.fromEntries(response.headers);responseHeaders['X-Content-Type-Options']='nosniff';responseHeaders['Referrer-Policy']='same-origin';if(path.pathname!=='/miniapp')responseHeaders['X-Frame-Options']='DENY';
   if(secureCookies)responseHeaders['Strict-Transport-Security']='max-age=31536000';
   res.writeHead(response.status,responseHeaders);
   if(method==='HEAD'||!response.body)res.end();else await pipeline(Readable.fromWeb(response.body),res);
  }catch(error){console.error('Request failed:',error.code||error.name);if(!res.headersSent){res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Не удалось выполнить запрос. Попробуйте ещё раз."}');}else res.destroy();}finally{if(uploadSlot)uploads--;}
 });
 server.on('close',()=>sqlite.close());
 return {server,sqlite,env,auth,host};
}

if(isMain(import.meta.url)){
 const origin=process.env.PUBLIC_ORIGIN;if(!origin)throw new Error('Set PUBLIC_ORIGIN');
 const production=process.env.NODE_ENV==='production';if(production&&!origin.startsWith('https://'))throw new Error('Production requires HTTPS');
 const {server}=createServer({origin,dataDir:process.env.DATA_DIR||resolve('data'),secureCookies:production||!['127.0.0.1','localhost'].includes(new URL(origin).hostname),registration:process.env.ALLOW_REGISTRATION==='true',inviteCode:process.env.INVITE_CODE||'',adminIds:process.env.ADMIN_USER_IDS||'',telegramBotToken:process.env.TELEGRAM_BOT_TOKEN||'',telegramBotUsername:process.env.TELEGRAM_BOT_USERNAME||'lovelevel_app_bot'});
 const port=Number(process.env.PORT||3118);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PORT');
 server.listen(port,'127.0.0.1',()=>console.log(`LoveLevel listening on 127.0.0.1:${port}`));
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>process.exit(1),10000).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
