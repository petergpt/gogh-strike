import {Vector3} from 'three';
import {bodyPoint} from './actor-body.js';

const V=(x=0,y=0,z=0)=>new Vector3(x,y,z),UP=V(0,1,0);
const ROLES=['vanguard','flanker','anchor','marksman','support','scout'];
const ROLE={
 vanguard:{range:21,speed:4.5,hold:3,leash:22,sector:1},
 flanker:{range:15,speed:4.85,hold:2.8,leash:23,sector:3},
 anchor:{range:15,speed:4.1,hold:8,leash:13,sector:0},
 marksman:{range:35,speed:4.05,hold:9,leash:16,sector:2},
 support:{range:24,speed:4.3,hold:5,leash:18,sector:4},
 scout:{range:19,speed:5,hold:2.2,leash:19,sector:5},
};
// Authored positions on the *original* town. Projection and routes use the
// same solid-geometry navigation representation as the human controller.
export const BOT_SECTORS=Object.freeze([
 {id:'bedroom',name:'The Bedroom',points:[[-1.65,3.5],[-9.7,6.8],[3,14],[16,17]]},
 {id:'cafe',name:'Café Terrace',points:[[-14,-4],[-11,-20],[-8,-30],[-18,6]]},
 {id:'rhone',name:'Rhône quay',points:[[3,-42],[18,-43],[27,-36],[20,-38]]},
 {id:'wheat',name:'Wheatfield',points:[[48,23],[49,4],[69,23],[56,17]]},
 {id:'sunflowers',name:'Sunflowers',points:[[82,16],[82,-6],[91,1],[77,20]]},
 {id:'crossroads',name:'Country lanes',points:[[35,-24],[39,-8],[59,-12],[47,-21]]},
]);
const distanceSq=(a,b)=>(a.x-b.x)**2+(a.z-b.z)**2;
const distance=(a,b)=>Math.sqrt(distanceSq(a,b));
const living=a=>a?.alive!==false&&(a?.health??100)>0;
// Visibility, aim and firing share the rendered artist's anatomical offsets.
const eye=a=>V().fromArray(bodyPoint(a));
const chest=a=>a.bodyProfile?V().fromArray(bodyPoint(a,'chest')):eye(a).addScaledVector(UP,-.28);
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const rng=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
const modeOf=game=>typeof game.mode==='object'?game.mode.id:game.mode||'tdm';
const weaponKind=id=>/shot/.test(id)?'shotgun':/snip|precision/.test(id)?'precision':/smg/.test(id)?'smg':/pistol/.test(id)?'pistol':'rifle';
const asVector=p=>p?.isVector3?p.clone():V(p?.x||0,p?.y||0,p?.z||0);

/**
 * Role-driven, decentralised squad AI. Team intel contains expiring snapshots,
 * never references to occluded enemy positions. Only two actors per team may
 * respond to a sighting; everyone else retains their assigned sector or site.
 * Weapons, health, utilities and objective progress remain game-owned.
 */
export class BotDirector {
 constructor(physics){this.physics=physics;this.states=new Map();this.intel=new Map();this.teams=new Map();this.sectors=null;this.lastTime=-Infinity;this.pathBudget=2;this.preservedRoles=new Map();}

 reset({preserveRoles=false}={}){
  this.preservedRoles=preserveRoles?new Map([...this.states].map(([id,s])=>[id,s.role])):new Map();
  this.states.clear();this.intel.clear();this.teams.clear();this.lastTime=-Infinity;
 }

 makeState(actor,now,rosterIndex=0){
  const role=ROLES.includes(actor.role)?actor.role:this.preservedRoles.get(actor.id)||ROLES[rosterIndex%ROLES.length];
  const personality=actor.personality||{};
  const s={role,slot:ROLES.indexOf(role),seed:hash(actor.id),wasAlive:living(actor),lastHealth:actor.health,
   aggression:clamp(personality.aggression??.65,0,1),discipline:clamp(personality.discipline??.75,0,1),curiosity:clamp(personality.curiosity??.65,0,1),
   target:null,visible:false,seenAt:-Infinity,lastSeen:V(),aimPoint:V(),aimError:V(),nextAimError:0,reactAt:now+.55,targetLockUntil:0,
   alertUntil:0,nextThink:now,nextPath:now,nextCover:now,coverUntil:0,coverReachedAt:null,cover:null,goal:null,objectiveId:null,
   path:[],pathIndex:0,intent:'deploy',nextGoal:now,holdUntil:0,holdStarted:false,sector:ROLE[role].sector,sectorVisit:0,
   strafeSign:hash(actor.id)%2?1:-1,nextStrafe:now+1,strafeUntil:0,sprintActive:false,burst:0,burstPauseUntil:now,
   moveCheckAt:now+.9,checkPosition:actor.position.clone(),stuckFor:0,recoveries:0,jumpAt:-Infinity,blockedUntil:0,
   combatUntil:0,nextUtility:now+5,assignmentKey:'',responding:false,interacting:false,scanPhase:rng({seed:hash(actor.id)})*6.28,
   announced:new Set(),pathFailures:0,routeVia:null,lastOrder:null,lastPathAt:-Infinity,friendBlockedUntil:0};
  s.nextThink+=rng(s)*.22;s.nextPath+=rng(s)*.35;s.nextStrafe+=rng(s)*1.2;return s;
 }

 update(dt,game){
  if(!game?.actors||!(dt>0))return;
  const now=Number.isFinite(game.time)?game.time:Math.max(0,this.lastTime)+dt;
  if(now<this.lastTime)this.reset();this.lastTime=now;dt=Math.min(dt,.08);this.pathBudget=2;
  if(!this.sectors)this.sectors=BOT_SECTORS.map(sector=>({...sector,points:sector.points.map(([x,z])=>this.physics.nearestWalkable(V(x,0,z)))}));
  // Create all state first: decisions for the first bot cannot accidentally
  // reserve every route before its teammates have a known role.
  for(const actor of game.actors){
   if(actor.isPlayer)continue;
   const roster=game.actors.filter(a=>a.team===actor.team);
   let s=this.states.get(actor.id);
   if(!s||(!s.wasAlive&&living(actor))){s=this.makeState(actor,now,roster.indexOf(actor));this.states.set(actor.id,s);}
   if(!living(actor)){s.wasAlive=false;s.target=null;s.path.length=0;actor.botState={role:s.role,intent:'eliminated',targetId:null,sector:this.sectors[s.sector].id};continue;}
   s.wasAlive=true;
  }
  this.assignTeams(game,now);
  for(const actor of game.actors){
   if(actor.isPlayer||!living(actor))continue;
   const s=this.states.get(actor.id);
   if((actor.sprayUntil||0)>now||(actor.tauntUntil||0)>now){actor.ads=actor.aiming=actor.sprinting=false;this.physics.move(actor,V(),dt,{braking:100,crouch:actor.crouched});continue;}
   if(game.tactical?.stage==='staging'){
    s.intent='prepare exhibition';s.target=null;s.visible=false;s.path.length=0;s.goal=null;s.assignmentKey='';
    actor.ads=actor.aiming=actor.sprinting=false;this.physics.move(actor,V(),dt,{braking:100,crouch:false});this.publish(actor,s);continue;
   }
   if(actor.health<s.lastHealth){s.alertUntil=now+3.5;s.nextThink=Math.min(s.nextThink,now+.07);if(!s.cover)s.nextCover=Math.min(s.nextCover,now);}
   s.lastHealth=actor.health;
   if(now>=s.nextThink){this.think(actor,s,game,now);s.nextThink=now+.19+rng(s)*.11;}
   this.act(actor,s,game,now,dt);this.publish(actor,s);
  }
 }

 assignTeams(game,now){
  for(const team of new Set(game.actors.map(a=>a.team))){
   let plan=this.teams.get(team);
   if(!plan){plan={nextPlan:0,responders:new Set(),siteId:null,removerId:null,recovererId:null,key:'',team,nextUtilityAt:0};this.teams.set(team,plan);}
   const tactical=game.tactical;
   const order=game.squadOrder,activeOrder=order?.team===team&&(order.expiresAt??Infinity)>now?order:null;
   const key=tactical?`${tactical.stage}:${tactical.beaconState}:${tactical.carrierId}:${tactical.site?.id}:${tactical.attackingTeam}:${activeOrder?.id}:${activeOrder?.expiresAt}`:'classic';
   if(now<plan.nextPlan&&key===plan.key)continue;
   plan.key=key;plan.nextPlan=now+1.25;
   const allies=game.actors.filter(a=>a.team===team&&living(a));
   const bots=allies.filter(a=>!a.isPlayer);
   const info=this.intel.get(team);
   plan.responders.clear();
   if(info&&now-info.at<5.5){
    // Response is a reservation, separate from self-defence. A defender who
    // sees a threat shoots, but does not drag the entire crew to that location.
    const candidates=bots.filter(a=>!['anchor','marksman'].includes(this.states.get(a.id)?.role)&&a.id!==tactical?.carrierId)
     .filter(a=>distance(a.position,info.position)<45)
     .sort((a,b)=>distance(a.position,info.position)-distance(b.position,info.position));
    for(const a of candidates.slice(0,2))plan.responders.add(a.id);
   }else if(info)this.intel.delete(team);
   if(!tactical)continue;
   const sites=tactical.sites?.length?tactical.sites:tactical.site?[tactical.site]:[];
   if(sites.length&&!sites.some(site=>site.id===plan.siteId)){
    const carrier=allies.find(a=>a.id===tactical.carrierId)||allies[0];
    const rank=sites.map((site,i)=>({site,score:(carrier?distance(carrier.position,site.position):0)+((team+i)%2)*7})).sort((a,b)=>a.score-b.score);
    plan.siteId=rank[0]?.site.id;
   }
   if(activeOrder?.id==='attack'&&activeOrder.position&&!tactical.planted&&sites.length){
    plan.siteId=sites.slice().sort((a,b)=>distance(a.position,activeOrder.position)-distance(b.position,activeOrder.position))[0].id;
   }
   if(tactical.planted&&tactical.site)plan.siteId=tactical.site.id;
   const destination=tactical.devicePosition&&asVector(tactical.devicePosition);
   plan.recovererId=null;plan.removerId=null;
   if(destination){
    const candidates=bots.slice().sort((a,b)=>distance(a.position,destination)-distance(b.position,destination));
    if(team===tactical.attackingTeam&&tactical.beaconState==='dropped')plan.recovererId=candidates[0]?.id??null;
    if(team!==tactical.attackingTeam&&tactical.planted)plan.removerId=candidates[0]?.id??null;
   }
  }
 }

 los(game,a,b){return game.getLOS?game.getLOS(a,b):this.physics.lineOfSight(a,b);}

 think(actor,s,game,now){
  const origin=eye(actor),current=s.target;let best=null,bestScore=Infinity,currentVisible=false;
  for(const enemy of game.actors){
   // Spawn protection is a chance to orient and leave safely. Do not track a
   // protected actor and then fire on the very frame their protection expires.
   if(enemy.team===actor.team||!living(enemy)||(enemy.protectedUntil||0)>now)continue;
   const d=distance(actor.position,enemy.position);
   const perception=s.role==='marksman'?72:s.role==='scout'?64:58;
   if(d>perception)continue;
   const bearing=Math.atan2(actor.position.x-enemy.position.x,actor.position.z-enemy.position.z);
   const fov=Math.abs(wrap(bearing-(actor.yaw||0)));
   if(fov>1.36&&d>9&&current!==enemy&&s.alertUntil<now)continue;
   if(!this.los(game,origin,chest(enemy)))continue;
   if(enemy===current)currentVisible=true;
   const score=d*(enemy===current?.7:1);
   if(score<bestScore){best=enemy;bestScore=score;}
  }
  if(best&&best!==current&&currentVisible&&now<s.targetLockUntil&&distance(actor.position,best.position)>7)best=current;
  s.visible=!!best;
  if(best){
   // Reappearing after meaningful occlusion needs a new acquisition. Keeping
   // the old target ID must not preserve fully settled aim through a wall.
   if(best!==current||now-s.seenAt>.65){
    const difficulty=game.settings?.difficulty||'standard';const multiplier=['relaxed','easy'].includes(difficulty)?1.5:['veteran','hard'].includes(difficulty)?.76:1;
    s.reactAt=now+(.3+rng(s)*.22+distance(actor.position,best.position)*.002)*multiplier;
    s.aimPoint.copy(chest(best));s.burst=0;s.burstPauseUntil=s.reactAt;s.combatUntil=now+2.8+s.aggression*3+rng(s)*1.5;s.targetLockUntil=now+1.25;
   }
   s.target=best;s.seenAt=now;s.lastSeen.copy(best.position);
   this.intel.set(actor.team,{position:best.position.clone(),at:now,targetId:best.id,observerId:actor.id});
  }else if(current&&(!living(current)||(current.protectedUntil||0)>now||now-s.seenAt>4.2)){s.target=null;s.nextGoal=now;}

  const reloading=(actor.reloadUntil||0)>now;
  const magazine=game.weapons?.[actor.weaponId]?.magSize||game.weapons?.[actor.weaponId]?.magazine||28;
  if(actor.ammo===0&&!reloading&&actor.reserve>0)game.requestReload?.(actor);
  if(!s.visible&&!s.interacting&&now-s.seenAt>2.1&&actor.ammo<magazine*.42&&actor.reserve>0&&!reloading)game.requestReload?.(actor);
  s.responding=this.teams.get(actor.team)?.responders.has(actor.id)||false;
  s.interacting=false;
  const objectivePriority=this.assignObjective(actor,s,game,now);

  if(s.visible&&!s.cover&&(actor.health<(actor.maxHealth??100)*.43||reloading||actor.ammo===0||(actor.suppression||0)>.55)&&now>=s.nextCover&&!objectivePriority){
   s.cover=this.findCover(actor,s,game);s.coverUntil=now+5.5;s.coverReachedAt=null;s.nextCover=now+5;
   if(s.cover)this.setGoal(s,s.cover,reloading?'reload in cover':'take cover',now);
  }
  if(s.cover&&now>=s.coverUntil){s.cover=null;s.coverReachedAt=null;s.nextGoal=now;s.assignmentKey='';s.nextCover=Math.max(s.nextCover,now+2);}
  if(!objectivePriority&&!s.cover){
   if(s.visible){
    const ideal=this.idealRange(actor,s),d=distance(actor.position,s.lastSeen);
    // Close-range specialists may pursue briefly; the rest hold a firing
    // angle and return to their assignment when the contact disappears.
    if(now>s.combatUntil&&d>10){
     // A sustained contact does not permanently pin every bot in the same
     // street. Keep firing while advancing to the assigned flank or sector.
     this.chooseGoal(actor,s,game,now);
    }else if(d>ideal+5&&(s.responding||['flanker','vanguard'].includes(s.role))&&now<s.combatUntil){
     const approach=actor.position.clone().lerp(s.lastSeen,clamp((d-ideal)/d,0,.65));
     this.setGoal(s,this.physics.nearestWalkable(approach),'close distance',now);
    }else if(d<ideal*.5&&['marksman','support'].includes(s.role)){
     const away=actor.position.clone().sub(s.lastSeen).setY(0).normalize();
     this.setGoal(s,this.physics.nearestWalkable(actor.position.clone().addScaledVector(away,5)),'open firing angle',now);
    }else{
     s.intent='engage';s.path.length=0;s.pathIndex=0;
    }
   }else if(s.target&&now-s.seenAt<2.8&&s.responding&&!game.tactical){
    const offset=this.slotOffset(s,s.lastSeen,4.5);
    this.setGoal(s,offset,'search last sighting',now);
   }else if(!s.goal||now>=s.nextGoal||s.intent==='engage'||s.intent==='close distance'||s.intent==='open firing angle'){
    this.chooseGoal(actor,s,game,now);
   }
  }
  this.useUtility(actor,s,game,now);
  if(s.goal&&s.intent!=='engage'&&now>=s.nextPath&&this.pathBudget>0)this.replan(actor,s,now);
 }

 assignObjective(actor,s,game,now){
  const tactical=game.tactical;if(!tactical)return false;
  const plan=this.teams.get(actor.team),sites=tactical.sites?.length?tactical.sites:[tactical.site].filter(Boolean);
  if(!sites.length)return false;
  const attack=actor.team===tactical.attackingTeam;
  const primary=sites.find(o=>o.id===plan.siteId)||sites[0];
  const alternate=sites.find(o=>o.id!==primary.id)||primary;
  const device=tactical.devicePosition?asVector(tactical.devicePosition):primary.position;
  let site=primary,goal,intent,key,priority=false;
  if(tactical.planted){
   site=tactical.site||primary;
   if(!attack&&actor.id===plan.removerId){goal=device;intent='remove beacon';priority=true;}
   else if(!attack){goal=this.slotOffset(s,device,s.role==='marksman'?14:6.5);intent='cover retake';}
   else{goal=this.slotOffset(s,device,s.role==='marksman'?16:s.role==='anchor'?8:10);intent='defend exhibition';}
  }else if(attack&&tactical.beaconState==='dropped'&&actor.id===plan.recovererId){
   goal=device;intent='recover beacon';priority=true;
  }else if(attack&&actor.id===tactical.carrierId){
   goal=this.plantPosition(site,s);intent='establish exhibition';priority=true;
  }else if(attack){
   if(s.role==='scout'){site=alternate;goal=this.slotOffset(s,site.position,6);intent='probe alternate site';}
   else if(s.role==='flanker'){goal=this.slotOffset(s,site.position,10);intent='flank exhibition';}
   else if(s.role==='marksman'){goal=this.slotOffset(s,site.position,16);intent='overwatch exhibition';}
   else if(s.role==='anchor'){goal=this.slotOffset(s,site.position,13);intent='secure rear lane';}
   else{goal=this.slotOffset(s,site.position,6.5);intent='escort beacon';}
  }else{
   // Three lanes at each site: a holder, an angle and a mobile perimeter.
   site=sites[s.slot%sites.length];
   const radius=s.role==='marksman'?14:s.role==='anchor'?3.5:s.role==='support'?9:6.5;
   goal=this.slotOffset(s,site.position,radius);intent=s.role==='scout'||s.role==='flanker'?'patrol site perimeter':'guard exhibition';
  }
  const order=game.squadOrder;
  if(!priority&&order?.team===actor.team&&(order.expiresAt??Infinity)>now&&order.position){
   if(order.id==='attack'){
    site=sites.slice().sort((a,b)=>distance(a.position,order.position)-distance(b.position,order.position))[0];
    goal=this.slotOffset(s,site.position,s.role==='marksman'?14:5+s.slot);intent='push marked site';
   }else if(order.id==='regroup'||order.id==='hold'){
    goal=this.slotOffset(s,order.position,order.id==='regroup'?4+s.slot*.9:5+s.slot);
    intent=order.id==='hold'?'hold ordered angle':'regroup in formation';
   }else if(order.id==='spread'){
    site=sites[s.slot%sites.length];goal=this.slotOffset(s,site.position,6+s.slot*1.7);intent='spread across site lanes';
   }
  }
  s.objectiveId=site.id;
  key=`${intent}:${site.id}:${tactical.carrierId}:${tactical.beaconState}`;
  // Objective overrides contact pursuit, but a carrier still fights back if
  // someone is in front of them. Interaction itself owns a stationary hold.
  if(s.assignmentKey!==key||!s.goal||priority||now>=s.nextGoal){
   if(!priority&&now>=s.nextGoal&&s.holdStarted&&['scout','flanker'].includes(s.role)){
    s.sectorVisit++;goal=this.slotOffset(s,site.position,s.role==='scout'?9:11,s.sectorVisit*.9);
   }
   this.setGoal(s,this.physics.nearestWalkable(goal),intent,now);
   s.assignmentKey=key;s.nextGoal=now+ROLE[s.role].hold+8;
  }
  if(priority){s.cover=null;s.intent=intent;}
  // Attack/defence assignments persist between combat contacts and never use
  // an enemy's concealed current location.
  return priority;
 }

 plantPosition(site,s){
  const centre=asVector(site.position),radius=Math.max(.2,Math.min(1,(site.radius||3)*.3));
  for(const offset of [this.slotOffset(s,centre,radius),centre]){
   const p=this.physics.nearestWalkable(offset);
   if(distance(p,centre)<(site.radius||3)*.8)return p;
  }
  return this.physics.nearestWalkable(centre);
 }

 slotOffset(s,point,radius,phase=0){
  const angle=(s.slot/6)*Math.PI*2+(s.seed%17)*.035+phase;
  return asVector(point).add(V(Math.cos(angle)*radius,0,Math.sin(angle)*radius));
 }

 chooseGoal(actor,s,game,now){
  if(game.tactical){s.assignmentKey='';this.assignObjective(actor,s,game,now);return;}
  const order=game.squadOrder;
  if(order&&order.team===actor.team&&(order.expiresAt??Infinity)>now&&order.position){
   if(order.id!=='spread'){
    const radius=order.id==='regroup'?4.5+s.slot*.8:order.id==='hold'?5+s.slot:3+s.slot*1.6;
    const point=this.physics.nearestWalkable(this.slotOffset(s,order.position,radius));
    this.setGoal(s,point,order.id==='attack'?'push marked position':order.id==='hold'?'hold ordered angle':'regroup in formation',now);
    s.nextGoal=now+4;s.objectiveId=null;return;
   }
  }
  const objectives=game.objectives||[];
  if(/control|domination|hold|capture/.test(modeOf(game))&&objectives.length){
   const assigned=objectives[s.slot%objectives.length];
   const choices=objectives.map(o=>{
    const count=game.actors.filter(a=>a!==actor&&a.team===actor.team&&living(a)&&this.states.get(a.id)?.objectiveId===o.id).length;
    return{o,score:(o===assigned?-24:0)+count*34+distance(actor.position,o.position)*.13+(o.owner===actor.team?9:-5)+(o.contested?-8:0)};
   }).sort((a,b)=>a.score-b.score);
   const o=choices[0].o;s.objectiveId=o.id;
   this.setGoal(s,this.physics.nearestWalkable(this.slotOffset(s,o.position,Math.min(2.2,(o.radius||4)*.5))),o.owner===actor.team?'defend objective':'capture objective',now);
   s.nextGoal=now+7+rng(s)*5;return;
  }
  s.objectiveId=null;
  const info=this.intel.get(actor.team),orderSpread=order?.id==='spread'&&order.team===actor.team&&(order.expiresAt??Infinity)>now;
  if(!orderSpread&&s.responding&&info&&now-info.at<4.5&&distance(actor.position,info.position)<32&&distance(actor.position,info.position)>9){
   this.setGoal(s,this.physics.nearestWalkable(this.slotOffset(s,info.position,8+s.slot)),'support contact',now);s.nextGoal=now+3;return;
  }
  const sector=this.sectors[s.sector];
  let point=sector.points[(s.sectorVisit+actor.team)%sector.points.length];
  // Arriving starts a deliberate watch, then a patrol to a different local
  // point. Distant sectors stay assigned until reached, even during encounters.
  if(distance(actor.position,point)<1.2&&!s.holdStarted){s.holdStarted=true;s.holdUntil=now+ROLE[s.role].hold;s.nextGoal=s.holdUntil;s.intent=s.role==='marksman'?'watch long lane':s.role==='anchor'?'hold sector':'watch sector';s.path.length=0;return;}
  if(s.holdStarted&&now<s.holdUntil){s.nextGoal=s.holdUntil;return;}
  if(s.holdStarted){s.sectorVisit++;s.holdStarted=false;}
  point=sector.points[(s.sectorVisit+actor.team)%sector.points.length];
  this.setGoal(s,point,s.role==='flanker'?'flank through sector':s.role==='scout'?'scout sector':'patrol sector',now);
  s.nextGoal=now+18;s.routeVia=null;
 }

 setGoal(s,point,intent,now){
  if(!point)return;
  if(!s.goal||distanceSq(s.goal,point)>.9**2){
   const movingContact=s.goal&&distance(s.goal,point)<6&&s.intent===intent&&s.pathIndex<s.path.length;
   s.goal=asVector(point);s.nextPath=Math.max(Math.min(s.nextPath,now),s.lastPathAt+.9);
   // A nearby target's tracking update can reuse the existing safe route until
   // the next planned search. Rebuilding A* on every perception tick adds no
   // tactical value and creates visible frame-time spikes in the dense town.
   if(!movingContact){s.path.length=0;s.pathIndex=0;}
   s.holdStarted=false;
  }
  s.intent=intent;
 }

 replan(actor,s,now){
  if(!s.goal)return;this.pathBudget--;s.lastPathAt=now;
  if(distance(actor.position,s.goal)<.6){s.path.length=0;s.nextPath=now+3;return;}
  s.path=this.physics.findPath(actor.position,s.goal,{radius:Math.max(.34,(actor.radius||.31)+.025),height:actor.standingHeight||1.8})||[];s.pathIndex=0;
  s.nextPath=now+4.5+rng(s)*2;
  if(!s.path.length){s.pathFailures++;s.nextPath=now+1.4+rng(s);if(s.pathFailures>2){s.sectorVisit++;s.assignmentKey='';s.nextGoal=now;s.pathFailures=0;}}
  else s.pathFailures=0;
 }

 findCover(actor,s,game){
  if(!s.visible||!s.target)return null;
  const threat=eye(s.target),away=actor.position.clone().sub(s.lastSeen).setY(0).normalize();
  let best=null,score=Infinity;
  for(let i=0;i<8;i++){
   const dir=away.clone().applyAxisAngle(UP,(i-3.5)*.43);
   const point=this.physics.nearestWalkable(actor.position.clone().addScaledVector(dir,3+i%3*2),{radius:actor.radius||.31,height:actor.standingHeight||1.8});
   const d=distance(actor.position,point);if(d<1.5||d>10)continue;
   const crouching={...actor,position:point,crouched:true};
   if(this.los(game,threat,eye(crouching))||this.los(game,threat,chest(crouching)))continue;
   if(d<score){best=point;score=d;}
  }
  return best;
 }

 useUtility(actor,s,game,now){
  if(!game.requestUtility||now<s.nextUtility||s.interacting||(actor.reloadUntil||0)>now)return;
  const team=this.teams.get(actor.team);if((team?.nextUtilityAt||0)>now)return;
  if(s.visible&&s.target){
   const d=distance(actor.position,s.lastSeen),hasSmoke=(actor.utility?.smoke||0)>0;
   if(hasSmoke&&(actor.health<(actor.maxHealth??100)*.5||s.intent==='establish exhibition'||s.intent==='remove beacon')&&d>10){
    const point=actor.position.clone().lerp(s.lastSeen,.42);if(game.requestUtility(actor,'smoke',point)){s.nextUtility=now+11;if(team)team.nextUtilityAt=now+6;this.radio(game,s,actor,'Smoke covering the crossing.');return;}
   }
   if((actor.utility?.frag||0)>0&&d>12&&d<30){
    const friendlyNear=game.actors.some(a=>a!==actor&&a.team===actor.team&&living(a)&&distance(a.position,s.lastSeen)<10);
    if(!friendlyNear&&this.los(game,eye(actor),chest(s.target))&&game.requestUtility(actor,'frag',s.lastSeen.clone())){s.nextUtility=now+14;if(team)team.nextUtilityAt=now+6;this.radio(game,s,actor,'Canister on the exposed angle.');}
   }
  }
 }

 idealRange(actor,s){const kind=weaponKind(actor.weaponId);return kind==='shotgun'?9:kind==='precision'?36:kind==='smg'?17:kind==='pistol'?20:ROLE[s.role].range;}

 interactionReady(actor,s,game){
  const t=game.tactical;if(!t||!game.requestInteract)return false;
  const site=t.sites?.find(site=>site.id===s.objectiveId)||t.site;
  let point,range;
  if(actor.id===t.carrierId&&!t.planted&&site){point=site.position;range=Math.max(.4,(site.radius||3)-.8);}
  else if(t.planted&&actor.team!==t.attackingTeam&&this.teams.get(actor.team)?.removerId===actor.id&&t.devicePosition){point=asVector(t.devicePosition);range=1.85;}
  else return false;
  if(distance(actor.position,point)>range)return false;
  // A wall between the actor and site/device must block using it too. Smoke
  // also prevents bots from knowing a device is available on the far side.
  if(!this.los(game,eye(actor),asVector(point).addScaledVector(UP,.65)))return false;
  return (actor.reloadUntil||0)<=game.time&&(actor.healUntil||0)<=game.time;
 }

 act(actor,s,game,now,dt){
  const move=V(),engaging=s.visible&&s.target&&living(s.target)&&(s.target.protectedUntil||0)<=now,reloading=(actor.reloadUntil||0)>now;
  const interact=this.interactionReady(actor,s,game);
  s.interacting=interact;
  if(interact){
   s.intent=game.tactical.planted?'remove beacon':'establish exhibition';s.path.length=0;s.pathIndex=0;
   this.physics.move(actor,move,dt,{crouch:true,braking:150});
   // Wait for braking before starting a hold. Once begun, strafe and crowd
   // steering remain disabled, so the game's 0.4m movement cancellation works.
   if(Math.hypot(actor.velocity?.x||0,actor.velocity?.z||0)<.2){game.requestInteract(actor,dt);this.radio(game,s,actor,game.tactical.planted?'Removing the colour beacon.':'Establishing the exhibition.');}
   actor.ads=actor.aiming=actor.sprinting=false;return;
  }
  while(s.pathIndex<s.path.length){const tolerance=s.pathIndex===s.path.length-1?.55:.28;if(distanceSq(actor.position,s.path[s.pathIndex])>=tolerance**2)break;s.pathIndex++;}
  if(s.pathIndex<s.path.length)move.copy(s.path[s.pathIndex]).sub(actor.position).setY(0).normalize();
  if(engaging&&!s.cover){
   const delta=s.lastSeen.clone().sub(actor.position).setY(0),d=delta.length();delta.normalize();
   if(now>s.nextStrafe){s.strafeSign=rng(s)>.5?1:-1;s.strafeUntil=now+.5+rng(s)*.4;s.nextStrafe=s.strafeUntil+1.5+rng(s)*1.6;}
   const steady=s.role==='marksman'||s.role==='anchor';
   if(s.intent==='engage'){
    // Each bot takes a short, committed sidestep, then settles to fire.
    // Independent cadence avoids a whole crew dancing to the same clock.
    const stride=now<s.strafeUntil;
    if((stride&&!steady)||s.friendBlockedUntil>now)move.add(V(delta.z,0,-delta.x).multiplyScalar(s.strafeSign*.7));
    if(d<6||reloading)move.addScaledVector(delta,-.65);
   }
  }
  const followingPath=s.pathIndex<s.path.length;
  for(const other of game.actors){
   if(other===actor||!living(other))continue;
   const d=distance(actor.position,other.position),friend=other.team===actor.team;
   const radius=friend?(followingPath?1.25:2.5):.8;
   if(d>.01&&d<radius){
    // Navigation wins inside narrow doorways; wider idle separation prevents
    // a row of shooters sharing the exact same firing position.
    const strength=followingPath?.5:1.1;
    move.addScaledVector(actor.position.clone().sub(other.position).setY(0).normalize(),(1-d/radius)*strength);
   }
  }
  if(move.lengthSq()>1)move.normalize();
  const travelling=move.lengthSq()>.1&&!engaging&&!reloading;
  const stamina=Number.isFinite(actor.stamina)?actor.stamina:100;
  const sprintAllowed=travelling&&distance(actor.position,s.goal||actor.position)>13&&s.role!=='anchor';
  if(!sprintAllowed||stamina<18)s.sprintActive=false;
  else if(stamina>48)s.sprintActive=true;
  actor.sprinting=s.sprintActive;
  actor.stamina=clamp(stamina+dt*(actor.sprinting?-15:10),0,100);
  if(s.cover&&s.coverReachedAt===null&&distance(actor.position,s.cover)<1.1){
   s.coverReachedAt=now;s.coverUntil=now+Math.max(1.5,(actor.reloadUntil||0)-now+.25);s.nextCover=s.coverUntil+2;
  }
  const crouch=!!s.cover&&distance(actor.position,s.cover)<1.5||engaging&&s.role==='marksman'&&!followingPath;
  const speed=crouch?2.2:engaging?reloading?4.4:3.1:actor.sprinting?6.4:ROLE[s.role].speed;
  move.multiplyScalar(speed);
  let jump=false;
  if(now>=s.moveCheckAt){
   const travelled=distance(actor.position,s.checkPosition);
   if(move.lengthSq()>2&&travelled<.35)s.stuckFor+=.9;else s.stuckFor=0;
   s.checkPosition.copy(actor.position);s.moveCheckAt=now+.9;
   if(s.stuckFor>=.9){s.strafeSign*=-1;s.nextPath=now;}
   if(s.stuckFor>=1.8&&now-s.jumpAt>3){jump=true;s.jumpAt=now;}
   if(s.stuckFor>=2.7){s.recoveries++;s.stuckFor=0;s.path.length=0;s.assignmentKey='';s.nextGoal=now;s.nextPath=now;s.blockedUntil=now+.55;}
  }
  if(now<s.blockedUntil)move.set(Math.cos(actor.yaw||0)*s.strafeSign*3,0,-Math.sin(actor.yaw||0)*s.strafeSign*3);
  this.physics.move(actor,move,dt,{jump,crouch,acceleration:engaging?21:28,braking:32});
  if(engaging){
   const targetPoint=chest(s.target);s.aimPoint.lerp(targetPoint,1-Math.exp(-dt*7));
   const direction=s.aimPoint.clone().sub(eye(actor)).normalize();this.face(actor,direction,dt,7.5);
   const d=distance(actor.position,s.target.position);actor.ads=actor.aiming=d>11&&!reloading;
   const error=Math.abs(wrap(Math.atan2(-direction.x,-direction.z)-(actor.yaw||0)));
   if(now>=s.reactAt&&now>=s.burstPauseUntil&&!reloading&&actor.ammo>0&&error<.18){
    if(this.los(game,eye(actor),targetPoint))this.fire(actor,s,game,now,direction,d);
    else{s.visible=false;s.nextThink=Math.min(s.nextThink,now+.05);}
   }
  }else if(move.lengthSq()>.1){actor.ads=actor.aiming=false;this.face(actor,move.clone().normalize(),dt,5.5);}
  else{
   actor.ads=actor.aiming=false;
   const scan=(s.seed%628)/100+Math.sin(now*.42+s.scanPhase)*.9;
   this.face(actor,V(-Math.sin(scan),0,-Math.cos(scan)),dt,1.15);
  }
  if(!engaging&&s.goal&&distance(actor.position,s.goal)<1.2&&now<s.nextGoal&&!game.tactical)s.nextGoal=now;
 }

 face(actor,direction,dt,speed){
  const yaw=Math.atan2(-direction.x,-direction.z),turnLimit=Math.max(1.8,speed*.7)*dt;
  actor.yaw=(actor.yaw||0)+clamp(wrap(yaw-(actor.yaw||0))*Math.min(1,dt*speed),-turnLimit,turnLimit);
  const pitch=Math.atan2(direction.y,Math.hypot(direction.x,direction.z));
  actor.pitch=(actor.pitch||0)+(pitch-(actor.pitch||0))*Math.min(1,dt*speed);
 }

 fire(actor,s,game,now,direction,d){
  if((actor.nextShotAt||0)>now||!game.requestFire||(s.target?.protectedUntil||0)>now)return;
  const kind=weaponKind(actor.weaponId),weapon=game.weapons?.[actor.weaponId],range=weapon?.range||{shotgun:30,precision:160,smg:55,pistol:65,rifle:125}[kind];
  if(d>Math.min(range,kind==='shotgun'?18:kind==='smg'?43:range))return;
  const origin=eye(actor);
  for(const friend of game.actors){
   if(friend===actor||friend.team!==actor.team||!living(friend))continue;
   const toFriend=chest(friend).sub(origin),along=toFriend.dot(direction);
   if(along>.1&&along<d-.4&&toFriend.lengthSq()-along*along<.47**2){
    s.friendBlockedUntil=now+.6;return;
   }
  }
  const difficulty=game.settings?.difficulty||'standard',accuracy=['relaxed','easy'].includes(difficulty)?1.65:['veteran','hard'].includes(difficulty)?.75:1;
  if(now>=s.nextAimError){
   const spread=(kind==='precision'?.011:.017)*accuracy*(1.2-s.discipline*.25)+Math.min(.012,d*.00012)+(actor.suppression||0)*.012;
   s.aimError.set((rng(s)-.5)*spread*2,(rng(s)-.5)*spread*1.6,(rng(s)-.5)*spread*2);s.nextAimError=now+.22+rng(s)*.15;
  }
  const shot=direction.clone().add(s.aimError).normalize(),before=actor.ammo;
  if(game.requestFire(actor,shot)===true||actor.ammo<before){
   s.burst++;const count=kind==='smg'?5:kind==='rifle'?3:1;
   if(s.burst>=count){s.burst=0;s.burstPauseUntil=now+(kind==='precision'?.9:kind==='shotgun'?.65:kind==='pistol'?.23:.22)+rng(s)*.23;}
  }
 }

 radio(game,s,actor,line){if(s.announced.has(line))return;s.announced.add(line);game.issueRadio?.(line,actor);}
 publish(actor,s){actor.botState={role:s.role,intent:s.intent,sector:this.sectors[s.sector]?.id,targetId:s.visible?s.target?.id??null:null,visibleTarget:s.visible,objectiveId:s.objectiveId,responding:s.responding,interacting:s.interacting,waypoints:Math.max(0,s.path.length-s.pathIndex),recoveries:s.recoveries};}
}
