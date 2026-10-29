import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function harness(file=':memory:'){
 const sqlite=new DatabaseSync(file);
 if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get())for(const f of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const db={prepare(sql){return {args:[],bind(...args){this.args=args;return this},async first(){return sqlite.prepare(sql).get(...this.args)||null},async all(){return {results:sqlite.prepare(sql).all(...this.args)}},async run(){const r=sqlite.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes)}}}}},async batch(stmts){sqlite.exec('BEGIN');try{const rs=[];for(const s of stmts)rs.push(await s.run());sqlite.exec('COMMIT');return rs;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 const blobs=new Map();const env={DB:db,BUCKET:{async put(k,b,o){blobs.set(k,{body:b,...o})},async get(k){return blobs.get(k)},async delete(k){blobs.delete(k)}},ADMIN_USER_IDS:'admin'};
 return {sqlite,env,blobs};
}
