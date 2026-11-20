const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function handleSearchDraft(request,{sqlite:db,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 if(request.method==='GET'){const draft=db.prepare('SELECT text FROM matchlove_search_drafts WHERE user=?').get(userId);return json({text:draft?.text??db.prepare('SELECT source FROM matchlove_profiles WHERE user=?').get(userId)?.source??''});}
 if(request.method!=='PATCH')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const b=await request.json().catch(()=>null);if(typeof b?.text!=='string'||b.text.length>12000)return json({error:'Описание: до 12000 символов'},400);
 db.prepare('INSERT INTO matchlove_search_drafts(user,text,updated) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET text=excluded.text,updated=excluded.updated').run(userId,b.text,Date.now());return json({ok:true});
}
