export const thresholds=[0,5,10,15,20,35,50,65,80,100];
export function level(points){let n=1;for(let i=0;i<thresholds.length;i++)if(points>=thresholds[i])n=i+1;return n;}
export function age(date,today=new Date()){const d=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)return -1;return today.getUTCFullYear()-d.getUTCFullYear()-(today.getUTCMonth()<d.getUTCMonth()||(today.getUTCMonth()===d.getUTCMonth()&&today.getUTCDate()<d.getUTCDate())?1:0);}
export function stablePick(viewer,items){return [...items].sort((a,b)=>hash(viewer+a.id)-hash(viewer+b.id)).slice(0,2);}
function hash(s){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function accessible(viewer,owner,viewerLevel,items){if(viewer===owner)return new Set(items.map(m=>m.id));const approved=items.filter(m=>m.status==='approved');const normal=approved.filter(m=>mediaKind(m)==='photo'&&!m.basic&&m.min===1);const initial=stablePick(viewer,normal);return new Set(approved.filter(m=>{if(mediaKind(m)!=='photo')return viewerLevel>=m.min;return m.basic||(m.min===1?(viewerLevel>=4||initial.some(x=>x.id===m.id)):viewerLevel>=Math.max(4,m.min));}).map(m=>m.id));}
export function rewardTasks(profile,photoCount){return [{key:'profile',label:'Создать анкету',points:5,ready:!!profile},{key:'intent',label:'Указать намерения',points:5,ready:!!profile?.intent},{key:'about',label:'Рассказать о себе',points:5,ready:(profile?.bio?.trim().length||0)>=60},{key:'interests',label:'Выбрать три интереса',points:5,ready:JSON.parse(profile?.interests||'[]').length>=3},{key:'photos',label:'Добавить три фото',points:10,ready:photoCount>=3}];}

export function mediaKind(m){return m.mime?.startsWith('video/')?'video':m.mime?.startsWith('audio/')?'voice':'photo';}
export function milestoneTasks(profile,{photos=0,likes=0,days=0,privacy=false,videos=0,voices=0}={}){
 return [
 {key:'basics',targetLevel:2,label:'Заполнить основные данные и цель знакомства',hint:'Имя, город и цель знакомства',tool:'basics',ready:!!profile?.name&&!!profile?.city&&!!profile?.intent},
 {key:'description',targetLevel:3,label:'Рассказать о себе и выбрать интересы',hint:'От 60 символов и минимум 3 интереса',tool:'description',ready:(profile?.bio?.trim().length||0)>=60&&JSON.parse(profile?.interests||'[]').length>=3},
 {key:'three-photos',targetLevel:4,label:'Добавить три фотографии',hint:`${Math.min(photos,3)} из 3 · фото на проверке тоже учитываются`,tool:'photos',ready:photos>=3},
 {key:'first-like',targetLevel:5,label:'Поставить одну симпатию',hint:'Взаимный лайк не требуется',tool:'like',ready:likes>0},
 {key:'two-days',targetLevel:6,label:'Пользоваться приложением в 2 разных дня',hint:`${Math.min(days,2)} из 2 дней · не обязательно подряд`,tool:'days',ready:days>=2},
 {key:'photo-access',targetLevel:7,label:'Настроить доступ к своим фотографиям',hint:'Сохрани уровень доступа для дополнительного фото',tool:'privacy',ready:!!privacy},
 {key:'four-days',targetLevel:8,label:'Пользоваться приложением в 4 разных дня',hint:`${Math.min(days,4)} из 4 дней · не обязательно подряд`,tool:'days',ready:days>=4},
 {key:'first-video',targetLevel:9,label:'Добавить короткое видео',hint:'До 30 секунд · загрузка доступна уже сейчас',tool:'video',ready:videos>0},
 {key:'first-voice',targetLevel:10,label:'Добавить голосовое',hint:'Запиши или загрузи голосовое до 30 секунд',tool:'voice',ready:voices>0}
 ];
}
