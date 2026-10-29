// Development fixture: SDK initData is signed with a fake test token. Cookies
// are stripped to exercise Telegram Web/third-party-cookie-restricted clients.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {createHmac} from 'node:crypto';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';
import {hashPassword} from '../server/auth.mjs';
const token='123456789:TestOnlyNotARealSecret01234567890';
const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
const origin='http://127.0.0.1:'+port,dir=await mkdtemp(join(tmpdir(),'ll-mini-browser-'));
const h=createServer({origin,dataDir:dir,secureCookies:false,registration:true,adminIds:'owner-fixture',telegramBotToken:token});
h.sqlite.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?)').run('owner-fixture','owner@example.test',await hashPassword('mini-browser-password'),Date.now());
h.sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('owner-fixture','Владелец','1995-01-01','Москва','man','all','Тестовая анкета владельца.','Знакомства и общение','[]',new Date().toISOString(),0);
h.sqlite.prepare('INSERT INTO rewards VALUES(?,?,?,?)').run('owner-fixture','profile',20,new Date().toISOString());
await h.env.BUCKET.put('photos/owner-fixture/test-photo',await readFile('assets/demo-portraits.jpg'));
h.sqlite.prepare('INSERT INTO media VALUES(?,?,?,?,?,?,?,?)').run('test-photo','owner-fixture','photos/owner-fixture/test-photo','image/jpeg',1,1,'approved',new Date().toISOString());
h.server.listen(port,'127.0.0.1');await once(h.server,'listening');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});let page;
async function miniPage(id){const page=await browser.newPage({viewport:{width:390,height:844}});const values={auth_date:String(Math.floor(Date.now()/1000)),query_id:'browser-'+id,user:JSON.stringify({id,first_name:'Тест',username:'mini_browser'})};values.hash=createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(Object.keys(values).sort().map(k=>k+'='+values[k]).join('\n')).digest('hex');const raw=new URLSearchParams(values).toString();
 await page.route(origin+'/**',async route=>{const headers={...route.request().headers()};headers.cookie='blocked_cookie_fixture=1';const response=await route.fetch({headers});const responseHeaders={...response.headers()};delete responseHeaders['set-cookie'];await route.fulfill({response,headers:responseHeaders});});
 await page.route('https://telegram.org/js/telegram-web-app.js*',route=>route.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{initData:${JSON.stringify(raw)},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},safeAreaInset:{bottom:12},onEvent(){},BackButton:{onClick(){},show(){},hide(){}}}};`}));return page;}
try{
 page=await miniPage(800001);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/miniapp',{waitUntil:'networkidle'});await page.getByRole('heading',{name:'LoveLevel в Telegram',exact:true}).waitFor();assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM auth_accounts').get().n,1);
 await page.getByRole('button',{name:'У меня уже есть аккаунт',exact:true}).click();await page.locator('#auth-email').fill('owner@example.test');await page.locator('#auth-password').fill('mini-browser-password');await page.locator('#auth-form button[type=submit]').click();await page.getByRole('button',{name:'Выйти',exact:true}).waitFor();await page.getByRole('button',{name:'Мой профиль',exact:true}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.gallery-item img')].some(i=>i.src.startsWith('blob:')&&i.naturalWidth>0));
 await page.getByRole('button',{name:'Привязать Telegram',exact:true}).click();await page.getByRole('button',{name:'Продолжить через Telegram',exact:true}).click();await page.getByText(/Telegram @mini_browser привязан/).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Выйти',exact:true}).waitFor();await page.getByRole('button',{name:'Мой профиль',exact:true}).click();assert.equal(await page.locator('#name').inputValue(),'Владелец');assert.match(await page.locator('.level-number > strong').first().textContent(),/05/);assert.equal(await page.getByRole('button',{name:'Модерация',exact:true}).count(),1);await page.waitForFunction(()=>[...document.querySelectorAll('.gallery-item img')].some(i=>i.src.startsWith('blob:')&&i.naturalWidth>0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await mkdir('outputs',{recursive:true});await page.screenshot({path:'outputs/miniapp-mobile.png',fullPage:true});assert.deepEqual(errors,[]);await page.close();
 page=await miniPage(800002);await page.goto(origin+'/miniapp',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Создать аккаунт через Telegram',exact:true}).click();await page.locator('#telegram-form input[name=adult]').check();await page.locator('#telegram-form input[name=terms]').check();await page.getByRole('button',{name:'Продолжить через Telegram',exact:true}).click();await page.locator('#profile-form').waitFor();assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM auth_accounts').get().n,2);assert.equal(await page.getByRole('button',{name:'Модерация',exact:true}).count(),0);
 console.log('Mini App browser PASS with cookies blocked: explicit existing-account login → protected photos → link → reload → automatic same owner/level/admin; new Telegram signup remains separate. SDK mocked.');
}catch(e){if(page){await mkdir('outputs',{recursive:true});await page.screenshot({path:'outputs/miniapp-failure.png',fullPage:true});console.log('Images:',await page.locator('.gallery-item img').evaluateAll(xs=>xs.map(x=>({src:x.getAttribute('src'),auth:x.dataset.authImage,loading:x.dataset.authLoading,width:x.naturalWidth,complete:x.complete,alt:x.alt}))));console.log('Errors:',await page.locator('#toast').innerText());}throw e;}
finally{await browser.close();h.server.closeAllConnections();await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true});}
