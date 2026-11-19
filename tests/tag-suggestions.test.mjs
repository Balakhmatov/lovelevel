import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {TAG_SEEDS} from '../server/tag-seeds.mjs';
import {handleTagSuggestions,updateTagUsage,MIN_TAG_USERS} from '../server/tag-suggestions.mjs';
test('Suggestions complete phrases and only expose frequent, non-sensitive hobby tags',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE matchlove_tag_usage(user TEXT,tag TEXT,PRIMARY KEY(user,tag));CREATE TABLE matchlove_category_tag_usage(user TEXT,category TEXT,tag TEXT,PRIMARY KEY(user,category,tag));');
 const request=q=>new Request('http://localhost/api/tag-suggestions?q='+encodeURIComponent(q));
 try{assert.ok(TAG_SEEDS.length>=200);const post=new Request('http://localhost/api/tag-suggestions',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({q:'люблю пут'})});assert.equal((await handleTagSuggestions(post,{sqlite:db})).status,200);const cross=new Request('http://localhost/api/tag-suggestions',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify({q:'люблю'})});assert.equal((await handleTagSuggestions(cross,{sqlite:db})).status,403);let data=await(await handleTagSuggestions(request('люблю путеш'),{sqlite:db})).json();assert.ok(data.suggestions.some(s=>s.text==='люблю путешествовать'));data=await(await handleTagSuggestions(request('люблю'),{sqlite:db})).json();assert.ok(data.suggestions.every(s=>s.text.startsWith('люблю ')));
 const profile={self:{interests:['плетение из бумажной лозы','приватный уникальный интерес','секс на пляже','contact@example.test']},wanted:{interests:['плетение из бумажной лозы']}};
 updateTagUsage(db,'a',profile);let found=await(await handleTagSuggestions(request('плетение'),{sqlite:db})).json();assert.equal(found.suggestions.length,0);
 assert.equal(MIN_TAG_USERS,5);
 for(let i=0;i<20;i++)updateTagUsage(db,'a',profile);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matchlove_tag_usage WHERE tag=?').get('плетение из бумажной лозы').n,1);
 for(let i=2;i<=4;i++)updateTagUsage(db,'user-'+i,{self:{interests:['плетение из бумажной лозы']}});
 found=await(await handleTagSuggestions(request('плетение'),{sqlite:db})).json();assert.equal(found.suggestions.length,0);
 updateTagUsage(db,'user-5',{self:{interests:['плетение из бумажной лозы']}});
 found=await(await handleTagSuggestions(request('плетение'),{sqlite:db})).json();assert.equal(found.suggestions[0].label,'плетение из бумажной лозы');assert.ok(!('popularity' in found.suggestions[0]));
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matchlove_tag_usage WHERE tag=?').get('плетение из бумажной лозы').n,5);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM matchlove_tag_usage WHERE tag LIKE ?').get('%секс%').n,0);
 updateTagUsage(db,'user-5',{self:{interests:[]}});found=await(await handleTagSuggestions(request('плетение'),{sqlite:db})).json();assert.equal(found.suggestions.length,0);
 }finally{db.close();}
});
test('Profile dictionaries are categorized, plain labels and frequent tags count distinct users',async()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE matchlove_tag_usage(user TEXT,tag TEXT,PRIMARY KEY(user,tag));CREATE TABLE matchlove_category_tag_usage(user TEXT,category TEXT,tag TEXT,PRIMARY KEY(user,category,tag));');
 const request=(category,q)=>new Request('http://localhost/api/tag-suggestions',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({category,q,format:'tag'})});
 const get=async(category,q)=>(await handleTagSuggestions(request(category,q),{sqlite:db})).json();
 try{
  const habits=await get('habits','не кур');assert.ok(habits.suggestions.some(s=>s.label==='не курю'&&s.text==='не курю'));
  assert.ok((await get('personality','спокой')).suggestions.length);assert.equal((await get('profession','не кур')).suggestions.length,0);
  const label='умение спокойно обсуждать разногласия';
  for(let i=1;i<=4;i++)updateTagUsage(db,'u'+i,{self:{personality:[label],sexual_preferences:['частный пункт']},wanted:{personality:[label]}});
  assert.equal((await get('personality','разногласия')).suggestions.length,0);
  updateTagUsage(db,'u5',{wanted:{preferences:[{category:'personality',preferred:[label]}]}});
  assert.equal((await get('personality','разногласия')).suggestions[0].label,label);assert.equal((await get('interests','разногласия')).suggestions.length,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM matchlove_category_tag_usage WHERE category='sexual_preferences'").get().n,0);
  assert.ok((await get('sexual_preferences','границ')).suggestions.length);assert.equal((await get('sexual_preferences','частный')).suggestions.length,0);
  updateTagUsage(db,'u5',{wanted:{personality:[]}});assert.equal((await get('personality','разногласия')).suggestions.length,0);
 }finally{db.close();}
});
