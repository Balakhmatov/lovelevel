// Compact two-vector retrieval for MatchLove. Only normalized structured descriptions are embedded.
const FIELDS=['goal','interests','appearance','sexual_preferences','personality','habits','profession'];
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
export async function generateEmbeddings(parsed,{apiKey,model=EMBEDDING_MODEL,timeoutMs=25000}){
 if(!apiKey)return null;
 const self=describe(parsed.self),wanted=describe(parsed.wanted);
 const inputs=[self,wanted].filter(Boolean);if(!inputs.length)return {self:null,wanted:null};
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);
 try{
  const response=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',signal:abort.signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,dimensions:EMBEDDING_DIMENSIONS,encoding_format:'float',input:inputs})});
  if(!response.ok)throw Error('Embedding API error '+response.status);
  const data=await response.json();const vectors=(data.data||[]).sort((a,b)=>a.index-b.index).map(x=>x.embedding);
  if(vectors.length!==inputs.length||vectors.some(x=>!Array.isArray(x)||x.length!==EMBEDDING_DIMENSIONS))throw Error('Invalid embeddings response');
  return {self:self?vectors[0]:null,wanted:wanted?vectors[vectors.length-1]:null};
 }finally{clearTimeout(timer)}
}

// Tag vectors are cached independently of profile revisions and never returned to clients.
export function tagKey(category,text){return category+': '+String(text).trim().toLowerCase().replace(/ё/g,'е');}
export async function loadTagVectors(sqlite,profiles,{apiKey,model=EMBEDDING_MODEL}={}){
 const labels=new Set();
 for(const profile of profiles)for(const side of ['self','wanted'])for(const category of FIELDS){
  const p=profile[side]||{};
  for(const label of [...(p[category]||[]),...(p.preferences||[]).filter(p=>p.category===category).flatMap(p=>[...(p.preferred||[]),...(p.excluded||[])])])labels.add(tagKey(category,label));
 }
 const vectors=new Map(),missing=[];
 for(const label of labels){const row=sqlite.prepare('SELECT vector FROM matchlove_tag_vectors WHERE model=? AND tag=?').get(model,label);if(row){try{vectors.set(label,JSON.parse(row.vector));}catch{missing.push(label)}}else missing.push(label);}
 if(!apiKey)return vectors;
 for(let i=0;i<missing.length;i+=128){
  const input=missing.slice(i,i+128),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const response=await fetch('https://api.openai.com/v1/embeddings',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({model,dimensions:EMBEDDING_DIMENSIONS,encoding_format:'float',input})});
   if(!response.ok)throw Error('Tag embedding API error '+response.status);
   const data=await response.json(),rows=(data.data||[]).sort((a,b)=>a.index-b.index);
   if(rows.length!==input.length||rows.some(r=>!Array.isArray(r.embedding)||r.embedding.length!==EMBEDDING_DIMENSIONS||r.embedding.some(v=>!Number.isFinite(v))))throw Error('Invalid tag embeddings');
   for(let j=0;j<input.length;j++){vectors.set(input[j],rows[j].embedding);sqlite.prepare('INSERT OR REPLACE INTO matchlove_tag_vectors(model,tag,vector) VALUES(?,?,?)').run(model,input[j],JSON.stringify(rows[j].embedding));}
  }catch(error){console.error('MatchLove tag embeddings unavailable:',error.name);break;}finally{clearTimeout(timer)}
 }
 return vectors;
}
