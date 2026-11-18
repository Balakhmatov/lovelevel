import {locationMatch} from './matching-location.mjs';
export const SCORING_VERSION='evidence-v2-location';
// 1 percentage point is reserved for a confirmed gender fit; 10 points are reserved for location, and the remaining 89 follow these proportions.
// Missing facts never redistribute their unused category budget to the known categories.
export const WEIGHTS={age:28,goal:24,interests:20,appearance:10,sexual_preferences:7,personality:8,profession:3};
export const SEMANTIC_FIELDS=Object.keys(WEIGHTS).filter(k=>k!=='age');
const norm=s=>String(s||'').trim().toLowerCase().replace(/ё/g,'е');
const unique=a=>[...new Set((a||[]).filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))];
const tokens=s=>new Set((norm(s).match(/[а-яa-z0-9]{3,}/g)||[]).map(x=>x.replace(/(иями|ение|ости|ость|ами|ями|ого|ему|ыми|ими|ать|ять|ая|ые|ий|ый|ов|ев|ах|ях|ей|ие|ое|ой|ам|ям|ом|ем|ую|юю)$/,'')));
function lexical(a,b){if(norm(a)===norm(b))return 1;const neg=s=>/(^|\s)(не|нет|без|not|no|without)(\s|$)/i.test(s);if(neg(a)!==neg(b))return 0;const x=tokens(a),y=tokens(b);if(!x.size||!y.size)return 0;const common=[...x].filter(t=>y.has(t)).length;const value=common/Math.max(x.size,y.size);return value>=.6?value:0;}
const canonical=v=>({мужчина:'male',парень:'male',мужской:'male',man:'male',male:'male',женщина:'female',девушка:'female',женский:'female',woman:'female',female:'female'}[norm(v)]||norm(v));
function genderFit(wanted={},self={}){const g=canonical(wanted.gender),s=canonical(self.gender);if(!g||!s||['любой','любая','все','all','не важно'].includes(g))return null;return g===s;}
function ageFit(wanted={},self={}){if(wanted.age_min==null&&wanted.age_max==null||self.age_min==null&&self.age_max==null)return null;return (wanted.age_max??100)>=(self.age_min??18)&&(self.age_max??100)>=(wanted.age_min??18);}
export function criteria(p={},category){return unique([...(p[category]||[]),...(p.preferences||[]).filter(v=>v.category===category).flatMap(v=>v.preferred||[])]);}
function importance(p,category,label){const pref=(p.preferences||[]).find(v=>v.category===category&&(v.preferred||[]).some(x=>norm(x)===norm(label)));return {required:1.7,strong:1.3,normal:1,weak:.6}[pref?.importance]||1;}
function usableLabel(s){return typeof s==='string'&&s.trim().length>0&&s.length<=100&&!/неизвест|не указ|недостаточ|нет данных|полнота сравнения/i.test(s);}
function finish(raw){
 const merged=new Map();for(const item of raw){if(item.units<=0||!usableLabel(item.label))continue;const key=item.category+'|'+norm(item.label);const old=merged.get(key);if(old)old.units+=item.units;else merged.set(key,{...item});}
 const rows=[...merged.values()],target=Math.min(10000,Math.round(rows.reduce((sum,r)=>sum+r.units,0)));for(const r of rows){r.fraction=r.units-Math.floor(r.units);r.units=Math.floor(r.units);}
 let remaining=target-rows.reduce((sum,r)=>sum+r.units,0);const byFraction=[...rows].sort((a,b)=>b.fraction-a.fraction);for(let i=0;remaining>0&&byFraction.length;i++,remaining--)byFraction[i%byFraction.length].units++;
 const matches=rows.filter(r=>r.units>0).map(r=>({label:r.label,category:r.category,points:r.units/100})).sort((a,b)=>b.points-a.points);
 return {matches,score:target/100};
}
export function scoreEvidence(a,b,evidence=[]){
 const directions=[{key:'viewer',wanted:a.wanted||{},self:b.self||{}},{key:'candidate',wanted:b.wanted||{},self:a.self||{}}];
 if(directions.some(d=>genderFit(d.wanted,d.self)===false||ageFit(d.wanted,d.self)===false))return null;
 const raw=[];if(directions.some(d=>genderFit(d.wanted,d.self)===true))raw.push({category:'gender',label:'Подходящий пол',units:100});
 for(const [category,weight] of Object.entries(WEIGHTS)){
  const budget=weight*89;
  if(category==='age'){
   const requested=directions.filter(d=>d.wanted.age_min!=null||d.wanted.age_max!=null);
   for(const d of requested)if(ageFit(d.wanted,d.self)===true){const min=d.wanted.age_min??18,max=d.wanted.age_max??100;raw.push({category,label:min===max?'Возраст '+min+' лет':'Возраст '+min+'–'+max+' лет',units:budget/requested.length});}continue;
  }
  const requested=directions.filter(d=>criteria(d.wanted,category).length);
  if(requested.length){for(const d of requested){const wanted=criteria(d.wanted,category),actual=criteria(d.self,category),denominator=wanted.reduce((sum,x)=>sum+importance(d.wanted,category,x),0);
   for(const wantedLabel of wanted){let agreement=actual.reduce((best,x)=>Math.max(best,lexical(wantedLabel,x)),0);
    const items=evidence.filter(e=>e?.direction===d.key&&e.category===category&&norm(e.wantedEvidence)===norm(wantedLabel)&&Number.isFinite(e.agreement)&&e.agreement>=0&&e.agreement<=1&&(e.agreement===0||actual.some(x=>norm(x)===norm(e.candidateEvidence))));
    if(items.length)agreement=Math.max(...items.map(e=>e.agreement));
    if(agreement>0&&actual.length)raw.push({category,label:wantedLabel.slice(0,100),units:budget/requested.length*importance(d.wanted,category,wantedLabel)/denominator*agreement});
   }
  }}else{
   // Shared self-described facts are evidence only when neither person sets a preference in this category.
   const mine=criteria(a.self||{},category),other=criteria(b.self||{},category);const denominator=Math.max(mine.length,other.length);
   for(const label of mine){const agreement=other.reduce((best,x)=>Math.max(best,lexical(label,x)),0);if(agreement>0)raw.push({category,label:label.slice(0,100),units:budget/denominator*agreement});}
  }
 }
 const proximity=locationMatch(a,b);if(proximity.units>0)raw.push({category:'location',label:proximity.label,units:proximity.units});
 const result=finish(raw);
 const knownDirections=directions.filter(d=>Object.keys(WEIGHTS).some(k=>k==='age'?(d.wanted.age_min!=null||d.wanted.age_max!=null):criteria(d.wanted,k).length));
 return {...result,distanceKm:proximity.distanceKm,confidence:0,mutual:knownDirections.length===2,location:proximity.location,explanation:'',reasons:result.matches.map(m=>m.label)};
}
export function rankMatch(a,b){return scoreEvidence(a,b);}
export function semanticProfile(p){return {self:p.self,wanted:p.wanted,criteria:Object.fromEntries(SEMANTIC_FIELDS.map(k=>[k,criteria(p.wanted||{},k)]))};}
