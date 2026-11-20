import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/matchlove.js','utf8').replace("window.addEventListener('hashchange',()=>{});boot();","window.addEventListener('hashchange',()=>{});");
function app(text){
 const listeners={},storage=new Map(),field={value:text},notices=[],requests=[];let modal=null;
 const context=vm.createContext({console,crypto,URL,URLSearchParams,Blob,Response,
  location:{search:'',pathname:'/',origin:'https://example.test'},
  sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  localStorage:{getItem:()=>null,setItem:()=>{}},navigator:{sendBeacon:()=>true},
  document:{querySelector:selector=>selector==='#about'?field:selector==='[data-search-auth]'?modal:null,querySelectorAll:()=>[],addEventListener:(name,fn)=>(listeners[name]||=[]).push(fn),visibilityState:'visible',referrer:''},
  window:{addEventListener:()=>{}},setTimeout:()=>1,setInterval:()=>1,clearTimeout:()=>{},clearInterval:()=>{},requestAnimationFrame:()=>{},fetch:async()=>new Response('{}'),
  FormData:class{get(key){return ({email:'test@example.test',password:'test-password'})[key]||null;}},
  showModal:(title,html)=>{modal={dataset:{},html,setAttribute(){},querySelector:selector=>selector==='h2'?{remove(){}}:{focus(){}},close(){modal=null;}};return modal;},
  notify:value=>notices.push(value),record:path=>requests.push(path)
 });
 vm.runInContext(source,context);
 vm.runInContext("utilityDialog=showModal;toast=notify;render=()=>{};clearTagSuggestions=()=>{};go=async(page)=>{S.page=page;};api=async(path,opt)=>{record(path);if(path==='me')return {id:'owner',gender:'male'};if(path==='ai-match')return opt?.method==='POST'?{ok:true}:{results:[]};return {};};startPresence=()=>{};loadSearchSettings=async()=>{};restoreSearchPhoto=async()=>{};restoreLocation=async()=>{};loadMatches=async()=>{};",context);
 return {context,notices,requests,storage,field,listeners,get modal(){return modal;},run:code=>vm.runInContext(code,context)};
}
test('Guest search opens auth for empty, one-character, short and oversized text without validating or requesting matches',async()=>{
 for(const text of ['','я','x'.repeat(99),'x'.repeat(12001)]){
  const view=app(text);await view.run('search()');assert(view.modal);assert.equal(view.modal.dataset.searchAuth,'true');assert(view.modal.html.includes('id="auth"'));assert.equal(view.field.value,text);assert(view.storage.has('matchlove-search-draft:guest')||[...view.storage.values()].includes(text));assert.deepEqual(view.notices,[]);assert.deepEqual(view.requests,[]);
  assert(!view.run('pageHome()').includes('minlength="100"'));
 }
});
test('After successful registration the same short draft hits the existing minimum and stays available',async()=>{
 const view=app('я');await view.run("S.authMode='register';search()");
 const submit=view.listeners.submit.find(fn=>fn.toString().includes("e.target.id==='auth'"));
 await submit({target:{id:'auth'},preventDefault(){}});
 assert.equal(view.modal,null);assert.equal(view.run('S.logged'),true);assert.equal(view.run('S.query'),'я');assert.equal(view.run('S.page'),'home');assert(view.notices.some(text=>text.includes('100')));assert(!view.requests.includes('ai-match'));assert(view.run('pageHome()').includes('minlength="100"'));
});
test('A sufficiently detailed guest draft resumes matching after registration',async()=>{
 const view=app('Описание интересов и пожеланий. '.repeat(6));await view.run("S.authMode='register';search()");
 const submit=view.listeners.submit.find(fn=>fn.toString().includes("e.target.id==='auth'"));
 await submit({target:{id:'auth'},preventDefault(){}});
 assert.equal(view.modal,null);assert.equal(view.run('S.page'),'results');assert.equal(view.requests.filter(path=>path==='ai-match').length,2);
});
test('Switching to registration keeps authentication in the popup and preserves the guest draft',async()=>{
 const view=app('я');await view.run('search()');
 const click=view.listeners.click.find(fn=>fn.toString().includes("closest('#toggleauth')"));
 await click({target:{closest:selector=>selector==='#toggleauth'?{}:null}});
 assert(view.modal);assert(view.modal.html.includes('Зарегистрироваться'));assert.equal(view.run('S.query'),'я');assert.equal(view.run('S.page'),'home');
});

test('Existing account login restores saved description and never parses guest text',async()=>{
 const view=app('A');await view.run('search()');
 await view.run("const originalAPI=api;api=async(path,opt)=>path==='ai-match'&&!opt?.method?{source:'Сохранённое подробное описание из аккаунта',results:[{id:'candidate'}]}:originalAPI(path,opt);");
 const submit=view.listeners.submit.find(fn=>fn.toString().includes("e.target.id==='auth'"));await submit({target:{id:'auth'},preventDefault(){}});
 assert.equal(view.run('S.query'),'Сохранённое подробное описание из аккаунта');assert.equal(view.field.value,'Сохранённое подробное описание из аккаунта');assert.equal(view.run('S.page'),'home');assert.equal(view.modal,null);assert(!view.requests.includes('ai-match'));assert(![...view.storage.values()].includes('A'));
});
test('Existing account without saved text does not inherit a guest draft',async()=>{
 const view=app('Случайно набранный гостевой текст');await view.run('search()');
 const submit=view.listeners.submit.find(fn=>fn.toString().includes("e.target.id==='auth'"));await submit({target:{id:'auth'},preventDefault(){}});
 assert.equal(view.run('S.query'),'');assert.equal(view.field.value,'');assert.equal(view.run('S.page'),'home');assert.equal(view.requests.filter(p=>p==='ai-match').length,1);
});
