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
