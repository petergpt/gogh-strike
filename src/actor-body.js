import {bodyPose} from './actor-profile.js';

const poses = new WeakMap();

// Standing/crouching gameplay poses are fixed. Cache their geometry rather than
// recomputing foot articulation for every visibility query and bullet pellet.
export function actorPose(actor) {
  if (!actor.bodyProfile) {
    const h = actor.height || actor.standingHeight || 1.8;
    return {eye:[0,h-.16,0],head:[0,h-.18,0],chest:[0,h*.61,0],abdomen:[0,h*.37,0],
      headRadii:[.205,.205,.205],chestRadii:[.30,.30,.30],abdomenRadii:[.26,.26,.26]};
  }
  let pair = poses.get(actor.bodyProfile);
  if (!pair) {
    pair = [bodyPose(actor.bodyProfile), bodyPose(actor.bodyProfile,{crouched:true})];
    poses.set(actor.bodyProfile, pair);
  }
  return pair[actor.crouched ? 1 : 0];
}

export function bodyPoint(actor, part = 'eye') {
  const [x,y,z] = actorPose(actor)[part], c = Math.cos(actor.yaw || 0), s = Math.sin(actor.yaw || 0);
  // The human's eased eye is advanced by the controller, once per simulation
  // step. Camera, firearm and utility then use exactly the same origin.
  const eyeY=part==='eye'&&actor.isPlayer&&Number.isFinite(actor.cameraHeight)?actor.cameraHeight:y;
  return [actor.position.x+x*c+z*s, actor.position.y+eyeY, actor.position.z-x*s+z*c];
}

/** Intersect a normalized world ray with the actor's yaw-oriented ellipsoids.
 * The ray parameter stays in world metres even after scaling into each volume.
 */
export function intersectActorBody(origin, direction, actor, maxDistance = Infinity) {
  const pose=actorPose(actor), c=Math.cos(actor.yaw||0), s=Math.sin(actor.yaw||0);
  const dx=origin.x-actor.position.x, dz=origin.z-actor.position.z;
  const localOrigin=[dx*c-dz*s,origin.y-actor.position.y,dx*s+dz*c];
  const localDirection=[direction.x*c-direction.z*s,direction.y,direction.x*s+direction.z*c];
  let best=null;
  const volumes=['head','chest','abdomen'].map(part=>({center:pose[part],radii:pose[part+'Radii'],pitch:pose[part+'Pitch']||0,headshot:part==='head'}));
  volumes.push(...(pose.upperLegs||[]),...(pose.lowerLegs||[]));
  for(const {center,radii,pitch=0,headshot=false} of volumes) {
    const cp=Math.cos(pitch),sp=Math.sin(pitch),offset=localOrigin.map((v,i)=>v-center[i]);
    const o=[offset[0],offset[1]*cp+offset[2]*sp,-offset[1]*sp+offset[2]*cp].map((v,i)=>v/radii[i]);
    const d=[localDirection[0],localDirection[1]*cp+localDirection[2]*sp,-localDirection[1]*sp+localDirection[2]*cp].map((v,i)=>v/radii[i]);
    const aa=d.reduce((n,v)=>n+v*v,0), bb=2*o.reduce((n,v,i)=>n+v*d[i],0), cc=o.reduce((n,v)=>n+v*v,0)-1;
    const discriminant=bb*bb-4*aa*cc;
    if(aa<1e-12||discriminant<0)continue;
    const root=Math.sqrt(discriminant), entry=(-bb-root)/(2*aa), exit=(-bb+root)/(2*aa);
    const distance=entry>=0?entry:exit;
    if(distance>=0&&distance<maxDistance&&(!best||distance<best.distance))best={distance,headshot};
  }
  return best;
}
