import test from 'node:test';
import assert from 'node:assert/strict';
import {describe,cosine,bidirectionalVectors} from '../server/matchlove-embeddings.mjs';
const p=(self,wanted)=>({self,wanted});
test('describes preferred, acceptable and excluded alternatives explicitly',()=>{
 const text=describe({appearance:['голубые глаза'],preferences:[{category:'appearance',importance:'strong',preferred:['голубые глаза'],acceptable:['зелёные глаза'],excluded:['карие глаза']}]});
 assert.match(text,/Предпочтительно/);assert.match(text,/Приемлемо/);assert.match(text,/Исключено/);
});
test('cosine distinguishes identical and opposite vectors',()=>{
 assert.ok(cosine([1,0],[1,0])>.99);
 assert.ok(cosine([1,0],[-1,0])<-.99);
 assert.equal(cosine(null,[1]),null);
});
test('bidirectional match uses seeker against target self on both sides',()=>{
 const a=p([1,0],[0,1]);
 const b=p([0,1],[1,0]);
 assert.ok(bidirectionalVectors(a,b)>.99);
 assert.ok(bidirectionalVectors(a,p([1,0],[0,1]))<.1);
});
test('self-only fallback has a lower retrieval priority',()=>{
 assert.equal(bidirectionalVectors(p([1,0],null),p([1,0],null)),.65);
});
