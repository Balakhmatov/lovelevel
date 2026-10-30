import test from 'node:test';
import assert from 'node:assert/strict';
import {botMenu,webhookSecret} from '../server/bot-menu.mjs';
const token='test-token',origin='https://lovelevel.cityai.site';
const request=(update,secret=webhookSecret(token))=>new Request(origin+'/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':secret,'Content-Type':'application/json'},body:JSON.stringify(update)});
test('Bot menu authenticates Telegram updates before replying',async()=>{assert.equal((await botMenu(request({message:{text:'/start',chat:{id:11,type:'private'}}},'wrong'),{token,origin})).status,403);});
test('Start returns Mini App, website and about buttons to a private chat',async()=>{const r=await(await botMenu(request({message:{text:'/start hello',chat:{id:11,type:'private'}}}),{token,origin})).json();assert.equal(r.method,'sendMessage');assert.equal(r.chat_id,11);const rows=r.reply_markup.inline_keyboard;assert.equal(rows[0][0].web_app.url,origin+'/miniapp');assert.equal(rows[1][0].url,origin);assert.equal(rows[2][0].callback_data,'lovelevel_about');});
test('About button opens concise product information',async()=>{const r=await(await botMenu(request({callback_query:{id:'abc',data:'lovelevel_about',message:{chat:{type:'private'}}}}),{token,origin})).json();assert.equal(r.method,'answerCallbackQuery');assert.equal(r.show_alert,true);assert.ok(r.text.includes('18 лет'));assert.ok(r.text.length<=200);});
test('Group messages and unrelated text produce no outgoing message',async()=>{for(const message of [{text:'/start',chat:{id:1,type:'group'}},{text:'hello',chat:{id:1,type:'private'}}])assert.deepEqual(await(await botMenu(request({message}),{token,origin})).json(),{ok:true});});
test('HTTP webhook is reachable without a user session but requires Telegram secret',async()=>{
 const {createServer}=await import('../server/index.mjs');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {once}=await import('node:events');
 const dir=await mkdtemp(join(tmpdir(),'ll-menu-'));const h=createServer({origin:'http://127.0.0.1:3197',dataDir:dir,secureCookies:false,telegramBotToken:token});h.server.listen(0,'127.0.0.1');await once(h.server,'listening');const base='http://127.0.0.1:'+h.server.address().port;
 try{
  assert.equal((await fetch(base+'/api/telegram/webhook',{method:'POST',body:'{}'})).status,403);
  const response=await fetch(base+'/api/telegram/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':webhookSecret(token)},body:JSON.stringify({message:{text:'/menu',chat:{id:123,type:'private'}}})});assert.equal(response.status,200);assert.equal((await response.json()).method,'sendMessage');
 }finally{h.server.closeAllConnections();await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true});}
});
