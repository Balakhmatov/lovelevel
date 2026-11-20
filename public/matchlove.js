
const $=s=>document.querySelector(s);
const analyticsState=(()=>{const get=(storage,key)=>{try{return storage.getItem(key);}catch{return null;}},put=(storage,key,value)=>{try{storage.setItem(key,value);}catch{}};let storage;try{storage=localStorage;}catch{}const visitor=get(storage,'ml-visitor')||crypto.randomUUID();put(storage,'ml-visitor',visitor);const params=new URLSearchParams(location.search);let ref='';try{const url=new URL(document.referrer);if(url.origin!==location.origin)ref=url.hostname;}catch{}return {visitor,session:crypto.randomUUID(),owner:null,last:Date.now(),activity:Date.now(),source:params.get('utm_source')||ref||'direct',medium:params.get('utm_medium')||'',campaign:params.get('utm_campaign')||'',landing:location.pathname};})();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',trash:'<path d="M3 6h18M9 6V4h6v2M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',profile:'<circle class="profile-ring" cx="12" cy="12" r="9"/><circle class="profile-head" cx="12" cy="9" r="2.7"/><path d="M6.8 18a5.6 5.6 0 0 1 10.4 0"/>',search:'<circle cx="10" cy="10" r="7"/><path class="search-handle" d="m15 15 6 6"/><path class="search-heart" d="M10 13.5 6.9 10.4a2 2 0 0 1 3.1-2.5 2 2 0 0 1 3.1 2.5Z"/>',logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',chat:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2v-9.5A8.5 8.5 0 0 1 9.5 4h3a8.5 8.5 0 0 1 8.5 7.5Z"/>',crown:'<path d="m2 8 5 4 5-8 5 8 5-4-2 12H4L2 8Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',back:'<path d="m15 18-6-6 6-6"/>',refresh:'<path d="M3 11a9 9 0 0 1 15.36-6.36L21 7"/><path d="M21 3v4h-4"/><path d="M21 13a9 9 0 0 1-15.36 6.36L3 17"/><path d="M7 17H3v4"/>',photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 6-5 4 4 3-3 5 4"/>',send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>'};
const ico=n=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(symbols[n]||symbols.heart)+'</svg>';
const logo=()=>'<img src="/favicon.png?v=matchlove-20261118" width="120" height="120" alt="MatchLove — два профиля образуют сердце">';
const examples=[['Анастасия',26,'Москва',['путешествия','кофе','искусство'],'Люблю маленькие путешествия, большие завтраки и людей с чувством юмора.'],['Мария',24,'Санкт-Петербург',['архитектура','кино','прогулки'],'Коллекционирую красивые места и поводы выключить телефон.'],['Александра',27,'Казань',['книги','музыка','горы'],'Могу рассказать о последней книге. А лучше — послушаю тебя.'],['Виктория',25,'Москва',['море','фотография','йога'],'В выходные меня можно найти у воды или в поисках новых впечатлений.'],['Александр',29,'Санкт-Петербург',['кулинария','горы','музыка'],'Готовлю пасту, хожу в горы и всё ещё верю в случайные встречи.'],['Михаил',28,'Москва',['спорт','кофе','кино'],'Ищу человека, с которым даже обычный вторник станет интереснее.']].map((a,i)=>({id:'demo-'+i,name:a[0],age:a[1],city:a[2],interests:a[3],bio:a[4],demo:true,demoIndex:i}));
const S={page:'home',query:'',image:null,imageURL:'',photos:[],pendingPhotos:[],photoSaving:false,genderSaving:false,locationSaving:false,location:{city:'',enabled:false},photoError:'',me:null,logged:false,profiles:[],results:[],matches:[],social:{incoming:[],matches:[],outgoing:[]},chat:null,messages:[],processing:false,authMode:'login',error:'',chatTimer:null};
let searchResultsDirty=false;
const nav=[['home','Поиск мэтчей','search'],['results','Мои мэтчи','heart'],['chats','Переписки','chat'],['profile','Профиль','profile']];
async function api(path,opt={}){
 let response;try{response=await fetch('/api/'+path,{method:opt.method||'GET',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Analytics-Session':analyticsState.session},body:opt.body?JSON.stringify(opt.body):undefined});}catch{throw Object.assign(new Error('Не удалось связаться с сайтом. Проверь соединение и попробуй ещё раз.'),{code:'NETWORK_ERROR',retryable:true});}
 let data;try{data=await response.json();}catch{throw Object.assign(new Error(response.status>=500?'Упс, сайт временно не ответил. Попробуй ещё раз.':'Не удалось получить ответ сайта. Попробуй ещё раз.'),{code:'HTTP_'+response.status,status:response.status,retryable:true});}
 if(!response.ok)throw Object.assign(new Error(data.error||'Не удалось выполнить запрос. Попробуй ещё раз.'),{code:data.code,status:response.status,retryable:data.retryable,requestId:data.requestId});return data;
}
function brand(){return '<button type="button" class="logo brand-home" data-nav="home" aria-label="MatchLove — Поиск мэтчей">'+logo()+'<span>Match<b>Love</b></span></button>'}
function conflictTags(p){return (p.conflicts||[]).length?'<div class="match-conflicts" aria-label="Несовпадения с твоими пожеланиями">'+p.conflicts.map(f=>'<span class="match-conflict"><b>'+esc(f.label)+'</b><small>'+esc(f.reason)+'</small></span>').join('')+'</div>':'';}
const activeNav=n=>S.page===n||(n==='profile'&&S.page==='viewProfile')||(n==='chats'&&S.page==='conversation');
function navBtn(n){return '<button class="navbtn '+(activeNav(n[0])?'active':'')+'" data-nav="'+n[0]+'">'+ico(n[2])+' '+n[1]+(n[0]==='chats'&&S.social.incoming.length?' <span class="counter">'+S.social.incoming.length+'</span>':'')+'</button>'}
function shell(body){return '<div class="app"><aside class="side">'+brand()+'<div class="side-nav">'+nav.map(navBtn).join('')+'</div><div class="side-foot">MATCHLOVE © 2026<br>Знакомства по смыслу, а не случайности.<div class="legal-links"><a href="/legal/offer.html">Условия</a><a href="/legal/privacy.html">Конфиденциальность</a><a href="/legal/contacts.html">Контакты и документы</a></div></div></aside><main class="content"><header class="top"><div class="mobilebrand">'+brand()+'</div><button class="premium" data-nav="premium">'+ico('crown')+' Подписка</button>'+(S.logged?(S.me?.admin?'<button type="button" class="btn btn-ghost" data-nav="admin">Админка</button>':'')+'<button class="logout-btn" id="logout">'+ico('logout')+'<span>Выйти</span></button>':'<button type="button" class="logout-btn" data-nav="login">Войти</button>')+'</header><div class="wrap">'+body+'</div></main><nav class="bottomnav" aria-label="Основная навигация">'+nav.map(n=>'<button data-nav="'+n[0]+'" class="'+(activeNav(n[0])?'active':'')+'">'+ico(n[2])+'<span>'+n[1]+(n[0]==='chats'&&S.social.incoming.length?' ('+S.social.incoming.length+')':'')+'</span></button>').join('')+'</nav></div><div id="toast" role="status" style="position:fixed;top:85px;right:18px;z-index:50"></div>'}
function demoMatches(){
 const portrait=(name,age,index,center=false)=>'<div class="match-person '+(center?'match-center':'')+'"><div class="match-avatar portrait-'+index+'" role="img" aria-label="'+name+'"></div><strong>'+name+', '+age+'</strong></div>';
 const link=(score,best=false)=>'<div class="match-link '+(best?'best-link':'')+'"><svg viewBox="0 0 120 55" aria-hidden="true"><path class="connection-base" d="M2 34 Q60 -10 118 34"/><defs><radialGradient id="firefly-'+(best?'pink':'green')+'"><stop offset="0" stop-color="'+(best?'#ffe4ed':'#f1ffd9')+'" stop-opacity=".95"/><stop offset=".15" stop-color="'+(best?'#ff9fbc':'#c4ff86')+'" stop-opacity=".8"/><stop offset=".42" stop-color="'+(best?'#ff527d':'#a3ff66')+'" stop-opacity=".35"/><stop offset="1" stop-color="'+(best?'#ff527d':'#a3ff66')+'" stop-opacity="0"/></radialGradient></defs><g class="connection-dot"><animateMotion dur="4s" repeatCount="indefinite" path="'+(best?'M2 34 Q60 -10 118 34':'M118 34 Q60 -10 2 34')+'"/><g class="firefly-light"><circle r="18" fill="url(#firefly-'+(best?'pink':'green')+')"/><circle class="firefly-core" r="4" fill="url(#firefly-'+(best?'pink':'green')+')"/></g></g></svg><span class="connection-heart">♥</span><strong>'+score+'</strong><small>совпадение</small></div>';
 const detail=(name,items)=>'<div class="match-breakdown"><strong>Алиса + '+name+'</strong>'+items.map(([label,value])=>'<span>'+label+' <b>'+value+'%</b></span>').join('')+'</div>';
 return '<section class="match-preview" aria-label="Как ИИ подбирает совпадения"><div class="match-network">'+portrait('Даниил',28,4)+link('95%')+portrait('Алиса',29,2,true)+link('100%',true)+portrait('Марк',31,1)+'</div><div class="match-details">'+detail('Даниил',[['Походы в горы','94'],['Спонтанные поездки','91'],['Серьёзные отношения','100']])+detail('Марк',[['Вечерние прогулки','100'],['Чувство юмора','100'],['Серьёзные отношения','100']])+'</div></section>'
}

function accountGenderControl(profile=false){if(!S.logged)return '';const gender=S.me?.gender;return '<div class="account-gender-control"><span id="gender-label">'+(profile?'Пол':'Мой пол')+'</span><details class="gender-dropdown" id="gender-picker" '+(S.genderSaving?'aria-disabled="true"':'')+'><summary id="account-gender" aria-labelledby="gender-label gender-value" '+(S.genderSaving?'tabindex="-1"':'')+'><span id="gender-value">'+(gender==='male'?'Мужчина':gender==='female'?'Женщина':'Выбери пол')+'</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></summary><div class="gender-options">'+[['female','Женщина'],['male','Мужчина']].map(([value,label])=>'<button type="button" data-gender="'+value+'" aria-pressed="'+(gender===value)+'" '+(S.genderSaving?'disabled':'')+'>'+label+(gender===value?'<span aria-hidden="true">✓</span>':'')+'</button>').join('')+'</div></details>'+(profile?'':'<small>'+(!gender?'Укажи пол, чтобы начать подбор':gender==='male'?'По умолчанию ищем женщин':'По умолчанию ищем мужчин')+'. Другие пожелания можно указать в описании.</small>')+'</div>';}

async function saveAccountGender(gender){if(S.genderSaving)return;const owner=S.me?.id;S.query=$('#about')?.value??S.query;S.genderSaving=true;render();try{const saved=await api('account-gender',{method:'PATCH',body:{gender}});if(S.me?.id!==owner)return;S.me.gender=saved.gender;S.results=[];}catch(error){if(S.me?.id===owner)toast(error.message)}finally{if(S.me?.id===owner){S.genderSaving=false;render();}}}
let locationChoiceMemory='',guestLocation=null;
function locationChoice(){try{return localStorage.getItem('matchlove.geo-choice')||locationChoiceMemory;}catch{return locationChoiceMemory;}}
function rememberLocationChoice(choice){locationChoiceMemory=choice;try{localStorage.setItem('matchlove.geo-choice',choice);}catch{}}
function maybeShowLocationPrompt(){
 if(S.page!=='home'||S.location.enabled||locationChoice()||!navigator.geolocation||document.querySelector('dialog[open]'))return;
 const dialog=document.createElement('dialog');dialog.className='location-dialog';dialog.setAttribute('aria-labelledby','location-dialog-title');
 dialog.innerHTML='<div class="location-dialog-art" aria-hidden="true"><svg viewBox="0 0 80 90"><path d="M40 83S11 51 11 32a29 29 0 0 1 58 0c0 19-29 51-29 51Z"/><circle cx="40" cy="31" r="10"/></svg><span>♥</span></div><h2 id="location-dialog-title">Твой человек может быть рядом</h2><p>Разреши геолокацию, чтобы учитывать расстояние и находить людей поближе.</p><button type="button" class="btn btn-primary btn-wide" data-enable-geo>Включить геолокацию</button><button type="button" class="link" data-later-geo>Позже</button><p class="location-dialog-error" role="status"></p>';
 document.body.append(dialog);dialog.tabIndex=-1;dialog.showModal();dialog.focus({preventScroll:true});
 dialog.addEventListener('cancel',()=>rememberLocationChoice('later'));
 dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 dialog.querySelector('[data-later-geo]').onclick=()=>{rememberLocationChoice('later');dialog.close();};
 dialog.querySelector('[data-enable-geo]').onclick=async()=>{
  const button=dialog.querySelector('[data-enable-geo]'),owner=S.me?.id;button.disabled=true;button.textContent='Определяем местоположение…';dialog.querySelector('.location-dialog-error').textContent='';
  try{
   const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:300000,timeout:15000}));
   if(!dialog.isConnected)return;
   const body={latitude:position.coords.latitude,longitude:position.coords.longitude,consent:true};
   rememberLocationChoice('allowed');
   if(S.logged&&S.me?.id===owner)await updateLocation(body);else guestLocation=body;
   dialog.close();
  }catch(error){
   if(!dialog.isConnected)return;
   if(error.code===1)rememberLocationChoice('denied');
   dialog.querySelector('.location-dialog-error').textContent=error.code===1?'Доступ не разрешён. Можно продолжить без геолокации и указать город в описании.':'Не удалось определить местоположение. Попробуй ещё раз или продолжи без геолокации.';
   button.disabled=false;button.textContent='Попробовать ещё раз';
  }
 };
}
async function refreshGrantedLocation(){
 const owner=S.me?.id;if(!S.logged||(!S.location.enabled&&locationChoice()!=='allowed')||!navigator.geolocation)return;
 try{if(navigator.permissions?.query){const permission=await navigator.permissions.query({name:'geolocation'});if(permission.state!=='granted')return;}
 const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:300000,timeout:10000}));
 if(S.me?.id!==owner)return;
 const saved=await api('location',{method:'PATCH',body:{latitude:position.coords.latitude,longitude:position.coords.longitude,consent:true}});if(S.me?.id===owner)S.location=saved;
 }catch{} // Keep the saved location when offline or permission is no longer available.
}
async function restoreLocation(){if(!S.logged)return;const owner=S.me?.id;try{const row=await api('location');if(S.me?.id===owner){S.location=row;if(guestLocation){const pending=guestLocation;guestLocation=null;await updateLocation(pending);}else void refreshGrantedLocation();}}catch{}}
async function updateLocation(body,method='PATCH'){const owner=S.me?.id;const row=await api('location',{method,body});if(S.me?.id===owner){S.location=row;S.results=[];}}
function photoGallery(){
 return '<div class="photo-gallery"><div class="photo-gallery-head"><label class="photo-upload">'+ico('photo')+' <span>'+(S.photoSaving?'Сохраняем фото…':'Добавить фото')+'</span><input type="file" id="myphoto" accept="image/jpeg,image/png,image/webp,image/gif" multiple '+(S.photoSaving||S.photos.length>=30?'disabled':'')+'></label></div>'+(S.photos.length?'<div class="photo-grid">'+S.photos.map(p=>'<div class="gallery-photo '+(p.main?'is-main':'')+'"><img src="'+esc(p.url)+'" alt="'+(p.main?'Главное фото анкеты':'Фото анкеты')+'">'+(p.main?'<span class="main-photo-badge">Главное</span>':'<button type="button" class="set-main-photo" data-photo-main="'+esc(p.id)+'" '+(S.photoSaving?'disabled':'')+'>Сделать главным</button>')+'<button type="button" class="delete-photo" data-photo-delete="'+esc(p.id)+'" aria-label="Удалить фото" '+(S.photoSaving?'disabled':'')+'>'+ico('trash')+'</button></div>').join('')+'</div>':S.imageURL?'<img class="photo-preview" src="'+esc(S.imageURL)+'" alt="Выбранное фото">':'')+''+(S.photoError?'<span class="photo-save-error" role="status">'+esc(S.photoError)+'</span>':'')+'</div>';
}
function searchDraftKey(){return 'matchlove.search-draft:'+(S.me?.id||'guest');}
function readSearchDraft(){try{return sessionStorage.getItem(searchDraftKey());}catch{return null;}}
function writeSearchDraft(text=S.query){try{sessionStorage.setItem(searchDraftKey(),text);}catch{}}
function clearSearchDraft(){try{sessionStorage.removeItem(searchDraftKey());sessionStorage.removeItem('matchlove.search-draft:guest');}catch{}}
function searchErrorView(){return S.searchError?'<div class="search-recovery" role="alert"><p>'+esc(S.searchError)+'</p><div><button type="button" class="btn btn-primary" id="retry-search">Повторить поиск</button><button type="button" class="link" data-nav="profile">Заполнить профиль вручную</button></div></div>':'';}

function pageHome(){return '<div class="hero"><div><h1><span class="red">Точный мэтч</span> — Твой человек.</h1></div>'+(!S.logged?demoMatches():'')+'</div><section class="searchbox"><div class="sectiontop"><label class="match-intro" for="about">Расскажи о себе — ИИ найдёт людей, с которыми совпадают желания и интересы.</label></div><textarea id="about" minlength="100" aria-label="Расскажи о себе и кого ищешь" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-expanded="false" aria-controls="tag-suggestions" placeholder="Например: Мне 28, живу в Москве, люблю путешествия, кино и спонтанные поездки. Хочу познакомиться с человеком, который ценит юмор, близость и умеет наслаждаться жизнью…">'+esc(S.query)+'</textarea>'+searchErrorView()+'<div id="tag-suggestions" class="tag-suggestions" role="listbox" aria-label="Подсказки интересов" hidden></div>'+photoGallery()+accountGenderControl()+'<button class="btn btn-primary btn-wide" style="margin-top:20px" id="find" '+(S.photoSaving||S.genderSaving||S.locationSaving?'disabled':'')+'>'+ico('heart')+' Найти мои мэтчи '+ico('arrow')+'</button></section>'}
function tokenize(t){return (String(t||'').toLowerCase().replace(/ё/g,'е').match(/[а-яa-z]{4,}/g)||[]).map(w=>w.replace(/(ами|ями|ого|ему|ыми|ими|иях|ать|ять|ение|ость|ами|ями|ов|ев|ами|ами|ой|ая|ые|ий|ый|ого|ами|ах|ях|ей|ие|ое|у|а|ы|и|е)$/,'')).filter(w=>w.length>=3)}
function rankPeople(list){const words=new Set(tokenize(S.query)),scored=list.map((p,i)=>{const profile=tokenize([p.bio||'',...(p.interests||[]),p.city||''].join(' '));const common=[...new Set(profile)].filter(x=>words.has(x));const overlap=common.length;const score=Math.min(96,Math.max(30,45+overlap*13+(p.interests||[]).filter(v=>tokenize(v).some(t=>words.has(t))).length*8));const explanation=common.length?'Общее: '+common.slice(0,4).join(', '):'Попробуйте добавить больше интересов для точного сравнения';return {...p,score,explanation,originalIndex:i}});return scored.sort((a,b)=>b.score-a.score||a.originalIndex-b.originalIndex)}
function face(p){if(p.demo)return '<div class="pic sprite" style="--x:'+(p.demoIndex%3)+';--y:'+Math.floor(p.demoIndex/3)+'"></div>';const url=p.media?.find(m=>m.url&&!m.locked)?.url;return '<div class="pic">'+(url?'<img src="'+esc(url)+'" alt="'+esc(p.name)+'" loading="lazy">':'<div style="height:100%;display:grid;place-items:center;font-size:55px">♥</div>')+'</div>'}
const matchPercent=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n)||0);
function cityName(value){return String(value||'').trim().toLocaleLowerCase('ru').replace(/(^|[\s-])([а-яёa-z]+)/giu,(all,separator,word)=>separator&&['на','и','в','де','ла','эль'].includes(word)?separator+word:separator+word[0].toLocaleUpperCase('ru')+word.slice(1));}
function cardLocation(p){const km=p.distanceKm;if(typeof km==='number'&&Number.isFinite(km)&&km>=0)return '<div class="city card-distance">'+ico('location')+'<span>'+(km<1?'Менее 1 км от тебя':Math.round(km)+' км от тебя')+'</span></div>';return p.city?'<div class="city">'+esc(cityName(p.city))+'</div>':'';}
function contributionLabel(p,m){return m.category==='location'?cityName(p.city)||'Рядом':m.category==='gender'?'Пол':m.category==='age'?(Number.isFinite(Number(p.age))&&Number(p.age)>0?'Возраст '+p.age:'Возраст'):m.label;}
function person(p){const incoming=S.social.incoming.some(x=>x.id===p.id),liked=S.social.outgoing.some(x=>x.id===p.id)||S.social.matches.some(x=>x.id===p.id),matched=S.social.matches.some(x=>x.id===p.id);return '<article class="person" tabindex="0" data-profile="'+esc(p.id)+'" aria-label="Открыть анкету '+esc(p.name)+'"><div style="position:relative">'+face(p)+'<span class="matchpill">Вы совпадаете на '+matchPercent(p.score)+'%</span></div><div class="person-info"><h3>'+esc(p.name)+(p.age?', '+esc(p.age):'')+'</h3>'+cardLocation(p)+conflictTags(p)+'<div class="match-contributions">'+(p.matches||[]).filter(m=>Number(m.points)>0).map(m=>'<span class="match-contribution"><span title="'+esc(contributionLabel(p,m))+'">'+esc(contributionLabel(p,m))+'</span>'+' <b>+'+matchPercent(m.points)+'%</b></span>').join('')+'</div>'+(incoming?'<div class="liked-me">♥ '+esc(p.name)+' уже поставил(а) тебе лайк!</div>':'')+'<button type="button" class="btn '+(matched?'btn-green':liked?'btn-ghost':'btn-primary')+' btn-wide" style="margin-top:14px;padding:11px" data-like="'+esc(p.id)+'" '+(liked&&!matched?'disabled':'')+'>'+(matched?'Написать':liked?ico('heart')+' Симпатия отправлена':incoming?ico('heart')+' Ответить взаимностью':ico('heart')+' Симпатия')+'</button></div></article>'}

function results(){if(!S.results.length&&S.hiddenResults)return '<div class="empty"><h3>Анкеты скрыты фильтром</h3><p>Можно выключить фильтр во вкладке «Кого ищу» своего профиля.</p><button type="button" class="btn btn-primary" data-nav="profile">Настроить фильтр</button></div>';if(!S.results.length)return '<div class="page-head"><h2>Мои мэтчи<span style="color:var(--red)">.</span></h2></div><div class="empty"><h3>Пока нет результатов</h3><p>Расскажи о себе, и здесь появится твоя последняя подборка.</p><button class="btn btn-primary" style="margin-top:22px" data-nav="home">Начать поиск</button></div>';return '<div class="page-head"><h2>Люди, с которыми <span style="color:var(--green)">совпало</span></h2><p>Подборка по интересам и описанию. Самые близкие совпадения — первыми.</p><button class="btn btn-green" id="update" style="margin-top:20px">'+ico('refresh')+' Обновить мэтчи</button></div><div class="cardgrid">'+S.results.map(person).join('')+'</div>'}
function loading(){
 const photo=S.imageURL||S.me?.profile?.media?.find(m=>m.url&&!m.locked&&(!m.kind||m.kind==='photo'))?.url;
 const points=[[42,58],[150,26],[258,58],[258,202],[150,234],[42,202]];
 const rays=points.map(([x,y],i)=>{const dx=x-150,dy=y-130,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;const path='M'+(150+ux*37).toFixed(2)+' '+(130+uy*37).toFixed(2)+' L'+(x-ux*24).toFixed(2)+' '+(y-uy*24).toFixed(2);const duration=6.2+i*.37,begin=(-i*1.13).toFixed(2)+'s';
 const stop=(offset,red,green,opacity)=>'<stop offset="'+offset+'" stop-color="'+red+'" stop-opacity="'+opacity+'"><animate attributeName="stop-color" values="'+red+';'+green+'" calcMode="discrete" dur="'+(duration*2)+'s" begin="'+begin+'" repeatCount="indefinite"/></stop>';
 return '<defs><radialGradient id="search-firefly-'+i+'">'+stop('0','#fff1f6','#f1ffdf','.95')+stop('.18','#ff9fbc','#c4ff86','.7')+stop('.48','#ff527d','#b2ff7b','.25')+stop('1','#ff527d','#b2ff7b','0')+'</radialGradient></defs><path class="search-ray" d="'+path+'"/><g class="connection-dot"><animateMotion dur="'+duration+'s" begin="'+begin+'" repeatCount="indefinite" path="'+path+'"/><g class="firefly-light"><circle r="12" fill="url(#search-firefly-'+i+')"/></g></g>';}).join('');
 return '<section class="search-wait" aria-busy="true" aria-labelledby="search-title"><div class="search-constellation"><svg viewBox="0 0 300 260" aria-hidden="true">'+rays+'</svg>'+points.map(([x,y],i)=>'<span class="search-placeholder placeholder-'+i+'" style="left:'+(x/3)+'%;top:'+(y/2.6)+'%;--delay:'+(-i*.3)+'s" aria-hidden="true"><span class="placeholder-art"></span></span>').join('')+'<div class="search-self">'+(photo?'<img src="'+esc(photo)+'" alt="Твоё главное фото">':'<span class="search-self-fallback" aria-label="Твоя анкета">'+ico('user')+'</span>')+'</div></div><h2 id="search-title">ИИ подбирает самые<br><span class="red">подходящие совпадения</span></h2><p id="scantext" role="status" aria-live="polite">Сравниваем твои интересы и пожелания с анкетами…</p></section>'
}

function price(){return '<div class="page-head"><div class="eyebrow">MATCHLOVE PLUS</div><h2>Больше возможностей.<br><span style="color:var(--red)">Больше совпадений.</span></h2><p>Сейчас MatchLove бесплатный. Подписки и приём платежей пока не подключены. Перед запуском опубликуем цены и условия.</p><p><a href="/legal/tariffs.html">Доступ и подписка</a> · <a href="/legal/offer.html">Условия использования</a></p></div><div class="pricegrid"><section class="price"><div class="eyebrow">БАЗОВЫЙ</div><h3 style="margin-top:13px">Free</h3><strong>0 ₽</strong><ul><li>Описание себя</li><li>Поиск анкет</li><li>Список совпадений</li></ul><button class="btn btn-ghost btn-wide" data-nav="home">Продолжить бесплатно</button></section><section class="price hot"><div class="eyebrow">БОЛЬШЕ ИСКР</div><h3 style="margin-top:13px">MatchLove Plus</h3><strong>Скоро</strong><ul><li>Расширенный AI-подбор</li><li>Подбор по внешности</li><li>Дополнительные фильтры</li></ul><button class="btn btn-primary btn-wide" disabled>Скоро в продаже</button></section></div>'}
function login(){const reg=S.authMode==='register';return '<div class="login"><p class="legal-links"><a href="/legal/offer.html">Условия</a><a href="/legal/privacy.html">Конфиденциальность</a><a href="/legal/contacts.html">Контакты и документы</a></p><h2 style="margin-top:12px">'+(reg?'Создать аккаунт':'С возвращением')+'<span style="color:var(--red)">.</span></h2><p class="lead" style="margin:10px 0 20px">Войди, чтобы сохранять свои знакомства и переписки.</p><section class="panel"><form id="auth" class="stack">'+(reg?'<fieldset class="registration-gender"><legend>Твой пол</legend><label><input type="radio" name="gender" value="female" required> Женщина</label><label><input type="radio" name="gender" value="male" required> Мужчина</label></fieldset>':'')+'<label>Email<input class="field" name="email" type="email" autocomplete="email" required></label><label>Пароль<input class="field" name="password" type="password" minlength="'+(reg?10:1)+'" autocomplete="'+(reg?'new-password':'current-password')+'" required></label>'+(reg?'<label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="adult" required>Мне исполнилось 18 лет</label><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="terms" required>Принимаю <a data-legal-docs href="/legal/offer.html" target="_blank" rel="noopener">условия использования</a></label><button type="button" class="link" data-legal-docs>Документы перед регистрацией</button><p class="notice">О данных: <a href="/legal/privacy.html" target="_blank" rel="noopener">конфиденциальность</a> и <a href="/legal/personal-data.html" target="_blank" rel="noopener">обработка персональных данных</a>.</p><label>Код приглашения (если есть)<input class="field" name="invite"></label>':'')+'<button class="btn btn-primary btn-wide" type="submit">'+(reg?'Зарегистрироваться':'Войти')+'</button></form><p id="auth-error" class="notice" style="color:var(--pink);margin-top:12px"></p><button class="link" id="toggleauth">'+(reg?'Уже есть аккаунт? Войти':'Нет аккаунта? Регистрация')+'</button></section></div>'}
function chats(){if(!S.logged)return '<div class="empty"><h3>Войди, чтобы переписываться</h3><p>Сообщения доступны после взаимной симпатии.</p><button class="btn btn-primary" style="margin-top:22px" data-nav="login">Войти</button></div>';const incoming=S.social.incoming||[];const liked= incoming.length?'<section class="inbound-likes"><h2 style="font-size:23px;margin-bottom:13px">♥ Тебя лайкнули <span class="counter">'+incoming.length+'</span></h2><div class="incoming-grid">'+incoming.map(p=>'<div class="incoming-row"><button type="button" class="incoming-person" data-profile="'+esc(p.id)+'"><strong>'+esc(p.name)+'</strong><small>'+esc(cityName(p.city))+'</small></button>'+(Number.isFinite(p.score)?'<span class="social-match-score">Вы совпадаете на '+matchPercent(p.score)+'%</span>':'')+conflictTags(p)+'<button type="button" class="btn btn-primary" data-like="'+esc(p.id)+'">♥ Взаимный лайк</button></div>').join('')+'</div></section>':'';return ''+liked+'<div class="chatlist">'+(S.matches.length?S.matches.map(p=>'<button class="chatrow" data-chat="'+esc(p.id)+'"><div class="body"><strong>♥ '+esc(p.name)+'</strong>'+(Number.isFinite(p.score)?'<span class="social-match-score">Вы совпадаете на '+matchPercent(p.score)+'%</span>':'')+'<small>Взаимный мэтч — открыть переписку</small></div>'+ico('arrow')+'</button>').join(''):'<div class="empty"><h3>Пока нет взаимных мэтчей</h3><p>Когда симпатия совпадёт, вы сможете переписываться.</p></div>')+'</div>'}

const presenceClient=crypto.randomUUID(),chatDrafts=new Map();
let presenceTimer=null,typingTimer=null,lastTypingAt=0,lastTypingTarget='',chatReadSequence=0,chatAppliedSequence=0,chatOpenSequence=0;
function currentChatPeer(){return S.chatPeer?.id===S.chat?S.chatPeer:S.matches.find(x=>x.id===S.chat)||S.profiles.find(x=>x.id===S.chat)||{id:S.chat,name:'Собеседник'};}
function typingMarkup(peer){return peer.typing?esc(peer.name)+' печатает<span class="typing-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>':peer.online?'В сети':'';}
function chatAvatar(peer){return (peer.photo?'<img src="'+esc(peer.photo)+'" alt="" onerror="this.hidden=true">':'<span class="avatar-initial">'+esc((peer.name||'?').slice(0,1))+'</span>')+'<span class="peer-online-dot" '+(peer.online?'':'hidden')+' aria-label="В сети"></span>';}
function chatMessages(){return S.messages.map(m=>'<div class="bubble '+(m.sender===S.me?.id?'mine':'')+'">'+esc(m.body||'Вложение')+'</div>').join('');}
function conversation(){const peer=currentChatPeer();return '<div class="chatbox"><header class="chathead"><button type="button" data-nav="chats" aria-label="Назад">'+ico('back')+'</button><button type="button" class="chat-profile-name" data-profile="'+esc(S.chat)+'"><span class="chat-peer-avatar">'+chatAvatar(peer)+'</span><span class="chat-peer-text"><span class="chat-peer-name">'+esc(peer.name)+'</span><span class="chat-typing-status" role="status" aria-live="polite" aria-atomic="true">'+typingMarkup(peer)+'</span></span></button><button type="button" class="chat-menu-button" data-chat-menu aria-label="Действия с собеседником">⋯</button></header><div class="messages" id="message-list">'+chatMessages()+'</div><form class="compose" id="compose"><input name="message" class="field" aria-label="Сообщение" autocomplete="off" placeholder="Напиши сообщение…" maxlength="3000" value="'+esc(chatDrafts.get(S.chat)||'')+'" required><button type="submit" class="btn btn-primary" aria-label="Отправить">'+ico('send')+'</button></form></div>';}
function syncChatViewport(){if(S.page!=='conversation')return;const viewport=window.visualViewport;document.documentElement.style.setProperty('--chat-height',(viewport?.height||innerHeight)+'px');document.documentElement.style.setProperty('--chat-top',(viewport?.offsetTop||0)+'px');}
async function sendPresence(active=true,extra={}){if(!S.logged)return;try{await api('ml-presence',{method:'POST',body:{client:presenceClient,active,...extra}});}catch{}}
function startPresence(){clearInterval(presenceTimer);if(!S.logged)return;void sendPresence(document.visibilityState==='visible');presenceTimer=setInterval(()=>{if(document.visibilityState==='visible')void sendPresence();},15000);}
async function reportTyping(typing,target=S.chat){if(!target||!S.logged)return;const now=Date.now();if(typing&&lastTypingTarget===target&&now-lastTypingAt<1500)return;if(typing){lastTypingAt=now;lastTypingTarget=target;}else if(lastTypingTarget===target){lastTypingAt=0;lastTypingTarget='';}await sendPresence(document.visibilityState==='visible',{target,typing});}
function stopChatActivity(offline=false){clearInterval(S.chatTimer);S.chatTimer=null;clearTimeout(typingTimer);if(!offline&&S.page==='conversation'&&S.chat)void reportTyping(false,S.chat);}
async function openChat(id){++navigationSequence;stopChatActivity();const openSequence=++chatOpenSequence;S.chat=id;S.chatPeer=null;S.messages=[];S.page='conversation';render();void sendPresence();await refreshChat(true);if(S.page==='conversation'&&S.chat===id&&openSequence===chatOpenSequence)S.chatTimer=setInterval(()=>{if(document.visibilityState==='visible')void refreshChat();},1500);}
async function refreshChat(forceBottom=false){
 if(!S.chat||S.page!=='conversation')return;const target=S.chat,sequence=++chatReadSequence;
 try{const data=await api('ml-chat?target='+encodeURIComponent(target));if(S.chat!==target||S.page!=='conversation'||sequence<chatAppliedSequence)return;chatAppliedSequence=sequence;
 const list=$('#message-list'),changed=JSON.stringify(S.messages)!==JSON.stringify(data.messages||[]),nearBottom=list&&list.scrollHeight-list.scrollTop-list.clientHeight<80;
 S.messages=data.messages||[];S.chatPeer=data.peer||currentChatPeer();
 if(list&&changed){list.innerHTML=chatMessages();if(forceBottom||nearBottom)list.scrollTop=list.scrollHeight;}
 const peer=currentChatPeer(),name=$('.chat-peer-name'),avatar=$('.chat-peer-avatar'),status=$('.chat-typing-status');
 if(name)name.textContent=peer.name;
 const avatarKey=JSON.stringify([peer.photo,peer.online,peer.name]);if(avatar&&avatar.dataset.key!==avatarKey){avatar.innerHTML=chatAvatar(peer);avatar.dataset.key=avatarKey;}
 const statusKey=JSON.stringify([peer.typing,peer.online,peer.name]);if(status&&status.dataset.key!==statusKey){status.innerHTML=typingMarkup(peer);status.dataset.key=statusKey;}
 }catch(error){if(S.page==='conversation'&&S.chat===target){if(error.status===403){stopChatActivity();S.chat=null;S.chatPeer=null;S.messages=[];await go('chats');}toast(error.message);}}
}
async function sendChatMessage(form){
 if(form.dataset.sending)return;const input=form.elements.message,value=input.value.trim(),target=S.chat;if(!value)return;
 form.dataset.sending='true';const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{await api('ml-chat',{method:'POST',body:{target,body:value,client:presenceClient}});if(S.chat===target){if(input.value.trim()===value){input.value='';chatDrafts.delete(target);}clearTimeout(typingTimer);lastTypingAt=0;await reportTyping(Boolean(input.value.trim()),target);await refreshChat(true);}}
 catch(error){toast(error.message);}finally{delete form.dataset.sending;button.disabled=false;}
}
document.addEventListener('input',event=>{if(!event.target.matches('#compose [name=message]'))return;chatDrafts.set(S.chat,event.target.value);clearTimeout(typingTimer);void reportTyping(Boolean(event.target.value.trim()));if(event.target.value.trim()){const target=S.chat;typingTimer=setTimeout(()=>void reportTyping(false,target),2200);}});
document.addEventListener('visibilitychange',()=>{if(!S.logged)return;if(document.visibilityState==='visible'){void sendPresence();if(S.page==='conversation')void refreshChat();}else{clearTimeout(typingTimer);void sendPresence(false);}});
window.addEventListener('pagehide',()=>{if(S.logged)navigator.sendBeacon('/api/ml-presence',new Blob([JSON.stringify({client:presenceClient,active:false})],{type:'application/json'}));});
window.addEventListener('resize',syncChatViewport);window.visualViewport?.addEventListener('resize',syncChatViewport);window.visualViewport?.addEventListener('scroll',syncChatViewport);
function render(){document.documentElement.classList.toggle('in-conversation',S.page==='conversation');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',S.page==='conversation'?'#17131a':'#160e14');captureProfileDraft();clearTagSuggestions();clearProfileTagSuggestions();const pages={home:pageHome,results,loading,login,chats,premium:price,conversation,profile:profilePage,viewProfile:profilePage,admin:adminPage};$('#app').innerHTML=S.page==='conversation'?shell('<div class="conversation-screen">'+conversation()+'</div>'):S.page==='loading'?'<main class="search-fullscreen"><div class="search-brand">'+brand()+'</div>'+loading()+'</main>':shell((pages[S.page]||pageHome)());document.title='MatchLove — знакомства по смыслу';initProfileCarousel();syncChatViewport();requestAnimationFrame(maybeShowLocationPrompt);}
function toast(message){const t=$('#toast');if(!t)return;t.textContent=message;t.style.cssText='position:fixed;top:85px;right:18px;z-index:50;background:#301b26;color:#fff;border:2px solid #ff355f;border-radius:14px;padding:14px 20px;max-width:320px;font-size:13px;box-shadow:0 20px 40px #0009';setTimeout(()=>{if(t.isConnected)t.remove()},3600)}
async function loadSearchSettings(){try{S.searchSettings=await api('ml-search-settings');}catch{S.searchSettings={hideConflicts:false};}}
let navigationSequence=0;
let socialRefresh=null;
async function go(page){
 if(page==='admin'){await openAdmin();return;}
 if(page==='profile'){await openProfile();return;}
 const sequence=++navigationSequence,owner=S.me?.id;
 S.query=$('#about')?.value??S.query;captureProfileDraft();stopChatActivity();S.page=page;render();window.scrollTo({top:0,behavior:'instant'});
 if(!S.logged||!['chats','results'].includes(page))return;
 // Navigation never waits for semantic scoring or network requests.
 const refreshSocial=async()=>{if(!socialRefresh){socialRefresh=loadMatches().finally(()=>{socialRefresh=null;});}await socialRefresh;};
 const refreshResults=async()=>{if(page!=='results'||!searchResultsDirty)return;try{const saved=await api('ai-match');if(S.me?.id!==owner)return;S.results=saved.results||[];S.hiddenResults=saved.hiddenCount||0;searchResultsDirty=false;}catch(error){if(sequence===navigationSequence)toast(error.message);}};
 await Promise.allSettled([refreshSocial(),refreshResults()]);
 if(S.me?.id===owner&&sequence===navigationSequence&&S.page===page)render();
}
async function loadMatches(){const owner=S.me?.id;try{const social=await api('ml-social');if(S.me?.id!==owner)return;S.social=social;S.matches=social.matches||[]}catch{}}

function applyGallery(saved){S.photos=saved.photos||[];S.imageURL=saved.url||'';}
async function restoreSearchPhoto(){
 if(!S.logged||S.image)return;const owner=S.me?.id;
 try{const saved=await api('search-photo-info');if(S.me?.id===owner&&!S.image)applyGallery(saved);}catch{if(S.me?.id===owner)S.photoError='Не удалось загрузить сохранённые фото. Обнови страницу.';}
}
async function saveSearchPhoto(){
 if(!S.logged||!S.image||S.photoSaving)return false;
 const owner=S.me?.id,queue=[S.image,...S.pendingPhotos],preview=S.imageURL;S.photoSaving=true;S.photoError='';render();
 try{let saved;
 while(queue.length){const form=new FormData();form.append('file',queue[0]);const response=await fetch('/api/search-photo',{method:'POST',credentials:'same-origin',body:form});saved=await response.json();if(!response.ok)throw Error(saved.error||'Не удалось сохранить фото');if(S.me?.id!==owner)return false;queue.shift();S.photos=saved.photos||[];}
 if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);applyGallery(saved);S.image=null;S.pendingPhotos=[];return true;
 }catch(error){if(S.me?.id===owner){S.image=queue[0]||null;S.pendingPhotos=queue.slice(1);S.photoError=error.message;}return false;}finally{if(S.me?.id===owner){S.photoSaving=false;S.query=$('#about')?.value??S.query;render();}}
}
async function changePhoto(id,method){
 if(S.photoSaving)return;const owner=S.me?.id;S.query=$('#about')?.value??S.query;S.photoSaving=true;S.photoError='';render();
 try{const saved=await api('search-photo',{method,body:{id}});if(S.me?.id===owner)applyGallery(saved);}catch(error){if(S.me?.id===owner)S.photoError=error.message;}finally{if(S.me?.id===owner){S.photoSaving=false;render();}}
}
async function boot(){try{const m=await api('me');S.me=m;S.logged=!!m?.id;startPresence();const draft=readSearchDraft();if(draft!==null)S.query=draft;if(S.logged){await loadSearchSettings();await restoreLocation();render();await restoreSearchPhoto();try{S.profiles=(await api('discover?')).profiles||[]}catch{}await loadMatches();try{const saved=await api('ai-match');S.results=(saved.results||[]);S.hiddenResults=saved.hiddenCount||0;searchResultsDirty=false;const draft=readSearchDraft();S.query=draft!==null?draft:$('#about')?.value.trim()?$('#about').value:saved.source||'';}catch{}}}catch{}render()}
async function search(){
 if(S.processing||S.photoSaving||S.genderSaving||S.locationSaving)return;
 const field=$('#about');S.query=field?field.value:S.query;writeSearchDraft();
 if(S.query.length>12000){S.searchError='Описание получилось слишком длинным. Оставь до 12 000 символов — текст в поле не потеряется.';render();return;}
 let useManual=false;
 if(!S.query.trim()&&S.logged){try{const own=await api('ml-profile');useManual=['self','wanted'].some(side=>Object.entries(own.profile[side]||{}).some(([key,value])=>!['gender','preferences'].includes(key)&&(Array.isArray(value)?value.length:!!value)));}catch{}}
 if(S.query.trim().length<100&&!useManual){toast('Опиши себя или желаемого партнёра подробнее — от 100 символов, либо заполни профиль');return;}
 if(!S.logged){S.page='login';render();toast('Войди, чтобы сохранить анкету и найти реальные совпадения');return;}
 if(!['male','female'].includes(S.me?.gender)){S.page='home';render();toast('Укажи свой пол перед поиском');$('#account-gender')?.focus();return;}
 if(S.image&&!await saveSearchPhoto()){toast(S.photoError||'Не удалось сохранить фото. Попробуй ещё раз.');return;}
 S.searchError='';S.processing=true;S.page='loading';render();let tick=0;
 const timer=setInterval(()=>{tick++;const label=$('#scantext');if(label)label.textContent=['Сравниваем твои интересы и пожелания с анкетами…','Ищем взаимный интерес — важно, чтобы вы подошли друг другу…','Оцениваем, что именно у вас совпадает…'][tick%3];},2800);
 let profileReady=useManual;
 try{
  if(!useManual){const result=await api('ai-match',{method:'POST',body:{text:S.query,confirmAdult:true}});if(!result.ok)throw Error('Не получилось сохранить анкету. Попробуй ещё раз.');profileReady=true;}
  const matched=await api('ai-match');
  S.results=(matched.results||[]);S.hiddenResults=matched.hiddenCount||0;searchResultsDirty=false;
  await loadMatches();clearSearchDraft();S.page='results';render();
 }catch(error){writeSearchDraft();S.searchError=profileReady?'Анкета готова, но подбор пока не ответил. Попробуй ещё раз — описание осталось в поле.':error.message||'Упс, не получилось завершить поиск. Попробуй ещё раз — описание осталось в поле.';S.page='home';render();}
 finally{clearInterval(timer);S.processing=false;}
}
async function logout(){
 ++navigationSequence;
 const button=$('#logout');if(button)button.disabled=true;
 try{clearSearchDraft();S.searchError='';clearInterval(presenceTimer);stopChatActivity(true);await sendPresence(false);await api('auth/logout',{method:'POST',body:{}});if(S.chatTimer)clearInterval(S.chatTimer);if(S.imageURL)URL.revokeObjectURL(S.imageURL);
 clearInterval(presenceTimer);presenceTimer=null;chatDrafts.clear();S.searchSettings={hideConflicts:false};S.hiddenResults=0;searchResultsDirty=false;profileView=null;profileDraft=null;Object.assign(S,{page:'home',query:'',image:null,imageURL:'',photos:[],pendingPhotos:[],photoSaving:false,genderSaving:false,locationSaving:false,location:{city:'',enabled:false},photoError:'',me:null,logged:false,profiles:[],results:[],matches:[],social:{incoming:[],matches:[],outgoing:[]},chat:null,messages:[],processing:false,authMode:'login',error:'',chatTimer:null});render();toast('Ты вышел из аккаунта');
 }catch(error){if(S.logged)startPresence();if(button)button.disabled=false;toast(error.message)}
}
document.addEventListener('click',async e=>{const suggestion=e.target.closest('[data-suggestion]');if(suggestion){applyTagSuggestion(Number(suggestion.dataset.suggestion));return}if(!e.target.closest('#about')&&!e.target.closest('#tag-suggestions'))clearTagSuggestions();const gender=e.target.closest('[data-gender]');if(gender){await saveAccountGender(gender.dataset.gender);return}if(!e.target.closest('.gender-dropdown'))$('#gender-picker')?.removeAttribute('open');const main=e.target.closest('[data-photo-main]');if(main){await changePhoto(main.dataset.photoMain,'PATCH');return}const remove=e.target.closest('[data-photo-delete]');if(remove){await changePhoto(remove.dataset.photoDelete,'DELETE');return}if(e.target.closest('#logout')){await logout();return}const n=e.target.closest('[data-nav]');if(n){await go(n.dataset.nav);return}if(e.target.closest('#find,#retry-search')){search();return}if(e.target.closest('#update')){search();return}if(e.target.closest('#toggleauth')){S.authMode=S.authMode==='login'?'register':'login';render();return}const chat=e.target.closest('[data-chat]');if(chat){await openChat(chat.dataset.chat);return}const like=e.target.closest('[data-like]');if(like){const id=like.dataset.like;if(!S.logged){await go('login');return}if(S.social.matches.some(p=>p.id===id)){await openChat(id);return}like.disabled=true;try{const response=await api('ml-like',{method:'POST',body:{target:id}});await loadMatches();if(response.matched){toast('♥ Взаимная симпатия! Можно переписываться.');await openChat(id)}else{toast('♥ Симпатия отправлена!');render()}}catch(error){like.disabled=false;toast(error.message)}return}});

document.addEventListener('change',async e=>{if(e.target.id==='hide-conflicts'){const input=e.target;input.disabled=true;try{S.searchSettings=await api('ml-search-settings',{method:'PATCH',body:{hideConflicts:input.checked}});searchResultsDirty=true;toast(input.checked?'Фильтр включён':'Фильтр выключен');}catch(error){input.checked=!input.checked;toast(error.message);}finally{input.disabled=false;}return;}if(e.target.id==='myphoto'){
 if(S.photoSaving)return;const files=Array.from(e.target.files||[]);if(!files.length)return;
 if(S.photos.length+files.length>30)return toast('Можно загрузить до 30 фото');
 if(files.some(file=>!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)))return toast('Выбери фото JPEG, PNG, WebP или GIF');if(files.some(file=>file.size>8*1024*1024))return toast('Каждое фото должно быть не больше 8 МБ');
 if(S.imageURL.startsWith('blob:'))URL.revokeObjectURL(S.imageURL);S.image=files[0];S.pendingPhotos=files.slice(1);if(!S.photos.length)S.imageURL=URL.createObjectURL(files[0]);S.photoError='';S.query=$('#about')?.value||S.query;render();
 if(S.logged)await saveSearchPhoto();
}});

document.addEventListener('submit',async e=>{if(e.target.id==='auth'){e.preventDefault();const d=new FormData(e.target);try{await api('auth/'+S.authMode,{method:'POST',body:{email:d.get('email'),gender:d.get('gender'),password:d.get('password'),adult:d.get('adult')==='on',terms:d.get('terms')==='on',invite:d.get('invite')||''}});S.me=await api('me');S.logged=!!S.me?.id;if(S.query.trim())writeSearchDraft();else S.query=readSearchDraft()??'';startPresence();await loadSearchSettings();searchResultsDirty=true;if(S.image)await saveSearchPhoto();else await restoreSearchPhoto();await restoreLocation();try{S.profiles=(await api('discover?')).profiles||[]}catch{}await loadMatches();await go('home');toast('Добро пожаловать в MatchLove')}catch(err){const box=$('#auth-error');if(box)box.textContent=err.message}return}if(e.target.id==='compose'){e.preventDefault();await sendChatMessage(e.target);}});
let suggestionTimer=null,suggestionAbort=null,suggestionSequence=0,suggestionItems=[],suggestionContext=null,activeSuggestion=-1;
function clearTagSuggestions(){if(suggestionTimer)clearTimeout(suggestionTimer);suggestionTimer=null;suggestionAbort?.abort();suggestionAbort=null;suggestionSequence++;suggestionItems=[];suggestionContext=null;activeSuggestion=-1;const list=$('#tag-suggestions');if(list){list.hidden=true;list.innerHTML='';}const field=$('#about');field?.setAttribute('aria-expanded','false');field?.removeAttribute('aria-activedescendant');}
function tagContext(field){const end=field.selectionStart??field.value.length,before=field.value.slice(0,end);if(!before.trim())return {start:end,end,query:''};const match=before.match(/(?:я\s+)?(?:люблю|обожаю)\s+[^,.!?;\n]{0,60}$/i)||before.match(/[\p{L}\p{N}-]{2,}$/u);return match?{start:end-match[0].length,end,query:match[0]}:null;}
function highlightSuggestion(){const field=$('#about');document.querySelectorAll('#tag-suggestions [data-suggestion]').forEach((button,i)=>{button.setAttribute('aria-selected',String(i===activeSuggestion));});if(activeSuggestion>=0)field?.setAttribute('aria-activedescendant','tag-choice-'+activeSuggestion);else field?.removeAttribute('aria-activedescendant');}
function requestTagSuggestions(field){S.query=field.value;clearTagSuggestions();const context=tagContext(field);if(!context)return;const sequence=suggestionSequence;suggestionTimer=setTimeout(async()=>{const controller=new AbortController();suggestionAbort=controller;try{const r=await fetch('/api/tag-suggestions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:context.query}),signal:controller.signal});if(!r.ok)return;const data=await r.json();if(sequence!==suggestionSequence||$('#about')!==field)return;const list=$('#tag-suggestions');if(!list)return;suggestionItems=(data.suggestions||[]).slice(0,6);suggestionContext=context;list.innerHTML=suggestionItems.map((item,i)=>'<button type="button" role="option" aria-selected="false" id="tag-choice-'+i+'" data-suggestion="'+i+'">'+esc(item.text)+'</button>').join('');list.hidden=!suggestionItems.length;field.setAttribute('aria-expanded',String(!!suggestionItems.length));}catch(error){if(error.name!=='AbortError')clearTagSuggestions();}},180);}
function applyTagSuggestion(index){const field=$('#about'),item=suggestionItems[index],context=suggestionContext;if(!field||!item||!context)return;field.setRangeText(item.text,context.start,context.end,'end');S.query=field.value;writeSearchDraft();clearTagSuggestions();field.focus({preventScroll:true});}
document.addEventListener('input',e=>{if(e.target.id==='about'){writeSearchDraft(e.target.value);requestTagSuggestions(e.target);}});
document.addEventListener('focusin',e=>{if(e.target.id==='about'&&!e.target.value.trim())requestTagSuggestions(e.target);});
document.addEventListener('pointerdown',e=>{if(e.target.closest('[data-suggestion]'))e.preventDefault();});
document.addEventListener('keydown',e=>{if(e.target.id!=='about'||!suggestionItems.length)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();activeSuggestion=(activeSuggestion+(e.key==='ArrowDown'?1:activeSuggestion<0?suggestionItems.length:-1)+suggestionItems.length)%suggestionItems.length;highlightSuggestion();}else if(e.key==='Enter'&&activeSuggestion>=0){e.preventDefault();applyTagSuggestion(activeSuggestion);}else if(e.key==='Escape'){e.preventDefault();clearTagSuggestions();}});
const profileFields=[['name','Имя'],['bio','Описание'],['age_min','Возраст от'],['age_max','Возраст до'],['location','Город'],['gender','Кого ищу'],['goal','Цель знакомства'],['interests','Интересы и хобби'],['habits','Привычки'],['personality','Характер'],['profession','Работа'],['appearance','Внешность'],['sexual_preferences','Интимные предпочтения']];
const profileTagFields=['goal','interests','habits','personality','profession','appearance','sexual_preferences'];
let profileView=null,profileReturn='results',profileTab='self',profileDraft=null,profileSaving=false,profileGeneration=0;
function captureProfileDraft(){
 const form=$('#profile-edit');if(!form||!profileDraft||Number(form.dataset.generation)!==profileGeneration)return;
 const data=new FormData(form),side=profileDraft[form.dataset.side];
 for(const [key] of profileFields){if(!data.has(key))continue;const value=data.get(key);
  if(profileTagFields.includes(key)){let values;try{values=JSON.parse(value);if(!Array.isArray(values))values=[];}catch{values=[];}
   const pending=form.querySelector('[data-tag-input="'+key+'"]')?.value.trim();if(pending&&!values.some(v=>v.toLowerCase()===pending.toLowerCase()))values.push(pending);side[key]=values;
  }else side[key]=['age_min','age_max'].includes(key)?(value===''?null:Number(value)):String(value);
 }
 if(form.dataset.side==='self'&&data.has('age_min'))side.age_max=side.age_min;
}
function profileCarousel(photos){
 if(!photos.length)return '<div class="profile-no-photo">'+ico('user')+'</div>';
 return '<div class="profile-photo-wrap"><div class="profile-carousel" data-count="'+photos.length+'" data-index="0" tabindex="0" aria-label="Фотографии анкеты"><div class="profile-photo-track">'+photos.map((p,i)=>'<img src="'+esc(p.url)+'" alt="Фото '+(i+1)+'" draggable="false" loading="'+(i<2?'eager':'lazy')+'">').join('')+'</div></div>'+(photos.length>1?'<div class="profile-photo-controls"><button type="button" data-photo-step="-1" aria-label="Предыдущее фото"><svg viewBox="0 0 24 40" aria-hidden="true"><path d="M20 3 4 20l16 17"/></svg></button><button type="button" data-photo-step="1" aria-label="Следующее фото"><svg viewBox="0 0 24 40" aria-hidden="true"><path d="m4 3 16 17L4 37"/></svg></button></div><div class="profile-photo-pagination" aria-label="Выбор фото">'+photos.map((_,i)=>'<button type="button" data-photo-index="'+i+'" aria-label="Фото '+(i+1)+' из '+photos.length+'" aria-current="'+(i===0)+'"></button>').join('')+'</div>':'')+'</div>';
}
function showProfilePhoto(index){
 const carousel=$('.profile-carousel');if(!carousel)return;const count=Number(carousel.dataset.count),previous=Number(carousel.dataset.index),next=((index%count)+count)%count,track=carousel.querySelector('.profile-photo-track');
 const wrapped=index<0||index>=count||Math.abs(next-previous)>1,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 track.style.transition=wrapped||reduced?'none':'transform .22s ease';track.style.transform='translateX('+(-next*100)+'%)';carousel.dataset.index=String(next);
 if(wrapped&&!reduced)carousel.animate([{opacity:.6},{opacity:1}],{duration:180});
 carousel.querySelectorAll('img').forEach((img,i)=>{if(i===next||i===(next+1)%count||i===(next+count-1)%count)img.loading='eager';});
 document.querySelectorAll('[data-photo-index]').forEach((dot,i)=>dot.setAttribute('aria-current',String(i===next)));
}
function stepProfilePhoto(step){const carousel=$('.profile-carousel');if(carousel)showProfilePhoto(Number(carousel.dataset.index)+step);}
function initProfileCarousel(){
 const carousel=$('.profile-carousel');if(!carousel||Number(carousel.dataset.count)<2)return;let start=null,wheelDelta=0,wheelAt=0;
 carousel.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.pointerType==='mouse'&&event.button!==0)return;start={x:event.clientX,y:event.clientY,id:event.pointerId};carousel.setPointerCapture(event.pointerId);});
 carousel.addEventListener('pointerup',event=>{if(!start||event.pointerId!==start.id)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;start=null;if(Math.abs(dx)>Math.max(32,carousel.clientWidth*.12)&&Math.abs(dx)>Math.abs(dy)*1.15)stepProfilePhoto(dx<0?1:-1);});
 carousel.addEventListener('pointercancel',()=>{start=null;});
 carousel.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();stepProfilePhoto(event.key==='ArrowLeft'?-1:1);}});
 carousel.addEventListener('wheel',event=>{if(Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;event.preventDefault();const now=Date.now();if(now-wheelAt<250)return;wheelDelta+=event.deltaX;if(Math.abs(wheelDelta)>40){stepProfilePhoto(wheelDelta>0?1:-1);wheelDelta=0;wheelAt=now;}},{passive:false});
}
function profileTagEditor(key,values){const label=profileFields.find(([field])=>field===key)?.[1]||'Пункты';return '<div class="interest-editor" data-category="'+key+'" data-tag-editor="'+key+'"><input type="hidden" name="'+key+'" value="'+esc(JSON.stringify(values))+'"><div class="profile-tags editable-interest-tags" tabindex="0" aria-label="'+esc(label)+' — прокрути строку">'+values.map((value,i)=>'<span><span>'+esc(value)+'</span><button type="button" data-remove-tag="'+key+'" data-tag-index="'+i+'" aria-label="Удалить: '+esc(value)+'">×</button></span>').join('')+'</div><div class="interest-add"><input type="text" maxlength="80" data-tag-input="'+key+'" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="profile-suggestions-'+key+'" placeholder="Добавить пункт" aria-label="Добавить: '+esc(label)+'"><button type="button" data-add-tag="'+key+'">Добавить</button></div><div id="profile-suggestions-'+key+'" class="profile-tag-suggestions" role="listbox" hidden></div></div>';}
function changeProfileTag(key,remove){
 if(!profileTagFields.includes(key))return;const oldLeft=$('[data-tag-editor="'+key+'"] .profile-tags')?.scrollLeft||0;
 captureProfileDraft();const values=profileDraft[profileTab][key]||[];if(remove!==undefined)values.splice(remove,1);
 const hidden=$('#profile-edit [name='+key+']');if(hidden)hidden.value=JSON.stringify(values);const input=$('[data-tag-input="'+key+'"]');if(input)input.value='';
 render();const row=$('[data-tag-editor="'+key+'"] .profile-tags');if(row)row.scrollLeft=remove===undefined?row.scrollWidth:oldLeft;$('[data-tag-input="'+key+'"]')?.focus({preventScroll:true});
}
function searchAgeControl(p){return '<fieldset class="search-age-control"><legend>Возраст кого ищем</legend><div class="search-age-values">'+[['age_min','От'],['age_max','До']].map(([key,label])=>'<div><span>'+label+'</span><input type="hidden" name="'+key+'" value="'+esc(p[key]??'')+'"><button type="button" data-age-picker="'+key+'" aria-label="'+label+': '+(p[key]??'не задан')+'">'+(p[key]??'—')+'</button></div>').join('')+'</div></fieldset>';}
function openAgePicker(focusKey){
 captureProfileDraft();const ages=[null,...Array.from({length:83},(_,i)=>i+18)],selection={age_min:profileDraft.wanted.age_min??null,age_max:profileDraft.wanted.age_max??null};
 const dialog=document.createElement('dialog');dialog.className='age-dialog';dialog.setAttribute('aria-label','Возраст кого ищем');
 dialog.innerHTML='<div class="age-dialog-head"><button type="button" data-age-cancel>Отмена</button><strong>Возраст кого ищем</strong><button type="button" data-age-done>Готово</button></div><div class="age-wheels">'+[['age_min','От'],['age_max','До']].map(([key,label])=>'<div><span>'+label+'</span><div class="age-wheel" data-age-wheel="'+key+'" tabindex="0" role="listbox" aria-label="'+label+'">'+ages.map((age,i)=>'<button type="button" tabindex="-1" role="option" id="wheel-'+key+'-'+i+'" data-age-index="'+i+'" aria-selected="false">'+(age??'—')+'</button>').join('')+'</div></div>').join('')+'</div><p class="age-picker-error" role="status"></p>';
 document.body.append(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 for(const wheel of dialog.querySelectorAll('[data-age-wheel]')){
  const key=wheel.dataset.ageWheel;
  const select=()=>{const index=Math.max(0,Math.min(ages.length-1,Math.round(wheel.scrollTop/40)));selection[key]=ages[index];wheel.querySelectorAll('[role=option]').forEach((row,i)=>{row.setAttribute('aria-selected',String(i===index));});wheel.setAttribute('aria-activedescendant','wheel-'+key+'-'+index);};
  wheel.scrollTop=Math.max(0,ages.indexOf(selection[key]))*40;select();
  wheel.addEventListener('scroll',select,{passive:true});
  wheel.addEventListener('click',event=>{const row=event.target.closest('[data-age-index]');if(row)wheel.scrollTo({top:Number(row.dataset.ageIndex)*40,behavior:'smooth'});});
  wheel.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();let index=Math.round(wheel.scrollTop/40)+(event.key==='ArrowDown'?1:-1);if(event.key==='Home')index=0;if(event.key==='End')index=ages.length-1;wheel.scrollTo({top:Math.max(0,Math.min(ages.length-1,index))*40,behavior:'instant'});select();}});
 }
 dialog.querySelector('[data-age-cancel]').onclick=()=>dialog.close();
 dialog.querySelector('[data-age-done]').onclick=()=>{
  for(const wheel of dialog.querySelectorAll('[data-age-wheel]')){const index=Math.max(0,Math.min(ages.length-1,Math.round(wheel.scrollTop/40)));selection[wheel.dataset.ageWheel]=ages[index];}
  if(selection.age_min!==null&&selection.age_max!==null&&selection.age_min>selection.age_max){dialog.querySelector('.age-picker-error').textContent='Возраст «От» должен быть не больше возраста «До».';return;}
  for(const [key,value] of Object.entries(selection))$('#profile-edit [name='+key+']').value=value??'';
  dialog.close();captureProfileDraft();render();$('[data-age-picker='+focusKey+']')?.focus({preventScroll:true});
 };
 dialog.querySelector('[data-age-wheel='+focusKey+']').focus({preventScroll:true});
}
function profilePage(){
 if(!S.logged)return '<div class="empty"><h3>Войди, чтобы открыть профиль</h3><button class="btn btn-primary" data-nav="login">Войти</button></div>';
 if(!profileView)return '<p role="status">Загружаем анкету…</p>';
 const v=profileView,own=v.own,p=(own?profileDraft:v.profile)[profileTab]||{};
 const tabs='<div class="profile-tabs" role="tablist" aria-label="Раздел анкеты">'+[['self','О себе'],['wanted','Кого ищу']].map(([key,label])=>'<button type="button" role="tab" aria-selected="'+(profileTab===key)+'" data-profile-tab="'+key+'">'+label+'</button>').join('')+'</div>';
 const photos=own?[...S.photos].sort((a,b)=>Number(b.main)-Number(a.main)):v.photos;
 const head='<div class="profile-heading">'+(!own?'<button type="button" class="link" id="profile-back">'+ico('back')+' Назад</button>':'<h2>Мой профиль</h2>')+'</div>';
 if(own)return '<section class="profile-page">'+head+'<p class="profile-hint">Заполни анкету вручную или поручи это ИИ: расскажи о себе и кого ищешь в разделе «Поиск мэтчей». ИИ разложит описание по категориям. Ручные исправления сохранятся при следующих поисках.</p>'+tabs+(profileTab==='self'?profileCarousel(photos)+'<details class="profile-photos-edit"><summary>'+ico('photo')+'<span>Добавить и настроить фото</span><svg class="photo-disclosure-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>'+photoGallery()+'</details>':'')+(profileTab==='self'?accountGenderControl(true):'')+'<form id="profile-edit" data-generation="'+profileGeneration+'" data-side="'+profileTab+'" class="profile-form">'+profileFields.filter(([key])=>profileTab==='self'?!['gender','age_max','bio'].includes(key):!['name','bio'].includes(key)).map(([key,label])=>{
 if(profileTab==='wanted'&&key==='age_max')return '';if(profileTab==='wanted'&&key==='age_min')return searchAgeControl(p);
 const value=p[key]??'',locked=Object.hasOwn(v.locked?.[profileTab]||{},key),age=['age_min','age_max'].includes(key);
 let control=profileTagFields.includes(key)?profileTagEditor(key,Array.isArray(value)?value:[]):key==='gender'?'<select name="gender" class="field"><option value="" '+(!value?'selected':'')+'>По умолчанию</option><option value="all" '+(value==='all'?'selected':'')+'>Любой пол</option><option value="female" '+(value==='female'?'selected':'')+'>Женщин</option><option value="male" '+(value==='male'?'selected':'')+'>Мужчин</option></select>':'<input class="field" name="'+key+'" '+(age?'type="number" min="18" max="100"':'maxlength="'+(key==='name'?60:90)+'"')+' value="'+esc(value)+'">';
 const tagField=profileTagFields.includes(key),element=tagField?'div':'label';
 return '<'+element+' class="profile-field-'+key+'"'+(tagField?' role="group" aria-label="'+esc(label)+'"':'')+'><span>'+(profileTab==='self'&&key==='age_min'?'Возраст':label)+'</span>'+(locked?'<small class="manual-mark">Исправлено вручную</small>':'')+control+'</'+element+'>';
 }).join('')+(profileTab==='wanted'?'<label class="habit-filter-setting"><input type="checkbox" id="hide-conflicts" '+(S.searchSettings?.hideConflicts?'checked':'')+'><span>Скрывать анкеты<small>Анкеты с критериями, которые противоречат твоим пожеланиям, не будут показаны в поиске.</small></span></label>':'')+'<p class="profile-hint profile-save-hint">'+(S.me?.gender==='female'?'С чем-то не согласна?':S.me?.gender==='male'?'С чем-то не согласен?':'Хочешь что-то исправить?')+' Исправь поля выше. Для подбора используются возраст, город и пункты по категориям.</p><button type="submit" class="btn btn-primary" '+(profileSaving?'disabled':'')+'>'+(profileSaving?'Сохраняем…':'Сохранить анкету')+'</button><p id="profile-error" role="status"></p></form><div class="profile-utilities"><button type="button" class="btn btn-ghost" data-legal-docs>Документы и контакты</button><button type="button" class="btn btn-ghost" data-email-settings>Уведомления на email</button><button type="button" class="btn btn-ghost" data-blocks>Заблокированные</button></div></section>';
 const details=profileFields.filter(([key])=>!['name','bio','age_min','age_max'].includes(key)&&!(profileTab==='self'&&key==='location')).map(([key,label])=>{
  const value=p[key];if(!value||(Array.isArray(value)&&!value.length))return '';
  return '<div class="profile-detail" data-category="'+key+'"><h3>'+ (key==='gender'&&profileTab==='self'?'Пол':label)+'</h3>'+(Array.isArray(value)?'<div class="profile-tags">'+value.map(t=>'<span>'+esc(t)+'</span>').join(''):'<p>'+esc(key==='location'?cityName(value):key==='gender'?value==='male'?(profileTab==='self'?'Мужчина':'Мужчин'):value==='female'?(profileTab==='self'?'Женщина':'Женщин'):value:value)+'</p>')+'</div>';
 }).join('');
 const age=p.age_min?(p.age_max&&p.age_max!==p.age_min?p.age_min+'–'+p.age_max:p.age_min):null;
 return '<section class="profile-page">'+head+tabs+(profileTab==='self'?profileCarousel(photos):'')+'<h2>'+esc(v.name)+(profileTab==='self'&&age?', '+esc(age):'')+'</h2>'+(profileTab==='self'&&v.city?'<p class="profile-city">'+esc(cityName(v.city))+'</p>':'')+(profileTab==='wanted'&&age?'<p>Возраст: '+esc(age)+'</p>':'')+(profileTab==='self'?conflictTags(v):'')+details+'</section>';
}
async function openProfile(id){
 if(!S.logged){await go('login');return;}
 const sequence=++navigationSequence,owner=S.me?.id;
 captureProfileDraft();S.query=$('#about')?.value??S.query;
 if(S.page!=='profile'&&S.page!=='viewProfile')profileReturn=S.page;
 stopChatActivity();
 profileView=null;profileDraft=null;profileGeneration++;S.page=id?'viewProfile':'profile';render();window.scrollTo({top:0,behavior:'instant'});
 try{const view=await api('ml-profile'+(id?'?user='+encodeURIComponent(id):''));if(sequence!==navigationSequence||S.me?.id!==owner)return;profileGeneration++;profileView=view;if(view.own&&view.searchSettings)S.searchSettings=view.searchSettings;profileDraft=structuredClone(view.profile);profileTab='self';render();}catch(error){if(sequence===navigationSequence)toast(error.message);}
}
async function saveProfile(){
 if(profileSaving||!profileView?.own)return;
 captureProfileDraft();const body={};
 for(const side of ['self','wanted']){const changes={};for(const [key] of profileFields){if(side==='self'&&key==='gender'||side==='wanted'&&key==='name')continue;const before=profileView.profile[side]?.[key]??null,after=profileDraft[side]?.[key]??null;if(JSON.stringify(before)!==JSON.stringify(after))changes[key]=after;}if(Object.keys(changes).length)body[side]=changes;}
 if(!Object.keys(body).length){toast('Изменений нет');return;}
 profileSaving=true;render();
 try{const saved=await api('ml-profile',{method:'PATCH',body});profileGeneration++;profileView.profile=saved.profile;profileView.locked=saved.locked;profileDraft=structuredClone(saved.profile);profileView.name=saved.profile.self.name||profileView.name;S.results=[];searchResultsDirty=true;toast('Анкета сохранена');}catch(error){toast(error.message);}finally{profileSaving=false;render();}
}
document.addEventListener('submit',e=>{if(e.target.id==='profile-edit'){e.preventDefault();void saveProfile();}});
document.addEventListener('click',async e=>{
 const suggestion=e.target.closest('[data-profile-suggestion]');if(suggestion){applyProfileTagSuggestion(Number(suggestion.dataset.profileSuggestion));return;}
 const photoIndex=e.target.closest('[data-photo-index]');if(photoIndex){showProfilePhoto(Number(photoIndex.dataset.photoIndex));return;}
 const age=e.target.closest('[data-age-picker]');if(age){openAgePicker(age.dataset.agePicker);return;}
 const add=e.target.closest('[data-add-tag]');if(add){changeProfileTag(add.dataset.addTag);return;}
 const remove=e.target.closest('[data-remove-tag]');if(remove){changeProfileTag(remove.dataset.removeTag,Number(remove.dataset.tagIndex));return;}
 const tab=e.target.closest('[data-profile-tab]');if(tab){captureProfileDraft();profileTab=tab.dataset.profileTab;render();return;}
 const photo=e.target.closest('[data-photo-step]');if(photo){stepProfilePhoto(Number(photo.dataset.photoStep));return;}
 if(e.target.closest('#profile-back')){if(profileReturn==='conversation')await openChat(S.chat);else await go(profileReturn);return;}
 if(e.target.closest('[data-like],[data-chat],[data-photo-main],[data-photo-delete]'))return;
 const card=e.target.closest('[data-profile]');if(card)await openProfile(card.dataset.profile);
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('article[data-profile]')){e.preventDefault();void openProfile(e.target.dataset.profile);}});

let profileSuggestionTimer=null,profileSuggestionAbort=null,profileSuggestionSequence=0,profileSuggestionItems=[],profileSuggestionKey='',profileSuggestionActive=-1;
function clearProfileTagSuggestions(){clearTimeout(profileSuggestionTimer);profileSuggestionAbort?.abort();profileSuggestionSequence++;profileSuggestionItems=[];profileSuggestionKey='';profileSuggestionActive=-1;document.querySelectorAll('.profile-tag-suggestions').forEach(list=>{list.hidden=true;list.innerHTML='';});document.querySelectorAll('[data-tag-input]').forEach(input=>{input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');});}
function requestProfileTagSuggestions(input){
 clearProfileTagSuggestions();const key=input.dataset.tagInput,sequence=profileSuggestionSequence;
 profileSuggestionTimer=setTimeout(async()=>{const controller=new AbortController();profileSuggestionAbort=controller;
  try{const r=await fetch('/api/tag-suggestions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:input.value,category:key,format:'tag'}),signal:controller.signal});if(!r.ok)return;const data=await r.json();if(sequence!==profileSuggestionSequence||!input.isConnected)return;
   const existing=profileDraft?.[profileTab]?.[key]||[];profileSuggestionItems=(data.suggestions||[]).filter(item=>!existing.some(value=>value.trim().toLowerCase()===item.label.trim().toLowerCase())).slice(0,8);profileSuggestionKey=key;
   const list=$('#profile-suggestions-'+key);if(!list)return;list.innerHTML=profileSuggestionItems.map((item,i)=>'<button type="button" role="option" aria-selected="false" id="profile-choice-'+i+'" data-profile-suggestion="'+i+'">'+esc(item.label)+'</button>').join('');list.hidden=!profileSuggestionItems.length;input.setAttribute('aria-expanded',String(!!profileSuggestionItems.length));
  }catch(error){if(error.name!=='AbortError')clearProfileTagSuggestions();}
 },160);
}
function applyProfileTagSuggestion(index){const key=profileSuggestionKey,item=profileSuggestionItems[index],input=$('[data-tag-input="'+key+'"]');if(!item||!input)return;input.value=item.label;changeProfileTag(key);}
document.addEventListener('focusin',event=>{if(event.target.matches('[data-tag-input]'))requestProfileTagSuggestions(event.target);});
document.addEventListener('input',event=>{if(event.target.matches('[data-tag-input]'))requestProfileTagSuggestions(event.target);});
document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-profile-suggestion]'))event.preventDefault();});
document.addEventListener('click',event=>{if(!event.target.closest('.interest-editor'))clearProfileTagSuggestions();});
document.addEventListener('keydown',event=>{
 if(!event.target.matches('[data-tag-input]')||!profileSuggestionItems.length)return;
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();profileSuggestionActive=(profileSuggestionActive+(event.key==='ArrowDown'?1:profileSuggestionActive<0?profileSuggestionItems.length:-1)+profileSuggestionItems.length)%profileSuggestionItems.length;document.querySelectorAll('[data-profile-suggestion]').forEach((button,i)=>button.setAttribute('aria-selected',String(i===profileSuggestionActive)));event.target.setAttribute('aria-activedescendant','profile-choice-'+profileSuggestionActive);}
 else if(event.key==='Enter'&&profileSuggestionActive>=0){event.preventDefault();applyProfileTagSuggestion(profileSuggestionActive);}
 else if(event.key==='Escape'){event.preventDefault();clearProfileTagSuggestions();}
});

document.addEventListener('keydown',event=>{if(!event.defaultPrevented&&event.target.matches('[data-tag-input]')&&event.key==='Enter'){event.preventDefault();changeProfileTag(event.target.dataset.tagInput);}});
let tagDrag=null,tagDragClick=null;
document.addEventListener('pointerdown',event=>{
 if(event.pointerType!=='mouse'||event.button!==0||!event.isPrimary)return;
 const row=event.target.closest('.profile-tags');if(!row||row.scrollWidth<=row.clientWidth)return;
 const rect=row.getBoundingClientRect();if(event.clientY>=rect.top+row.clientHeight)return;
 tagDrag={row,id:event.pointerId,x:event.clientX,y:event.clientY,left:row.scrollLeft,moved:false};
});
document.addEventListener('pointermove',event=>{
 const drag=tagDrag;if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x;
 if(!drag.moved){if(Math.abs(dx)<5||Math.abs(dx)<Math.abs(event.clientY-drag.y))return;drag.moved=true;drag.row.setPointerCapture(event.pointerId);drag.row.classList.add('is-dragging');}
 event.preventDefault();drag.row.scrollLeft=drag.left-dx;
},{passive:false});
function finishTagDrag(event){const drag=tagDrag;if(!drag||event.pointerId!==drag.id)return;tagDrag=null;drag.row.classList.remove('is-dragging');if(event.type==='pointerup'&&drag.moved){const ignored={row:drag.row};tagDragClick=ignored;setTimeout(()=>{if(tagDragClick===ignored)tagDragClick=null;},250);}if(drag.row.hasPointerCapture(event.pointerId))drag.row.releasePointerCapture(event.pointerId);}
document.addEventListener('pointerup',finishTagDrag);document.addEventListener('pointercancel',finishTagDrag);
document.addEventListener('lostpointercapture',event=>{if(tagDrag?.id===event.pointerId){tagDrag.row.classList.remove('is-dragging');tagDrag=null;}});
document.addEventListener('click',event=>{if(tagDragClick&&tagDragClick.row.contains(event.target)){tagDragClick=null;event.preventDefault();event.stopImmediatePropagation();}},true);

window.addEventListener('hashchange',()=>{});boot();

document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#gender-picker')?.hasAttribute('open')){$('#gender-picker').removeAttribute('open');$('#account-gender')?.focus();}});

function utilityDialog(title,body){document.querySelector('#utility-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='utility-dialog';dialog.className='utility-dialog';dialog.innerHTML='<button type="button" class="utility-close" aria-label="Закрыть">×</button><h2>'+title+'</h2>'+body;document.body.append(dialog);dialog.querySelector('.utility-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();return dialog;}

async function removeBlockedPeer(target){
 S.results=S.results.filter(p=>p.id!==target);S.profiles=S.profiles.filter(p=>p.id!==target);searchResultsDirty=true;chatDrafts.delete(target);
 if(S.chat===target){stopChatActivity();S.chat=null;S.chatPeer=null;S.messages=[];}
 await loadMatches();await go('chats');
}
function reportDialog(target){
 const message=[...S.messages].reverse().find(m=>m.sender===target)?.id;
 const dialog=utilityDialog('Пожаловаться','<form id="report-form" class="stack"><label>Причина<select class="field" name="reason" required><option value="">Выбери причину</option><option>Спам или реклама</option><option>Оскорбления и угрозы</option><option>Мошенничество</option><option>Неприемлемый контент</option><option>Другая причина</option></select></label><label>Комментарий<textarea class="field" name="details" maxlength="800" rows="3"></textarea></label><label><input type="checkbox" name="block" checked> Также заблокировать собеседника</label><button type="submit" class="btn btn-primary">Отправить жалобу</button><p role="status"></p></form>');
 dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;try{const response=await api('report',{method:'POST',body:{target,reason:form.elements.reason.value+(form.elements.details.value.trim()?' — '+form.elements.details.value.trim():''),message,block:form.elements.block.checked}});if(response.blocked)await removeBlockedPeer(target);if(dialog.isConnected)dialog.close();toast('Жалоба отправлена на рассмотрение');}catch(error){form.querySelector('[role=status]').textContent=error.message;}finally{button.disabled=false;}};
}
document.addEventListener('click',async event=>{
 if(event.target.closest('[data-chat-menu]')){
  const target=S.chat;if(!target)return;const dialog=utilityDialog('Действия с собеседником','<div class="stack"><button type="button" class="btn btn-ghost" data-report-peer>Пожаловаться</button><button type="button" class="btn btn-primary" data-block-peer>Заблокировать</button><p role="status"></p></div>');
  dialog.querySelector('[data-report-peer]').onclick=()=>reportDialog(target);
  dialog.querySelector('[data-block-peer]').onclick=async event=>{event.currentTarget.disabled=true;try{await api('block',{method:'POST',body:{target}});await removeBlockedPeer(target);if(dialog.isConnected)dialog.close();toast('Собеседник заблокирован');}catch(error){if(dialog.isConnected){dialog.querySelector('[role=status]').textContent=error.message;dialog.querySelector('[data-block-peer]').disabled=false;}}};return;
 }
 if(event.target.closest('[data-blocks]')){
  const owner=S.me?.id,dialog=utilityDialog('Заблокированные','<p role="status">Загружаем…</p>');
  try{const result=await api('blocks');if(!dialog.isConnected||S.me?.id!==owner)return;dialog.querySelector('p').outerHTML='<div class="stack">'+(result.blocks.length?result.blocks.map(p=>'<div class="blocked-person"><span>'+esc(p.name)+'</span><button type="button" class="btn btn-ghost" data-unblock="'+esc(p.id)+'">Разблокировать</button></div>').join(''):'<p>Нет заблокированных пользователей</p>')+'</div><p role="status"></p>';dialog.onclick=async event=>{const button=event.target.closest('[data-unblock]');if(!button)return;button.disabled=true;try{await api('unblock',{method:'POST',body:{target:button.dataset.unblock}});button.closest('.blocked-person').remove();searchResultsDirty=true;toast('Пользователь разблокирован');}catch(error){dialog.querySelector('[role=status]').textContent=error.message;button.disabled=false;}};}catch(error){if(dialog.isConnected)dialog.querySelector('p').textContent=error.message;}return;
 }
});

let adminData=null,adminDays=30,adminTab='overview',adminLoading=false,adminError='',adminSequence=0;
const adminNumber=x=>Number(x||0).toLocaleString('ru-RU');
const adminTime=x=>Math.floor(Number(x||0)/60)+' мин '+Math.floor(Number(x||0)%60)+' с';
const adminDate=x=>x?new Date(x).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'—';
function adminTable(headers,rows){return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Пока нет данных</td></tr>')+'</tbody></table></div>';}
async function openAdmin(){
 if(!S.me?.admin){toast('Доступ только для администратора');return;}
 const sequence=++adminSequence,owner=S.me.id;++navigationSequence;stopChatActivity();S.page='admin';adminLoading=true;adminError='';render();
 try{const paths=adminTab==='overview'?['admin/analytics?days='+adminDays]:adminTab==='users'?['admin/users']:['admin/queue'];const data=await api(paths[0]);if(sequence!==adminSequence||S.me?.id!==owner||S.page!=='admin')return;adminData=data;}
 catch(error){if(sequence===adminSequence)adminError=error.message;}
 finally{if(sequence===adminSequence){adminLoading=false;if(S.me?.id===owner&&S.page==='admin')render();}}
}
function adminPage(){
 if(!S.me?.admin)return '<div class="empty">Нет доступа</div>';
 let body='<p role="status">'+(adminLoading?'Загружаем…':esc(adminError))+'</p>';
 if(!adminLoading&&!adminError&&adminData){
  const d=adminData;
  if(adminTab==='overview'){
   const t=d.totals,metrics=[['Посетители',t.visitors],['Сессии',t.sessions],['Регистрации',t.registrations],['Активные участники',t.active_users],['В сети сейчас',t.online],['Время на сессию',adminTime(t.sessions?t.active_seconds/t.sessions:0)]];
   body='<div class="admin-metrics">'+metrics.map(([label,value])=>'<div class="panel"><small>'+label+'</small><strong>'+esc(typeof value==='number'?adminNumber(value):value)+'</strong></div>').join('')+'</div><h3>Воронка новых участников</h3>'+adminTable(['Этап','Участники','От регистраций'],[['registered','Регистрация'],['profile','Анкета'],['liked','Первый лайк'],['matched','Взаимный мэтч'],['chatted','Отправлено сообщение']].map(([key,label])=>[label,adminNumber(d.funnel[key]),d.funnel.registered?Math.round(d.funnel[key]/d.funnel.registered*100)+'%':'—']))+'<h3>Возвраты</h3>'+adminTable(['День','Вернулись','Когорта с завершённым днём'],Object.entries(d.retention).map(([key,r])=>[esc(key.toUpperCase()),r.eligible?Math.round(r.returned/r.eligible*100)+'%':'—',r.returned+' / '+r.eligible]))+'<h3>Источники и кампании</h3>'+adminTable(['Источник','Канал','Кампания','Посетители','Сессии','Регистрации'],d.sources.map(s=>[esc(s.source),esc(s.medium||'—'),esc(s.campaign||'—'),adminNumber(s.visitors),adminNumber(s.sessions),adminNumber(s.registrations)]))+'<h3>По дням · Москва</h3>'+adminTable(['Дата','Посетители','Сессии','Активное время'],d.daily.map(row=>[esc(row.day),adminNumber(row.visitors),adminNumber(row.sessions),adminTime(row.active_seconds)]))+'<h3>Действия за период</h3>'+adminTable(['Событие','Действия','Участники'],d.events.map(row=>[esc(({registration:'Регистрация',login:'Вход',profile_saved:'Сохранение анкеты',search:'Подбор',like:'Лайк',message:'Сообщение',photo_uploaded:'Фото',block:'Блокировка',report:'Жалоба'})[row.name]||row.name),adminNumber(row.count),adminNumber(row.users)]))+'<p class="profile-hint">'+esc(d.notes)+' Сбор начат: '+adminDate(d.trackingSince)+'. Время — оценка по активной вкладке и действиям пользователя. Источник регистрации — первый известный переход.</p>';
  }else if(adminTab==='users')body='<p class="profile-hint">Последние '+d.limit+' участников по активности. Время указано за весь период сбора.</p>'+adminTable(['Участник','Email','Регистрация','Последний визит','Время','Анкета','Лайки','Сообщения'],d.users.map(u=>[esc(u.name)+'<small>'+esc(u.id)+'</small>',esc(u.email),adminDate(u.created),adminDate(u.last_seen),adminTime(u.active_seconds),u.profile?'Да':'Нет',adminNumber(u.likes),adminNumber(u.messages)]));
  else body='<h3>Открытые жалобы</h3>'+adminTable(['Дата','От кого → на кого','Причина','Действия'],d.reports.map(r=>[adminDate(r.created),esc(r.reporter)+' → '+esc(r.target),esc(r.reason),'<button type="button" class="btn btn-ghost" data-report-context="'+esc(r.id)+'">Контекст</button><button type="button" class="btn btn-ghost" data-resolve-report="'+esc(r.id)+'">Закрыть</button>']));
 }
 return '<section class="admin-page"><div class="page-head"><h2>Админка</h2><p>Продукт, привлечение и модерация</p></div><div class="admin-toolbar">'+[['overview','Аналитика'],['users','Участники'],['reports','Жалобы']].map(([key,label])=>'<button type="button" class="btn '+(adminTab===key?'btn-primary':'btn-ghost')+'" data-admin-tab="'+key+'">'+label+'</button>').join('')+(adminTab==='overview'?'<select class="field" id="admin-days" aria-label="Период">'+[7,30,90].map(days=>'<option value="'+days+'" '+(adminDays===days?'selected':'')+'>'+days+' дней</option>').join('')+'</select>':'')+'<button type="button" class="btn btn-ghost" data-admin-refresh>Обновить</button></div>'+body+'</section>';
}
document.addEventListener('change',event=>{if(event.target.id==='admin-days'){adminDays=Number(event.target.value);void openAdmin();}});
document.addEventListener('click',async event=>{
 const tab=event.target.closest('[data-admin-tab]');if(tab){adminTab=tab.dataset.adminTab;await openAdmin();return;}
 if(event.target.closest('[data-admin-refresh]')){await openAdmin();return;}
 const resolve=event.target.closest('[data-resolve-report]');if(resolve){resolve.disabled=true;try{await api('admin/resolve',{method:'POST',body:{id:resolve.dataset.resolveReport}});await openAdmin();}catch(error){toast(error.message);resolve.disabled=false;}return;}
 const context=event.target.closest('[data-report-context]');if(context){try{const d=await api('admin/context?id='+encodeURIComponent(context.dataset.reportContext));utilityDialog('Контекст жалобы',d.messages.length?d.messages.map(m=>'<p><b>'+esc(m.sender)+'</b> · '+adminDate(m.created)+'</p><p>'+esc(m.body)+'</p>').join(''):'<p>Сообщение к жалобе не приложено.</p>');}catch(error){toast(error.message);}}
});

async function analyticsBeat(final=false){
 const a=analyticsState,now=Date.now(),owner=S.me?.id||null,elapsed=now-a.last;
 if(a.owner!==owner||elapsed>1800000){a.session=crypto.randomUUID();a.owner=owner;a.last=now;}
 const seconds=document.visibilityState==='visible'&&now-a.activity<60000?Math.min(30,Math.max(0,(now-a.last)/1000)):0;
 a.last=now;const body=JSON.stringify({session:a.session,visitor:a.visitor,page:S.page,seconds,source:a.source,medium:a.medium,campaign:a.campaign,landing:a.landing});
 if(final){navigator.sendBeacon('/api/analytics',new Blob([body],{type:'application/json'}));return;}
 try{await fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body,keepalive:true});}catch{}
}
for(const event of ['pointerdown','keydown','scroll','touchstart'])document.addEventListener(event,()=>{analyticsState.activity=Date.now();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){analyticsState.last=Date.now();analyticsState.activity=Date.now();void analyticsBeat();}else void analyticsBeat(true);});
window.addEventListener('pagehide',()=>void analyticsBeat(true));
setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-analyticsState.activity<60000)void analyticsBeat();},15000);void analyticsBeat();
document.addEventListener('click',async event=>{
 if(event.target.closest('[data-legal-docs]')){event.preventDefault();utilityDialog('Документы MatchLove','<p>Перед регистрацией ознакомься с условиями и информацией об обработке данных.</p><nav>'+[['offer','Условия использования'],['privacy','Конфиденциальность'],['personal-data','Обработка персональных данных'],['contacts','Контакты и реквизиты'],['tariffs','Доступ и подписка'],['refunds','Оплата и возвраты']].map(([key,label])=>'<a href="/legal/'+key+'.html" target="_blank" rel="noopener">'+label+' ↗</a>').join('')+'</nav>');return;}
 if(!event.target.closest('[data-email-settings]'))return;
 const owner=S.me?.id,dialog=utilityDialog('Уведомления на email','<p role="status">Загружаем настройки…</p>');
 try{const settings=await api('ml-email-settings');if(!dialog.isConnected||S.me?.id!==owner)return;dialog.querySelector('p').outerHTML='<form id="email-settings-form"><label><input type="checkbox" name="likes" '+(settings.likes?'checked':'')+'> Новые симпатии</label><label><input type="checkbox" name="messages" '+(settings.messages?'checked':'')+'> Новые сообщения</label><button class="btn btn-primary" type="submit">Сохранить</button><p role="status"></p></form>';
 dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;try{await api('ml-email-settings',{method:'PATCH',body:{likes:form.elements.likes.checked,messages:form.elements.messages.checked}});if(dialog.isConnected){dialog.close();toast('Настройки уведомлений сохранены');}}catch(error){if(form.isConnected)form.querySelector('p').textContent=error.message;}finally{button.disabled=false;}};
 }catch(error){if(dialog.isConnected)dialog.querySelector('p').textContent=error.message;}
});

