const norm=s=>String(s||'').trim().toLowerCase().replace(/ё/g,'е');
const list=(p,k)=>[...new Set([...(Array.isArray(p?.[k])?p[k]:[]),...(p?.preferences||[]).filter(v=>v.category===k).flatMap(v=>v.preferred||[])])];
export function habitState(text){
 const s=norm(text);
 if(/кур(?:ю|ит|ят|ишь|ить|ени[ея]|ящ|ильщик)|сигарет|smok/.test(s)){
  if(/не\s*кур|некур|без\s+(?:сигарет|курени)|non.?smok|no smoking|бросил[аи]?\s+курить/.test(s))return {kind:'smoking',value:'no'};
  if(/(?:^|\s)кур(?:ю|ит|ят|ишь|ящ)|курильщик|smoker/.test(s))return {kind:'smoking',value:'yes'};
 }
 if(/алкогол|выпива|трезвен|непьющ/.test(s)||/^не\s+(?:пью|пьет)(?:\s+(?:совсем|вообще))?$/.test(s)){
  if(/не\s*(?:пью|пьет|выпива|употребля\S*\s+алкогол)|без\s+алкогол|трезвен|непьющ/.test(s))return {kind:'alcohol',value:'no'};
  if(/регулярно|часто|каждый\s+день/.test(s))return {kind:'alcohol',value:'frequent'};
  if(/иногда|редко|выходным|праздникам/.test(s))return {kind:'alcohol',value:'occasional'};
  if(/употребля|выпива/.test(s))return {kind:'alcohol',value:'yes'};
 }
 return null;
}
export function habitLabel(text){const state=habitState(text);return state?.kind==='smoking'?(state.value==='no'?'Не курит':'Курит'):state?.kind==='alcohol'?({no:'Не употребляет алкоголь',occasional:'Иногда употребляет алкоголь',frequent:'Часто употребляет алкоголь',yes:'Употребляет алкоголь'}[state.value]):text;}
export function findConflicts(viewer,candidate,evidence=[]){
 const flags=[],seen=new Set();
 const add=(category,actual,wanted,reason)=>{const key=category+'|'+norm(actual);if(seen.has(key))return;seen.add(key);flags.push({category,label:category==='habits'?habitLabel(actual):actual,expected:wanted,evidence:actual,reason:reason||'Ты ищешь: '+(category==='habits'?habitLabel(wanted):wanted)});};
 for(const wanted of list(viewer.wanted,'habits'))for(const actual of list(candidate.self,'habits')){
  const w=habitState(wanted),a=habitState(actual);if(!w||!a||w.kind!==a.kind)continue;
  if(w.value==='no'&&a.value!=='no')add('habits',actual,wanted,w.kind==='smoking'?'Ты ищешь некурящего партнёра':'Ты ищешь партнёра, который не употребляет алкоголь');
  else if(w.kind==='alcohol'&&w.value==='occasional'&&a.value==='frequent')add('habits',actual,wanted,'Ты ищешь партнёра, который выпивает редко');
 }
 for(const pref of viewer.wanted?.preferences||[])for(const excluded of pref.excluded||[])for(const actual of list(candidate.self,pref.category)){
  if(norm(actual)===norm(excluded))add(pref.category,actual,excluded,'Это указано в твоих нежелательных качествах');
 }
 for(const e of evidence){
  if(e?.direction!=='viewer'||e.conflict!==true||e.agreement!==0)continue;
  if(!list(viewer.wanted,e.category).some(x=>norm(x)===norm(e.wantedEvidence))||!list(candidate.self,e.category).some(x=>norm(x)===norm(e.candidateEvidence)))continue;
  if(norm(e.wantedEvidence)===norm(e.candidateEvidence))continue;
  const expected=habitState(e.wantedEvidence),actual=habitState(e.candidateEvidence);
  if(e.category==='habits'&&expected&&actual&&expected.kind===actual.kind&&expected.value===actual.value)continue;
  add(e.category,e.candidateEvidence,e.wantedEvidence);
 }
 return flags;
}
