import {chromium} from '/opt/codex/cua_node/lib/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().includes('/api/auth/')&&r.status()>=400)console.log('Auth error',r.status(),(await r.json()).error);});
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:3118';
const email='qa-'+Date.now()+'@example.test',password='browser-test-password-12345';
fs.mkdirSync('outputs',{recursive:true});
try {
await page.goto(origin,{waitUntil:'networkidle'});
await page.getByRole('heading',{name:'Знакомства'}).waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'outputs/vps-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/vps-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1100});
await page.getByRole('button',{name:'Войти',exact:true}).click();
await page.getByRole('button',{name:'Первый раз? Создать аккаунт',exact:true}).click();await page.getByRole('heading',{name:'Создать аккаунт',exact:true}).waitFor();
await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(password);await page.locator('#auth-form input[name=adult]').check();await page.locator('#auth-form input[name=terms]').check();await page.locator('#auth-form button[type=submit]').click();
await page.locator('#profile-form').waitFor();await page.locator('#name').fill('Тестировщик');await page.locator('#birthdate').fill('1995-05-20');await page.locator('#city').fill('Москва');await page.locator('#bio').fill('Обожаю путешествовать, готовить завтраки и знакомиться с интересными людьми.');
await page.locator('[data-interest="Кофе"]').click();await page.locator('[data-interest="Книги"]').click();await page.locator('[data-interest="Кино"]').click();await page.locator('#profile-form input[name=adult]').check();await page.locator('#profile-form input[name=terms]').check();await page.locator('#profile-form button[type=submit]').click();
await page.getByRole('heading',{name:'Моя галерея'}).waitFor();
await page.locator('#upload-form input[type=file]').setInputFiles('assets/demo-portraits.jpg');await page.locator('#upload-form button').click();await page.locator('.gallery-item .label').filter({hasText:'На проверке'}).waitFor();
await page.getByRole('button',{name:'Мой уровень',exact:true}).click();await page.locator('[data-action=claim][data-key=basics]').click();await page.getByRole('dialog').waitFor();await page.locator('[data-action=close]').click();
assert.match(await page.locator('.level-number > strong').first().textContent(),/02/);
await page.getByRole('button',{name:'Выйти',exact:true}).click();await page.getByRole('button',{name:'Войти',exact:true}).waitFor();
await page.getByRole('button',{name:'Войти',exact:true}).click();await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(password);await page.locator('#auth-form button[type=submit]').click();
await page.getByRole('button',{name:'Мой профиль',exact:true}).click();await page.getByRole('heading',{name:'Моя галерея'}).waitFor();assert.equal(await page.locator('#name').inputValue(),'Тестировщик');
await page.getByRole('button',{name:'Сменить пароль',exact:true}).click();await page.locator('#current-password').fill(password);await page.locator('#new-password').fill(password+'-new');await page.locator('#password-form button').click();await page.getByRole('dialog').waitFor({state:'hidden'});
await page.getByRole('button',{name:'Знакомства',exact:true}).click();
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(4000);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
await page.screenshot({path:'outputs/vps-mobile-signed-in.png',fullPage:true});
await page.getByRole('button',{name:'Посмотреть демо',exact:true}).click();await page.locator('[data-action=person]').first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
assert.deepEqual(errors,[]);console.log('Browser PASS: real registration → profile → photo upload → progress → logout → login → persisted photo/profile → password change → mobile layout.');
console.log('Photos loaded',await page.locator('.portrait img').evaluateAll(xs=>xs.every(i=>i.complete&&i.naturalWidth>0)));
await browser.close();

} catch(error){await page.screenshot({path:'outputs/vps-browser-failure.png',fullPage:true});console.log('Visible state:',(await page.locator('body').innerText()).slice(-2000));await browser.close();throw error;}
