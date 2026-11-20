import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/matchlove.js','utf8');
const loading=source.slice(source.indexOf('function loading(){'),source.indexOf('function price(){'));
test('Loading uses current main photo and never resurrects legacy or deleted photos',()=>{
 const context=vm.createContext({S:{image:null,imageURL:'legacy-preview.jpg',photos:[],me:{profile:{media:[{url:'legacy-profile.jpg'}]}}},esc:String,ico:()=>'<svg></svg>'});vm.runInContext(loading,context);
 let html=vm.runInContext('loading()',context);assert(html.includes('search-self-fallback'));assert(!html.includes('legacy'));
 context.S.photos=[{main:false,url:'other.jpg'},{main:true,url:'current.jpg'}];html=vm.runInContext('loading()',context);assert(html.includes('src="current.jpg"'));assert(!html.includes('src="other.jpg"'));
 context.S.photos=[{main:true,url:'other.jpg'}];html=vm.runInContext('loading()',context);assert(html.includes('src="other.jpg"'));assert(!html.includes('current.jpg'));
 context.S.photos=[];html=vm.runInContext('loading()',context);assert(html.includes('search-self-fallback'));
 context.S.image={};context.S.imageURL='blob:new-preview';html=vm.runInContext('loading()',context);assert(html.includes('src="blob:new-preview"'));
});
