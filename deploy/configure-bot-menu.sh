#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root on the VPS'; exit 1; }
NODE=/usr/local/bin/node-lovelevel
[[ -x "$NODE" && -f /etc/lovelevel/telegram.env ]] || { echo 'Configure Telegram login first.'; exit 1; }
# The token stays on the VPS. Do not source or print configuration files.
"$NODE" --input-type=module <<'JS'
import fs from 'node:fs';
import {webhookSecret} from '/opt/lovelevel/current/server/bot-menu.mjs';
const config=fs.readFileSync('/etc/lovelevel/telegram.env','utf8');
const token=config.split('\n').find(line=>line.startsWith('TELEGRAM_BOT_TOKEN='))?.slice('TELEGRAM_BOT_TOKEN='.length);
const origin='https://lovelevel.cityai.site';
async function call(method,body){const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!data.ok)throw Error(method);return data.result;}
try{
 if(!token)throw Error('missing token');
 const local=await fetch('http://127.0.0.1:3118/api/telegram/webhook',{signal:AbortSignal.timeout(5000)});if(local.status!==405)throw Error('app update is not deployed yet');
 const bot=await call('getMe',{});if(bot.username?.toLowerCase()!=='lovelevel_app_bot')throw Error('wrong bot');
 await call('setMyCommands',{commands:[{command:'start',description:'Открыть меню LoveLevel'},{command:'menu',description:'Приложение и веб-версия'},{command:'about',description:'О приложении'}]});
 await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Открыть LoveLevel',web_app:{url:origin+'/miniapp'}}});
 await call('setWebhook',{url:origin+'/api/telegram/webhook',secret_token:webhookSecret(token),allowed_updates:['message','callback_query']});
 console.log('Меню настроено. Откройте @lovelevel_app_bot и отправьте /start.');
}catch(error){console.error('Bot menu setup failed:',/^[a-zA-Z0-9 ]+$/.test(error.message)?error.message:'Telegram connection error');process.exit(1);}
JS
