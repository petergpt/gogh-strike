import {intersectActorBody} from './actor-body.js';

// The projectile sampler and reticle share this value, including the same
// movement, crouch, airborne, recoil bloom and suppression penalties.
export function shotSpread(actor,weapon,aimed=false){
 return ((aimed?weapon.adsSpread:weapon.spread)+(actor.bloom||0))
  *(Math.hypot(actor.velocity.x,actor.velocity.z)>1?1.7:1)
  *(actor.crouched?.5:1)*(!actor.grounded?2.5:1)*(1+(actor.suppression||0)*.35);
}
export function spreadPixels(spread,height,fov){
 return Math.max(1.5,Math.min(24,spread*height*.5/Math.tan(fov*Math.PI/360)));
}
export function aimedRelation(origin,direction,player,actors,physics,lineOfSight,range){
 let distance=physics.raycast(origin,direction,range)?.distance??range,target=null;
 for(const actor of actors){
  if(actor===player||!actor.alive)continue;
  const hit=intersectActorBody(origin,direction,actor,distance);
  if(hit){distance=hit.distance;target=actor;}
 }
 if(!target||!lineOfSight(origin,origin.clone().addScaledVector(direction,distance)))return null;
 return target.team===player.team?'friendly':'enemy';
}
