import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,chmod,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const remote='https://github.com/Balakhmatov/lovelevel.git';
const old='a'.repeat(40),latest='b'.repeat(40);
async function scenario({deployed,failed,outage=false,deployFails=false,invalid=false,badRemote=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'lovelevel-poll-test-'));const bin=join(dir,'bin'),state=join(dir,'state');await mkdir(bin);await mkdir(state);if(deployed)await writeFile(join(state,'.deployed-commit'),deployed);if(failed)await writeFile(join(state,'.failed-deploy-commit'),failed);
 const executable=async(name,body)=>{const path=join(bin,name);await writeFile(path,'#!/usr/bin/env bash\n'+body+'\n');await chmod(path,0o755);};
 await executable('id','echo 0');
 await executable('git',`if [[ "$*" == *"remote get-url origin"* ]]; then echo '${badRemote?'https://example.com/wrong.git':remote}'; elif [[ "$*" == *"ls-remote origin refs/heads/main"* ]]; then ${outage?'exit 1':`printf '%s\\t%s\\n' '${invalid?'invalid':latest}' 'refs/heads/main'`}; else exit 99; fi`);
 await executable('timeout','shift; exec "$@"');
 await executable('lovelevel-deploy',`printf '%s\\n' "$1" > '${dir}/called'; ${deployFails?'exit 1':`printf '%s\\n' "$1" > '${state}/.deployed-commit'`}`);
 // Only filesystem/tool locations are relocated; the actual poller behavior is executed unchanged.
 let script=await readFile('deploy/poll.sh','utf8');script=script.replace('export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',`export PATH=${bin}:/usr/bin:/bin`).replace('STORE=/var/lib/lovelevel-deploy',`STORE=${state}`).replace('/usr/local/sbin/lovelevel-deploy',join(bin,'lovelevel-deploy'));
 const path=join(dir,'poll.sh');await writeFile(path,script);const result=spawnSync('bash',[path],{encoding:'utf8'});const called=await readFile(join(dir,'called'),'utf8').catch(()=>null),failure=await readFile(join(state,'.failed-deploy-commit'),'utf8').catch(()=>null);await rm(dir,{recursive:true,force:true});return {status:result.status,called:called?.trim(),failure:failure?.trim(),stderr:result.stderr};
}
test('Poller leaves a deployed commit running without restart',async()=>{const r=await scenario({deployed:latest});assert.equal(r.status,0);assert.equal(r.called,undefined);});
test('Poller does not stop production during GitHub outage',async()=>{const r=await scenario({outage:true});assert.equal(r.status,0);assert.equal(r.called,undefined);});
test('Poller deploys the exact advertised main SHA',async()=>{const r=await scenario({deployed:old});assert.equal(r.status,0);assert.equal(r.called,latest);});
test('Poller records a failed revision and does not retry that revision',async()=>{const first=await scenario({deployed:old,deployFails:true});assert.equal(first.status,1);assert.equal(first.failure,latest);const next=await scenario({deployed:old,failed:latest});assert.equal(next.status,0);assert.equal(next.called,undefined);});
test('Poller rejects malformed Git responses and unexpected remotes',async()=>{for(const opts of [{invalid:true},{badRemote:true}]){const r=await scenario(opts);assert.equal(r.status,1);assert.equal(r.called,undefined);}});
