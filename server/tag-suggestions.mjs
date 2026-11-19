import {CATEGORY_TAGS,COMMON_TAG_CATEGORIES} from './category-tags.mjs';
export const MIN_TAG_USERS=5;
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').trim().replace(/\s+/g,' ');
const safe=tag=>typeof tag==='string'&&tag.trim().length>=3&&tag.trim().length<=80&&!/https?:|www\.|@|\d{3}|секс|фетиш|эрот|бдсм|диагноз|религи|полит|ориентац/i.test(tag)&&/^[\p{L}\p{N}\s,.'«»()—–-]+$/u.test(tag);
function tags(parsed,category){return [...new Set(['self','wanted'].flatMap(side=>[...(parsed[side]?.[category]||[]),...(parsed[side]?.preferences||[]).filter(p=>p.category===category).flatMap(p=>p.preferred||[])]).filter(safe).map(norm))].slice(0,60);}
export function updateTagUsage(db,user,parsed){
 db.exec('BEGIN IMMEDIATE');try{
  db.prepare('DELETE FROM matchlove_tag_usage WHERE user=?').run(user);
  const legacy=db.prepare('INSERT INTO matchlove_tag_usage(user,tag) VALUES(?,?)');for(const tag of tags(parsed,'interests'))legacy.run(user,tag);
  db.prepare('DELETE FROM matchlove_category_tag_usage WHERE user=?').run(user);
  const insert=db.prepare('INSERT INTO matchlove_category_tag_usage(user,category,tag) VALUES(?,?,?)');
  for(const category of COMMON_TAG_CATEGORIES)for(const tag of tags(parsed,category))insert.run(user,category,tag);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
export async function handleTagSuggestions(request,{sqlite}){
 if(!['GET','POST'].includes(request.method))return json({error:'Метод недоступен'},405);
 const url=new URL(request.url);if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник'},403);
 const raw=request.method==='POST'?await request.json().catch(()=>({})):null;const body=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const q=request.method==='POST'?body.q:url.searchParams.get('q')||'',category=(request.method==='POST'?body.category:url.searchParams.get('category'))||'interests',plain=(request.method==='POST'?body.format:url.searchParams.get('format'))==='tag';
 if(!Object.hasOwn(CATEGORY_TAGS,category))return json({suggestions:[]},400);
 if(typeof q!=='string'||q.length>80)return json({suggestions:[]});
 const cleaned=norm(q),verb=cleaned.match(/^(?:я\s+)?(люблю|обожаю)\s*/),prefix=plain?'':verb?verb[1]+' ':cleaned?'':'люблю ',query=verb?cleaned.slice(verb[0].length):cleaned,words=query.split(' ').filter(Boolean);
 const common=COMMON_TAG_CATEGORIES.includes(category)?sqlite.prepare('SELECT tag,COUNT(DISTINCT user) AS count FROM matchlove_category_tag_usage WHERE category=? GROUP BY tag HAVING COUNT(DISTINCT user)>=?').all(category,MIN_TAG_USERS):[];
 const rows=new Map(CATEGORY_TAGS[category].map((label,index)=>[norm(label),{label,popularity:0,index}]));
 for(const r of common)if(safe(r.tag)){const old=rows.get(norm(r.tag));rows.set(norm(r.tag),{label:old?.label||r.tag,popularity:r.count,index:old?.index??10000});}
 const matches=[...rows.values()].map(row=>({...row,key:norm(row.label)})).filter(row=>!query||words.every(word=>row.key.includes(word))).sort((a,b)=>Number(b.key.startsWith(query))-Number(a.key.startsWith(query))||b.popularity-a.popularity||a.index-b.index).slice(0,plain?12:6);
 return json({suggestions:matches.map(row=>({label:row.label,text:prefix+row.label}))});
}
