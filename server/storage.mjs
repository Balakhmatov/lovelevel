import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { open, mkdir, readFile, rename, rm, stat, statfs, readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export function openDatabase(filename, migrations = resolve('drizzle')) {
  mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  const sqlite = new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS _lovelevel_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied TEXT NOT NULL)');
  for (const file of readdirSync(migrations).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
    const sql = readFileSync(resolve(migrations, file), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const applied = sqlite.prepare('SELECT hash FROM _lovelevel_migrations WHERE name=?').get(file);
    if (applied) { if (applied.hash !== hash) { sqlite.close(); throw new Error('Applied migration changed: '+file); } continue; }
    sqlite.exec('BEGIN IMMEDIATE');
    try { sqlite.exec(sql); sqlite.prepare('INSERT INTO _lovelevel_migrations VALUES(?,?,?)').run(file, hash, new Date().toISOString()); sqlite.exec('COMMIT'); }
    catch (error) { sqlite.exec('ROLLBACK'); sqlite.close(); throw error; }
  }
  const DB = {
    prepare(sql) { return { args: [], bind(...args) { this.args = args; return this; }, first() { return sqlite.prepare(sql).get(...this.args) || null; }, all() { return {results:sqlite.prepare(sql).all(...this.args)}; }, run() { const r=sqlite.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes)}}; } }; },
    async batch(statements) { sqlite.exec('BEGIN IMMEDIATE'); try { const results=[];for (const s of statements)results.push(s.run());sqlite.exec('COMMIT');return results; } catch(error) {sqlite.exec('ROLLBACK');throw error;} }
  };
  return {sqlite, DB};
}

export function diskBucket(directory,{maxBytes=8*1024**3,minFreeBytes=1024**3}={}) {
  const root=resolve(directory);mkdirSync(root,{recursive:true,mode:0o700});
  function pathFor(key) { if (!/^(?:photos|chat)\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9-]+$/.test(key))throw new Error('Invalid media key');const path=resolve(root,key);if(!path.startsWith(root+sep))throw new Error('Invalid media path');return path; }
  let usage=null,chain=Promise.resolve();
  async function measure(path){let total=0;for(const entry of await readdir(path,{withFileTypes:true})){const child=resolve(path,entry.name);if(entry.isDirectory())total+=await measure(child);else if(entry.isFile())total+=(await stat(child)).size;}return total;}
  function serial(action){const next=chain.then(action,action);chain=next.catch(()=>{});return next;}
  async function size(path){try{return (await stat(path)).size;}catch(error){if(error.code==='ENOENT')return 0;throw error;}}
  const full=()=>Object.assign(new Error('Медиахранилище заполнено. Новые загрузки временно недоступны.'),{status:507});
  return {
    async put(key, bytes) {return serial(async()=>{const path=pathFor(key);if(usage===null)usage=await measure(root);const old=await size(path);if(usage-old+bytes.byteLength>maxBytes)throw full();const disk=await statfs(root);if(disk.bavail*disk.bsize<minFreeBytes+bytes.byteLength)throw full();await mkdir(dirname(path),{recursive:true,mode:0o700});const temp=path+'.'+randomUUID()+'.tmp';const fd=await open(temp,'wx',0o600);try{await fd.writeFile(bytes);await fd.sync();await fd.close();await rename(temp,path);usage=usage-old+bytes.byteLength;}catch(error){await fd.close().catch(()=>{});await rm(temp,{force:true});throw error;}}); },
    async get(key) { const path=pathFor(key);try {const info=await stat(path);if(!info.isFile()||info.size>5*1024*1024)throw new Error('Invalid media file');return {body:await readFile(path)};}catch(error){if(error.code==='ENOENT')return null;throw error;} },
    async delete(key) {return serial(async()=>{const path=pathFor(key),old=await size(path);await rm(path,{force:true});if(usage!==null)usage=Math.max(0,usage-old);});}
  };
}
