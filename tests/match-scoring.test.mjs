import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreEvidence,WEIGHTS} from '../server/match-scoring.mjs';
const p=(v={})=>({age_min:null,age_max:null,gender:'',location:'',goal:[],interests:[],appearance:[],sexual_preferences:[],personality:[],profession:[],preferences:[],...v});
const pair=(wanted={},self={})=>[{self:p({gender:'male'}),wanted:p({gender:'female',...wanted})},{self:p({gender:'female',...self}),wanted:p({gender:'male'})}];
const sum=r=>Math.round(r.matches.reduce((n,m)=>n+m.points,0)*100)/100;
test('Only matching gender gives exactly 1 percent and no invented evidence',()=>{const r=scoreEvidence(...pair());assert.equal(r.score,1);assert.deepEqual(r.matches,[{label:'Подходящий пол',category:'gender',points:1}]);assert.equal(r.explanation,'');});
test('An empty candidate never gains points from unknown age, interests or goals',()=>{const r=scoreEvidence(...pair({age_min:25,age_max:40,goal:['серьёзные отношения'],interests:['ночные поездки','походы в лесу']}));assert.equal(r.score,1);assert.equal(sum(r),1);});
test('Matched travel receives its category budget, without rescaling missing categories to 100',()=>{const r=scoreEvidence(...pair({interests:['путешествия']},{interests:['путешествия']}));assert.equal(r.score,18.8);assert.ok(r.matches.some(m=>m.label==='путешествия'&&m.points===17.8));assert.equal(sum(r),r.score);});
test('Verified semantic synonyms can add points, but invented facts and duplicates cannot inflate them',()=>{
 const [a,b]=pair({interests:['путешествия']},{interests:['поездки за границу']});const e={category:'interests',direction:'viewer',wantedEvidence:'путешествия',candidateEvidence:'поездки за границу',agreement:1};
 assert.equal(scoreEvidence(a,b).score,1);assert.equal(scoreEvidence(a,b,[e]).score,18.8);assert.equal(scoreEvidence(a,b,[e,e,e]).score,18.8);
 assert.equal(scoreEvidence(a,b,[{...e,candidateEvidence:'выдуманный факт'}]).score,1);assert.equal(scoreEvidence(a,b,[{...e,wantedEvidence:'выдуманное пожелание'}]).score,1);
});
test('Every tag contribution sums exactly to the headline; a fully matched profile reaches 100',()=>{
 const fields={age_min:30,age_max:30};for(const field of Object.keys(WEIGHTS).filter(k=>k!=='age'))fields[field]=['первый вариант','второй вариант','третий вариант'];const [a,b]=pair(fields,fields);a.self.location=b.self.location='Москва';const r=scoreEvidence(a,b);assert.equal(r.score,100);assert.equal(sum(r),100);assert.ok(r.matches.every(m=>m.points>0));
});
test('Multiple criteria split a category budget; matching one cannot earn all the category points',()=>{const r=scoreEvidence(...pair({interests:['путешествия','ночные поездки']},{interests:['путешествия']}));assert.equal(r.score,9.9);assert.equal(sum(r),r.score);assert.ok(!r.matches.some(m=>m.label==='ночные поездки'));});
test('Negations do not count as a lexical match and hard constraints still exclude',()=>{
 assert.equal(scoreEvidence(...pair({interests:['курю']},{interests:['не курю']})).score,1);
 assert.equal(scoreEvidence(...pair({age_min:25,age_max:30},{age_min:40,age_max:40})),null);
 assert.equal(scoreEvidence(...pair({}, {gender:'male'})),null);
});
test('Extra candidate hobbies do not dilute the searching person category budget',()=>{
 const [a,b]=pair();a.self.interests=['лес','машины'];b.self.interests=['лес','кино','спорт','музыка','танцы'];
 assert.equal(scoreEvidence(a,b).score,9.9);
});
test('Per-tag embeddings award calibrated points and semantic conflict vetoes them',async()=>{
 const {tagKey}=await import('../server/matchlove-embeddings.mjs');
 const [a,b]=pair({interests:['путешествия']},{interests:['поездки за границу']});
 const vectors=new Map([[tagKey('interests','путешествия'),[1,0]],[tagKey('interests','поездки за границу'),[.8,.6]]]);
 assert.equal(scoreEvidence(a,b,[],vectors).score,1);
 const r=scoreEvidence(a,b,[{category:'interests',direction:'viewer',wantedEvidence:'путешествия',candidateEvidence:'поездки за границу',agreement:1}],vectors);assert.equal(r.score,13.71);assert.equal(sum(r),r.score);
 assert.equal(scoreEvidence(a,b,[{category:'interests',direction:'viewer',wantedEvidence:'путешествия',candidateEvidence:'поездки за границу',agreement:0}],vectors).score,1);
});
test('Habits have a fixed separate budget and opposite statements do not earn embedding points',async()=>{
 const {tagKey}=await import('../server/matchlove-embeddings.mjs');
 const [a,b]=pair({habits:['люблю пиво']},{habits:['не люблю пиво']});
 const vectors=new Map([[tagKey('habits','люблю пиво'),[1,0]],[tagKey('habits','не люблю пиво'),[1,0]]]);
 assert.equal(scoreEvidence(a,b,[],vectors).score,1);
 b.self.habits=['люблю пиво'];assert.equal(scoreEvidence(a,b).score,4.56);
 assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
});
test('Implicit nearby age is soft while an explicit desired age takes precedence',()=>{
 const [a,b]=pair();a.self.age_min=a.self.age_max=26;b.self.age_min=b.self.age_max=28;
 assert.equal(scoreEvidence(a,b).score,25.92);
 b.self.age_min=b.self.age_max=45;assert.equal(scoreEvidence(a,b).score,1);
 a.wanted.age_min=40;a.wanted.age_max=50;assert.equal(scoreEvidence(a,b).score,25.92);
});
test('An erroneous affirmative semantic review cannot override opposite habits',()=>{
 const [a,b]=pair({habits:['люблю пиво']},{habits:['не люблю пиво']});
 assert.equal(scoreEvidence(a,b,[{category:'habits',direction:'viewer',wantedEvidence:'люблю пиво',candidateEvidence:'не люблю пиво',agreement:1}]).score,1);
});

test('Related leisure interests do not invent shared television or dancing activities',async()=>{
 const {tagKey}=await import('../server/matchlove-embeddings.mjs');
 const [a,b]=pair({interests:['смотреть телевизор','танцы']},{interests:['отдыхать дома','музыка']});
 const vectors=new Map(['смотреть телевизор','танцы','отдыхать дома','музыка'].map(t=>[tagKey('interests',t),[1,0]]));
 assert.equal(scoreEvidence(a,b,[],vectors).score,1);
 const e={category:'interests',direction:'viewer',wantedEvidence:'танцы',candidateEvidence:'музыка',agreement:.6};
 assert.equal(scoreEvidence(a,b,[e],vectors).score,1);
});
test('Each viewer gets their own percentage and only their own positive criteria',async()=>{
 const {mark,alice}=await import('./fixtures/directional-profiles.mjs');
 const forward=scoreEvidence(mark,alice),reverse=scoreEvidence(alice,mark);
 assert.equal(forward.score,82.2);assert.equal(reverse.score,73);assert.equal(sum(forward),82.2);assert.equal(sum(reverse),73);
 assert.ok(!forward.matches.some(m=>m.category==='habits'&&m.label==='Не курит'));assert.ok(reverse.matches.some(m=>m.label==='Не курит'&&m.points===1.78));
 assert.deepEqual(forward.conflicts.map(f=>f.label),['Курит']);assert.deepEqual(reverse.conflicts,[]);
 const otherWishes=structuredClone(alice);otherWishes.wanted={age_min:99,age_max:99,interests:['танцы']};assert.equal(scoreEvidence(mark,otherWishes).score,82.2);
});
test('Known habit synonyms agree, while absence and beer preferences do not invent conflicts',()=>{
 const [a,b]=pair({habits:['некурящий']},{habits:['не курю']});assert.equal(scoreEvidence(a,b).score,4.56);
 b.self.habits=[];assert.deepEqual(scoreEvidence(a,b).conflicts,[]);
 a.wanted.habits=['не употребляю алкоголь'];b.self.habits=['люблю пиво'];assert.deepEqual(scoreEvidence(a,b).conflicts,[]);
 b.self.habits=['иногда употребляю алкоголь'];assert.equal(scoreEvidence(a,b).conflicts[0].label,'Иногда употребляет алкоголь');
});
test('Semantic conflicts require real viewer wishes, real candidate facts and explicit contradiction',()=>{
 const [a,b]=pair({goal:['серьёзные отношения']},{goal:['встречи без обязательств']});
 const evidence={category:'goal',direction:'viewer',wantedEvidence:'серьёзные отношения',candidateEvidence:'встречи без обязательств',agreement:0,conflict:true};
 assert.equal(scoreEvidence(a,b,[evidence]).conflicts.length,1);
 for(const invalid of [{...evidence,direction:'candidate'},{...evidence,candidateEvidence:'выдуманный факт'},{...evidence,wantedEvidence:'выдуманное пожелание'},{...evidence,conflict:false}])assert.equal(scoreEvidence(a,b,[invalid]).conflicts.length,0);
});
test('Explicitly excluded facts never earn fallback points just because the viewer also has them',()=>{
 const [a,b]=pair({}, {habits:['курю']});a.self.habits=['курю'];a.wanted.preferences=[{category:'habits',preferred:[],excluded:['курю']}];
 const result=scoreEvidence(a,b);assert.equal(result.score,1);assert.equal(result.conflicts[0].label,'Курит');assert.ok(!result.matches.some(m=>m.category==='habits'));
});
