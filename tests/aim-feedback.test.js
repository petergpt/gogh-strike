import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {shotSpread,spreadPixels,aimedRelation} from '../src/aim-feedback.js';
import {bodyProfile} from '../src/actor-profile.js';
import {FACTIONS} from '../src/factions.js';
import {WEAPON_BY_ID} from '../src/weapon-catalog.js';

test('accuracy feedback tracks movement, stance, aim and sustained fire with the shot sampler',()=>{
 const a={velocity:new Vector3(),grounded:true},w=WEAPON_BY_ID.rifle,standing=shotSpread(a,w);
 assert.ok(shotSpread(a,w,true)<standing);
 a.velocity.x=3;assert.ok(shotSpread(a,w)>standing);
 a.velocity.x=0;a.crouched=true;assert.equal(shotSpread(a,w),standing*.5);assert.ok(spreadPixels(shotSpread(a,w,true),800,74)<spreadPixels(shotSpread({...a,crouched:false},w,true),800,74));
 a.crouched=false;a.grounded=false;assert.ok(shotSpread(a,w)>standing*2);
 a.grounded=true;a.bloom=.012;assert.ok(shotSpread(a,w)>standing);
 assert.ok(spreadPixels(.008,800,31)>spreadPixels(.008,800,74));
 assert.ok(spreadPixels(.008,1000,74)>spreadPixels(.008,600,74));
});
test('target tint follows the nearest physical body and never reveals an actor through walls or smoke',()=>{
 const player={team:0},profile=bodyProfile(FACTIONS[0].roster[0].look);
 const ally={team:0,alive:true,position:new Vector3(0,0,-3),yaw:0,bodyProfile:profile};
 const enemy={...ally,team:1,position:new Vector3(0,0,-6)};
 const origin=new Vector3(0,1.3,0),dir=new Vector3(0,0,-1),physics={raycast:()=>null};
 const query=(cast,visible=true)=>aimedRelation(origin,dir,player,cast,physics,()=>visible,50);
 assert.equal(query([enemy,ally]),'friendly');assert.equal(query([ally,enemy]),'friendly');
 ally.alive=false;assert.equal(query([ally,enemy]),'enemy');
 assert.equal(query([enemy],false),null,'smoke hides the tint');
 physics.raycast=()=>({distance:2});assert.equal(query([enemy]),null,'a nearer wall wins');
});
