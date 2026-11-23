import {accountBirthdate,withAccountAge,fullYears} from './birthdate.mjs';
import {ZODIAC_SIGNS,zodiacSigns,zodiacComparison} from './zodiac.mjs';
import {findConflicts} from './match-conflicts.mjs';
import {SCORING_VERSION,criteria} from './match-scoring.mjs';
import {searchSettings} from './search-settings.mjs';
import {randomUUID} from 'node:crypto';
import {updateTagUsage} from './tag-suggestions.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const PROFILE_LISTS=['goal','interests','habits','personality','profession','appearance','sexual_preferences'];
const EMPTY={name:'',bio:'',age_min:null,age_max:null,location:'',gender:'',zodiac:[],preferences:[],...Object.fromEntries(PROFILE_LISTS.map(k=>[k,[]]))};
export function mergeManualProfile(parsed,overrides={}){
 const result={...parsed,self:{...EMPTY,...parsed.self,...overrides.self},wanted:{...EMPTY,...parsed.wanted,...overrides.wanted}};
 // A manually replaced category must also replace AI-generated preference clauses for it.
 for(const side of ['self','wanted'])result[side].preferences=(result[side].preferences||[]).filter(p=>!Object.hasOwn(overrides[side]||{},p.category));
 // Preferences may carry the AI's wishes even when the direct category array is empty.
 for(const category of PROFILE_LISTS)result.wanted[category]=criteria(result.wanted,category);
 if(Object.hasOwn(overrides.wanted||{},'gender'))result.genderPreferenceExplicit=!!overrides.wanted.gender;
 return result;
}
export function applyManualProfile(db,user,parsed){const row=db.prepare('SELECT data FROM matchlove_profile_overrides WHERE user=?').get(user);return withAccountAge(db,user,mergeManualProfile(parsed,row?JSON.parse(row.data):{}));}
export function canViewProfile(db,viewer,target){return target===viewer||!db.prepare('SELECT 1 FROM matchlove_account_bans WHERE user=?').get(target)&&!!db.prepare('SELECT 1 FROM matchlove_profiles WHERE user=?').get(target)&&!db.prepare('SELECT 1 FROM profiles WHERE id=? AND paused=1').get(target)&&!db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(viewer,target,target,viewer);}
function validate(side,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Некорректные поля анкеты');
 const result={};
 for(const [key,value] of Object.entries(patch)){
  if(key==='zodiac'){if(!Array.isArray(value)||value.length>(side==='self'?1:12)||value.some(v=>!ZODIAC_SIGNS.includes(v)))throw Error('Выбери знак зодиака из списка');result[key]=zodiacSigns(value);}
  else if(PROFILE_LISTS.includes(key)){if(!Array.isArray(value)||value.length>30||value.some(v=>typeof v!=='string'||v.length>80))throw Error('Не больше 30 пунктов по 80 символов');result[key]=[...new Set(value.map(v=>v.trim()).filter(Boolean))];}
  else if(['age_min','age_max'].includes(key)){if(value!==null&&(!Number.isInteger(value)||value<18||value>100))throw Error('Возраст — от 18 до 100 лет');result[key]=value;}
  else if(['bio','location','name'].includes(key)){if(key==='name'&&side!=='self')throw Error('Некорректное поле');if(typeof value!=='string'||value.length>({bio:1200,location:90,name:60}[key]))throw Error('Слишком длинное поле');result[key]=value.trim();}
  else if(key==='gender'&&side==='wanted'){if(!['','male','female','all'].includes(value))throw Error('Выбери пол');result[key]=value;}
  else throw Error('Некорректное поле анкеты');
 }
 return result;
}
export async function handleProfile(request,{sqlite:db,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 const url=new URL(request.url),target=url.searchParams.get('user')||userId;
 if(!canViewProfile(db,userId,target))return json({error:'Анкета недоступна'},404);
 if(request.method==='GET'){
  const row=db.prepare('SELECT parsed,updated FROM matchlove_profiles WHERE user=?').get(target);
  const classic=db.prepare('SELECT name,city FROM profiles WHERE id=?').get(target),gender=db.prepare('SELECT gender FROM auth_accounts WHERE id=?').get(target)?.gender;
  const profile=applyManualProfile(db,target,row?JSON.parse(row.parsed):{});profile.self.gender=gender||profile.self.gender;
  const photos=db.prepare('SELECT id,is_main FROM matchlove_photos WHERE user=? ORDER BY is_main DESC,created,id').all(target).map(p=>({id:p.id,main:!!p.is_main,url:'/api/profile-photo?user='+encodeURIComponent(target)+'&id='+encodeURIComponent(p.id)}));
  const own=target===userId;
  const locked=own?JSON.parse(db.prepare('SELECT data FROM matchlove_profile_overrides WHERE user=?').get(target)?.data||'{}'):undefined;
  let zodiacMatch=null,conflicts=[];if(!own){const mine=db.prepare('SELECT parsed,updated FROM matchlove_profiles WHERE user=?').get(userId);if(mine){let evidence=[];const cached=db.prepare('SELECT evidence FROM matchlove_ai_cache WHERE viewer=? AND candidate=? AND viewer_updated=? AND candidate_updated=? AND scoring_version=?').get(userId,target,mine.updated,row.updated,SCORING_VERSION);try{const items=JSON.parse(cached?.evidence||'[]');if(Array.isArray(items))evidence=items;}catch{}conflicts=findConflicts(JSON.parse(mine.parsed),profile,evidence);zodiacMatch=zodiacComparison(JSON.parse(mine.parsed),profile);}}
  return json({id:target,own,conflicts,zodiacMatch,name:profile.self.name||classic?.name||'Участник '+target.slice(0,4),city:profile.self.location||classic?.city||'',profile,photos,...(own?{locked,birthdate:accountBirthdate(db,userId),searchSettings:searchSettings(db,userId)}:{})});
 }
 if(request.method!=='PATCH')return json({error:'Метод недоступен'},405);
 if(target!==userId)return json({error:'Можно редактировать только свою анкету'},403);
 if(request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник'},403);
 let body;try{body=await request.json();}catch{return json({error:'Некорректный запрос'},400);}
 let patches={};try{if(!body||typeof body!=='object'||!Object.keys(body).length||Object.keys(body).some(k=>!['self','wanted'].includes(k)))throw Error('Выбери поля анкеты');for(const side of Object.keys(body))patches[side]=validate(side,body[side]);}catch(error){return json({error:error.message},400);}
 const registeredAge=fullYears(accountBirthdate(db,userId));if(registeredAge!==null&&patches.self){for(const key of ['age_min','age_max'])if(key in patches.self){if(patches.self[key]!==registeredAge)return json({error:'Возраст рассчитывается по дате рождения, указанной при регистрации.'},400);delete patches.self[key];}}
 const existing=db.prepare('SELECT * FROM matchlove_profiles WHERE user=?').get(userId),old=existing?JSON.parse(existing.parsed):{};
 const previous=JSON.parse(db.prepare('SELECT data FROM matchlove_profile_overrides WHERE user=?').get(userId)?.data||'{}');
 const overrides={self:{...previous.self,...patches.self},wanted:{...previous.wanted,...patches.wanted}};
 const profile=withAccountAge(db,userId,mergeManualProfile(old,overrides));profile.self.gender=db.prepare('SELECT gender FROM auth_accounts WHERE id=?').get(userId)?.gender||'';
 for(const side of ['self','wanted'])if(profile[side].age_min!=null&&profile[side].age_max!=null&&profile[side].age_min>profile[side].age_max)return json({error:'Начало возраста должно быть не больше конца'},400);
 const updated=new Date().toISOString()+'-'+randomUUID();
 db.exec('BEGIN IMMEDIATE');try{
  db.prepare('INSERT INTO matchlove_profile_overrides(user,data) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET data=excluded.data').run(userId,JSON.stringify(overrides));
  db.prepare('INSERT INTO matchlove_profiles(user,source,parsed,updated) VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET parsed=excluded.parsed,updated=excluded.updated').run(userId,existing?.source||'',JSON.stringify(profile),updated);
  db.prepare('DELETE FROM matchlove_vectors WHERE user=?').run(userId);db.prepare('DELETE FROM matchlove_ai_cache WHERE viewer=? OR candidate=?').run(userId,userId);db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
 updateTagUsage(db,userId,profile);
 return json({ok:true,profile,locked:overrides});
}
