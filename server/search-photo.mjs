import {randomUUID} from 'node:crypto';
import {compressPhoto} from './photo-compression.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const SEARCH_PHOTO_LIMIT=8*1024*1024;
const MAX_PHOTOS=30;
function imageMime(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
 return null;
}
function gallery(db,user){
 const photos=db.prepare('SELECT id,is_main FROM matchlove_photos WHERE user=? ORDER BY created,id').all(user).map(p=>({id:p.id,main:!!p.is_main,url:'/api/search-photo?id='+encodeURIComponent(p.id)}));
 return {url:photos.find(p=>p.main)?.url||null,photos,limit:MAX_PHOTOS};
}
export async function handleSearchPhoto(request,{sqlite,userId}){
 if(!userId)return json({error:'Войдите в аккаунт'},401);
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='GET'||request.method==='HEAD'){
  if(path==='/api/search-photo-info')return json(gallery(sqlite,userId));
  let row;
  if(path==='/api/profile-photo'){
   const target=url.searchParams.get('user');
   if(target!==userId&&(!sqlite.prepare('SELECT 1 FROM matchlove_profiles WHERE user=?').get(target)||sqlite.prepare('SELECT 1 FROM profiles WHERE id=? AND paused=1').get(target)||sqlite.prepare('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)').get(userId,target,target,userId)))return json({error:'Фото недоступно'},404);
   row=url.searchParams.has('id')?sqlite.prepare('SELECT mime,data FROM matchlove_photos WHERE user=? AND id=?').get(target,url.searchParams.get('id')):sqlite.prepare('SELECT mime,data FROM matchlove_photos WHERE user=? AND is_main=1').get(target);
  }else row=url.searchParams.has('id')?sqlite.prepare('SELECT mime,data FROM matchlove_photos WHERE user=? AND id=?').get(userId,url.searchParams.get('id')):sqlite.prepare('SELECT mime,data FROM matchlove_photos WHERE user=? AND is_main=1').get(userId);
  if(!row)return json({error:'Фото не загружено'},404);
  return new Response(row.data,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path!=='/api/search-photo'||!['POST','PATCH','DELETE'].includes(request.method))return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Недопустимый источник запроса'},403);
 if(request.method==='PATCH'||request.method==='DELETE'){
  const body=await request.json().catch(()=>({}));const row=sqlite.prepare('SELECT id,is_main FROM matchlove_photos WHERE user=? AND id=?').get(userId,typeof body.id==='string'?body.id:'');if(!row)return json({error:'Фото не найдено'},404);
  sqlite.exec('BEGIN IMMEDIATE');try{
   if(request.method==='PATCH'){sqlite.prepare('UPDATE matchlove_photos SET is_main=0 WHERE user=?').run(userId);sqlite.prepare('UPDATE matchlove_photos SET is_main=1 WHERE user=? AND id=?').run(userId,row.id);}
   else{if(sqlite.prepare('SELECT COUNT(*) n FROM matchlove_photos WHERE user=?').get(userId).n<=1){sqlite.exec('ROLLBACK');return json({error:'Нужно оставить хотя бы одно фото. Сначала загрузи замену.'},409);}sqlite.prepare('DELETE FROM matchlove_photos WHERE user=? AND id=?').run(userId,row.id);if(row.is_main){const next=sqlite.prepare('SELECT id FROM matchlove_photos WHERE user=? ORDER BY created,id LIMIT 1').get(userId);if(next)sqlite.prepare('UPDATE matchlove_photos SET is_main=1 WHERE id=?').run(next.id);}}
   sqlite.exec('COMMIT');
  }catch(error){sqlite.exec('ROLLBACK');throw error;}return json({ok:true,...gallery(sqlite,userId)});
 }
 if(sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_photos WHERE user=?').get(userId).n>=MAX_PHOTOS)return json({error:'Можно загрузить до 30 фото. Удали одно, чтобы добавить новое'},409);
 let form;try{form=await request.formData()}catch{return json({error:'Не удалось прочитать фото'},400)}
 const file=form.get('file');if(!(file instanceof File)||!file.size)return json({error:'Выбери фото'},400);if(file.size>SEARCH_PHOTO_LIMIT)return json({error:'Фото не должно превышать 8 МБ'},413);
 const bytes=Buffer.from(await file.arrayBuffer());if(!imageMime(bytes))return json({error:'Выбери фото в формате JPEG, PNG, WebP или GIF'},400);
 let compressed;try{compressed=await compressPhoto(bytes)}catch(error){return json({error:error.message},error.status||400)}
 sqlite.exec('BEGIN IMMEDIATE');try{
  const count=sqlite.prepare('SELECT COUNT(*) AS n FROM matchlove_photos WHERE user=?').get(userId).n;
  if(count>=MAX_PHOTOS){sqlite.exec('ROLLBACK');return json({error:'Можно загрузить до 30 фото'},409);}
  sqlite.prepare('INSERT INTO matchlove_photos(id,user,mime,data,is_main,created) VALUES(?,?,?,?,?,?)').run(randomUUID(),userId,'image/webp',compressed,count===0?1:0,new Date().toISOString());sqlite.exec('COMMIT');
 }catch(error){sqlite.exec('ROLLBACK');throw error;}
 return json({ok:true,...gallery(sqlite,userId)});
}
