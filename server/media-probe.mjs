import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);let active=0;
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export async function inspectClip(file){
 if(file.size===0||file.size>5*1024*1024)throw failure('Выберите файл до 5 МБ');
 if(active>=2)throw failure('Сейчас обрабатываются другие файлы. Повторите через несколько секунд.',429);
 const mime=file.type.split(';')[0],video=mime.startsWith('video/');
 if(!['video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','audio/wav','audio/mpeg'].includes(mime))throw failure('Неподдерживаемый формат');
 active++;let dir;
 try{
  dir=await mkdtemp(join(tmpdir(),'lovelevel-media-'));const path=join(dir,'clip');await writeFile(path,new Uint8Array(await file.arrayBuffer()),{mode:0o600});
  let output;try{output=await exec('ffprobe',['-v','error','-protocol_whitelist','file','-format_whitelist','mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,ogg,wav,mp3','-show_entries','format=duration,format_name:stream=codec_type,duration,width,height:packet=pts_time,duration_time','-of','json',path],{timeout:8000,maxBuffer:1024*1024,windowsHide:true});}catch(error){if(error.code==='ENOENT')throw failure('Обработка видео и голоса ещё не включена на сервере',503);throw failure('Не удалось прочитать файл. Выберите обычное видео MP4/WebM или аудиозапись.');}
  const data=JSON.parse(output.stdout),streams=data.streams||[],format=data.format?.format_name||'';
  const expected=mime.includes('webm')?'webm':mime.includes('mp4')?'mp4':mime.includes('ogg')?'ogg':mime.includes('wav')?'wav':'mp3';
  if(!format.split(',').includes(expected))throw failure('Содержимое файла не соответствует его формату');
  if(video?!streams.some(s=>s.codec_type==='video'):(!streams.some(s=>s.codec_type==='audio')||streams.some(s=>s.codec_type==='video')))throw failure(video?'В файле нет видеодорожки':'Для голосового нужен аудиофайл без видео');
  const values=[Number(data.format?.duration),...streams.map(s=>Number(s.duration)),...(data.packets||[]).map(p=>Number(p.pts_time)+(Number(p.duration_time)||0))].filter(Number.isFinite);
  const duration=Math.max(0,...values),limit=video?5:30;
  if(duration<=0||duration>limit+.25)throw failure(`Максимальная длительность — ${limit} секунд`);
  if(streams.some(s=>Number(s.width)>3840||Number(s.height)>3840))throw failure('Выберите видео с разрешением не выше 4K');
  return {duration};
 }finally{active--;if(dir)await rm(dir,{recursive:true,force:true});}
}
