
// MatchLove: user-authored self profile + independent partner preferences.
// Parsing happens once per changed text; matching is deterministic and does not send other users' private data to an LLM.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const clean=(v,max=300)=>String(v??'').trim().slice(0,max);
const spec={
 type:'object',additionalProperties:false,required:['self','wanted'],
 properties:{
  self:{$ref:'#/$defs/profile'},
  wanted:{$ref:'#/$defs/profile'}
 },
 $defs:{profile:{type:'object',additionalProperties:false,required:['age_min','age_max','location','gender','goal','interests','appearance','sexual_preferences','personality','profession'],properties:{
  age_min:{type:['integer','null']},age_max:{type:['integer','null']},location:{type:'string'},gender:{type:'string'},goal:{type:'array',items:{type:'string'}},interests:{type:'array',items:{type:'string'}},appearance:{type:'array',items:{type:'string'}},sexual_preferences:{type:'array',items:{type:'string'}},personality:{type:'array',items:{type:'string'}},profession:{type:'array',items:{type:'string'}}
 }}}
};
function normalize(p){
 const list=a=>Array.isArray(a)?[...new Set(a.filter(v=>typeof v==='string').map(v=>clean(v,80).toLowerCase()).filter(Boolean))].slice(0,30):[];
 const n=v=>Number.isInteger(v)&&v>=18&&v<=100?v:null;
 let min=n(p?.age_min),max=n(p?.age_max);if(min!==null&&max!==null&&min>max)[min,max]=[max,min];
 return {age_min:min,age_max:max,location:clean(p?.location,90).toLowerCase(),gender:clean(p?.gender,40).toLowerCase(),goal:list(p?.goal),interests:list(p?.interests),appearance:list(p?.appearance),sexual_preferences:list(p?.sexual_preferences),personality:list(p?.personality),profession:list(p?.profession)};
}
function tokenize(s){return (String(s||'').toLowerCase().replace(/ё/g,'е').match(/[а-яa-z0-9]{3,}/g)||[]).map(x=>x.replace(/(иями|ение|ости|ость|ами|ями|ого|ему|ыми|ими|ией|иях|ать|ять|ого|ая|ые|ий|ый|ого|ов|ев|ах|ях|ей|ие|ое|ой|ый|ам|ям|ом|ем|ую|юю)$/,'')).filter(x=>x.length>=3);}
function similarity(a,b){
 if(!a.length||!b.length)return null;
 const x=new Set(a.flatMap(tokenize)),y=new Set(b.flatMap(tokenize));
 if(!x.size||!y.size)return null;
 const overlap=[...x].filter(w=>y.has(w)).length;
 return Math.min(1,overlap/Math.max(1,Math.min(x.size,y.size)));
}
function ageFit(wanted,self){
 if(wanted.age_min===null&&wanted.age_max===null||self.age_min===null&&self.age_max===null)return null;
 const a=wanted.age_min??18,b=wanted.age_max??100,c=self.age_min??18,d=self.age_max??100;
 if(b<c||d<a)return 0;return 1;
}
function genderFit(wanted,self){
 const g=wanted.gender.toLowerCase(),s=self.gender.toLowerCase();if(!g||!s||['любой','любая','все','all','не важно'].includes(g))return null;
 return g===s?1:0;
}
const WEIGHTS={age:28,goal:24,interests:20,appearance:10,sexual_preferences:7,personality:8,profession:3};
function direction(self,wanted){
 let total=0,earned=0,confidence=0;const reasons=[];
 const values={age:ageFit(wanted,self),goal:similarity(wanted.goal,self.goal),interests:similarity(wanted.interests,self.interests),appearance:similarity(wanted.appearance,self.appearance),sexual_preferences:similarity(wanted.sexual_preferences,self.sexual_preferences),personality:similarity(wanted.personality,self.personality),profession:similarity(wanted.profession,self.profession)};
 for(const [k,weight] of Object.entries(WEIGHTS)){const value=values[k];if(value===null)continue;total+=weight;earned+=weight*value;confidence+=weight;if(value>=.49)reasons.push({age:'Возраст',goal:'Цель знакомства',interests:'Интересы',appearance:'Внешность',sexual_preferences:'Предпочтения',personality:'Характер и ценности',profession:'Профессия'}[k]);}
 const g=genderFit(wanted,self);if(g===0)return {score:0,known:confidence/100,reasons:[],incompatible:true};
 return {score:total?Math.round(earned/total*100):null,known:confidence/100,reasons,incompatible:false};
}
function locationScore(a,b){if(!a||!b)return null;const x=tokenize(a),y=tokenize(b);return x.some(t=>y.includes(t))?1:0;}
export function rankMatch(a,b){
 const aToB=direction(b.self,a.wanted),bToA=direction(a.self,b.wanted);
 // Explicit partner age bounds and requested gender are eligibility constraints, not soft preferences.
 if(aToB.incompatible||bToA.incompatible||ageFit(a.wanted,b.self)===0||ageFit(b.wanted,a.self)===0)return null;
 // If only one partner specifies preferences, use that direction; never imply the other direction is confirmed.
 const known=[aToB,bToA].filter(x=>x.score!==null);
 const selfSimilarity=[similarity(a.self.interests,b.self.interests),similarity(a.self.personality,b.self.personality),similarity(a.self.goal,b.self.goal)].filter(v=>v!==null);
 const similarSelf=selfSimilarity.length?selfSimilarity.reduce((x,y)=>x+y,0)/selfSimilarity.length:null;
 const similarityScore=known.length?known.reduce((s,x)=>s+x.score,0)/known.length:(similarSelf===null?25:Math.round(similarSelf*45+20));
 const confidence=known.length?known.reduce((s,x)=>s+x.known,0)/known.length:0;
 const geoA=locationScore(a.wanted.location,b.self.location),geoB=locationScore(b.wanted.location,a.self.location);
 const geo=geoA!==null&&geoB!==null?(geoA+geoB)/2:geoA??geoB??locationScore(a.self.location,b.self.location);
 const score=Math.round(Math.max(0,Math.min(100,similarityScore)));
 const mutual=known.length===2;
 const reasons=[...new Set([...aToB.reasons,...bToA.reasons])].filter(x=>x!=='Предпочтения').slice(0,4);
 if(!known.length&&similarSelf!==null&&similarSelf>.1)reasons.push('Похожие интересы и ценности');
 if(geo===1)reasons.unshift('Подходит по локации');
 return {score,confidence:Math.round(confidence*100),mutual,location:geo===1?'same':geo===0?'different':geo===.5?'partial':'unknown',explanation:reasons.length?'Совпадает: '+reasons.slice(0,4).join(', '):'Данных для точного сравнения пока мало',reasons};
}
export function initMatchAI(sqlite){
 sqlite.exec("CREATE TABLE IF NOT EXISTS matchlove_profiles (user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE, source TEXT NOT NULL, parsed TEXT NOT NULL, updated TEXT NOT NULL);CREATE INDEX IF NOT EXISTS idx_matchlove_profiles_updated ON matchlove_profiles(updated);");
}
async function parseWithOpenAI(source,{apiKey,model='gpt-4.1-mini'}){
 if(!apiKey)throw Object.assign(new Error('OpenAI API не настроен на сервере'),{status:503});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),25000);
 try{
 const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({
 model,temperature:0,store:false,max_completion_tokens:1200,
 messages:[{role:'system',content:'Ты извлекаешь структуру из текста пользователя сайта знакомств 18+. Раздели две стороны: self = только факты о самом человеке, wanted = только требования к потенциальному партнеру. Не приписывай желания на основании личных характеристик. Если человек только рассказывает о себе, оставь wanted пустым. Если только описывает желаемого партнера, оставь self пустым. Возраст клиента — возрастной диапазон из одного числа. Для неизвестных возрастов null, для неизвестных строк пустая строка, массивов пустые массивы. sexual_preferences отражает лишь явно указанные предпочтения взрослых; не делай выводов о сексуальности из фото, интересов или стереотипов. location = явно указанное место, gender = явно указанный пол без предположений. Никаких дополнительных свойств.'},{role:'user',content:source}],
 response_format:{type:'json_schema',json_schema:{name:'matchlove_profile',strict:true,schema:spec}}})});
 if(!r.ok){const msg=await r.text();throw Object.assign(new Error('OpenAI вернул ошибку ('+r.status+')'),{status:502,detail:msg.slice(0,200)})}
 const data=await r.json(),text=data.choices?.[0]?.message?.content;if(!text)throw new Error('OpenAI не вернул структурированный профиль');
 const parsed=JSON.parse(text);return {self:normalize(parsed.self),wanted:normalize(parsed.wanted)};
 }finally{clearTimeout(timeout)}
}
export async function handleMatchAI(request,{sqlite,userId,apiKey,model}){
 if(!userId)return json({error:'Необходимо войти в аккаунт'},401);
 if(request.method==='POST'){
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник запроса'},403);
  const body=await request.json().catch(()=>({}));const source=clean(body.text,4000);
  if(source.length<15)return json({error:'Напиши о себе или о том, кого ищешь (не менее 15 символов)'},400);
  if(!body.confirmAdult)return json({error:'Доступно только совершеннолетним'},400);
  try{
   const existing=sqlite.prepare('SELECT source,parsed FROM matchlove_profiles WHERE user=?').get(userId);
   let parsed=existing?.source===source?JSON.parse(existing.parsed):await parseWithOpenAI(source,{apiKey,model});
   sqlite.prepare('INSERT INTO matchlove_profiles(user,source,parsed,updated) VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET source=excluded.source,parsed=excluded.parsed,updated=excluded.updated').run(userId,source,JSON.stringify(parsed),new Date().toISOString());
   return json({ok:true,profile:parsed});
  }catch(e){return json({error:e.message==='OpenAI API не настроен на сервере'?e.message:'Не удалось разобрать текст через OpenAI'},e.status||502)}
 }
 if(request.method==='GET'){
  const mine=sqlite.prepare('SELECT source,parsed FROM matchlove_profiles WHERE user=?').get(userId);
  if(!mine)return json({results:[],saved:false});
  const myself=JSON.parse(mine.parsed);
  // Do not limit to "most recent 200" candidates: all eligible users are evaluated and sorted.
  const rows=sqlite.prepare("SELECT m.user,m.parsed,p.name,p.city,p.birthdate,p.gender FROM matchlove_profiles m LEFT JOIN profiles p ON p.id=m.user WHERE m.user<>? AND COALESCE(p.paused,0)=0 AND NOT EXISTS(SELECT 1 FROM blocks WHERE (sender=? AND recipient=m.user) OR (recipient=? AND sender=m.user))").all(userId,userId,userId);
  const results=[];
  for(const r of rows){
   let parsed;try{parsed=JSON.parse(r.parsed)}catch{continue}
   const detail=rankMatch(myself,parsed);if(!detail)continue;
   let age=null;if(r.birthdate){const birth=new Date(r.birthdate);if(Number.isFinite(birth.getTime())){age=new Date().getUTCFullYear()-birth.getUTCFullYear();}}
   results.push({id:r.user,name:r.name||'Участник '+String(r.user).slice(0,4),city:r.city||parsed.self.location||'',age:age||parsed.self.age_min,score:detail.score,confidence:detail.confidence,mutual:detail.mutual,location:detail.location,explanation:detail.explanation});
  }
  results.sort((a,b)=>b.score-a.score||b.confidence-a.confidence||(b.location==='same')-(a.location==='same')||a.name.localeCompare(b.name));
  return json({saved:true,results,total:results.length,source:mine.source});
 }
 return json({error:'Метод не поддерживается'},405);
}
