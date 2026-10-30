// Local fixtures only. Validate navigation, responsive layout and screenshots.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';
import {hashPassword} from '../server/auth.mjs';
const dir=await mkdtemp(join(tmpdir(),'ll-design-')),origin='http://127.0.0.1:3197';
const h=createServer({origin,dataDir:dir,secureCookies:false,registration:true,adminIds:'design-owner'});
h.sqlite.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?)').run('design-owner','design@example.test',await hashPassword('design-test-password'),Date.now());
h.sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('design-owner','Илья','1990-01-01','Москва','man','all','Люблю прогулки, музыку и путешествия.','Серьёзные отношения','["Кофе","Книги","Кино"]',new Date().toISOString(),0);

h.server.listen(3197,'127.0.0.1');await once(h.server,'listening');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:'design@example.test',password:'design-test-password'}});
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Поздравляем!',exact:true}).waitFor();
 assert.match(await page.locator('.level-celebration').innerText(),/У тебя уровень 2/);
 assert.match(await page.locator('.level-celebration').innerText(),/Задание выполнено/);
 await page.getByRole('button',{name:'Продолжить',exact:true}).click();
 await page.waitForTimeout(900);assert.equal(await page.locator('.level-celebration').count(),0);
 await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(900);assert.equal(await page.locator('.level-celebration').count(),0);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#fff9f6');assert.equal(await page.locator('.level-panel').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 229, 239)');}
 await page.getByRole('button',{name:'Скрыть панель уровней',exact:true}).click();
 await page.waitForTimeout(200);assert.equal(await page.locator('.rail').count(),0);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.rail').count(),0);
 await page.getByRole('button',{name:'Мой уровень',exact:true}).click();await page.getByRole('button',{name:'Показывать панель уровней',exact:true}).waitFor();
 await page.getByRole('button',{name:'Показывать панель уровней',exact:true}).click();await page.waitForTimeout(200);
 await page.getByRole('button',{name:'Знакомства',exact:true}).click();assert.equal(await page.locator('.rail').count(),1);
 const other=await browser.newPage();await other.goto(origin);assert.equal(await other.locator('.rail').count(),1);await other.close();
 assert.deepEqual(errors,[]);console.log('Levels and panel PASS: congratulations, persistent dismissal, restore and separate guest state.');
}finally{await browser.close();await new Promise(resolve=>h.server.close(resolve));await rm(dir,{recursive:true,force:true});}
