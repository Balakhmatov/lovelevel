import {withAccountAge} from './birthdate.mjs';
import {applyGenderDefaults} from './matchlove-ai.mjs';
import {genderFit,ageFit,SCORING_VERSION} from './match-scoring.mjs';
import {findConflicts} from './match-conflicts.mjs';
import {searchSettings} from './search-settings.mjs';
export function matchVisibility(db,viewer,target){
 const fail=reason=>({visible:false,reason});
 if(target===viewer)return fail('Это твоя анкета: она не показывается в собственной подборке.');
 const mine=db.prepare('SELECT parsed,updated FROM matchlove_profiles WHERE user=?').get(viewer),candidate=db.prepare('SELECT parsed,updated FROM matchlove_profiles WHERE user=?').get(target);
 if(!mine)return fail('Сначала заполни свою анкету и запусти поиск.');
 if(!candidate)return fail('Пользователь зарегистрировался, но ещё не сохранил анкету для подбора.');
 if(db.prepare('SELECT 1 FROM matchlove_account_bans WHERE user=?').get(target))return fail('Аккаунт заблокирован администратором.');
 if(db.prepare('SELECT 1 FROM profiles WHERE id=? AND paused=1').get(target))return fail('Показ анкеты приостановлен.');
 if(db.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(viewer,target,target,viewer))return fail('Между вами действует блокировка.');
 let a,b;try{a=applyGenderDefaults(withAccountAge(db,viewer,JSON.parse(mine.parsed)),db.prepare('SELECT gender FROM auth_accounts WHERE id=?').get(viewer)?.gender);b=applyGenderDefaults(withAccountAge(db,target,JSON.parse(candidate.parsed)),db.prepare('SELECT gender FROM auth_accounts WHERE id=?').get(target)?.gender);}catch{return fail('Сохранённые данные анкеты повреждены. Нужно повторно сохранить анкету.');}
 if(genderFit(a.wanted,b.self)===false)return fail('Пол пользователя не соответствует твоему выбору «Кого ищу».');
 const outsideAgeRange=ageFit(a.wanted,b.self)===false;
 const cached=db.prepare('SELECT evidence FROM matchlove_ai_cache WHERE viewer=? AND candidate=? AND viewer_updated=? AND candidate_updated=? AND scoring_version=?').get(viewer,target,mine.updated,candidate.updated,SCORING_VERSION);let evidence=[];try{const value=JSON.parse(cached?.evidence||'[]');if(Array.isArray(value))evidence=value;}catch{}
 const conflicts=findConflicts(a,b,evidence);
 if(searchSettings(db,viewer).hideConflicts&&conflicts.length)return fail('Включён фильтр нежелательных критериев. Не совпало: '+conflicts.map(c=>c.label).join(', ')+'.');
 if(outsideAgeRange)return {visible:true,reason:'Анкета проходит фильтры. Возраст вне желаемого диапазона уменьшает баллы за возраст, но не скрывает пользователя.'};
 return {visible:true,reason:'Анкета проходит фильтры и должна появляться в обновлённой подборке. Другой город и низкий процент сами по себе её не скрывают.'};
}
