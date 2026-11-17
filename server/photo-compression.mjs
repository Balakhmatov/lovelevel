import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const exec=promisify(execFile);
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export async function compressPhoto(bytes){
 let dir;
 try{
  dir=await mkdtemp(join(tmpdir(),'matchlove-photo-'));const input=join(dir,'input'),output=join(dir,'photo.webp');await writeFile(input,bytes,{mode:0o600});
  const probe=await exec('ffprobe',['-v','error','-protocol_whitelist','file','-show_entries','stream=codec_name,width,height','-of','json',input],{timeout:8000,maxBuffer:65536});
  const image=JSON.parse(probe.stdout).streams?.[0];
  if(!image||!['png','mjpeg','webp','gif'].includes(image.codec_name)||!image.width||!image.height||image.width*image.height>40000000)throw failure('Выбери обычное фото до 40 мегапикселей');
  await exec('ffmpeg',['-v','error','-nostdin','-protocol_whitelist','file','-threads','1','-i',input,'-frames:v','1','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease",'-filter_threads','1','-map_metadata','-1','-c:v','libwebp','-quality','78','-compression_level','5','-threads','1','-y',output],{timeout:20000,maxBuffer:65536});
  if((await stat(output)).size>600*1024)throw failure('Не удалось достаточно сжать фото. Попробуй другой снимок');
  return await readFile(output);
 }catch(error){if(error.code==='ENOENT')throw failure('Обработка фото пока не настроена на сервере',503);if(error.status)throw error;throw failure('Не удалось обработать фото. Попробуй JPEG, PNG или WebP');}
 finally{if(dir)await rm(dir,{recursive:true,force:true});}
}
