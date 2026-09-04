import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchIntro} from '../src/match-intro.js';

test('intro gives each numeral a beat and releases play at2.4 seconds before the short exit',()=>{
 const intro=new MatchIntro();assert.equal(intro.active,false);assert.equal(intro.start().beat,3);
 assert.equal(intro.advance(.79).beat,3);assert.equal(intro.advance(.01).beat,2);
 assert.equal(intro.advance(.8).beat,1);assert.equal(intro.advance(.8).beat,'GO');
 assert.equal(intro.active,false);assert.equal(intro.state.exiting,true);
 assert.equal(intro.advance(.32).running,false);
});
test('cancel and restart discard the previous sequence without deferred transitions',()=>{
 const intro=new MatchIntro();intro.start();intro.advance(1.3);intro.cancel();
 assert.equal(intro.advance(20).running,false);assert.equal(intro.start().beat,3);
 intro.advance(.2);const state=intro.state;intro.advance(NaN);intro.advance(-1);intro.advance(0);assert.deepEqual(intro.state,state);
});
test('ordinary60Hz updates show the same count and end without a leftover blocking frame',()=>{
 const intro=new MatchIntro();intro.start();const beats=new Set([intro.state.beat]);
 for(let i=0;i<144;i++)beats.add(intro.advance(1/60).beat);
 assert.deepEqual([...beats],[3,2,1,'GO']);assert.equal(intro.active,false);
 for(let i=0;i<20;i++)intro.advance(1/60);assert.equal(intro.state.running,false);
});
