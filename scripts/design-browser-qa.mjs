// Local fixtures only. Validate navigation, responsive layout and screenshots.
import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';
import {hashPassword} from '../server/auth.mjs';
const dir=await mkdtemp(join(tmpdir(),'ll-design-')),origin='http://127.0.0.1:3199';
const h=createServer({origin,dataDir:dir,secureCookies:false,registration:true,adminIds:'design-owner'});
h.sqlite.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?)').run('design-owner','design@example.test',await hashPassword('design-test-password'),Date.now());
h.sqlite.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('design-owner','Илья','1990-01-01','Москва','man','all','Люблю прогулки, музыку и путешествия.','Серьёзные отношения','["Кофе","Книги","Кино"]',new Date().toISOString(),0);
h.sqlite.prepare('INSERT INTO rewards VALUES(?,?,?,?)').run('design-owner','profile',10,new Date().toISOString());
h.server.listen(3199,'127.0.0.1');await once(h.server,'listening');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email:'design@example.test',password:'design-test-password'}});
 await mkdir('outputs',{recursive:true});
 for(const width of [1440,390,320,768]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(origin,{waitUntil:'networkidle'});
  for(const [name,key] of [['Знакомства','discover'],['Симпатии','matches'],['Сообщения','messages'],['Мой уровень','levels'],['Мой профиль','profile'],['Модерация','admin']]){
   await page.getByRole('button',{name,exact:true}).filter({visible:true}).click();await page.waitForTimeout(100);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key}: overflow at ${width}`);
   await page.screenshot({path:`outputs/design-${key}-${width}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Знакомства',exact:true}).click();await page.getByRole('button',{name:'Посмотреть демо',exact:true}).click();await page.screenshot({path:`outputs/design-demo-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('Design PASS: 4 widths × 6 screens, demo cards, no overflow or browser errors.');
}finally{await browser.close();h.server.closeAllConnections();await new Promise(r=>h.server.close(r));await rm(dir,{recursive:true,force:true});}
