import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {tauntCameraPose,defeatFocusPose} from '../src/taunt-camera.js';
import {bodyProfile} from '../src/actor-profile.js';
import {FACTIONS} from '../src/factions.js';

const actor={position:new Vector3(),yaw:0,standingHeight:1.8,alive:true,bodyProfile:bodyProfile(FACTIONS[0].roster[0].look)};
test('showcase camera remains on the actor side of walls and refuses an enclosed view',()=>{
 const open=tauntCameraPose(actor,{raycast:()=>null});assert.ok(open.position.distanceTo(open.target)>2.5);
 const clipped=tauntCameraPose(actor,{raycast:()=>({distance:1.2})});assert.ok(Math.abs(clipped.position.distanceTo(clipped.target)-.98)<1e-9);
 assert.equal(tauntCameraPose(actor,{raycast:()=>({distance:.5})}),null);
 const edge=tauntCameraPose(actor,{raycast:origin=>Math.abs(origin.x)>0.04?{distance:1.1}:null});assert.ok(edge.position.distanceTo(edge.target)<.9,'near-plane edge catches wall even when center ray is clear');
 assert.deepEqual(actor.position.toArray(),[0,0,0]);
});
test('defeat framing requires a living visible killer within range and never moves the camera',()=>{
 const position=new Vector3(0,1.6,8),original=position.clone(),visible=()=>true;
 const pose=defeatFocusPose(position,actor,1.6,visible);assert.ok(pose&&pose.fov>=20&&pose.fov<=70);assert.deepEqual(position,original);
 assert.equal(defeatFocusPose(position,actor,1.6,()=>false),null);
 assert.equal(defeatFocusPose(position,{...actor,alive:false},1.6,visible),null);
 assert.equal(defeatFocusPose(new Vector3(0,1.6,60),actor,1.6,visible),null);
});
