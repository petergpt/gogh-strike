import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {FACTIONS} from '../src/factions.js';
import {bodyProfile} from '../src/actor-profile.js';
import {actorPose,bodyPoint,intersectActorBody} from '../src/actor-body.js';

const artists=FACTIONS.flatMap(f=>f.roster);
const make=(name,crouched=false,yaw=0)=>({bodyProfile:bodyProfile(artists.find(a=>a.shortName===name).look),position:new Vector3(3,2,-4),crouched,yaw});

test('cast dimensions preserve adult proportions and provide a distinct short-legged silhouette',()=>{
  const short=make('Toulouse-Lautrec').bodyProfile,tall=make('Seurat').bodyProfile;
  assert.ok(short.standingHeight>1.51&&short.standingHeight<1.53);
  assert.ok(tall.standingHeight>1.93&&tall.standingHeight<1.96);
  assert.ok(short.legScale/short.torsoScale<.65);
  for(const artist of artists){
    const p=bodyProfile(artist.look);
    assert.ok(p.crouchHeight<p.standingHeight-.2);
    assert.ok(p.eyeStanding<p.standingHeight&&p.eyeCrouched<p.crouchHeight);
    assert.ok(!('health' in p)&&!('speed' in p));
  }
});

test('rays hit each artist at their own standing and crouching head and torso positions',()=>{
  for(const artist of artists)for(const crouched of [false,true])for(const yaw of [0,.8,Math.PI]){
    const a=make(artist.shortName,crouched,yaw);
    for(const part of ['head','chest']){
      const center=new Vector3().fromArray(bodyPoint(a,part)),direction=new Vector3(0,0,-1).applyAxisAngle(new Vector3(0,1,0),yaw);
      const origin=center.clone().addScaledVector(direction,-5),hit=intersectActorBody(origin,direction,a,10);
      assert.ok(hit,`${artist.shortName} ${part} crouch=${crouched} yaw=${yaw}`);
      assert.equal(hit.headshot,part==='head');
      assert.ok(hit.distance>4.5&&hit.distance<5);
      assert.equal(intersectActorBody(origin,direction,a,4),null,'wall before actor blocks the hit');
    }
  }
});

test('a shot above Lautrec or a crouching artist does not hit an invisible old-height head',()=>{
  const a=make('Toulouse-Lautrec'),origin=new Vector3(a.position.x,a.position.y+1.8,a.position.z+5);
  assert.equal(intersectActorBody(origin,new Vector3(0,0,-1),a,10),null);
  const b=make('Morisot',true),head=bodyPoint(make('Morisot'),'head');
  assert.equal(intersectActorBody(new Vector3(head[0],head[1],head[2]+5),new Vector3(0,0,-1),b,10),null);
});

test('crouch eye offsets rotate with the body instead of projecting forward through the wrong wall',()=>{
  const a=make('Cassatt',true,Math.PI/2),pose=actorPose(a),point=bodyPoint(a);
  assert.ok(Math.abs(point[0]-a.position.x-pose.eye[2])<1e-10);
  assert.ok(Math.abs(point[2]-a.position.z)<1e-10);
  assert.equal(actorPose(a),pose,'visibility queries share the fixed cached pose');
});

test('short and long legs remain hittable when standing and bent into a crouch',()=>{
  for(const name of ['Toulouse-Lautrec','Seurat','Morisot'])for(const crouched of [false,true]){
    const a=make(name,crouched),pose=actorPose(a);
    for(const leg of [...pose.upperLegs,...pose.lowerLegs]){
      const origin=new Vector3().fromArray(leg.center).add(a.position).add(new Vector3(0,0,5));
      const hit=intersectActorBody(origin,new Vector3(0,0,-1),a,10);
      assert.ok(hit,`${name} leg hit, crouched=${crouched}`);assert.equal(hit.headshot,false);
    }
  }
});
