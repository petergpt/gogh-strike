import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PhysicsWorld} from '../src/physics.js';
import {ArtistSprays,SPRAY_RULES,projectSprayGeometry} from '../src/sprays.js';
import {FACTIONS} from '../src/factions.js';
import {ARTIST_TAGS,getArtistTag,tagDataURI} from '../src/art-tags.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const wall=(a=-8,b=8)=>({a:V(a,0,0),b:V(b,0,0),minY:0,maxY:3});
const fixture=(walls=[wall()])=>{const physics=new PhysicsWorld({wallSegments:walls,bounds:{minX:-9,maxX:9,minZ:-3,maxZ:3}}),scene=new THREE.Scene(),sprays=new ArtistSprays(scene,physics,{textureFactory:()=>new THREE.Texture()});return{physics,scene,sprays};};
const actor=(id=0)=>({id,team:0,alive:true,artistName:FACTIONS.flatMap(f=>f.roster)[id%12].name});

test('every artist resolves to a unique original tag and a valid encoded SVG title',()=>{
 const cast=FACTIONS.flatMap(f=>f.roster),tags=cast.map(a=>getArtistTag(a));assert.equal(new Set(tags.map(t=>t.id)).size,12);assert.equal(ARTIST_TAGS.length,12);
 for(const a of cast){const tag=getArtistTag(a);assert.equal(tag.artist,a.name);assert.ok(decodeURIComponent(tagDataURI(a)).includes(tag.svg));assert.ok(!/<title>[^<]*&(?!amp;)/.test(tag.svg));}
});
test('wall spray consumes only cosmetic cooldown, respects distance, and cannot paint empty air',()=>{
 const {sprays}=fixture(),a=actor();assert.equal(sprays.place(a,V(0,1.5,6),V(0,0,-1),0).ok,false);assert.equal(a.nextSprayAt,undefined);
 const result=sprays.place(a,V(0,1.5,2),V(0,0,-1),0);assert.equal(result.ok,true);assert.equal(result.tag,'sunflower');assert.equal(a.nextSprayAt,4);assert.equal(sprays.place(a,V(1,1.5,2),V(0,0,-1),1).reason,'cooldown');
 a.alive=false;assert.equal(sprays.place(a,V(1,1.5,2),V(0,0,-1),5).ok,false);sprays.dispose();
});
test('wall art is clipped at window edges instead of floating across the opening',()=>{
 const {physics,sprays}=fixture([wall(-8,-.4),wall(.4,8)]);
 assert.equal(sprays.place(actor(),V(0,1.5,2),V(0,0,-1),0).ok,false);
 const hit=physics.raycast(V(-.45,1.5,2),V(0,0,-1),4),g=projectSprayGeometry(physics,hit);assert.ok(g);const positions=g.getAttribute('position'),uv=g.getAttribute('uv');
 for(let i=0;i<positions.count;i++){assert.ok(positions.getX(i)<=-.39999);assert.ok(Math.abs(positions.getZ(i)-.038)<.00001);assert.ok(uv.getX(i)>=-.00001&&uv.getX(i)<=1.00001);}
 assert.ok(g.userData.coverage<.7);g.dispose();sprays.dispose();
});
test('vertical wall rule rejects floors and marks face the hit side',()=>{
 const {physics,sprays}=fixture();assert.equal(projectSprayGeometry(physics,{point:V(),normal:V(0,1,0)}),null);
 const hit=physics.raycast(V(0,1.5,-2),V(0,0,1),4),g=projectSprayGeometry(physics,hit);assert.ok(g);assert.ok(g.getAttribute('position').getZ(0)<0);g.dispose();sprays.dispose();
});
test('placement indicator matches clipped wall eligibility without creating marks or textures',()=>{
 const {sprays}=fixture([wall(-8,-.4),wall(.4,8)]),dir=V(0,0,-1);
 assert.equal(sprays.canPlace(V(0,1.5,2),dir),false,'opening');
 assert.equal(sprays.canPlace(V(-.45,1.5,2),dir),true,'enough wall beside opening');
 assert.equal(sprays.canPlace(V(-2,1.5,6),dir),false,'out of range');
 assert.equal(sprays.canPlace(V(-2,4,2),dir),false,'above wall');
 assert.equal(sprays.textures.size,0);assert.equal(sprays.marks.length,0);sprays.dispose();
 const narrow=fixture([wall(-.05,.05)]);assert.equal(narrow.sprays.canPlace(V(0,1.5,2),dir),false,'thin post has insufficient paint area');narrow.sprays.dispose();
});
test('overpainting and per-artist caps prevent coplanar stacking and release old geometry',()=>{
 const {sprays}=fixture(),a=actor();sprays.place(a,V(0,1.5,2),V(0,0,-1),0);let disposed=0;sprays.marks[0].mesh.geometry.addEventListener('dispose',()=>disposed++);
 sprays.place(actor(1),V(0,1.5,2),V(0,0,-1),1);assert.equal(disposed,1);assert.equal(sprays.marks.length,1);
 for(let i=0;i<6;i++)sprays.place(a,V(-6+i*1.3,1.5,2),V(0,0,-1),5+i*4);
 assert.equal(sprays.marks.filter(m=>m.actorId===a.id).length,SPRAY_RULES.perArtist);sprays.update(200);assert.equal(sprays.marks.length,0);sprays.dispose();
});
test('match reset and finishing stamps stay bounded and do not change actors or score',()=>{
 const {sprays,scene}=fixture(),a=actor();a.health=150;a.kills=2;
 for(let i=0;i<100;i++)sprays.celebrate(V(),a,i/100);assert.equal(sprays.flourishes.length,SPRAY_RULES.flourishCapacity);
 sprays.update(3);assert.equal(sprays.getState().activeFlourishes,0);assert.equal(a.health,150);assert.equal(a.kills,2);
 sprays.place(a,V(0,1.5,2),V(0,0,-1),4);sprays.clear();assert.equal(sprays.marks.length,0);sprays.dispose();assert.equal(scene.children.length,0);assert.equal(sprays.textures.size,0);
});
test('rich wall posters and compact elimination stamps use separate cached textures',()=>{
 const {physics,scene}=fixture(),variants=[];
 const sprays=new ArtistSprays(scene,physics,{textureFactory:(tag,variant)=>{variants.push(variant);return new THREE.Texture();}}),a=actor();
 sprays.place(a,V(0,1.5,2),V(0,0,-1),0);sprays.celebrate(V(),a,0);sprays.celebrate(V(1,0,0),a,.2);
 assert.deepEqual(variants,['full','stamp']);assert.notEqual(sprays.marks[0].mesh.material.map,sprays.flourishes[0].sprite.material.map);sprays.dispose();
});
