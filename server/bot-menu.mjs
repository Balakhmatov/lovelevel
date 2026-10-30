import {createHmac,timingSafeEqual} from 'node:crypto';

export const aboutText='LoveLevel — знакомства с системой уровней. Все анкеты видны сразу. Уровень открывает дополнительные материалы. Взаимная симпатия — переписку. Прогресс сохраняется. Только с 18 лет.';
export function webhookSecret(token){return createHmac('sha256',token).update('lovelevel:bot-menu:webhook:v1').digest('hex');}
export function menuKeyboard(origin){return {inline_keyboard:[[{text:'Открыть приложение',web_app:{url:origin+'/miniapp'}}],[{text:'Веб-версия',url:origin}],[{text:'О приложении',callback_data:'lovelevel_about'}]]};}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function botMenu(request,{token,origin}){
 if(!token)return json({ok:false},404);
 if(request.method!=='POST')return json({ok:false},405);
 const actual=Buffer.from(request.headers.get('x-telegram-bot-api-secret-token')||''),expected=Buffer.from(webhookSecret(token));
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return json({ok:false},403);
 let update;try{update=await request.json();}catch{return json({ok:false},400);}
 if(!update||typeof update!=='object')return json({ok:false},400);
 const callback=update.callback_query;
 if(callback?.data==='lovelevel_about'&&callback.message?.chat?.type==='private'&&typeof callback.id==='string')return json({method:'answerCallbackQuery',callback_query_id:callback.id,text:aboutText,show_alert:true});
 const message=update.message;
 if(message?.chat?.type!=='private'||!Number.isSafeInteger(message.chat.id)||typeof message.text!=='string')return json({ok:true});
 const command=message.text.trim().split(/\s/)[0].split('@')[0].toLowerCase();
 if(!['/start','/menu','/about'].includes(command))return json({ok:true});
 return json({method:'sendMessage',chat_id:message.chat.id,text:command==='/about'?aboutText:'LoveLevel\n\nЗнакомства, фотографии и общение. Выберите, где открыть приложение.',reply_markup:menuKeyboard(origin)});
}
