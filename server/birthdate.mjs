export function fullYears(value,now=Date.now()){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day)),today=new Date(now);
 if(year<1900||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||!Number.isFinite(today.getTime())||date.getTime()>today.getTime())return null;
 return today.getUTCFullYear()-year-(today.getUTCMonth()+1<month||today.getUTCMonth()+1===month&&today.getUTCDate()<day?1:0);
}
export function validAdultBirthdate(value,now=Date.now()){const age=fullYears(value,now);return age!==null&&age>=18&&age<=100;}
export function accountBirthdate(db,user){return db.prepare('SELECT birthdate FROM matchlove_birthdates WHERE user=?').get(user)?.birthdate||null;}
export function withAccountAge(db,user,profile,now=Date.now()){const age=fullYears(accountBirthdate(db,user),now);if(age===null)return profile;return {...profile,self:{...profile.self,age_min:age,age_max:age}};}
