const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/^\s*г(?:ород)?\.?\s+/,'').replace(/[^а-яa-z0-9]+/g,' ').trim();
export function cityKey(city){const k=norm(city);return {спб:'санкт петербург',питер:'санкт петербург',санктпетербург:'санкт петербург',мск:'москва',moscow:'москва','saint petersburg':'санкт петербург'}[k]||k;}
const coordinates=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
export function distanceKm(a,b){if(!coordinates(a)||!coordinates(b))return null;const rad=x=>x*Math.PI/180,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),v=Math.sin(dLat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(Math.min(1,v)),Math.sqrt(Math.max(0,1-v)));}
export function locationMatch(a,b){
 const mine=a.matchingLocation||{},other=b.matchingLocation||{};const km=distanceKm(mine,other);
 if(km!==null)return {units:Math.round(1000/(1+km/100)),distanceKm:Math.round(km),label:km<1?'Менее 1 км от тебя':'Примерно '+Math.round(km)+' км от тебя',location:km<=30?'same':'different'};
 const cityA=mine.city||a.self?.location,cityB=other.city||b.self?.location;
 if(cityKey(cityA)&&cityKey(cityB)&&cityKey(cityA)===cityKey(cityB))return {units:1000,distanceKm:null,label:'Один город: '+String(cityA).trim(),location:'same'};
 return {units:0,distanceKm:null,label:'',location:cityKey(cityA)&&cityKey(cityB)?'different':'unknown'};
}
export function ownLocation(db,user){const row=db.prepare('SELECT city,latitude,longitude FROM matchlove_locations WHERE user=?').get(user);const profile=db.prepare('SELECT parsed FROM matchlove_profiles WHERE user=?').get(user);let parsed;try{parsed=JSON.parse(profile?.parsed||'{}')}catch{parsed={}}return {...(row||{}),city:row?.city||parsed.self?.location||db.prepare('SELECT city FROM profiles WHERE id=?').get(user)?.city||''};}
export async function handleLocation(request,{sqlite:db,userId}){
 if(!userId)return json({error:'Войди в аккаунт'},401);
 const read=()=>{const row=ownLocation(db,userId);return json({city:row.city,enabled:coordinates(row)});};
 if(request.method==='GET')return read();
 if(!['PATCH','DELETE'].includes(request.method))return json({error:'Метод недоступен'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Недопустимый источник'},403);
 if(request.method==='DELETE'){db.prepare('UPDATE matchlove_locations SET latitude=NULL,longitude=NULL,updated=? WHERE user=?').run(new Date().toISOString(),userId);return read();}
 const body=await request.json().catch(()=>({})),previous=db.prepare('SELECT city,latitude,longitude FROM matchlove_locations WHERE user=?').get(userId);let city=previous?.city||'',latitude=previous?.latitude??null,longitude=previous?.longitude??null;
 if('city' in body){if(typeof body.city!=='string'||body.city.trim().length>80)return json({error:'Укажи город до 80 символов'},400);city=body.city.trim();}
 if('latitude' in body||'longitude' in body){if(body.consent!==true||!coordinates(body))return json({error:'Для геолокации нужны разрешение и корректные координаты'},400);latitude=Math.round(body.latitude*100)/100;longitude=Math.round(body.longitude*100)/100;}
 if(!('city' in body)&&!('latitude' in body))return json({error:'Укажи город или разреши геолокацию'},400);
 db.prepare('INSERT INTO matchlove_locations(user,city,latitude,longitude,updated) VALUES(?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET city=excluded.city,latitude=excluded.latitude,longitude=excluded.longitude,updated=excluded.updated').run(userId,city,latitude,longitude,new Date().toISOString());return read();
}
