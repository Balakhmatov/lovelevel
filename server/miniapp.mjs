import {createHmac,timingSafeEqual} from 'node:crypto';

// Bot-token validation, not the alternative third-party Ed25519 protocol.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function verifyMiniApp(raw,botToken,now=Date.now()){
 if(typeof raw!=='string'||!raw||raw.length>32768||!botToken)return null;
 const params=new URLSearchParams(raw),entries=[...params.entries()];
 if(entries.length>32||new Set(entries.map(([k])=>k)).size!==entries.length)return null;
 if(entries.some(([k,v])=>!/^[_a-z]+$/.test(k)||k.includes('\n')||v.includes('\n')))return null;
 const hash=params.get('hash')||'',date=Number(params.get('auth_date'));
 if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isSafeInteger(date)||date<=0)return null;
 const age=Math.floor(now/1000)-date;if(age>600||age< -30)return null;
 const check=entries.filter(([k])=>k!=='hash').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
 const secret=createHmac('sha256','WebAppData').update(botToken).digest();
 const expected=createHmac('sha256',secret).update(check).digest();
 if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))return null;
 let user;try{user=JSON.parse(params.get('user')||'null');}catch{return null;}
 if(!user||!Number.isSafeInteger(user.id)||user.id<=0||user.is_bot===true||typeof user.first_name!=='string')return null;
 return {id:String(user.id),username:typeof user.username==='string'?user.username.slice(0,64):'',proof:'miniapp:'+hash,expires:(date+630)*1000};
}
