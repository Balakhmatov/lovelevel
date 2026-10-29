import {isMain} from './entrypoint.mjs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {openDatabase} from './storage.mjs';
import {hashPassword} from './auth.mjs';

export async function readSecret(){
 if(!process.stdin.isTTY){const parts=[];let size=0;for await(const p of process.stdin){size+=p.length;if(size>1024)throw new Error('Input too long');parts.push(p);}return Buffer.concat(parts).toString('utf8').replace(/\r?\n$/,'');}
 process.stderr.write('Password (hidden, 10–128 characters): ');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let value='';const done=(error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stderr.write('\n');error?reject(error):resolve(value);};function onData(chunk){for(const c of chunk){if(c==='\u0003')return done(new Error('Cancelled'));if(c==='\r'||c==='\n')return done();if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' '){value+=c;if(value.length>128)return done(new Error('Password too long'));}}}process.stdin.on('data',onData);});
}
export async function createAccount(sqlite,{email,password,profileId}){
 email=String(email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new Error('Invalid email');if(typeof password!=='string'||password.length<10||password.length>128)throw new Error('Password must have 10–128 characters');
 const id=profileId||randomUUID();if(profileId&&!sqlite.prepare('SELECT 1 FROM profiles WHERE id=?').get(id))throw new Error('Imported profile not found');if(sqlite.prepare('SELECT 1 FROM auth_accounts WHERE id=? OR email=?').get(id,email))throw new Error('Account already exists; do not overwrite it');const hash=await hashPassword(password);sqlite.prepare('INSERT INTO auth_accounts(id,email,password_hash,created) VALUES(?,?,?,?)').run(id,email,hash,Date.now());return id;
}
const direct=isMain(import.meta.url);
if(direct){
 const [command,...args]=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
 const {sqlite}=openDatabase(resolve(process.env.DATA_DIR||'/var/lib/lovelevel','lovelevel.sqlite'),resolve(dirname(fileURLToPath(import.meta.url)),'../drizzle'));
 try{
  if(command==='create-account'){const id=await createAccount(sqlite,{email:arg('--email'),profileId:arg('--profile-id'),password:await readSecret()});console.log('Account created. ID: '+id);console.log('To grant moderation, add this exact ID to ADMIN_USER_IDS in /etc/lovelevel/app.env and restart only lovelevel.');}
  else if(command==='reset-password'){const id=arg('--id');if(!id||!sqlite.prepare('SELECT 1 FROM auth_accounts WHERE id=?').get(id))throw new Error('Account ID not found');const password=await readSecret();if(password.length<10||password.length>128)throw new Error('Password must have 10–128 characters');const hash=await hashPassword(password);sqlite.exec('BEGIN IMMEDIATE');try{sqlite.prepare('UPDATE auth_accounts SET password_hash=? WHERE id=?').run(hash,id);sqlite.prepare('DELETE FROM auth_sessions WHERE account=?').run(id);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}console.log('Password changed; all sessions revoked.');}
  else if(command==='list-accounts'){for(const a of sqlite.prepare('SELECT id,email FROM auth_accounts ORDER BY created').all())console.log(a.id+' '+a.email);}
  else throw new Error('Commands: create-account --email EMAIL [--profile-id ID], reset-password --id ID, list-accounts. Passwords are read from hidden stdin, never argv.');
 }finally{sqlite.close();}
}
