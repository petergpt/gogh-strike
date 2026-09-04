import {Vector3} from 'three';
import {bodyPoint} from './actor-body.js';

const UP=new Vector3(0,1,0);

/** A short showcase view around the actor's existing position. Each candidate
 * is clipped against the town from the subject, so it cannot see through a wall.
 * Prefer a front three-quarter view; cramped spaces use the clearest side. */
export function tauntCameraPose(actor,physics,{aspect=1.7,near=.1}={}){
 const height=actor.standingHeight||1.8,target=actor.position.clone().add(new Vector3(0,height*.52,0));
 let best=null;
 for(const angle of [.42,-.42,0,1.1,-1.1,2.1,-2.1,Math.PI]){
  const yaw=actor.yaw+angle,desired=new Vector3(-Math.sin(yaw)*2.8,.48,-Math.cos(yaw)*2.8),distance=desired.length(),direction=desired.normalize();
  const right=direction.clone().cross(UP).normalize(),up=right.clone().cross(direction).normalize();
  const radius=Math.max(.16,near*Math.tan(80*Math.PI/360)*Math.max(1,aspect)+.04);
  let clear=distance;
  // Protect the near-plane corners as well as the center at oblique walls.
  for(const x of[-1,0,1])for(const y of[-1,0,1]){
   const origin=target.clone().addScaledVector(right,x*radius).addScaledVector(up,y*radius);
   const wall=physics.raycast(origin,direction,distance);clear=Math.min(clear,(wall?.distance??distance)-.22);
  }
  clear=Math.max(0,clear);
  const position=target.clone().addScaledVector(direction,clear),score=clear-Math.abs(angle)*.12;
  if(!best||score>best.score)best={position,target,score,distance:clear};
 }
 if(best.distance<.65)return null;
 return{position:best.position,target:best.target,fov:Math.max(48,Math.min(80,2*Math.atan(height*.69/best.distance)*180/Math.PI))};
}

/** Stay at the defeated player's own camera location. Only a visible killer
 * receives a brief focus; no spectator teleport, wall peek or respawn delay. */
export function defeatFocusPose(position,killer,aspect,lineOfSight){
 if(!killer?.alive)return null;
 const target=new Vector3().fromArray(bodyPoint(killer,'chest'));
 target.y=killer.position.y+(killer.standingHeight||1.8)*.54;
 const direction=target.clone().sub(position),distance=direction.length();
 if(distance<1||distance>45||!lineOfSight(position,target))return null;
 const fov=Math.max(20,Math.min(70,2*Math.atan((killer.standingHeight||1.8)/(.66*distance))*180/Math.PI));
 const right=direction.clone().normalize().cross(UP).normalize();
 // Keep the living figure to the left of the enlarged, central killer portrait.
 target.addScaledVector(right,distance*Math.tan(fov*Math.PI/360)*aspect*.52);
 return{target,fov};
}
