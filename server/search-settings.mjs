const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function searchSettings(db,user){const value=!!db.prepare('SELECT hide_conflicts FROM matchlove_search_settings WHERE user=?').get(user)?.hide_conflicts;return {hideConflicts:value,hideHabitConflicts:value};}
export async function handleSearchSettings(request,{sqlite:db,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 if(request.method==='GET')return json(searchSettings(db,userId));
 if(request.method!=='PATCH')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 const body=await request.json().catch(()=>null);
 if(!body||Object.keys(body).length!==1||!(typeof body.hideConflicts==='boolean'||typeof body.hideHabitConflicts==='boolean'))return json({error:'Выбери настройку поиска'},400);
 const enabled=(body.hideConflicts??body.hideHabitConflicts)?1:0;
 db.prepare('INSERT INTO matchlove_search_settings(user,hide_habit_conflicts,hide_conflicts) VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET hide_habit_conflicts=excluded.hide_habit_conflicts,hide_conflicts=excluded.hide_conflicts').run(userId,enabled,enabled);
 return json(searchSettings(db,userId));
}
