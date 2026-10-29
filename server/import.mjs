import {resolve,dirname,sep} from 'node:path';
import {readFile,realpath,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase,diskBucket} from './storage.mjs';
const tables=['profiles','media','rewards','likes','messages','blocks','reports','audits'];
export async function importSnapshot({sqlite,bucket,snapshot,filesDirectory,dryRun=false}){
 if(snapshot?.format!=='lovelevel-transfer-v1'||!snapshot.tables||tables.some(t=>!Array.isArray(snapshot.tables[t])))throw new Error('Invalid transfer snapshot');
 if(Object.keys(snapshot.tables).some(t=>!tables.includes(t)))throw new Error('Unsupported table in transfer snapshot');
 for(const t of tables)if(sqlite.prepare('SELECT COUNT(*) AS n FROM '+t).get().n!==0)throw new Error('Destination must be empty; refusing to overwrite '+t);
 if(sqlite.prepare('SELECT COUNT(*) AS n FROM auth_accounts').get().n!==0)throw new Error('Create logins only after importing data');
 const files=[];
 if(snapshot.tables.media.length&&!filesDirectory)throw new Error('Media files are required; metadata alone is not a complete transfer');
 const root=filesDirectory?await realpath(filesDirectory):null;
 for(const m of snapshot.tables.media){if(!/^photos\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+$/.test(m.key))throw new Error('Invalid media key');const path=await realpath(resolve(root,m.key)).catch(()=>null);if(!path||!path.startsWith(root+sep))throw new Error('Required photo is missing from transfer files');const info=await stat(path);if(!info.isFile()||info.size===0||info.size>5*1024*1024)throw new Error('Invalid photo in transfer');files.push({key:m.key,path});}
 const statements=[];
 for(const table of tables){const allowed=new Set(sqlite.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name));for(const row of snapshot.tables[table]){if(!row||typeof row!=='object')throw new Error('Invalid row');const columns=Object.keys(row);if(!columns.length||columns.some(c=>!allowed.has(c)))throw new Error('Unsupported columns');const sql='INSERT INTO '+table+'('+columns.map(c=>'"'+c+'"').join(',')+') VALUES('+columns.map(()=>'?').join(',')+')';statements.push({sql,args:columns.map(c=>row[c])});}}
 if(dryRun)return Object.fromEntries(tables.map(t=>[t,snapshot.tables[t].length]));
 const copied=[];let committed=false;
 try{for(const f of files){if(await bucket.get(f.key))throw new Error('Destination photo already exists; refusing overwrite');await bucket.put(f.key,await readFile(f.path));copied.push(f.key);}sqlite.exec('BEGIN IMMEDIATE');try{for(const s of statements)sqlite.prepare(s.sql).run(...s.args);sqlite.exec('COMMIT');committed=true;}catch(e){sqlite.exec('ROLLBACK');throw e;}}
 finally{if(!committed)for(const key of copied)await bucket.delete(key);}
 return Object.fromEntries(tables.map(t=>[t,snapshot.tables[t].length]));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};const source=arg('--snapshot');if(!source)throw new Error('Usage: import.mjs --snapshot FILE --files DIRECTORY [--dry-run]. Stop LoveLevel before import.');const dir=process.env.DATA_DIR||'/var/lib/lovelevel';const {sqlite}=openDatabase(resolve(dir,'lovelevel.sqlite'),resolve(dirname(fileURLToPath(import.meta.url)),'../drizzle'));try{const result=await importSnapshot({sqlite,bucket:diskBucket(resolve(dir,'uploads')),snapshot:JSON.parse(await readFile(source,'utf8')),filesDirectory:arg('--files'),dryRun:args.includes('--dry-run')});console.log(JSON.stringify({ok:true,counts:result,dryRun:args.includes('--dry-run')}));}finally{sqlite.close();}
}
