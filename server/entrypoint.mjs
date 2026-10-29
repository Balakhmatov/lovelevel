import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// systemd invokes /opt/lovelevel/current/... while Node resolves import.meta.url
// to /opt/lovelevel/releases/<commit>/... . Compare canonical filesystem paths.
export function isMain(moduleUrl,argvPath=process.argv[1]){
  if(!argvPath)return false;
  try{return realpathSync(argvPath)===realpathSync(fileURLToPath(moduleUrl));}
  catch{return false;}
}
