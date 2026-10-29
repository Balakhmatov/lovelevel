import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
fs.mkdirSync('outputs',{recursive:true});
if(!fs.existsSync('dist/server/index.js'))throw new Error('Run npm run build first');
const sha=execFileSync('git',['rev-parse','--short=12','HEAD'],{encoding:'utf8'}).trim();
const file=`outputs/lovelevel-vps-${sha}.tar.gz`;
execFileSync('tar',['-czf',file,'server','dist/server','drizzle','deploy','README.md','package.json']);
console.log(file);
