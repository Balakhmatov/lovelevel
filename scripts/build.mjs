import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
let code=fs.readFileSync('src/worker.js','utf8').replace("import { level, age, accessible, rewardTasks, thresholds, mediaKind, milestoneTasks } from './rules.js';",fs.readFileSync('src/rules.js','utf8').replaceAll('export ',''));
const html=fs.readFileSync('public/index.html','utf8').replace('/* APP_CSS */',fs.readFileSync('public/matchlove.css','utf8').replace('var(--demo-portraits)', 'url(data:image/png;base64,'+fs.readFileSync('assets/demo-matches.png').toString('base64')+')')).replaceAll('var(--search-placeholder)', 'url(data:image/webp;base64,'+fs.readFileSync('assets/search-placeholder.webp').toString('base64')+')').replace('/* APP_JS */',fs.readFileSync('public/matchlove.js','utf8'));
code='const DEMO_PORTRAITS='+JSON.stringify(fs.readFileSync('assets/demo-portraits.jpg').toString('base64'))+';\n'+code;
const fonts=Object.fromEntries(['inter-latin-v1.woff2','inter-cyrillic-v1.woff2','manrope-v1.woff2'].map(name=>[name,fs.readFileSync('assets/fonts/'+name).toString('base64')]));
code='const FONT_ASSETS='+JSON.stringify(fonts)+';\n'+code;
const brandFiles={'/favicon.png':'icons/matchlove-64.png','/favicon.svg':'icons/favicon.svg','/favicon.ico':'icons/favicon.ico','/favicon-16x16.png':'icons/matchlove-16.png','/favicon-32x32.png':'icons/matchlove-32.png','/apple-touch-icon.png':'icons/matchlove-180.png','/apple-touch-icon-precomposed.png':'icons/matchlove-180.png','/android-chrome-192x192.png':'icons/matchlove-192.png','/android-chrome-512x512.png':'icons/matchlove-512.png','/site.webmanifest':'site.webmanifest'};
const brandAssets=Object.fromEntries(Object.entries(brandFiles).map(([url,file])=>[url,{type:file.endsWith('.ico')?'image/x-icon':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webmanifest')?'application/manifest+json':'image/png',base64:fs.readFileSync('public/'+file).toString('base64')} ]));
for(const file of fs.readdirSync('public/legal')){if(/\.(html|css)$/.test(file))brandAssets['/legal/'+file]={type:file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8',base64:fs.readFileSync('public/legal/'+file).toString('base64')};}
code='const BRAND_ASSETS='+JSON.stringify(brandAssets)+';\n'+code;
code='const HTML='+JSON.stringify(html)+';\n'+code;
fs.writeFileSync('dist/server/index.js',code);fs.cpSync('drizzle','dist/drizzle',{recursive:true});
console.log('Built standalone MatchLove application, embedded UI and database migrations.');
