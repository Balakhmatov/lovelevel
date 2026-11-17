const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export const SEARCH_PHOTO_LIMIT=8*1024*1024;
function imageMime(bytes){
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
 return null;
}
export async function handleSearchPhoto(request,{sqlite,userId}){
 if(!userId)return json({error:'Войдите в аккаунт'},401);
 const path=new URL(request.url).pathname;
 if(request.method==='GET'||request.method==='HEAD'){
  if(path==='/api/search-photo-info'){
   const row=sqlite.prepare('SELECT updated FROM matchlove_search_photos WHERE user=?').get(userId);
   return json({url:row?'/api/search-photo?v='+encodeURIComponent(row.updated):null});
  }
  const row=sqlite.prepare('SELECT mime,data FROM matchlove_search_photos WHERE user=?').get(userId);
  if(!row)return json({error:'Фото не загружено'},404);
  return new Response(row.data,{headers:{'Content-Type':row.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path!=='/api/search-photo'||request.method!=='POST')return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник запроса'},403);
 let form;try{form=await request.formData()}catch{return json({error:'Не удалось прочитать фото'},400)}
 const file=form.get('file');
 if(!(file instanceof File)||!file.size)return json({error:'Выбери фото'},400);
 if(file.size>SEARCH_PHOTO_LIMIT)return json({error:'Фото не должно превышать 8 МБ'},413);
 const bytes=Buffer.from(await file.arrayBuffer()),mime=imageMime(bytes);
 if(!mime)return json({error:'Выбери фото в формате JPEG, PNG, WebP или GIF'},400);
 const updated=new Date().toISOString();
 sqlite.prepare('INSERT INTO matchlove_search_photos(user,mime,data,updated) VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET mime=excluded.mime,data=excluded.data,updated=excluded.updated').run(userId,mime,bytes,updated);
 return json({ok:true,url:'/api/search-photo?v='+encodeURIComponent(updated)});
}
