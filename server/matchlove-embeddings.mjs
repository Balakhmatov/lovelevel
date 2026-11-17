// Compact two-vector retrieval for MatchLove. Only normalized structured descriptions are embedded.
const FIELDS=['goal','interests','appearance','sexual_preferences','personality','profession'];
export const EMBEDDING_MODEL='text-embedding-3-small';
export const EMBEDDING_DIMENSIONS=512;
function norm(x){return String(x||'').trim().toLowerCase();}
export function describe(profile){
 const p=profile||{};
 const pieces=[];
 if(p.gender)pieces.push('Пол: '+norm(p.gender));
 if(p.age_min!==null&&p.age_min!==undefined)pieces.push('Возраст от '+p.age_min);
 if(p.age_max!==null&&p.age_max!==undefined)pieces.push('Возраст до '+p.age_max);
 for(const k of FIELDS)if(p[k]?.length)pieces.push(k+': '+p[k].map(norm).join(', '));
 for(const pref of p.preferences||[]){
  if(pref.preferred?.length)pieces.push('Предпочтительно ('+norm(pref.importance)+', '+norm(pref.category)+'): '+pref.preferred.map(norm).join(', '));
  if(pref.acceptable?.length)pieces.push('Приемлемо ('+norm(pref.category)+'): '+pref.acceptable.map(norm).join(', '));
  if(pref.excluded?.length)pieces.push('Исключено ('+norm(pref.category)+'): '+pref.excluded.map(norm).join(', '));
 }
 return pieces.join('. ').slice(0,5000);
}
export function cosine(a,b){
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||!a.length)return null;
 let ab=0,aa=0,bb=0;for(let i=0;i<a.length;i++){ab+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
 return aa&&bb?ab/Math.sqrt(aa*bb):null;
}
export function bidirectionalVectors(viewer,candidate){
 if(!viewer||!candidate)return null;
 const values=[];
 if(viewer.wanted&&candidate.self){const v=cosine(viewer.wanted,candidate.self);if(v!==null)values.push(v)}
 if(candidate.wanted&&viewer.self){const v=cosine(candidate.wanted,viewer.self);if(v!==null)values.push(v)}
 if(!values.length&&viewer.self&&candidate.self){const v=cosine(viewer.self,candidate.self);if(v!==null)return v*.65}
 return values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
}
export async function generateEmbeddings(parsed,{apiKey,model=EMBEDDING_MODEL}){
 if(!apiKey)return null;
 const self=describe(parsed.self),wanted=describe(parsed.wanted);
 const inputs=[self,wanted].filter(Boolean);if(!inputs.length)return {self:null,wanted:null};
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),25000);
 try{
  const response=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',signal:abort.signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,dimensions:EMBEDDING_DIMENSIONS,encoding_format:'float',input:inputs})});
  if(!response.ok)throw Error('Embedding API error '+response.status);
  const data=await response.json();const vectors=(data.data||[]).sort((a,b)=>a.index-b.index).map(x=>x.embedding);
  if(vectors.length!==inputs.length||vectors.some(x=>!Array.isArray(x)||x.length!==EMBEDDING_DIMENSIONS))throw Error('Invalid embeddings response');
  return {self:self?vectors[0]:null,wanted:wanted?vectors[vectors.length-1]:null};
 }finally{clearTimeout(timer)}
}
