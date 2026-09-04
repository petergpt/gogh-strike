import * as THREE from 'three';
import {getArtistTag,tagDataURI} from './art-tags.js';

export const SPRAY_RULES=Object.freeze({range:4.5,cooldown:4,size:1.18,lifetime:90,capacity:36,perArtist:3,flourishCapacity:12});
const UP=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);

function clip(poly,axis,limit,sign){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],ai=a[axis]*sign<=limit,bi=b[axis]*sign<=limit;
  if(ai)out.push(a);
  if(ai!==bi){const f=(limit*sign-a[axis])/(b[axis]-a[axis]);out.push(a.map((n,j)=>n+(b[j]-n)*f));}
 }
 return out;
}

/** Clip artwork to the actual coplanar wall triangles. Windows and the wall's
 * silhouette remain holes rather than becoming floating square billboards. */
function projectWall(physics,hit,size,collect){
 if(!hit||!finite(hit.point)||!finite(hit.normal)||Math.abs(hit.normal.y)>.35)return null;
 const n=hit.normal.clone().normalize(),right=UP.clone().cross(n).normalize(),up=n.clone().cross(right),half=size/2;
 const ids=physics._near?.(hit.point.x,hit.point.z,size)||physics.triangles.map((_,i)=>i),positions=[],uv=[],normals=[];
 let area=0;
 for(const id of ids){
  const triangle=physics.triangles[id];if(!triangle||Math.abs(triangle.normal.dot(n))<.985)continue;
  let poly=[triangle.a,triangle.b,triangle.c].map(point=>{const d=point.clone().sub(hit.point);return[d.dot(right),d.dot(up),d.dot(n)];});
  if(poly.some(p=>Math.abs(p[2])>.035))continue;
  for(const axis of[0,1])for(const sign of[-1,1])poly=clip(poly,axis,half,sign);
  for(let i=1;i<poly.length-1;i++){
   const a=poly[0],b=poly[i],c=poly[i+1],part=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
   if(part<1e-8)continue;area+=part;
   if(collect)for(const p of[a,b,c]){const world=hit.point.clone().addScaledVector(right,p[0]).addScaledVector(up,p[1]).addScaledVector(n,p[2]+.038);positions.push(world.x,world.y,world.z);uv.push(.5+p[0]/size,.5+p[1]/size);normals.push(n.x,n.y,n.z);}
  }
 }
 if(area<size*size*.22)return null;
 return{positions,uv,normals,coverage:Math.min(1,area/(size*size))};
}
export function projectSprayGeometry(physics,hit,size=SPRAY_RULES.size){
 const projected=projectWall(physics,hit,size,true);if(!projected)return null;
 const {positions,uv,normals,coverage}=projected,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.computeBoundingSphere();geometry.userData.coverage=coverage;return geometry;
}

/** Cosmetic paint only: never changes the map geometry, collision or score. */
export class ArtistSprays{
 constructor(scene,physics,{textureFactory}={}){
  this.scene=scene;this.physics=physics;this.marks=[];this.flourishes=[];this.textures=new Map();this.time=0;
  this.textureFactory=textureFactory||((tag,variant)=>{const texture=new THREE.TextureLoader().load(tagDataURI(tag.id,variant));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;});
 }
 texture(tag,variant='full'){const key=tag.id+':'+variant;if(!this.textures.has(key))this.textures.set(key,this.textureFactory(tag,variant));return this.textures.get(key);}
 surface(origin,direction){
  if(!finite(origin)||!finite(direction)||direction.lengthSq()<1e-8)return null;
  const hit=this.physics.raycast(origin,direction,SPRAY_RULES.range);
  return hit&&hit.distance>=.35&&Math.abs(hit.normal.y)<.35?hit:null;
 }
 canPlace(origin,direction){
  // Same clipping threshold as placement, without allocating GPU geometry or
  // textures merely to light the small T control in the HUD.
  const hit=this.surface(origin,direction);return !!(hit&&projectWall(this.physics,hit,SPRAY_RULES.size,false));
 }
 place(actor,origin,direction,time){
  if(!actor?.alive||!Number.isFinite(time))return{ok:false,reason:'unavailable'};
  if((actor.nextSprayAt||0)>time)return{ok:false,reason:'cooldown',readyIn:actor.nextSprayAt-time};
  const hit=this.surface(origin,direction);if(!hit)return{ok:false,reason:'wall'};
  const geometry=projectSprayGeometry(this.physics,hit);if(!geometry)return{ok:false,reason:'wall'};
  const tag=getArtistTag(actor),material=new THREE.MeshBasicMaterial({map:this.texture(tag),transparent:true,opacity:0,alphaTest:.02,side:THREE.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`${tag.artist} · ${tag.name} wall spray`;mesh.renderOrder=2;this.scene.add(mesh);
  // A second mark in the same spot paints over the first, rather than stacking
  // coplanar transparent layers until they flicker or dominate the frame.
  for(const mark of [...this.marks])if(mark.normal.dot(hit.normal)>.98&&mark.position.distanceTo(hit.point)<.55)this.remove(mark);
  const own=this.marks.filter(mark=>mark.actorId===actor.id);if(own.length>=SPRAY_RULES.perArtist)this.remove(own[0]);
  while(this.marks.length>=SPRAY_RULES.capacity)this.remove(this.marks[0]);
  const mark={mesh,actorId:actor.id,team:actor.team,tag:tag.id,position:hit.point.clone(),normal:hit.normal.clone(),born:time};this.marks.push(mark);actor.nextSprayAt=time+SPRAY_RULES.cooldown;actor.lastSprayAt=time;
  return{ok:true,tag:tag.id,position:hit.point.clone(),normal:hit.normal.clone(),coverage:geometry.userData.coverage};
 }
 celebrate(position,actor,time){
  if(!finite(position)||!actor||!Number.isFinite(time))return;
  const tag=getArtistTag(actor);let mark=this.flourishes.find(item=>!item.active);
  if(!mark&&this.flourishes.length<SPRAY_RULES.flourishCapacity){const material=new THREE.SpriteMaterial({map:this.texture(tag,'stamp'),transparent:true,opacity:0,depthTest:true,depthWrite:false,toneMapped:false});const sprite=new THREE.Sprite(material);sprite.name='artist elimination stamp';this.scene.add(sprite);mark={sprite,active:false};this.flourishes.push(mark);}
  if(!mark)mark=this.flourishes.reduce((a,b)=>a.born<b.born?a:b);
  mark.sprite.material.map=this.texture(tag,'stamp');mark.sprite.material.needsUpdate=true;mark.sprite.position.copy(position).add(V(0,1.15,0));mark.origin=mark.sprite.position.clone();mark.sprite.visible=true;mark.sprite.scale.setScalar(.65);mark.born=time;mark.active=true;
 }
 update(time){
  this.time=time;
  for(const mark of[...this.marks]){const age=time-mark.born;if(age>SPRAY_RULES.lifetime){this.remove(mark);continue;}const alpha=Math.min(1,age/.22)*Math.min(1,(SPRAY_RULES.lifetime-age)/4);mark.mesh.material.opacity=.94*Math.max(0,alpha);}
  for(const mark of this.flourishes){if(!mark.active)continue;const age=time-mark.born;if(age>.85){mark.active=false;mark.sprite.visible=false;continue;}mark.sprite.position.copy(mark.origin).add(V(0,age*.32,0));mark.sprite.scale.setScalar(.65+Math.min(1,age/.16)*.13);mark.sprite.material.opacity=Math.max(0,Math.min(1,age/.08)*(1-age/.85))*.9;}
 }
 remove(mark){const i=this.marks.indexOf(mark);if(i>=0)this.marks.splice(i,1);this.scene.remove(mark.mesh);mark.mesh.geometry.dispose();mark.mesh.material.dispose();}
 clear(){for(const mark of[...this.marks])this.remove(mark);for(const mark of this.flourishes){mark.active=false;mark.sprite.visible=false;}this.time=0;}
 dispose(){this.clear();for(const mark of this.flourishes){this.scene.remove(mark.sprite);mark.sprite.material.dispose();}this.flourishes.length=0;for(const texture of this.textures.values())texture.dispose();this.textures.clear();}
 getState(){return{marks:this.marks.map(mark=>({artist:mark.tag,actorId:mark.actorId,position:mark.position.toArray(),normal:mark.normal.toArray(),coverage:mark.mesh.geometry.userData.coverage})),activeFlourishes:this.flourishes.filter(mark=>mark.active).length,textures:this.textures.size};}
}
