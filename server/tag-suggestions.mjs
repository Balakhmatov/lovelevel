import {TAG_SEEDS} from './tag-seeds.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').trim().replace(/\s+/g,' ');
const safe=tag=>typeof tag==='string'&&tag.trim().length>=3&&tag.trim().length<=70&&!/https?:|www\.|@|\d{3}|секс|фетиш|эрот|бдсм|диагноз|религи|полит|ориентац/i.test(tag)&&/^[\p{L}\p{N}\s,.'«»()—–-]+$/u.test(tag);
export function updateTagUsage(db,user,parsed){
 // Only hobby phrases can become common suggestions. Never publish source text or sensitive preference categories.
 const tags=[...new Set([...(parsed.self?.interests||[]),...(parsed.wanted?.interests||[])].filter(safe).map(norm))].slice(0,60);
 db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM matchlove_tag_usage WHERE user=?').run(user);const insert=db.prepare('INSERT INTO matchlove_tag_usage(user,tag) VALUES(?,?)');for(const tag of tags)insert.run(user,tag);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
}
export async function handleTagSuggestions(request,{sqlite}){
 if(!['GET','POST'].includes(request.method))return json({error:'Метод недоступен'},405);
 const url=new URL(request.url);if(request.method==='POST'&&request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник'},403);
 const body=request.method==='POST'?await request.json().catch(()=>({})):null;const q=request.method==='POST'?body.q:url.searchParams.get('q')||'';if(typeof q!=='string'||q.length>80)return json({suggestions:[]});
 const cleaned=norm(q),verb=cleaned.match(/^(?:я\s+)?(люблю|обожаю)\s*/),prefix=verb?verb[1]+' ':cleaned?'':'люблю ',query=verb?cleaned.slice(verb[0].length):cleaned,words=query.split(' ').filter(Boolean);
 const common=sqlite.prepare('SELECT tag,COUNT(*) AS count FROM matchlove_tag_usage GROUP BY tag HAVING COUNT(*)>=3').all();
 const rows=new Map(TAG_SEEDS.map((label,index)=>[norm(label),{label,popularity:0,index}]));
 for(const r of common)if(safe(r.tag)){const old=rows.get(norm(r.tag));rows.set(norm(r.tag),{label:old?.label||r.tag,popularity:r.count,index:old?.index??10000});}
 const matches=[...rows.values()].map(row=>({...row,key:norm(row.label)})).filter(row=>!query||words.every(word=>row.key.includes(word))).sort((a,b)=>Number(b.key.startsWith(query))-Number(a.key.startsWith(query))||b.popularity-a.popularity||a.index-b.index).slice(0,6);
 return json({suggestions:matches.map(row=>({label:row.label,text:prefix+row.label}))});
}
