// Development-only browser fixture: Telegram's external widget is mocked;
// signed callback verification, cookies, linking and application UI are real.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {createHash,createHmac} from 'node:crypto';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';
import {hashPassword} from '../server/auth.mjs';
const token='123456789:TestOnlyNotARealSecret01234567890';
const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const dir=await mkdtemp(join(tmpdir(),'ll-tg-browser-')),origin='http://127.0.0.1:'+port;
const h=createServer({origin,dataDir:dir,secureCookies:false,registration:true,adminIds:'existing-owner',telegramBotToken:token});
h.sqlite.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?)').run('existing-owner','owner@example.test',await hashPassword('browser-test-password'),Date.now());
h.sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('existing-owner','Тестовый владелец','1995-01-01','Москва','man','all','Описание тестового профиля владельца.','Знакомства и общение','["Кофе","Книги","Кино"]',new Date().toISOString(),0);
h.sqlite.prepare('INSERT INTO rewards VALUES(?,?,?,?)').run('existing-owner','profile',20,new Date().toISOString());
h.server.listen(port,'127.0.0.1');await once(h.server,'listening');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let serial=0;
await page.route('https://telegram.org/js/telegram-widget.js*',async route=>{const data={id:900077,first_name:'Тест',username:'browser_owner',auth_date:Math.floor(Date.now()/1000)+serial++};data.hash=createHmac('sha256',createHash('sha256').update(token).digest()).update(Object.keys(data).sort().map(k=>k+'='+data[k]).join('\n')).digest('hex');await route.fulfill({contentType:'application/javascript',body:`(()=>{const button=document.createElement('button');button.textContent='Подтвердить Telegram';button.type='button';button.className='telegram-button';button.onclick=()=>window.LoveLevelTelegramAuth(${JSON.stringify(data)});document.currentScript.parentElement.appendChild(button);})();`});});
try{
 await page.goto(origin,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Войти',exact:true}).click();await page.locator('#auth-email').fill('owner@example.test');await page.locator('#auth-password').fill('browser-test-password');await page.locator('#auth-form button[type=submit]').click();await page.getByRole('button',{name:'Выйти',exact:true}).waitFor();
 await page.getByRole('button',{name:'Мой профиль',exact:true}).click();await page.getByRole('button',{name:'Привязать Telegram',exact:true}).click();await page.getByRole('button',{name:'Продолжить через Telegram',exact:true}).click();await page.getByRole('button',{name:'Подтвердить Telegram',exact:true}).click();await page.getByText(/Telegram @browser_owner привязан/).waitFor();
 let me=await(await page.request.get(origin+'/api/me')).json();assert.equal(me.id,'existing-owner');assert.equal(me.level,5);assert.equal(me.admin,true);
 await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Войти',exact:true}).click();await page.getByRole('button',{name:'Войти через Telegram',exact:true}).click();await page.locator('#telegram-form input[name=adult]').check();await page.locator('#telegram-form input[name=terms]').check();await page.getByRole('button',{name:'Продолжить через Telegram',exact:true}).click();await page.getByRole('button',{name:'Подтвердить Telegram',exact:true}).click();await page.getByRole('button',{name:'Выйти',exact:true}).waitFor();
 me=await(await page.request.get(origin+'/api/me')).json();assert.equal(me.id,'existing-owner');assert.equal(me.profile.name,'Тестовый владелец');assert.equal(me.level,5);assert.equal(me.admin,true);
 await page.getByRole('button',{name:'Мой профиль',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Сменить пароль',exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mkdir('outputs',{recursive:true});await page.screenshot({path:'outputs/telegram-linked-mobile.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Telegram browser PASS: native login → link → logout → Telegram login → same profile, level and admin ID. Provider widget mocked.');
}finally{await browser.close();h.server.closeAllConnections();await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true});}
