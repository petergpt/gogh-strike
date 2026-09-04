import test from 'node:test';
import assert from 'node:assert/strict';
import {initEquipment,equip} from '../src/loadout.js';
import {MatchRules} from '../src/match.js';
test('Clash signatures provide exactly a primary and free sidearm and reset on respawn',()=>{
 const a={credits:3800};initEquipment(a,{mode:'clash',weapon:'smg',attachments:{optic:'reflex',barrel:'suppressor'}});
 assert.deepEqual(a.carriedWeapons,['smg','pistol']);assert.equal(a.armor,50);assert.equal(a.attachments.smg.barrel,'suppressor');assert.equal(equip(a,'sniper'),false);
 a.utility.frag=0;a.armor=3;a.ammo=2;initEquipment(a,{mode:'clash',weapon:'smg',firstRound:false,attachments:{optic:'reflex',barrel:'suppressor'}});assert.equal(a.utility.frag,1);assert.equal(a.armor,50);assert.equal(a.ammo,30);
});
test('short Clash stops exactly at twenty and time limit resolves by score',()=>{
 const r=new MatchRules({mode:'tdm',scoreLimit:20,timeLimit:180}),a={team:0},b={team:1};for(let i=0;i<20;i++)r.recordKill(a,b);assert.equal(r.phase,'ended');assert.deepEqual(r.scores,[20,0]);r.recordKill(a,b);assert.deepEqual(r.scores,[20,0]);
 const timed=new MatchRules({mode:'tdm',scoreLimit:20,timeLimit:180});timed.recordKill(b,a);timed.update(180);assert.equal(timed.winner,1);assert.equal(timed.timeRemaining,0);
});
