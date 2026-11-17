import test from 'node:test';
import assert from 'node:assert/strict';
import {rankMatch} from '../server/matchlove-ai.mjs';
const p=(overrides={})=>({age_min:null,age_max:null,location:'',gender:'',goal:[],interests:[],appearance:[],sexual_preferences:[],personality:[],profession:[],...overrides});
test('one sided wishes match the other person self description',()=>{
 const man={self:p({age_min:30,age_max:30,gender:'мужчина',appearance:['голубые глаза','светлые волосы']}),wanted:p()};
 const woman={self:p({age_min:26,age_max:26,gender:'женщина'}),wanted:p({age_min:27,age_max:40,gender:'мужчина',appearance:['голубые глаза','светлые волосы']})};
 const result=rankMatch(man,woman);assert.ok(result);assert.equal(result.mutual,false);assert.ok(result.score>=80);
});
test('explicit age bounds exclude ineligible candidate',()=>{
 const a={self:p({age_min:20,age_max:20}),wanted:p({age_min:25,age_max:35})};
 const b={self:p({age_min:60,age_max:60}),wanted:p()};
 assert.equal(rankMatch(a,b),null);
});
test('declared desired gender excludes wrong gender',()=>{
 const a={self:p({gender:'женщина'}),wanted:p({gender:'мужчина'})};
 const b={self:p({gender:'женщина'}),wanted:p()};
 assert.equal(rankMatch(a,b),null);
});
test('self-only descriptions get secondary similarity signal',()=>{
 const a={self:p({interests:['кофе','музыка']}),wanted:p()};
 const b={self:p({interests:['кофе','спорт']}),wanted:p()};
 const r=rankMatch(a,b);assert.ok(r);assert.ok(r.score>25);assert.equal(r.mutual,false);
});
test('location handled after main score',()=>{
 const a={self:p({location:'Москва',interests:['музыка']}),wanted:p()};
 const b={self:p({location:'Москва',interests:['музыка']}),wanted:p()};
 const c={self:p({location:'Казань',interests:['музыка']}),wanted:p()};
 assert.equal(rankMatch(a,b).score,rankMatch(a,c).score);
 assert.equal(rankMatch(a,b).location,'same');
});

test('registration gender sets self and opposite default while explicit preferences win',async()=>{
 const {applyGenderDefaults}=await import('../server/matchlove-ai.mjs');
 const profile={self:p(),wanted:p()};
 assert.equal(applyGenderDefaults(profile,'male').self.gender,'male');
 assert.equal(applyGenderDefaults(profile,'male').wanted.gender,'female');
 assert.equal(applyGenderDefaults(profile,'female').wanted.gender,'male');
 assert.equal(applyGenderDefaults({...profile,wanted:p({gender:'female'})},'female').wanted.gender,'female');
 assert.equal(applyGenderDefaults({...profile,wanted:p({gender:'all'})},'male').wanted.gender,'all');
 assert.equal(applyGenderDefaults(profile,null),profile);
});
