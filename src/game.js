import * as THREE from 'three';
import {createTown} from './map.js';
import {PhysicsWorld} from './physics.js';
import {WEAPONS,WEAPON_BY_ID,createWeaponView,AudioEngine,Effects} from './combat.js';
import {GameUI} from './ui.js';
import {BotDirector} from './bots.js';
import {MatchRules} from './match.js';
import {MatchIntro,INTRO_TIMING} from './match-intro.js';
import {GameInputState,isShortcutEvent,isGameWheel} from './input-state.js';
import {PointerCapture} from './pointer-capture.js';
import {FACTIONS,ROLES} from './factions.js';
import {shotSpread,spreadPixels,aimedRelation} from './aim-feedback.js';
import {ROLE_LOADOUTS} from './artist-loadout.js';
import {ArtistSprays} from './sprays.js';
import {getArtistTag} from './art-tags.js';
import {getArtistTaunt} from './artist-taunts.js';
import {beginTaunt,cancelTaunt,isTaunting,canTaunt} from './taunt-system.js';
import {tauntCameraPose,defeatFocusPose} from './taunt-camera.js';
import {createActorModel} from './actors.js';
import {bodyProfile} from './actor-profile.js';
import {actorPose,bodyPoint,intersectActorBody} from './actor-body.js';
import {UtilitySystem} from './utility.js';
import {initEquipment,equip,stashMagazine,absorbDamage} from './loadout.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const teamColors=FACTIONS.map(f=>new THREE.Color(f.color).getHex());
const teamName=t=>FACTIONS[t]?.shortName||'Draw';
const diagnosticParams=new URLSearchParams(location.search);
const diagnostic=diagnosticParams.has('test'),allowUnlockedTest=diagnostic&&!diagnosticParams.has('strictControls');
let storedSettings={};try{storedSettings=JSON.parse(localStorage.getItem('vgs-settings')||'{}');}catch{}
const settings={volume:.65,sensitivity:1,graphics:'balanced',difficulty:'standard',...storedSettings};
const town=createTown(),{scene,camera,renderer}=town;
const physics=new PhysicsWorld({ground:town.ground,wallSegments:town.wallSegments,solidMeshes:town.solidMeshes,bounds:{minX:-46,maxX:108,minZ:-48,maxZ:34}});
const director=new BotDirector(physics),view=createWeaponView(camera),audio=new AudioEngine(),effects=new Effects(scene);
effects.setSurfaceQuery?.((x,z,y)=>physics.floorHeight(x,z,y));
const utility=new UtilitySystem(scene,physics,{onDamage:(a,n,source)=>damageActor(a,n,source,false,{kind:'frag',penetration:.45}),onSound:(name,pos)=>audio.action?.(name,pos,false),onBurst:(pos,type,source)=>{if(type==='frag')effects.paintBurst?.(pos,source?.team??0);}});
const sprays=new ArtistSprays(scene,physics);
const intro=new MatchIntro();
const input=new GameInputState();
const actors=[],keys=input.keys,spots=new Map(),pings=[];
let player,rules,config={mode:'tdm',team:0,role:'vanguard',weapon:'rifle'},phase='menu',paused=false,locked=false,awaitingLock=false;
let fireHeld=false,fireLatch=false,ads=false,time=0,worldTime=0,accumulator=0,lastTime=performance.now(),hudTick=0,frame=0,fps=60;
let recoilPitch=0,recoilYaw=0,renderedMetrics={},lastRoundPhase='',lastBeaconState='',shotCount=0,hitCount=0,respawnCount=0,squadOrder=null,orderIndex=0,spotTick=0,radioUntil=0;
let killRecap=null,sprayFeedback='',sprayFeedbackUntil=0;
const CLASH={maxHealth:150,scoreLimit:20,timeLimit:180,respawnDelay:2,protection:2,killHeal:15};
const signatureAttachments=Object.fromEntries(Object.entries(ROLE_LOADOUTS).map(([role,kit])=>[role,kit.attachments]));
const WAYPOINTS=[[-1.65,3.5],[-9.7,6.8],[-12,10],[-14,-4],[-11,-20],[-8,-30],[3,-42],[18,-43],[27,-36],[35,-24],[39,-8],[48,23],[49,4],[59,-12],[69,23],[82,16],[82,-6],[91,1],[16,17]];
const waypoints=WAYPOINTS.map(([x,z])=>V(x,town.ground(x,z),z));
const classicSpawns=[
 [[-12,10],[-9,-23],[15,-43],[37,-20],[50,23],[82,19],[-18,12],[8,14],[62,-17],[88,22]],
 [[-14,-32],[20,-37],[37,-7],[58,14],[81,-8],[6,15],[47,-23],[-30,17],[70,25],[89,-4]],
];
const objectives=[];
const ui=new GameUI({weapons:WEAPONS,settings,onStart:startMatch,onRestart:startMatch,onMenu:showMenu,onPauseChange:setPause,onSettings:applySettings,
 onWeaponSelect:value=>{if(controlsReady())switchWeapon(typeof value==='number'?player?.carriedWeapons[value]:value);}});
const pointerCapture=new PointerCapture({element:renderer.domElement,document,
 canCapture:()=>phase==='playing'&&!paused&&!document.hidden&&document.hasFocus(),
 onChange:(captured,pending)=>{locked=captured;awaitingLock=pending;ui.setPointerLocked(locked);},
 onLost:()=>{if(phase==='playing'&&!paused)setPause(true);}});
applySettings(settings);
const roleWeapon=Object.fromEntries(Object.entries(ROLE_LOADOUTS).map(([role,kit])=>[role,kit.weaponId]));
function newActor(team,i){
 const identity=FACTIONS[team].roster[i],isPlayer=team===config.team&&identity.role===config.role,profile=bodyProfile(identity.look);
 const a={id:team*6+i,name:isPlayer?'You':identity.shortName,artistName:identity.name,identity,team,role:identity.role,personality:identity.personality,isPlayer,
 position:V(),velocity:V(),health:CLASH.maxHealth,maxHealth:CLASH.maxHealth,armor:0,stamina:100,suppression:0,alive:false,kills:0,deaths:0,assists:0,damage:0,objectiveScore:0,credits:3800,
 yaw:0,pitch:0,ammo:0,reserve:0,weaponId:isPlayer?config.weapon:roleWeapon[identity.role],nextShotAt:0,reloadUntil:0,protectedUntil:0,bodyProfile:profile,height:profile.standingHeight,standingHeight:profile.standingHeight,crouchHeight:profile.crouchHeight,radius:profile.radius,grounded:true,
 weapons:{},attachments:{},utility:{smoke:0,frag:0,medkit:0},carriedWeapons:[],damageContributors:new Map(),lastShotAt:-99,lastDamageAt:-99,lastSprintAt:-99,nextSprayAt:0,lastSprayAt:-99,nextBotSprayAt:12+team*3+i*2,sprayUntil:0,tauntStarted:-99,tauntUntil:0,nextTauntAt:0,tauntId:null,burstRemaining:0,healUntil:0,slideUntil:0};
 a.portrait=`assets/portraits/faces/${team}-${a.role}.png`;a.model=createActorModel(scene,{team,color:FACTIONS[team].color,role:a.role,look:identity.look,name:identity.shortName});a.model.setRelation?.(team===config.team);actors.push(a);if(isPlayer)player=a;return a;
}
function chooseSpawn(a,initial=false){
 const pool=classicSpawns[a.team];if(initial){const p=pool[a.id%6];return physics.nearestWalkable(V(p[0],0,p[1]),{radius:a.radius,height:a.standingHeight});}
 const candidates=[];
 for(const base of pool){const p=physics.nearestWalkable(V(base[0]+(Math.random()-.5)*2,0,base[1]+(Math.random()-.5)*2),{radius:a.radius,height:a.standingHeight});let nearestEnemy=80,visible=0,crowd=0,nearestAlly=80;
  for(const other of actors){if(other===a||!other.alive)continue;const d=other.position.distanceTo(p);if(other.team!==a.team){nearestEnemy=Math.min(nearestEnemy,d);if(d<32&&utility.lineOfSight(p.clone().add(V(0,1.5,0)),eye(other)))visible++;}else{nearestAlly=Math.min(nearestAlly,d);if(d<7)crowd+=7-d;}}
  const safe=nearestEnemy>=12&&visible===0;
  const score=-Math.abs(nearestEnemy-23)*.8-Math.max(0,nearestAlly-18)*.3-visible*32-crowd*4+Math.random()*2;
  candidates.push({p,score,safe});
 }
 const safe=candidates.filter(c=>c.safe);return (safe.length?safe:candidates).sort((a,b)=>b.score-a.score)[0].p;
}
function spawn(a,{initial=false,survived=false}={}){
 const weapon=roleWeapon[a.role];initEquipment(a,{mode:'clash',weapon,firstRound:initial,attachments:signatureAttachments[a.role]});
 a.position.copy(chooseSpawn(a,initial));a.position.y=physics.floorHeight(a.position.x,a.position.z);a.velocity.set(0,0,0);a.health=a.maxHealth;a.stamina=100;a.suppression=0;a.cameraHeight=a.bodyProfile.eyeStanding;a.alive=true;a.grounded=true;a.crouched=false;a.height=a.standingHeight;a.reloadUntil=0;a.nextShotAt=time+.3;a.protectedUntil=time+CLASH.protection;a.respawnAt=0;a.healUntil=0;a.slideUntil=0;a.sprayUntil=0;cancelActorTaunt(a);a.lastAttacker=null;a.damageContributors.clear();a.damageHits=new Map();if(a.isPlayer)killRecap=null;a.pitch=0;a.lastDamageAt=time;a.killStreak=0;a.multiFrag=0;a.lastFragAt=-Infinity;a.deathView=null;a.interactingUntil=0;a.sprinting=false;a.sliding=false;
 const goals=waypoints;
 const goal=goals.slice().sort((p,q)=>p.distanceToSquared(a.position)-q.distanceToSquared(a.position)).find(p=>p.distanceTo(a.position)>3);
 if(goal){const next=physics.findPath(a.position,goal,{radius:a.radius+.025,height:a.standingHeight})[0]||goal;a.yaw=Math.atan2(a.position.x-next.x,a.position.z-next.z);}else a.yaw=0;
 a.model.setVisible(!a.isPlayer);if(a.isPlayer){clearInput();recoilPitch=recoilYaw=0;syncView();if(!initial)respawnCount++;}
}
function syncView(){if(!player)return;audio.cancelReload?.();view.equip(player.weaponId);view.setArtist?.(player.identity);view.setAttachments?.(player.attachments[player.weaponId]);view.setVisible(player.alive&&!isTaunting(player,time));camera.fov=74;camera.updateProjectionMatrix();}
function startMatch(next={}){
 intro.cancel();ui.endIntro?.();
 config={team:0,role:'vanguard',...next,mode:'tdm',scoreLimit:CLASH.scoreLimit,timeLimit:CLASH.timeLimit};if(!ROLES.includes(config.role))config.role='vanguard';config.team=config.team===1?1:0;config.weapon=roleWeapon[config.role];applySettings(config.settings||settings);
 actors.forEach(a=>a.model.dispose());actors.length=0;utility.clear();sprays.clear();sprayFeedback='';sprayFeedbackUntil=0;effects.clear?.();spots.clear();pings.length=0;squadOrder=null;
 time=0;shotCount=hitCount=respawnCount=0;phase='playing';paused=false;awaitingLock=false;rules=new MatchRules(config);director.reset();
 for(let t=0;t<2;t++)for(let i=0;i<6;i++)newActor(t,i);
 for(const a of actors)spawn(a,{initial:true});
 rules.update(0,actors);syncView();clearInput({shortcuts:true});killRecap=null;ui.beginMatch(config);audio.unlock();
 if(!(diagnostic&&next.skipIntro===true)){intro.start();ui.beginIntro(config);audio.countdown?.(3);}
 requestLock();updateHUD();lastTime=performance.now();accumulator=0;
}
function advanceIntro(dt){
 if(paused||input.suspended||phase!=='playing')return 0;
 if(!intro.state.running)return dt;
 const before=intro.state,state=intro.advance(dt),gameplayTime=before.active?Math.max(0,dt-Math.max(0,INTRO_TIMING.countdown-before.elapsed)):dt;
 if(state.beat!==before.beat)audio.countdown?.(state.beat);
 if(before.active&&!state.active){clearInput();for(const actor of actors)actor.nextShotAt=0;updateHUD();}
 if(state.running)ui.updateIntro(state);else ui.endIntro();
 return gameplayTime;
}
function simulationReady(){return phase==='playing'&&!paused&&!input.suspended&&!awaitingLock&&(locked||allowUnlockedTest);}
function controlsReady(){return simulationReady()&&!intro.active&&rules?.phase==='playing'&&player?.alive;}
function clearInput(options){input.clear(options);fireHeld=fireLatch=ads=false;audio.cancelReload?.();ui.showScoreboard(false);if(player){player.burstRemaining=0;cancelActorTaunt(player);}}
function releaseLock(){pointerCapture.release();}
function showMenu(){intro.cancel();ui.endIntro?.();phase='menu';paused=false;awaitingLock=false;clearInput();releaseLock();actors.forEach(a=>a.model.setVisible(false));utility.clear();sprays.clear();effects.clear?.();view.setVisible(false);town.setView(1);ui.showMenu();}
function requestLock(){return pointerCapture.request();}
function setPause(value){if(phase!=='playing')return;paused=!!value;clearInput();if(value){releaseLock();ui.showPause();}else{ui.hidePause();audio.unlock();requestLock();}}
function applySettings(next){Object.assign(settings,next);settings.volume=clamp(Number(settings.volume)||0,0,1);settings.sensitivity=clamp(Number(settings.sensitivity)||1,.25,2.5);try{localStorage.setItem('vgs-settings',JSON.stringify(settings));}catch{}audio.setVolume(settings.volume);const q=settings.graphics;town.setQuality(q==='full'?1:q==='performance'?.48:.73);renderer.setPixelRatio(Math.min(devicePixelRatio,q==='full'?1.7:q==='performance'?1:1.25));renderer.setSize(innerWidth,innerHeight);}
function switchWeapon(id){if(intro.active||!player?.alive||phase!=='playing'||paused||!id||player.weaponId===id)return;if(!equip(player,id))return;cancelActorTaunt(player);player.reloadUntil=0;player.healUntil=0;player.sprayUntil=0;player.nextShotAt=time+.28;fireLatch=fireHeld;syncView();audio.action?.('equip',null,true);}
function requestReload(a){if(intro.active)return false;const w=WEAPON_BY_ID[a.weaponId];if(!a.alive||a.reloadUntil>time||a.ammo>=w.magSize||a.reserve<=0||a.healUntil>time)return false;cancelActorTaunt(a);a.sprayUntil=0;a.reloadDuration=a.ammo===0?w.reloadEmptyTime:w.reloadTime;a.reloadUntil=time+a.reloadDuration;a.reloadStarted=time;a.burstRemaining=0;if(a.isPlayer){view.reload(a.reloadDuration,{empty:a.ammo===0});audio.reload(a.reloadDuration,{weapon:w,empty:a.ammo===0});}return true;}
function eye(a){return V().fromArray(bodyPoint(a));}
function aimDirection(a,includeRecoil=false){return V(0,0,-1).applyEuler(new THREE.Euler(a.pitch+(includeRecoil?recoilPitch:0),a.yaw+(includeRecoil?recoilYaw:0),0,'YXZ'));}
function actorRay(origin,dir,a,max){const hit=intersectActorBody(origin,dir,a,max);return hit?{...hit,point:origin.clone().addScaledVector(dir,hit.distance),actor:a}:null;}
function requestFire(a,direction){
 if(intro.active)return false;cancelActorTaunt(a);
 if(!a.alive||rules.phase!=='playing'||a.nextShotAt>time||a.reloadUntil>time||a.healUntil>time)return false;const w=WEAPON_BY_ID[a.weaponId];if(a.ammo<=0){a.nextShotAt=time+.22;requestReload(a);if(a.isPlayer)audio.dry();return false;}
 a.sprayUntil=0;a.ammo--;a.nextShotAt=time+w.fireInterval;a.protectedUntil=0;a.lastShotAt=time;a.recoilIndex=(a.recoilIndex||0);a.noiseUntil=time+(a.attachments[a.weaponId]?.barrel==='suppressor'?.4:1.6);
 const origin=eye(a),aimed=a.isPlayer?ads:a.ads,suppressed=a.attachments[a.weaponId]?.barrel==='suppressor';
 const spread=shotSpread(a,w,aimed);
 let didHit=false,killed=false,headshot=false;
 for(let pellet=0;pellet<w.pellets;pellet++){
  const dir=direction.clone().normalize(),right=V().crossVectors(dir,V(0,1,0)).normalize(),up=V().crossVectors(right,dir).normalize();dir.addScaledVector(right,(Math.random()-.5)*spread*2).addScaledVector(up,(Math.random()-.5)*spread*2).normalize();
  const wall=physics.raycast(origin,dir,w.range);let dist=wall?.distance??w.range,hit=null;for(const other of actors){if(other===a||!other.alive)continue;const h=actorRay(origin,dir,other,dist);if(h){hit=h;dist=h.distance;}}
  const end=origin.clone().addScaledVector(dir,dist);effects.tracer(origin.clone().addScaledVector(dir,.65),end,a.team);
  for(const other of actors){if(!other.alive||other.team===a.team)continue;const rel=eye(other).sub(origin),along=rel.dot(dir);if(along>1&&along<dist&&rel.addScaledVector(dir,-along).length()<1.5)other.suppression=Math.min(1,other.suppression+.10);}
  if(hit){if(hit.actor.team!==a.team&&hit.actor.protectedUntil<=time){const damage=w.damage*(hit.headshot?w.headMultiplier:1)*lerp(1,w.damageFalloff,clamp(dist/w.range,0,1))*(suppressed?.97:1);damageActor(hit.actor,damage,a,hit.headshot,{penetration:w.armorPenetration,kind:a.weaponId,distance:dist});didHit=true;headshot ||=hit.headshot;killed ||= !hit.actor.alive;effects.impact(end,null,true);}else effects.impact(end,null,false);}else if(wall)effects.impact(end,wall.normal,false);
 }
 a.bloom=Math.min(w.maxSpreadBloom||.04,(a.bloom||0)+(w.spreadBloom||.002));
 audio.shot(w,origin,a.isPlayer,{occluded:player&&!a.isPlayer&&!physics.lineOfSight(origin,eye(player)),suppressed,lowAmmo:a.ammo<=3});
 if(!a.isPlayer){effects.muzzle(origin.clone().addScaledVector(direction,.85),a.team);effects.shell?.(origin.clone().add(V(.25,-.15,0)),V(1.7,1.6,.4),w);}
 if(a.isPlayer){shotCount++;view.fire({heat:a.bloom,empty:a.ammo===0,suppressed});const pattern=w.recoilPattern?.[a.recoilIndex%w.recoilPattern.length]||{x:0,y:w.recoil};recoilPitch+=pattern.y*(aimed?.64:1)*(a.crouched?.82:1);recoilYaw+=pattern.x*(aimed?.64:1);if(didHit){hitCount++;ui.showHit({headshot,killed});audio.hit(headshot);}}
 a.recoilIndex++;return true;
}
function damageActor(victim,amount,attacker,headshot=false,meta={}){
 if(intro.active||!victim.alive||victim.protectedUntil>time||rules?.phase!=='playing')return;
 const before=victim.health,{healthDamage}=absorbDamage(victim,amount,meta.penetration??.6,{headshot,bypassArmor:meta.kind==='melee'});victim.health=Math.max(0,before-healthDamage);const actual=before-victim.health;
 cancelActorTaunt(victim);victim.lastAttacker=attacker?.id;victim.lastDamageAt=time;victim.suppression=Math.min(1,victim.suppression+.3);victim.healUntil=0;victim.sprayUntil=0;
 if(attacker&&attacker.team!==victim.team){attacker.damage+=actual;victim.damageHits.set(attacker.id,(victim.damageHits.get(attacker.id)||0)+1);victim.damageContributors.set(attacker.id,{damage:(victim.damageContributors.get(attacker.id)?.damage||0)+actual,time});rules.recordDamage?.(attacker,victim,actual);}
 if(victim.isPlayer){view.cancelSpray?.();audio.hurt();const delta=attacker?attacker.position.clone().sub(victim.position):V();ui.showDamage(Math.atan2(delta.x,delta.z)-victim.yaw);killRecap={killer:attacker?.artistName||attacker?.name||'The blast',portrait:attacker?.portrait,team:attacker?.team,weapon:WEAPON_BY_ID[meta.kind]?.name||meta.kind||'Impact',damage:Math.round(victim.damageContributors.get(attacker?.id)?.damage||actual),hits:victim.damageHits.get(attacker?.id)||1,distance:Math.round(meta.distance||delta.length()),headshot};}
 if(victim.health>0)return;
 victim.alive=false;victim.deaths++;victim.wasAliveAtRoundEnd=false;victim.respawnAt=time+CLASH.respawnDelay;victim.reloadUntil=0;victim.burstRemaining=0;victim.velocity.set(0,0,0);stashMagazine(victim);
 if(attacker&&attacker!==victim){attacker.kills++;rules.recordKill(attacker,victim);attacker.killStreak=(attacker.killStreak||0)+1;attacker.multiFrag=(time-(attacker.lastFragAt??-Infinity)<=4?(attacker.multiFrag||0):0)+1;attacker.lastFragAt=time;const healthGain=attacker.alive?Math.min(CLASH.killHeal,attacker.maxHealth-attacker.health):0;attacker.health+=healthGain;effects.elimination?.(victim.position,attacker.team,{playerKill:attacker.isPlayer,headshot,multi:attacker.multiFrag});sprays.celebrate(victim.position,attacker,time);ui.addKill({killer:attacker.name,victim:victim.name,killerId:attacker.id,victimId:victim.id,killerPortrait:attacker.portrait,victimPortrait:victim.portrait,killerRole:attacker.role,victimRole:victim.role,team:attacker.team,victimTeam:victim.team,weaponId:meta.kind||attacker.weaponId,weapon:meta.kind==='frag'?'Paint burst':meta.kind==='melee'?'Melee':WEAPON_BY_ID[meta.kind||attacker.weaponId]?.name||'Impact',headshot});if(attacker.isPlayer){audio.elimination?.({streak:attacker.killStreak,multi:attacker.multiFrag,headshot});ui.showElimination?.({victim:victim.identity.shortName,portrait:victim.portrait,healthGain,healthMax:attacker.maxHealth,streak:attacker.killStreak,multi:attacker.multiFrag,headshot});}}
 for(const[id,data]of victim.damageContributors){const contributor=actors.find(a=>a.id===id);if(contributor&&contributor!==attacker&&data.damage>=20&&time-data.time<10){contributor.assists++;}}
 if(victim.isPlayer){
  const rotation=new THREE.Euler(victim.pitch+recoilPitch,victim.yaw+recoilYaw,0,'YXZ');
  victim.deathView={position:eye(victim),quaternion:new THREE.Quaternion().setFromEuler(rotation),fov:74,killerId:attacker?.id,killerDeaths:attacker?.deaths};
  if(attacker?.alive&&!attacker.isPlayer&&attacker.team!==victim.team&&canTaunt({...attacker,crouched:false,sprinting:false,sliding:false,slideUntil:0},time)&&physics.canOccupy(attacker.position,attacker.radius,attacker.standingHeight)){
   attacker.crouched=attacker.sprinting=attacker.sliding=false;attacker.slideUntil=0;attacker.height=attacker.standingHeight;beginTaunt(attacker,time);
  }
  clearInput();view.setVisible(false);ui.showKillRecap?.(killRecap);
 }
}
const TAUNT_CANCEL_KEYS=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','ControlLeft','ControlRight','ShiftLeft','ShiftRight'];
function cancelActorTaunt(a){
 if(!a)return;const active=cancelTaunt(a);
 if(Number.isFinite(a.tauntAimPitch)){a.pitch=a.tauntAimPitch;delete a.tauntAimPitch;}
 a.tauntView=null;
 if(active&&a.isPlayer){a.model.setVisible(false);view.setVisible(a.alive&&phase==='playing');ui.setTaunting?.(false);}
}
function requestTaunt(){
 if(intro.active||!player?.alive||phase!=='playing'||rules.phase!=='playing'||paused)return false;
 if(isTaunting(player,time)){cancelActorTaunt(player);updateHUD();return true;}
 if(fireHeld||ads||TAUNT_CANCEL_KEYS.some(key=>keys.has(key))||!canTaunt(player,time))return false;
 const pose=tauntCameraPose(player,physics,{aspect:camera.aspect,near:camera.near});if(!pose)return false;
 const pitch=player.pitch,result=beginTaunt(player,time);if(!result.ok)return false;
 player.tauntAimPitch=pitch;player.tauntView=pose;ads=false;recoilPitch=recoilYaw=0;view.cancelActions?.();view.setVisible(false);updateHUD();return true;
}
function respawnsEnabled(){return true;}
function requestUtility(a,type,target){if(intro.active)return false;cancelActorTaunt(a);if(!a.alive||rules.phase!=='playing'||a.reloadUntil>time||a.healUntil>time)return false;const success=utility.throw(a,type,target,time);if(success){a.sprayUntil=0;a.protectedUntil=0;a.lastUtilityAt=time;if(a.isPlayer)view.action?.('throw');}return success;}
function requestSpray(a=player,direction){
 if(intro.active||!a?.alive||phase!=='playing'||rules.phase!=='playing'||paused||a.reloadUntil>time||a.healUntil>time||a.sprinting)return false;
 cancelActorTaunt(a);const result=sprays.place(a,eye(a),direction||aimDirection(a),time);
 if(!result.ok){if(a.isPlayer&&result.reason==='wall'){sprayFeedback='Aim at a nearby wall';sprayFeedbackUntil=time+1.2;ui.showToast(sprayFeedback,1200);}return false;}
 a.protectedUntil=0;a.nextShotAt=Math.max(a.nextShotAt,time+.20);a.sprayUntil=time+.55;a.noiseUntil=time+.6;
 audio.action?.('spray',a.isPlayer?null:eye(a),a.isPlayer);
 if(a.isPlayer){ads=false;view.action?.('spray');sprayFeedback='';sprayFeedbackUntil=0;ui.showSprayFeedback?.(getArtistTag(a));}
 return true;
}
function botStreetArt(){
 for(const a of actors){
  if(a.isPlayer||!a.alive||time<a.nextBotSprayAt)continue;a.nextBotSprayAt=time+13+(a.id%5)*2;
  if(a.botState?.targetId!=null||time-a.lastDamageAt<6||time-a.lastShotAt<6||Math.hypot(a.velocity.x,a.velocity.z)>.9||a.reloadUntil>time)continue;
  const origin=eye(a);
  for(const offset of[0,.75,-.75,1.5,-1.5,Math.PI]){const yaw=a.yaw+offset,dir=V(-Math.sin(yaw),0,-Math.cos(yaw));if(!sprays.surface(origin,dir))continue;if(requestSpray(a,dir)){a.yaw=yaw;break;}}
 }
}
function melee(){if(intro.active||!player?.alive||rules.phase!=='playing'||player.nextShotAt>time||player.reloadUntil>time||player.healUntil>time)return;cancelActorTaunt(player);player.sprayUntil=0;player.nextShotAt=time+.75;player.protectedUntil=0;player.healUntil=0;view.action?.('melee');audio.action?.('melee',null,true);const dir=aimDirection(player),origin=eye(player);let target=null,dist=2.25;for(const other of actors){if(other.team===player.team||!other.alive)continue;const delta=eye(other).sub(origin),d=delta.length();if(d<dist&&delta.normalize().dot(dir)>.7&&utility.lineOfSight(origin,eye(other))){target=other;dist=d;}}if(target){damageActor(target,48,player,false,{kind:'melee',distance:dist});ui.showHit({killed:!target.alive});}}
function startHealing(){if(intro.active||!player?.alive||rules.phase!=='playing'||player.health>=player.maxHealth||!player.utility.medkit||player.healUntil>time)return;cancelActorTaunt(player);player.sprayUntil=0;player.healUntil=time+2.6;player.healStarted=time;player.healPosition=player.position.clone();player.reloadUntil=0;audio.cancelReload?.();view.cancelActions?.();player.burstRemaining=0;}
function updatePlayer(dt){
 if(!player?.alive||rules.phase!=='playing')return;
 if(isTaunting(player,time)){
  if(fireHeld||ads||TAUNT_CANCEL_KEYS.some(key=>keys.has(key)))cancelActorTaunt(player);
  else{physics.move(player,V(),dt,{braking:100,crouch:false});return;}
 }
 const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 if(keys.has('ArrowLeft'))player.yaw+=dt*1.65;if(keys.has('ArrowRight'))player.yaw-=dt*1.65;
 const crouchInput=keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('KeyC'),shift=keys.has('ShiftLeft')||keys.has('ShiftRight');
 // Releasing the key under a low ceiling still leaves a crouched body. Use
 // the same clearance as physics before selecting speed and sprint posture.
 const crouch=crouchInput||(player.crouched&&!physics.canOccupy(player.position,player.radius,player.standingHeight));
 const sprint=shift&&!crouch&&!ads&&forward>0&&player.stamina>(player.sprinting?1:18)&&player.healUntil<=time;
 if(ads||sprint){player.sprayUntil=0;view.cancelSpray?.();}
 if(sprint){player.stamina=Math.max(0,player.stamina-dt*16);player.lastSprintAt=time;}else if(time-player.lastSprintAt>.75)player.stamina=Math.min(100,player.stamina+dt*13);
 if(crouchInput&&shift&&player.grounded&&Math.hypot(player.velocity.x,player.velocity.z)>5.1&&time>(player.nextSlideAt||0)){player.slideUntil=time+.62;player.nextSlideAt=time+1.4;player.slideDirection=V(player.velocity.x,0,player.velocity.z).normalize();player.stamina=Math.max(0,player.stamina-12);}
 const sliding=player.slideUntil>time,w=WEAPON_BY_ID[player.weaponId],speed=(sliding?7.8:crouch?2.15:ads?2.8:sprint?7.1:4.5)*w.speedMultiplier*(player.armor>0?.98:1);
 const desired=sliding?player.slideDirection.clone().multiplyScalar(speed*(.6+.4*(player.slideUntil-time)/.62)):V(-Math.sin(player.yaw)*forward+Math.cos(player.yaw)*side,0,-Math.cos(player.yaw)*forward-Math.sin(player.yaw)*side).normalize().multiplyScalar(speed);
 const wasGrounded=player.grounded;physics.move(player,desired,dt,{jump:keys.has('Space')&&!sliding,crouch:crouch||sliding,acceleration:34,braking:39,gravity:22,jumpSpeed:7});if(!wasGrounded&&player.grounded)audio.land();const eyeY=actorPose(player).eye[1];player.cameraHeight=lerp(player.cameraHeight??eyeY,eyeY,1-Math.exp(-dt*18));if(!physics.canOccupy(player.position,.14,player.cameraHeight+.1))player.cameraHeight=eyeY;player.sprinting=sprint;player.sliding=sliding;player.lean=lerp(player.lean||0,-side*.03,Math.min(1,dt*9));
 if(player.healUntil>time){if(!keys.has('KeyH')||player.position.distanceTo(player.healPosition)>.3||fireHeld)player.healUntil=0;}
 else if(player.healUntil){player.health=Math.min(player.maxHealth,player.health+45);player.utility.medkit--;player.healUntil=0;audio.action?.('heal',null,true);}
 if(sprint||sliding)player.burstRemaining=0;
 if(fireHeld&&!sprint&&!sliding&&player.healUntil<=time){
  const mode=player.fireMode;
  if(mode==='burst'&&!fireLatch){player.burstRemaining=w.burstCount||3;fireLatch=true;}
  if(mode==='auto'||(mode==='semi'&&!fireLatch)){if(requestFire(player,aimDirection(player,true)))fireLatch=true;}
 }
 if(player.burstRemaining>0&&!sprint&&!sliding&&time>=player.nextShotAt){if(requestFire(player,aimDirection(player,true))){player.burstRemaining--;if(player.burstRemaining===0)player.nextShotAt=time+(w.burstDelay||.22);}else if(player.ammo===0||player.reloadUntil>time)player.burstRemaining=0;}
}
function separateActors(){for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j];if(!a.alive||!b.alive||Math.abs(a.position.y-b.position.y)>1.5)continue;const delta=a.position.clone().sub(b.position).setY(0),d=delta.length();const spacing=a.radius+b.radius+.02;if(d>.01&&d<spacing){delta.multiplyScalar((spacing-d)*.5/d);physics.displace(a,delta);physics.displace(b,delta.multiplyScalar(-1));}}}
const game={settings,requestSpray,weapons:Object.fromEntries(WEAPONS.map(w=>[w.id,{...w,magazine:w.magSize}])),get actors(){return actors;},get player(){return player;},mode:'tdm',objectives:[],get time(){return time;},requestFire,requestReload,requestUtility,requestInteract:()=>false,issueRadio:()=>{},getLOS:(a,b)=>utility.lineOfSight(a,b),waypoints,botWaypoints:waypoints,squadOrder:null,tactical:null};
function updateSimulation(dt){
 if(intro.active)return;time+=dt;
 for(const a of actors){
  if(a.tauntId&&time>=a.tauntUntil)cancelActorTaunt(a);
  const w=WEAPON_BY_ID[a.weaponId];a.bloom=Math.max(0,(a.bloom||0)-dt*(w.spreadRecovery||.025));a.suppression=Math.max(0,a.suppression-dt*.3);if(time-a.lastShotAt>.42)a.recoilIndex=0;
  if(a.alive&&a.reloadUntil&&time>=a.reloadUntil){const n=Math.min(w.magSize-a.ammo,a.reserve);a.ammo+=n;a.reserve-=n;a.reloadUntil=0;}
  if(a.alive&&a.health<a.maxHealth&&time-a.lastDamageAt>4.5)a.health=Math.min(a.maxHealth,a.health+dt*10);
  if(!a.alive&&time>=a.respawnAt&&rules.phase==='playing')spawn(a);
  const speed=Math.hypot(a.velocity.x,a.velocity.z);if(a.alive&&a.grounded&&speed>1&&time>(a.footstepAt||0)&&(!player||a.position.distanceTo(player.position)<26)){audio.footstep(a.isPlayer?null:a.position,a.sprinting);a.footstepAt=time+(a.crouched?.66:a.sprinting?.30:.43);a.noiseUntil=a.crouched?0:time+.35;}
 }
 if(rules.phase==='playing'){if(!awaitingLock||diagnostic)updatePlayer(dt);director.update(dt,game);separateActors();utility.update(dt,time,actors);botStreetArt();sprays.update(time);}
 rules.update(dt,actors);if(rules.phase==='ended')finishMatch();
 spotTick+=dt;if(spotTick>.25){spotTick=0;updateSpots();}
}
function finishMatch(){if(phase==='results')return;phase='results';paused=false;clearInput();releaseLock();view.setVisible(false);audio.end(rules.winner===player.team);ui.showResults({winner:rules.winner,playerTeam:player.team,scores:rules.scores,mode:config.mode,actors,player,reason:rules.roundHistory?.at(-1)?.reason||'Match complete',duration:time,roundHistory:rules.roundHistory||[],mvp:rules.mvp});updateHUD();}
function updateSpots(){if(!player)return;for(const enemy of actors){if(enemy.team===player.team||!enemy.alive)continue;let observed=false;for(const ally of actors){if(!ally.alive||ally.team!==player.team)continue;const d=ally.position.distanceTo(enemy.position);if(d<46&&utility.lineOfSight(eye(ally),eye(enemy))){const facing=aimDirection(ally),delta=enemy.position.clone().sub(ally.position).normalize();if(d<10||facing.dot(delta)>.25){observed=true;break;}}}if(observed)spots.set(enemy.id,{x:enemy.position.x,z:enemy.position.z,time});}for(const[id,spot]of spots)if(time-spot.time>3.5)spots.delete(id);}
function renderActors(dt){
 const labels=[],direction=camera.getWorldDirection(V());
 for(const a of actors){
  a.model.setVisible(phase!=='menu'&&(!a.isPlayer||isTaunting(a,time)));a.model.update(dt,a,time,camera);
  let visible=false,focused=false,facing=-1,distance=Infinity;
  if(player?.alive&&a.alive&&!a.isPlayer){
   const delta=eye(a).sub(camera.position);distance=delta.length();facing=direction.dot(delta.normalize());
   visible=distance<54&&facing>.2&&utility.lineOfSight(camera.position,eye(a));
   // A wider release cone keeps a moving artist's name from blinking at the aim boundary.
   focused=visible&&distance<(a.nameplateFocused?40:34)&&facing>(a.nameplateFocused?.985:.995);
  }
  a.nameplateFocused=focused;
  const label={actor:a,visible,focused,facing,distance,presented:false};
  if(focused){
   const point=a.position.clone();point.y+=a.model.state.pose.height;point.project(camera);
   const data=a.model.marker.userData.nameplate,scale=clamp(innerHeight/420,.8,1),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2-8*scale;
   label.bounds={left:x-data.logicalWidth*scale/2-4,right:x+data.logicalWidth*scale/2+4,top:y-data.logicalHeight*scale-4,bottom:y+4};
  }
  labels.push(label);
 }
 // Keep nearby names from stacking. A small preference for the current label
 // prevents two crossing artists from exchanging nameplates every frame.
 const occupied=[];
 for(const label of labels.filter(l=>l.focused).sort((a,b)=>(1-a.facing-(a.actor.nameplatePresented?.003:0))-(1-b.facing-(b.actor.nameplatePresented?.003:0))||a.distance-b.distance)){
  const r=label.bounds;
  if(occupied.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top))continue;
  label.presented=true;occupied.push(r);
 }
 for(const {actor:a,visible,presented} of labels){
  a.nameplatePresented=presented;
  a.model.setIndicator?.({visible,focused:presented});
  a.model.updateNameplate?.({camera,viewportHeight:innerHeight,visible,focused:presented,dt});
 }
}
function updateCamera(dt){
 if(phase==='menu'||!player)return;
 if(!player.alive&&player.deathView){
  const death=player.deathView,killer=actors.find(a=>a.id===death.killerId&&a.deaths===death.killerDeaths);
  const focus=isTaunting(killer,time)?defeatFocusPose(death.position,killer,camera.aspect,(a,b)=>utility.lineOfSight(a,b)):null;
  camera.position.copy(death.position);
  if(focus){const look=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(death.position,focus.target,V(0,1,0)));camera.quaternion.slerp(look,1-Math.exp(-dt*12));camera.fov=lerp(camera.fov,focus.fov,1-Math.exp(-dt*10));death.focused=true;}
  else if(!death.focused){camera.quaternion.copy(death.quaternion);camera.fov=death.fov;}
  camera.updateProjectionMatrix();audio.setListener(camera.position,camera.getWorldDirection(V()));return;
 }
 if(isTaunting(player,time)&&player.tauntView){
  const pose=player.tauntView;camera.position.copy(pose.position);camera.lookAt(pose.target);camera.fov=pose.fov;camera.updateProjectionMatrix();audio.setListener(camera.position,camera.getWorldDirection(V()));return;
 }
 camera.position.copy(eye(player));
 camera.rotation.set(player.pitch+recoilPitch,player.yaw+recoilYaw,player.lean||0,'YXZ');
 const att=player.attachments[player.weaponId]||{},zoom=att.optic==='scope'?31:WEAPON_BY_ID[player.weaponId].zoomFov,targetFov=ads&&player.alive&&player.reloadUntil<=time&&!view.handling.inspecting&&!player.sprinting?zoom:player.sprinting?79:74;camera.fov=lerp(camera.fov,targetFov,1-Math.exp(-dt*13));camera.updateProjectionMatrix();
 recoilPitch*=Math.exp(-dt*8);recoilYaw*=Math.exp(-dt*8);audio.setListener(camera.position,camera.getWorldDirection(V()));
}
function updateHUD(){
 if(!player||!rules)return;const w=WEAPON_BY_ID[player.weaponId],origin=eye(player),direction=aimDirection(player,true);
 const taunting=isTaunting(player,time),taunt=getArtistTaunt(player),active=phase==='playing'&&player.alive&&!taunting,spread=spreadPixels(shotSpread(player,w,ads),innerHeight,camera.fov);
 const aimTarget=active?aimedRelation(origin,direction,player,actors,physics,(a,b)=>utility.lineOfSight(a,b),w.range):null;
 const canPlace=active&&player.reloadUntil<=time&&player.healUntil<=time&&!player.sprinting&&sprays.canPlace(origin,aimDirection(player));
 ui.update({phase,paused,ads,spread,aimTarget,scoped:view.scoped,taunt:{active:taunting,name:taunt.name,readyIn:Math.max(0,(player.nextTauntAt||0)-time),available:phase==='playing'&&canTaunt(player,time)&&!fireHeld&&!ads&&!TAUNT_CANCEL_KEYS.some(key=>keys.has(key))},spray:{canPlace,readyIn:Math.max(0,(player.nextSprayAt||0)-time),feedback:time<sprayFeedbackUntil?sprayFeedback:''},mode:'tdm',player:{...player,utilityCooldowns:{smoke:Math.max(0,(player.utilityReadyAt||0)-time),frag:Math.max(0,(player.utilityReadyAt||0)-time)},weapon:{id:w.id,name:w.name,ammo:player.ammo,reserve:player.reserve,reloading:player.reloadUntil>time,reloadProgress:player.reloadUntil>time?1-(player.reloadUntil-time)/player.reloadDuration:0,fireMode:player.fireMode,attachments:player.attachments[player.weaponId]}},scores:rules.scores,timeRemaining:rules.timeRemaining,scoreLimit:CLASH.scoreLimit,actors,respawnIn:player.alive?0:Math.max(0,player.respawnAt-time),protected:player.protectedUntil>time,healing:player.healUntil>time?1-(player.healUntil-time)/2.6:null,smokeObscurity:utility.obscurity(camera.position),
 radar:{bounds:physics.bounds,walls:town.wallSegments,markers:actors.filter(a=>a.team===player.team||spots.has(a.id)).map(a=>({id:a.id,x:a.team===player.team?a.position.x:spots.get(a.id).x,z:a.team===player.team?a.position.z:spots.get(a.id).z,team:a.team,alive:a.alive,isPlayer:a.isPlayer,observed:a.team===player.team||spots.has(a.id),role:a.role})),objectives:[],yaw:player.yaw,pings:[]}});
}
function tick(now){
 requestAnimationFrame(tick);if(document.hidden){lastTime=now;return;}if(now-lastTime<16.3)return;const elapsed=Math.min(.1,(now-lastTime)/1000);lastTime=now;worldTime+=elapsed;fps=lerp(fps,1/Math.max(.001,elapsed),.04);
 const gameplayElapsed=advanceIntro(elapsed);let simulatedElapsed=0;
 if(simulationReady()&&!intro.active){accumulator+=gameplayElapsed;let steps=0;while(simulationReady()&&accumulator>=1/60&&steps++<6){updateSimulation(1/60);accumulator-=1/60;simulatedElapsed+=1/60;}}else accumulator=0;
 updateCamera(elapsed);town.update(worldTime);renderActors(elapsed);effects.update(elapsed);
 if(player)view.update(simulatedElapsed,{time:worldTime,speed:Math.hypot(player.velocity.x,player.velocity.z),grounded:player.grounded,ads,crouch:player.crouched,sprint:player.sprinting,aimPitch:player.pitch,lean:player.lean,suppression:player.suppression,shotHeat:player.bloom});
 ui.setScoped?.(view.scoped&&!isTaunting(player,time));
 renderer.render(scene,camera);renderedMetrics=town.metrics();if(phase==='playing'&&player?.alive&&!isTaunting(player,time))view.render(renderer);
 hudTick+=elapsed;if(hudTick>.09){hudTick=0;updateHUD();}frame++;
 if(frame===1)ui.ready();
 if(frame%20===0)renderer.domElement.dataset.gameState=JSON.stringify({phase,paused,locked,awaitingLock,inputSuspended:input.suspended,focused:document.hasFocus(),captureError:pointerCapture.lastError||'',rulePhase:rules?.phase,mode:config.mode,time,round:rules?.round,scores:rules?.scores,player:player&&{position:player.position.toArray(),yaw:player.yaw,pitch:player.pitch,alive:player.alive,health:player.health,maxHealth:player.maxHealth,standingHeight:player.standingHeight,height:player.height,armor:player.armor,ammo:player.ammo,weapon:player.weaponId}});
}
const GAME_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyC','Space','Tab','KeyR','KeyB','KeyJ','KeyT','KeyI','KeyQ','KeyG','KeyH','KeyV','Digit1','Digit2']);
window.addEventListener('keydown',e=>{
 // Command/Option belong to the system. Suspend immediately, even if the OS
 // never sends keyup for a movement key used in the shortcut.
 if(isShortcutEvent(e)||input.suspended){input.keyDown(e);clearInput();return;}
 if(e.defaultPrevented||e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
 if(e.code==='Escape'){if(!e.repeat&&phase==='playing'&&!paused){e.preventDefault();setPause(true);}return;}
 if(e.code==='Tab'&&phase==='playing'&&!paused){e.preventDefault();if(input.keyDown(e)&&!intro.active)ui.showScoreboard(true);return;}
 if(!controlsReady()||!GAME_KEYS.has(e.code)||e.target.closest?.('button,a,dialog,[role="dialog"]'))return;
 e.preventDefault();if(!input.keyDown(e))return;
 if(e.repeat)return;
 if(['KeyR','KeyH','KeyQ','KeyG','KeyV','KeyT','KeyI','Digit1','Digit2'].includes(e.code))cancelActorTaunt(player);
 if(e.code==='KeyR')requestReload(player);
 if(e.code==='Digit1'||e.code==='Digit2')switchWeapon(player.carriedWeapons[Number(e.code.slice(-1))-1]);
 if(e.code==='KeyB'){const modes=WEAPON_BY_ID[player.weaponId].fireModes;player.fireMode=modes[(modes.indexOf(player.fireMode)+1)%modes.length];player.burstRemaining=0;audio.action?.('selector',null,true);}
 if(e.code==='KeyJ')requestTaunt();if(e.code==='KeyT')requestSpray();if(e.code==='KeyI'){cancelActorTaunt(player);view.inspect?.();}if(e.code==='KeyQ')requestUtility(player,'smoke');if(e.code==='KeyG')requestUtility(player,'frag');if(e.code==='KeyH')startHealing();if(e.code==='KeyV')melee();
});
window.addEventListener('keyup',e=>{input.keyUp(e);if(e.code==='Tab')ui.showScoreboard(false);});
function pauseForFocusLoss(){clearInput({shortcuts:true});if(phase==='playing'&&!paused)setPause(true);else releaseLock();}
window.addEventListener('blur',pauseForFocusLoss);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForFocusLoss();});
document.addEventListener('pointerlockchange',()=>pointerCapture.handleChange());
document.addEventListener('pointerlockerror',()=>pointerCapture.handleError());
document.addEventListener('mousemove',e=>{
 if(isShortcutEvent(e)){input.keyDown(e);clearInput();return;}
 // The countdown freezes simulation, not the player's view. Canvas-only hover
 // also permits looking before browsers finish granting pointer capture.
 const countdownLook=intro.active&&e.target===renderer.domElement;
 if((locked||countdownLook)&&phase==='playing'&&!paused&&!input.suspended&&player?.alive&&rules.phase==='playing'&&!isTaunting(player,time)){
  player.yaw-=(e.movementX||0)*.0022*settings.sensitivity;
  player.pitch=clamp(player.pitch-(e.movementY||0)*.0022*settings.sensitivity*(ads?.58:1),-1.48,1.48);
 }
});
renderer.domElement.addEventListener('mousedown',e=>{
 if(isShortcutEvent(e)||input.suspended){input.keyDown(e);clearInput();return;}
 if(phase!=='playing'||paused||rules.phase!=='playing'||![0,2].includes(e.button))return;
 // Recapture must remain possible during the short respawn; it never fires.
 if(!locked){requestLock();return;}if(!controlsReady())return;
 e.preventDefault();cancelActorTaunt(player);if(e.button===0){fireHeld=true;fireLatch=false;player.healUntil=0;}if(e.button===2)ads=true;audio.unlock();
});
window.addEventListener('mouseup',e=>{if(e.button===0){fireHeld=false;fireLatch=false;}if(e.button===2)ads=false;});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{
 if(phase!=='playing'||paused)return;e.preventDefault();
 if(!controlsReady()||!isGameWheel(e))return;
 const ids=player.carriedWeapons,i=ids.indexOf(player.weaponId);switchWeapon(ids[(i+(e.deltaY>0?1:ids.length-1))%ids.length]);
},{passive:false});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
function diagnosticState(){return{version:'8.1.1',intro:intro.state,ready:ui.isReady,phase,paused,locked,awaitingLock,inputSuspended:input.suspended,mode:config.mode,time,scores:rules?.scores,rulePhase:rules?.phase,round:rules?.round,timeRemaining:rules?.timeRemaining,fps:Math.round(fps),player:player&&{id:player.id,position:player.position.toArray(),health:player.health,maxHealth:player.maxHealth,standingHeight:player.standingHeight,height:player.height,armor:player.armor,stamina:player.stamina,alive:player.alive,ammo:player.ammo,reserve:player.reserve,weapon:player.weaponId,fireMode:player.fireMode,credits:player.credits,utility:player.utility,kills:player.kills,deaths:player.deaths,grounded:player.grounded,crouched:player.crouched,taunting:isTaunting(player,time),taunt:getArtistTaunt(player).name,tauntReadyIn:Math.max(0,(player.nextTauntAt||0)-time)},actors:actors.map(a=>({id:a.id,name:a.name,role:a.role,team:a.team,position:a.position.toArray(),health:a.health,maxHealth:a.maxHealth,standingHeight:a.standingHeight,artistName:a.artistName,armor:a.armor,alive:a.alive,kills:a.kills,deaths:a.deaths,ammo:a.ammo,taunting:isTaunting(a,time),taunt:a.tauntId,bot:a.botState})),objectives:objectives.map(o=>({id:o.id,owner:o.owner,progress:o.progress,contested:o.contested})),utility:utility.getState(),sprays:sprays.getState(),shotCount,hitCount,respawnCount,...renderedMetrics};}
window.vanGoghStrike={get state(){return diagnosticState();}};
if(diagnostic)window.vanGoghStrike.test={get controls(){return{keys:[...keys],fireHeld,fireLatch,ads,suspended:input.suspended,ready:controlsReady()};},input:s=>{if(s.keys){keys.clear();s.keys.forEach(k=>keys.add(k));}if('fire'in s){fireHeld=s.fire;if(!s.fire)fireLatch=false;}if('ads'in s)ads=s.ads;},start:(next={})=>startMatch({...next,skipIntro:next.skipIntro??true}),step:seconds=>{for(let i=0;i<seconds*60&&phase==='playing';i++){const dt=advanceIntro(1/60);if(dt>1e-9&&simulationReady())updateSimulation(dt);}updateHUD();},teleport:(x,z)=>{player.position.copy(physics.nearestWalkable(V(x,0,z)));player.position.y=physics.floorHeight(player.position.x,player.position.z);},aim:(yaw,pitch=0)=>{player.yaw=yaw;player.pitch=pitch;},damage:n=>damageActor(player,n,actors.find(a=>a.team!==player.team)),get physics(){return physics;},get actors(){return actors;},get rules(){return rules;},get player(){return player;},get town(){return town;},get game(){return game;},get utility(){return utility;},get sprays(){return sprays;},spray:()=>requestSpray(),taunt:requestTaunt,render:()=>{updateCamera(1/60);renderActors(1/60);updateHUD();},get view(){return view;},get camera(){return camera;},get ui(){return ui;},damageActor,fire:()=>requestFire(player,aimDirection(player)),reload:()=>requestReload(player),switchWeapon,pause:setPause,throw:type=>requestUtility(player,type),heal:startHealing};
view.setVisible(false);requestAnimationFrame(tick);
