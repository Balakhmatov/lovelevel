import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../dist/server/index.js';
const get=path=>app.fetch(new Request('https://matchlove.cityai.site'+path),{});
test('Browser and phone favicon routes return real branded image files',async()=>{
 for(const [path,size] of [['/favicon.png',64],['/favicon-16x16.png',16],['/favicon-32x32.png',32],['/apple-touch-icon.png',180],['/apple-touch-icon-precomposed.png',180],['/android-chrome-192x192.png',192],['/android-chrome-512x512.png',512]]){
  const r=await get(path);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/png');assert.match(r.headers.get('Cache-Control'),/must-revalidate/);const png=Buffer.from(await r.arrayBuffer());assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
 const ico=await get('/favicon.ico');assert.equal(ico.headers.get('Content-Type'),'image/x-icon');assert.deepEqual([...new Uint8Array(await ico.arrayBuffer()).slice(0,4)],[0,0,1,0]);
 const svg=await get('/favicon.svg');assert.equal(svg.headers.get('Content-Type'),'image/svg+xml');assert.match(await svg.text(),/<svg/);
});
test('Home declares versioned icons, Apple branding and a valid MatchLove manifest',async()=>{
 const html=await(await get('/')).text();assert.match(html,/rel="apple-touch-icon"/);assert.match(html,/favicon.ico\?v=matchlove-20261118/);assert.match(html,/name="application-name" content="MatchLove"/);
 const r=await get('/site.webmanifest');assert.equal(r.headers.get('Content-Type'),'application/manifest+json');const manifest=await r.json();assert.equal(manifest.name,'MatchLove');assert.equal(manifest.start_url,'/');for(const icon of manifest.icons)assert.equal((await get(icon.src)).status,200);
});
