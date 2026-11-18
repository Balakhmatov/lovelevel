import test from 'node:test';
import assert from 'node:assert/strict';
import {touchPresence,readPresence,ONLINE_TTL,TYPING_TTL} from '../server/chat-presence.mjs';
test('Typing expires promptly, applies only to its recipient, and online expires after a lost heartbeat',()=>{
 const db={},start=1000;touchPresence(db,'b',{client:'tab',target:'a',typing:true},start);
 assert.deepEqual(readPresence(db,'b','a',start),{online:true,typing:true});
 assert.deepEqual(readPresence(db,'b','c',start),{online:true,typing:false});
 assert.deepEqual(readPresence(db,'b','a',start+TYPING_TTL),{online:true,typing:false});
 assert.deepEqual(readPresence(db,'b','a',start+ONLINE_TTL),{online:false,typing:false});
 assert.deepEqual(readPresence({},'b','a',start),{online:false,typing:false});
});
test('A delayed typing stop for another chat cannot clear the current recipient',()=>{
 const db={};touchPresence(db,'b',{client:'tab',target:'a',typing:true},1000);touchPresence(db,'b',{client:'tab',target:'c',typing:true},1100);touchPresence(db,'b',{client:'tab',target:'a',typing:false},1200);
 assert.equal(readPresence(db,'b','c',1200).typing,true);assert.equal(readPresence(db,'b','a',1200).typing,false);
});
