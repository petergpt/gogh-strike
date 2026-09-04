import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createWeaponAssets} from './weapon-models.js';
import {WEAPONS,resolveWeapon} from './weapon-catalog.js';
import {createSprayCan} from './spray-prop.js';
import {getArtistTag} from './art-tags.js';

const clamp=THREE.MathUtils.clamp,mix=THREE.MathUtils.lerp;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Exact critically damped spring integration keeps kick recovery identical at
// 30, 60 and 120 Hz and cannot overshoot wildly after a slow frame.
const spring=(position,velocity,frequency,dt)=>{const c=velocity+frequency*position,decay=Math.exp(-frequency*dt);return[(position+c*dt)*decay,(velocity-frequency*c*dt)*decay];};

/** Independent PBR view pass with physical detail and staged hand/weapon handling. */
export function createWeaponView(mainCamera){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(61,mainCamera.aspect,.018,5),group=new THREE.Group();scene.add(group);
  scene.add(new THREE.HemisphereLight('#c4dcec','#484033',1.15));
  const key=new THREE.DirectionalLight('#ffe7ba',2.5);key.position.set(-1.5,2.5,3);scene.add(key);
  const rim=new THREE.DirectionalLight('#9dbfd7',2.2);rim.position.set(2,1,-2);scene.add(rim);
  const fill=new THREE.DirectionalLight('#f0b979',.75);fill.position.set(-2,-.5,-1);scene.add(fill);
  const assets=createWeaponAssets(),cache=new Map(),attachmentCache=new Map();
  let weapon=WEAPONS[2],current=null,attachments={...weapon.defaultAttachments},visible=true,environment=null;
  let clock=0,walk=0,ads=0,equipAge=0,fireAge=10,inspectAge=-1,reloadAge=-1,reloadDuration=1,emptyReload=false;
  let recoil=0,recoilVelocity=0,kick=0,kickVelocity=0,lateral=0,shotIndex=0,lastEmpty=false,suppressed=false,heat=0,lean=0;
  let sprintAmount=0,actionAge=-1,actionKind=null,actionDuration=.42,destroyed=false;
  const sprayCan=createSprayCan();group.add(sprayCan.group);sprayCan.group.visible=false;
  const shellGeometry=new THREE.CylinderGeometry(.0038,.0038,.017,8),shellMaterial=new THREE.MeshStandardMaterial({color:'#c8a45d',metalness:.88,roughness:.25});
  const shells=Array.from({length:10},()=>{const mesh=new THREE.Mesh(shellGeometry,shellMaterial);mesh.visible=false;scene.add(mesh);return{mesh,velocity:V(),spin:V(),life:0};});let shellIndex=0;

  function stopAction(){actionAge=-1;actionKind=null;sprayCan.group.visible=false;sprayCan.update(0,{spraying:false,time:clock});}
  function cancelSpray(){if(actionKind==='spray')stopAction();}
  function setArtist(artist){sprayCan.setPalette(getArtistTag(artist).palette);}

  function setAttachments(next={}){
    const options=weapon.attachmentOptions;
    attachments={optic:options.optic.includes(next.optic)?next.optic:attachments.optic,barrel:options.barrel.includes(next.barrel)?next.barrel:attachments.barrel};
    if(!options.optic.includes(attachments.optic))attachments.optic=weapon.defaultAttachments.optic;
    if(!options.barrel.includes(attachments.barrel))attachments.barrel='standard';
    attachmentCache.set(weapon.id,{...attachments});
    if(current){current.iron.visible=attachments.optic==='iron';current.reflex.visible=attachments.optic==='reflex';current.scope.visible=attachments.optic==='scope';current.suppressor.visible=attachments.barrel==='suppressor';current.muzzle.position.z=current.muzzleZ-.055-(current.suppressor.visible?current.suppressLength:0);}
    return{...attachments};
  }
  function equip(value){
    stopAction();
    weapon=resolveWeapon(value);if(current)group.remove(current.root);
    if(!cache.has(weapon.id))cache.set(weapon.id,assets.build(weapon));current=cache.get(weapon.id);group.add(current.root);
    attachments={...(attachmentCache.get(weapon.id)||weapon.defaultAttachments)};setAttachments(attachments);
    recoil=recoilVelocity=kick=kickVelocity=lateral=shotIndex=heat=sprintAmount=0;fireAge=10;inspectAge=reloadAge=actionAge=-1;actionKind=null;equipAge=ads=0;lastEmpty=false;
    for(const c of shells){c.life=0;c.mesh.visible=false;}
  }
  function fire(options={}){
    stopAction();
    const pattern=weapon.recoilPattern[shotIndex++%weapon.recoilPattern.length];
    recoilVelocity+=weapon.recoil*(weapon.id==='shotgun'?12:10);kickVelocity+=.5+weapon.recoil*10;lateral+=pattern.x*.4;
    fireAge=0;inspectAge=actionAge=-1;lastEmpty=!!options.empty;suppressed=options.suppressed??attachments.barrel==='suppressor';heat=clamp(Number(options.heat??heat+.13),0,2);
    const s=shells[shellIndex++%shells.length];group.updateMatrixWorld(true);s.mesh.position.copy(current.ejectPoint).applyMatrix4(group.matrixWorld);
    s.velocity.set(.5+Math.random()*.25,.38+Math.random()*.18,.07+Math.random()*.12).applyQuaternion(group.quaternion);s.spin.set(4+Math.random()*6,6+Math.random()*6,3+Math.random()*3);s.mesh.rotation.set(.3,Math.random()*6,1.2);s.life=.62;s.mesh.visible=true;
  }
  function reload(duration=weapon.reloadTime,options={}){
    stopAction();
    if(typeof duration==='object'){options=duration;duration=options.duration||(options.empty?weapon.reloadEmptyTime:weapon.reloadTime);}
    reloadAge=0;reloadDuration=Math.max(.3,Number(duration)||weapon.reloadTime);emptyReload=options.empty??lastEmpty;inspectAge=actionAge=-1;shotIndex=0;return reloadDuration;
  }
  function inspect(){if(reloadAge>=0)return false;stopAction();inspectAge=0;return true;}
  function action(kind='throw',options={}){
    if(reloadAge>=0)return false;
    stopAction();if(options.tag)sprayCan.setPalette(options.tag.palette||getArtistTag(options.tag).palette);
    actionKind=['melee','spray'].includes(kind)?kind:'throw';actionDuration=actionKind==='spray'?.55:actionKind==='melee'?.34:.42;actionAge=0;inspectAge=-1;
    return true;
  }
  function actionEnvelope(){return actionAge<0?0:actionKind==='spray'?smooth(0,.13,actionAge)*(1-smooth(.37,actionDuration,actionAge)):smooth(0,.065,actionAge)*(1-smooth(.12,actionDuration,actionAge));}
  function poseHands(p){
    const left=current.supportLocation.clone(),right=current.gripLocation.clone();
    let leftRotation=V(.3,.12,-.23),rightRotation=V(.24,-1.33,-.27),leftFlex=0,rightFlex=fireAge<.12?-.6:0;
    if(current.pistol){leftRotation=V(.25,1.15,.12);rightRotation=V(.15,-1.35,-.2);}
    current.shellProp.visible=false;
    if(p>=0){
      if(current.shotgun){
        const entry=smooth(.04,.16,p),exit=1-smooth(.85,1,p),amount=entry*exit;
        const cycle=((p-.15)*4.3)%1,feed=p>.15&&p<.84;
        const target=V(-.018,-.126+Math.sin(Math.max(0,cycle)*Math.PI)*.075,.023);
        left.lerp(target,amount);leftRotation.lerp(V(.0,.9,.5),amount);leftFlex=amount;
        current.shellProp.visible=feed&&cycle<.7;
      }else{
        const grab=smooth(.04,.20,p),returnHand=smooth(emptyReload?.88:.79,1,p);
        const magTarget=current.pistol?V(-.012,-.195,.09):V(-.029,-.19,-.029);
        const withdraw=smooth(.22,.40,p),insert=smooth(.52,.72,p);
        magTarget.y-=.27*withdraw*(1-insert);magTarget.x-=.075*withdraw*(1-insert);magTarget.z+=.05*withdraw*(1-insert);
        left.lerp(magTarget,grab*(1-returnHand));leftRotation.lerp(V(.08,.60,.48),grab*(1-returnHand));leftFlex=grab;
        if(emptyReload&&p>.75){const boltAmount=smooth(.74,.81,p)*(1-smooth(.9,1,p));left.lerp(V(current.pistol?-.028:.055,.063,current.pistol?.045:.10),boltAmount);leftRotation.lerp(V(.22,-.3,.2),boltAmount);}
      }
    }
    if(current.sniper&&fireAge>.11&&fireAge<.85&&p<0){
      const boltAmount=smooth(.11,.24,fireAge)*(1-smooth(.66,.85,fireAge));right.lerp(V(.104,.001,.10+current.bolt.position.z),boltAmount);rightRotation.lerp(V(.22,-1,.55),boltAmount);rightFlex=boltAmount;
    }
    const inspectAmount=inspectAge<0?0:smooth(.0,.4,inspectAge)*(1-smooth(1.75,2.25,inspectAge));
    left.lerp(current.supportLocation.clone().add(V(-.015,-.015,.02)),inspectAmount*.4);
    if(actionAge>=0&&actionKind==='throw')left.lerp(V(-.13,-.19,-.11),actionEnvelope());
    const spraying=actionAge>=0&&actionKind==='spray';
    if(spraying){
      const amount=actionEnvelope();left.lerp(V(-.355,.035,-.24),amount);leftRotation.lerp(V(-.08,.08,1.48),amount);leftFlex=amount*.35;
      sprayCan.group.position.copy(left).add(V(.003,.012,-.018));sprayCan.group.rotation.set(-.10+amount*.14,.04,-.10);
    }
    sprayCan.group.visible=visible&&spraying&&actionEnvelope()>.10;
    sprayCan.update(0,{spraying:sprayCan.group.visible&&actionAge>.13&&actionAge<.37,time:clock});
    const leftElbow=V(-.25,-.34,.27),rightElbow=V(.15,-.32,.34);
    current.leftRig.pose(left,leftRotation,leftElbow,leftFlex);current.rightRig.pose(right,rightRotation,rightElbow,rightFlex);
  }
  function update(dt,state={}){
    dt=clamp(Number(dt)||0,0,.1);clock+=dt;fireAge+=dt;equipAge+=dt;heat=Math.max(0,heat-dt*.35);
    if(!current)return;
    if(inspectAge>=0){inspectAge+=dt;if(state.ads||inspectAge>2.35)inspectAge=-1;}
    if(actionAge>=0){actionAge+=dt;if(actionAge>actionDuration||(state.ads&&(actionKind==='spray'||actionAge>.05)))stopAction();}
    let p=-1;if(reloadAge>=0){reloadAge+=dt;p=clamp(reloadAge/reloadDuration,0,1);if(reloadAge>=reloadDuration-1e-9){p=1;reloadAge=-1;lastEmpty=false;}}
    const speed=Math.max(0,Number(state.speed)||0),movement=clamp(speed/5,0,1.5),sprint=!!state.sprint;
    sprintAmount=mix(sprintAmount,sprint?1:0,1-Math.exp(-dt*18));
    const adsTarget=state.ads&&reloadAge<0&&inspectAge<0&&!sprint?1:0;ads=mix(ads,adsTarget,1-Math.exp(-dt*(weapon.id==='sniper'?11:17)));
    lean=mix(lean,clamp(Number(state.lean)||0,-1,1),1-Math.exp(-dt*12));
    [recoil,recoilVelocity]=spring(recoil,recoilVelocity,14,dt);
    [kick,kickVelocity]=spring(kick,kickVelocity,16,dt);lateral*=Math.exp(-dt*12);
    if(state.grounded!==false)walk+=dt*(2+speed*1.95);
    const bob=movement*(1-ads*.95),breath=(1-ads*.78)*(1-movement*.5),suppression=clamp(Number(state.suppression)||0,0,1),shotHeat=clamp(Number(state.shotHeat)||heat,0,2);
    const inspectEnvelope=inspectAge<0?0:smooth(0,.4,inspectAge)*(1-smooth(1.75,2.28,inspectAge));
    const inspectRoll=inspectAge>1.05?smooth(1.05,1.65,inspectAge)*.42:0;
    const reloadEnvelope=p<0?0:smooth(0,.15,p)*(1-smooth(.83,1,p));
    const quickAction=actionEnvelope(),strike=actionKind==='melee'?quickAction:0;
    const equipDrop=1-smooth(0,.34,equipAge);
    const sightY=current.sightHeights[attachments.optic];
    group.position.set(mix(current.pistol?.20:.205,0,ads)+Math.sin(walk)*.005*bob-inspectEnvelope*.105-lean*.014,
      mix(current.pistol?-.194:-.200,-sightY,ads)+Math.abs(Math.cos(walk))* .005*bob+Math.sin(clock*1.9)*.0011*breath-reloadEnvelope*.042-equipDrop*.36+inspectEnvelope*.045-sprintAmount*.025-quickAction*.025,
      mix(current.pistol?-.43:-.47,attachments.optic==='scope'?-.355:-.365,ads)+kick+reloadEnvelope*.012-inspectEnvelope*.10-strike*.07);
    group.rotation.set(recoil+Math.cos(walk*.5)*.004*bob+Math.sin(clock*1.9)*.002*breath-reloadEnvelope*.18+inspectEnvelope*.14-sprintAmount*.17-quickAction*.09,
      lateral+reloadEnvelope*.18-inspectEnvelope*(.85-inspectRoll)+Math.sin(clock*27)*suppression*.003,
      Math.sin(walk)*.008*bob+reloadEnvelope*.48+inspectEnvelope*(.24+inspectRoll)-lean*.065-sprintAmount*.24+quickAction*.12);
    group.rotation.x+=Math.sin(clock*31)*suppression*.0015+Math.sin(clock*17)*Math.max(0,shotHeat-1)*.001;
    current.slide.position.z=current.pistol?(fireAge<.10?Math.sin(Math.PI*fireAge/.10)*.044:lastEmpty?.038:0):0;
    if(p>=0&&current.pistol&&emptyReload)current.slide.position.z=(1-smooth(.80,.88,p))*.038;
    current.bolt.position.z=current.sniper?(fireAge>.17&&fireAge<.73?smooth(.17,.36,fireAge)*(1-smooth(.53,.73,fireAge))*.083:0):Math.max(0,1-fireAge/.07)*.045;
    current.bolt.rotation.z=current.sniper&&fireAge>.12&&fireAge<.80?smooth(.12,.24,fireAge)*(1-smooth(.64,.8,fireAge))*.48:0;
    if(p>=0&&emptyReload&&!current.pistol){current.bolt.position.z=smooth(.07,.15,p)*(1-smooth(.80,.88,p))*.078;current.bolt.rotation.z=current.sniper?smooth(.05,.14,p)*(1-smooth(.82,.9,p))*.5:0;}
    current.pump.position.z=current.shotgun&&fireAge>.14&&fireAge<.63?smooth(.14,.32,fireAge)*(1-smooth(.44,.63,fireAge))*.105:0;
    if(p>=0&&current.shotgun&&p>.85)current.pump.position.z=Math.sin((p-.85)/.15*Math.PI)*.10;
    current.magazine.visible=true;current.magazine.position.set(0,0,0);current.magazine.rotation.set(0,0,0);
    if(p>=0&&!current.shotgun){
      const drop=smooth(.22,.4,p),insert=smooth(.52,.72,p),amount=drop*(1-insert);
      current.magazine.position.set(-amount*.065,-amount*.25,amount*.045);current.magazine.rotation.set(amount*.15,amount*-.12,amount*.14);current.magazine.visible=!(p>.405&&p<.505);
    }
    poseHands(p);
    current.muzzle.visible=fireAge<(suppressed?.021:.044);current.muzzle.scale.setScalar(suppressed?.27:1);current.muzzle.rotation.z=shotIndex*2.399+fireAge*7;
    current.flashLight.intensity=current.muzzle.visible?(suppressed?.7:5.5)*(1-fireAge/.05):0;
    for(const s of shells)if(s.life>0){s.life-=dt;s.velocity.y-=dt*2.3;s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.rotation.x+=s.spin.x*dt;s.mesh.rotation.y+=s.spin.y*dt;s.mesh.rotation.z+=s.spin.z*dt;s.mesh.visible=s.life>0;}
    group.visible=visible&&!(attachments.optic==='scope'&&ads>.965);
    if(camera.aspect!==mainCamera.aspect){camera.aspect=mainCamera.aspect;camera.updateProjectionMatrix();}
  }
  function render(renderer){
    if(!visible||!group.visible)return;
    if(!environment&&renderer.isWebGLRenderer){const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();}
    const autoClear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.clearDepth();renderer.render(scene,camera);}finally{renderer.autoClear=autoClear;}
  }
  function destroy(){if(destroyed)return;destroyed=true;stopAction();sprayCan.dispose();assets.dispose();shellGeometry.dispose();shellMaterial.dispose();environment?.dispose();cache.clear();attachmentCache.clear();scene.clear();}
  equip(weapon);update(0);
  return{group,scene,camera,equip,fire,reload,inspect,action,setArtist,cancelSpray,cancelActions(){reloadAge=inspectAge=-1;stopAction();},setAttachments,update,render,destroy,setVisible(value){visible=!!value;group.visible=visible;if(!visible){stopAction();shells.forEach(s=>s.mesh.visible=false);}},get weapon(){return weapon;},get ads(){return ads;},get scoped(){return attachments.optic==='scope'&&ads>.965;},get attachments(){return{...attachments};},get handling(){return{reloading:reloadAge>=0,reloadProgress:reloadAge<0?0:reloadAge/reloadDuration,inspecting:inspectAge>=0,action:actionAge>=0?actionKind:null,sprayVisible:sprayCan.group.visible,spraying:sprayCan.jet.visible,sprintAmount,emptyReload,shotIndex};}};
}
