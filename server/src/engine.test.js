import test from 'node:test';
import assert from 'node:assert/strict';
import {score,compare,shuffle} from './engine.js';
const c=(rank,suit)=>({rank,suit});
test('52 unique cards',()=>assert.equal(new Set(shuffle().map(c=>c.rank+':'+c.suit)).size,52));
test('trail beats straight flush',()=>assert.equal(compare([c(7,0),c(7,1),c(7,2)],[c(9,0),c(10,0),c(11,0)]),1));
test('pair beats high card',()=>assert.equal(compare([c(8,0),c(8,1),c(3,0)],[c(14,0),c(12,1),c(9,2)]),1));
