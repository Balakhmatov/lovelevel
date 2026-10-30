// Two isolated browser sessions; local fixtures only, no production accounts.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';import {hashPassword} from '../server/auth.mjs';
const origin='http://127.0.0.1:3196',dir=await mkdtemp(join(tmpdir(),'ll-chat-progress-'));
const h=createServer({origin,dataDir:dir,secureCookies:false,registration:true});
for(const [id,name] of [['alice','Алиса'],['bob','Борис']]){
 h.sqlite.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?)').run(id,id+'@example.test',await hashPassword('browser-test-password'),Date.now());
 h.sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,name,'1995-01-01','Москва','woman','all','','Знакомства и общение','[]',new Date().toISOString(),0);
}
h.server.listen(3196,'127.0.0.1');await once(h.server,'listening');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const contexts=await Promise.all([browser.newContext({viewport:{width:390,height:844}}),browser.newContext({viewport:{width:1440,height:1000}})]);const [a,b]=await Promise.all(contexts.map(c=>c.newPage()));const errors=[];for(const page of [a,b])page.on('pageerror',e=>errors.push(e.message));
const write=async(page,path,body)=>page.request.post(origin+'/api/'+path,{headers:{Origin:origin},data:body});
async function claimTask(page,key){const button=page.locator(`[data-action=claim][data-key=${key}]`);await button.click();await button.waitFor({state:'hidden'});await closeDialog(page);}
async function closeDialog(page){if(await page.getByRole('dialog').count())await page.getByRole('button',{name:'Закрыть',exact:true}).click();}
try{
 for(const [page,id] of [[a,'alice'],[b,'bob']]){await write(page,'auth/login',{email:id+'@example.test',password:'browser-test-password'});await page.goto(origin,{waitUntil:'networkidle'});}
 assert.equal((await write(a,'chat/bob',{body:'До взаимности'})).status(),403);
 await a.locator('[data-action=like][data-id=bob]').click();await b.locator('[data-action=like][data-id=alice]').click();await b.getByRole('dialog',{name:'Взаимная симпатия'}).waitFor();await b.getByRole('button',{name:'Написать сообщение',exact:true}).click();
 await a.getByRole('button',{name:'Сообщения',exact:true}).click();await a.locator('.match-row').click();
 await a.locator('#chat-form input').fill('Привет, Борис!');await a.locator('#chat-form button').click();await b.locator('.bubble').filter({hasText:'Привет, Борис!'}).waitFor({timeout:12000});
 await b.locator('#chat-form input').fill('Привет, Алиса!');await b.locator('#chat-form button').click();await a.locator('.bubble').filter({hasText:'Привет, Алиса!'}).waitFor({timeout:12000});
 await a.reload({waitUntil:'networkidle'});await a.getByRole('button',{name:'Сообщения',exact:true}).click();await a.locator('.match-row').click();await a.locator('.bubble').filter({hasText:'Привет, Алиса!'}).waitFor();assert.equal(await a.locator('.bubble').count(),2);await closeDialog(a);
 // Every task has a working tool and a claim action. No points are inserted.
 await a.getByRole('button',{name:'Мой уровень',exact:true}).click();
 for(const key of ['profile','intent']){await claimTask(a,key);}
 await a.locator('[data-action=task-tool][data-key=about]').click();await a.locator('#bio').fill('Люблю длинные прогулки, хорошее кино и поездки в новые города по выходным.');await a.locator('#profile-form button[type=submit]').click();await a.locator('#profile-form').waitFor({state:'hidden'});await claimTask(a,'about');
 await a.locator('[data-action=task-tool][data-key=interests]').click();for(const interest of ['Кофе','Книги','Кино'])await a.locator(`[data-interest="${interest}"]`).click();await a.locator('#profile-form button[type=submit]').click();await claimTask(a,'interests');
 await a.locator('[data-action=task-tool][data-key=photos]').click();for(let i=0;i<3;i++){await a.locator('#upload-form input[type=file]').setInputFiles('assets/demo-portraits.jpg');await a.locator('#upload-form button').click();if(i<2)await a.locator('.gallery-item').nth(i).waitFor();}
 await claimTask(a,'photos');
 let me=await(await a.request.get(origin+'/api/me')).json();assert.equal(me.points,30);assert.equal(me.tasks.filter(t=>t.claimed).length,5);assert.equal(me.level,5);
 await a.locator('[data-action=daily]').click();await a.waitForFunction(()=>document.querySelector('[data-action=daily]')?.disabled);assert.equal(await a.locator('[data-action=daily]').isDisabled(),true);me=await(await a.request.get(origin+'/api/me')).json();assert.equal(me.points,32);
 await mkdir('outputs',{recursive:true});await a.screenshot({path:'outputs/completed-tasks-mobile.png',fullPage:true});
 await a.getByRole('button',{name:'Сообщения',exact:true}).click();await a.locator('.match-row').click();a.once('dialog',d=>d.accept());await a.getByRole('button',{name:'Заблокировать',exact:true}).click();await a.getByRole('dialog').waitFor({state:'hidden'});assert.equal((await write(b,'chat/alice',{body:'После блокировки'})).status(),403);assert.equal((await(await b.request.get(origin+'/api/matches')).json()).matches.length,0);
 assert.deepEqual(errors,[]);console.log('PASS: two-way chat, polling, reload persistence, block enforcement; all five task tools, claims and daily reward via mobile UI.');
}catch(error){console.log('STATE',await a.locator('body').innerText());await mkdir('outputs',{recursive:true});await a.screenshot({path:'outputs/chat-progress-failure.png',fullPage:true});throw error;}finally{await browser.close();h.server.closeAllConnections();await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true});}
