import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
async function fixture(){const root=await mkdtemp(join(tmpdir(),'lovelevel-entry-'));await symlink(resolve('.'),join(root,'current'),'dir');return {root,entry:name=>join(root,'current/server',name)};}
async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(r=>server.close(r));return port;}
test('Service starts through the current release symlink and serves health',async()=>{
 const f=await fixture(),port=await freePort();let child;
 try{child=spawn(process.execPath,['--experimental-sqlite',f.entry('index.mjs')],{env:{...process.env,NODE_ENV:'development',PUBLIC_ORIGIN:'http://127.0.0.1:'+port,PORT:String(port),DATA_DIR:join(f.root,'data')},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',c=>errors+=c);
 await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(new Error('Server did not start: '+errors)),5000);child.stdout.on('data',c=>{if(String(c).includes('LoveLevel listening')){clearTimeout(timer);res();}});child.once('error',e=>{clearTimeout(timer);rej(e);});child.once('exit',code=>{clearTimeout(timer);rej(new Error('Server exited before listening, code '+code+': '+errors));});});
 const r=await fetch('http://127.0.0.1:'+port+'/health');assert.equal(r.status,200);assert.equal((await r.json()).database,true);
 }finally{if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}await rm(f.root,{recursive:true,force:true});}
});
test('Account management command executes through current symlink',async()=>{const f=await fixture();try{const data=join(f.root,'data');const r=spawnSync(process.execPath,['--experimental-sqlite',f.entry('manage.mjs'),'list-accounts'],{env:{...process.env,DATA_DIR:data},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.ok((await stat(join(data,'lovelevel.sqlite'))).isFile());}finally{await rm(f.root,{recursive:true,force:true});}});
test('Importer validates CLI arguments when started through current symlink',async()=>{const f=await fixture();try{const r=spawnSync(process.execPath,['--experimental-sqlite',f.entry('import.mjs')],{env:{...process.env,DATA_DIR:join(f.root,'data')},encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/Usage: import/);}finally{await rm(f.root,{recursive:true,force:true});}});
