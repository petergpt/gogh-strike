import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Original local geometry: machined silhouettes, walnut grain, woven sleeves and articulated hands. */
export function createWeaponAssets(){
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  function grain(kind){
    if(typeof document==='undefined')return null;
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
    let seed=17421;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    if(kind==='wood'){
      c.fillStyle='#7a4825';c.fillRect(0,0,256,256);
      for(let i=0;i<110;i++){const x=i*2.4;c.strokeStyle=i%4===0?'rgba(225,163,82,.29)':'rgba(32,17,10,.25)';c.lineWidth=.7+random()*2;c.beginPath();for(let y=0;y<=256;y+=4){const px=x+Math.sin(y*.021+i*.17)*9+Math.sin(y*.049+i)*2;if(y===0)c.moveTo(px,y);else c.lineTo(px,y);}c.stroke();}
      for(let i=0;i<38;i++){c.fillStyle='rgba(251,191,98,.14)';c.fillRect(random()*256,random()*256,1+random()*2,8+random()*25);}
    }else if(kind==='cloth'){
      c.fillStyle='#788274';c.fillRect(0,0,256,256);for(let i=0;i<256;i+=4){c.fillStyle='rgba(21,33,32,.28)';c.fillRect(i,0,1,256);c.fillRect(0,i,256,1);c.fillStyle='rgba(229,222,190,.14)';c.fillRect(i+1,0,1,256);}
    }else{
      c.fillStyle='#c1c1c1';c.fillRect(0,0,256,256);for(let i=0;i<800;i++){const s=Math.floor(120+random()*110);c.strokeStyle=`rgba(${s},${s},${s},.14)`;c.lineWidth=.45;c.beginPath();const x=random()*256,y=random()*256;c.moveTo(x,y);c.lineTo(x+random()*40+4,y+random()*1.4);c.stroke();}
    }
    const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=kind==='wood'?THREE.SRGBColorSpace:THREE.NoColorSpace;textures.add(t);return t;
  }
  const woodMap=grain('wood'),metalGrain=grain('metal'),clothMap=grain('cloth');
  function material(params){const m=new THREE.MeshStandardMaterial(params);materials.add(m);return m;}
  const M={
    gunmetal:material({color:'#344c58',metalness:.83,roughness:.31,roughnessMap:metalGrain}),
    receiver:material({color:'#1a2f3b',metalness:.76,roughness:.36,roughnessMap:metalGrain}),
    steel:material({color:'#80969e',metalness:.94,roughness:.24,roughnessMap:metalGrain}),
    dark:material({color:'#0b1217',metalness:.36,roughness:.51}),
    bore:material({color:'#030506',metalness:.04,roughness:.95}),
    brass:material({color:'#d0a55a',metalness:.88,roughness:.27}),
    wood:material({color:woodMap?'#ffffff':'#915b2b',map:woodMap,metalness:.02,roughness:.42}),
    woodEdge:material({color:'#a37343',metalness:.03,roughness:.48}),
    rubber:material({color:'#172323',metalness:0,roughness:.88}),
    leather:material({color:'#4a4b36',metalness:0,roughness:.72}),
    glove:material({color:'#4c5951',metalness:0,roughness:.90,roughnessMap:clothMap}),
    glovePad:material({color:'#293b3d',metalness:0,roughness:.7}),
    seam:material({color:'#a4aa89',metalness:0,roughness:.91}),
    skin:material({color:'#ce9a75',metalness:0,roughness:.77}),
    sleeve:material({color:'#263d45',metalness:0,roughness:.86,roughnessMap:clothMap}),
    cuff:material({color:'#607e76',metalness:0,roughness:.8}),
    shell:material({color:'#9e4536',metalness:.05,roughness:.61}),
    white:material({color:'#eedca8',emissive:'#ac9760',emissiveIntensity:.3,metalness:.15,roughness:.4}),
    glass:material({color:'#438487',emissive:'#10242c',emissiveIntensity:.25,metalness:.15,roughness:.08,transparent:true,opacity:.23,depthWrite:false,side:THREE.DoubleSide}),
  };
  const glow=new THREE.MeshBasicMaterial({color:'#ffc776',transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});materials.add(glow);
  const redDot=new THREE.MeshBasicMaterial({color:'#ff7856',toneMapped:false});materials.add(redDot);
  function geometry(g){geometries.add(g);return g;}
  function mesh(parent,g,m,pos=V(),rot=V()){const o=new THREE.Mesh(geometry(g),typeof m==='string'?M[m]:m);o.position.copy(pos);o.rotation.set(rot.x,rot.y,rot.z);parent.add(o);return o;}
  function box(parent,x,y,z,w,h,d,m='receiver',r=.004,rot=V()){return mesh(parent,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w*.24,h*.24,d*.24)),m,V(x,y,z),rot);}
  function cyl(parent,x,y,z,r,len,m='steel',axis='z',r2=r,sides=16,open=false){const o=mesh(parent,new THREE.CylinderGeometry(r,r2,len,sides,1,open),m,V(x,y,z));if(axis==='z')o.rotation.x=Math.PI/2;else if(axis==='x')o.rotation.z=Math.PI/2;return o;}
  function ball(parent,x,y,z,rx,ry,rz,m){const o=mesh(parent,new THREE.SphereGeometry(1,12,8),m,V(x,y,z));o.scale.set(rx,ry,rz);return o;}
  function ring(parent,x,y,z,r,t,m='steel',axis='z'){const o=mesh(parent,new THREE.TorusGeometry(r,t,6,20),m,V(x,y,z));if(axis==='x')o.rotation.y=Math.PI/2;else if(axis==='y')o.rotation.x=Math.PI/2;return o;}
  function rod(parent,a,b,r,m){const d=b.clone().sub(a),o=mesh(parent,new THREE.CylinderGeometry(r,r,d.length(),10),m,a.clone().add(b).multiplyScalar(.5));o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o;}
  function tube(parent,points,r,m){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),Math.max(12,points.length*4),r,6,false),m);}
  function profile(parent,points,width,m,bevel=.003){
    const shape=new THREE.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-z,y):shape.moveTo(-z,y));shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:width,steps:1,bevelEnabled:bevel>0,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:6});geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);return mesh(parent,geo,m);
  }
  function screw(parent,x,y,z,r=.004,axis='x'){
    cyl(parent,x,y,z,r,.002,'steel',axis,r,12);if(axis==='x')box(parent,x+.0015,y,z,.001,.0014,r*1.4,'dark',.0002,V(.35,0,0));else box(parent,x,y,z+.0015,r*1.5,.0015,.001,'dark',.0002,V(0,0,.35));
  }
  function rail(parent,z0,z1,y=.072,width=.038){
    box(parent,0,y-.009,(z0+z1)/2,width*.7,.014,z1-z0,'dark',.002);
    for(let z=z0;z<=z1;z+=.018)box(parent,0,y,z,width,.009,.010,'gunmetal',.0015);
  }
  function wear(parent,z0,z1,width,y){
    for(let i=0;i<8;i++)box(parent,(i%3-1)*width*.26,y,z0+(z1-z0)*i/8,.0015,.0007,.011+(i%2)*.017,i%3?'steel':'brass',.0001,V(0,.10*(i%3-1),0));
  }
  function bake(group){
    const batches=new Map();for(const c of [...group.children])if(c.isMesh&&!c.material.transparent){const list=batches.get(c.material)||[];list.push(c);batches.set(c.material,list);}
    for(const [material,list]of batches){if(list.length<2)continue;const pieces=list.map(o=>{o.updateMatrix();const g=(o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone()).applyMatrix4(o.matrix);return g;});const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(merged){const m=new THREE.Mesh(geometry(merged),material);group.add(m);for(const o of list)group.remove(o);}}
  }
  function handRig(parent,left=false){
    const root=new THREE.Group(),hand=new THREE.Group();parent.add(root);root.add(hand);
    box(hand,0,0,0,.061,.035,.074,'glove',.012);
    box(hand,0,.020,.004,.052,.009,.047,'glovePad',.004);
    for(let i=0;i<3;i++)box(hand,-.019+i*.019,.025,-.003,.011,.003,.023,'seam',.001,V(0,.12,0));
    const fingers=[];
    for(let i=0;i<4;i++){
      const f=new THREE.Group();f.position.set(-.023+i*.0155,-.002,-.028);hand.add(f);const length=i===3?.018:.024;
      cyl(f,0,0,-length*.43,.008,length,'glove','z',.0075,10);ball(f,0,0,0,.008,.008,.008,'glovePad');
      const joint=new THREE.Group();joint.position.z=-length;f.add(joint);cyl(joint,0,0,-.01,.007,.021,i===0?'skin':'glove','z',.006,10);ball(joint,0,0,-.021,.0065,.0065,.0065,'skin');
      f.rotation.x=-.85-(i===0?.12:0);joint.rotation.x=-.85;f.userData.rest=f.rotation.x;joint.userData.rest=joint.rotation.x;fingers.push(f);bake(f);bake(joint);
    }
    const thumb=new THREE.Group();thumb.position.set(left?.032:-.032,-.003,.018);thumb.rotation.set(-.5,left?-.85:.85,left?.55:-.55);hand.add(thumb);cyl(thumb,0,0,-.017,.011,.034,'glove','z',.008,10);ball(thumb,0,0,-.035,.009,.009,.012,'skin');bake(thumb);
    const arm=mesh(root,new THREE.CylinderGeometry(.039,.053,1,14),M.sleeve),cuff=mesh(root,new THREE.CylinderGeometry(.043,.043,.035,14),M.cuff);
    const seam=rod(root,V(0,0,0),V(0,.2,0),.0014,'seam');
    bake(hand);
    function pose(position,rotation,elbow,flex=0){
      hand.position.copy(position);hand.rotation.set(rotation.x,rotation.y,rotation.z);
      const wrist=position.clone().add(V(0,0,.033).applyEuler(hand.rotation)),d=wrist.clone().sub(elbow),q=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize());
      arm.position.copy(elbow).add(wrist).multiplyScalar(.5);arm.quaternion.copy(q);arm.scale.y=d.length();cuff.position.copy(wrist);cuff.quaternion.copy(q);
      seam.position.copy(arm.position).add(V(.035,0,0));seam.quaternion.copy(q);seam.scale.y=d.length()/ .2;
      fingers.forEach((f,i)=>{f.rotation.x=f.userData.rest+flex*(i===0?.2:.1);f.children.filter(x=>x.isGroup).forEach(j=>j.rotation.x=j.userData.rest+flex*.16);});
    }
    return{root,hand,fingers,pose};
  }
  function build(w){
    const root=new THREE.Group(),receiver=new THREE.Group(),barrel=new THREE.Group(),furniture=new THREE.Group(),magazine=new THREE.Group(),slide=new THREE.Group(),pump=new THREE.Group(),bolt=new THREE.Group();
    root.add(receiver,barrel,furniture,magazine,slide,pump,bolt);
    const pistol=w.id==='pistol',smg=w.id==='smg',shotgun=w.id==='shotgun',sniper=w.id==='sniper';
    let muzzleZ,barrelY=pistol?.015:.018,gripLocation=V(.026,-.112,.10),supportLocation=V(-.022,-.054,-.255),ejectPoint=V(.045,.025,-.01);
    if(pistol){
      profile(receiver,[[-.118,-.033],[-.105,-.050],[.018,-.049],[.063,-.093],[.113,-.084],[.111,.001],[.089,.018],[-.112,.012]],.035,'receiver',.003);
      box(slide,0,.028,-.024,.038,.041,.216,'gunmetal',.007);
      box(slide,0,.05,-.03,.026,.005,.179,'steel',.001);
      box(slide,.0196,.023,-.022,.0018,.017,.041,'bore',.001);
      box(slide,.0208,.020,-.021,.002,.008,.031,'steel',.001);
      for(let side of[-1,1])for(let i=0;i<8;i++)box(slide,side*.020,.025,.026+i*.007,.0018,.027,.0025,'dark',.0004,V(-.2,0,0));
      for(let i=0;i<5;i++)box(slide,.020,.025,-.116+i*.006,.0018,.025,.002,'dark',.0003,V(-.2,0,0));
      profile(furniture,[[.032,-.041],[.09,-.035],[.132,-.195],[.087,-.209],[.053,-.188]],.030,'dark',.005);
      for(const side of[-1,1]){
        const p=profile(furniture,[[.054,-.068],[.087,-.065],[.117,-.182],[.084,-.184]],.005,'wood',.002);p.position.x=side*.019;
        for(let i=0;i<9;i++)box(furniture,side*.0225,-.085-i*.010,.071+i*.0026,.001,.0016,.026,'woodEdge',.0002,V(.34,0,0));
        screw(furniture,side*.023,-.081,.075,.003);screw(furniture,side*.023,-.175,.099,.003);
      }
      cyl(barrel,0,barrelY,-.105,.010,.092,'steel');muzzleZ=-.158;
      tube(receiver,[[0,-.035,.025],[0,-.067,.01],[0,-.081,-.014],[0,-.071,-.04],[0,-.036,-.046]],.0042,'gunmetal');
      box(receiver,0,-.049,-.006,.009,.028,.005,'brass',.002,V(.32,0,0));
      box(receiver,.025,-.039,.042,.008,.012,.015,'steel',.002);
      box(magazine,0,-.157,.094,.026,.09,.032,'gunmetal',.003,V(-.22,0,0));box(magazine,0,-.207,.102,.034,.012,.041,'dark',.003);
      screw(receiver,.021,-.017,.058,.003);gripLocation=V(.029,-.115,.086);supportLocation=V(-.022,-.117,.069);ejectPoint=V(.025,.032,-.031);
      wear(slide,-.118,.046,.028,.053);
    }else{
      const receiverRear=smg?.125:.166,receiverFront=smg?-.134:-.185;
      profile(receiver,[[receiverFront,.007],[receiverFront+.015,.047],[receiverRear-.025,.043],[receiverRear,.009],[receiverRear,-.035],[.04,-.052],[-.11,-.049],[receiverFront,-.028]],smg?.055:.064,'receiver',.005);
      cyl(receiver,0,.021,-.027,shotgun?.032:.027,receiverRear-receiverFront,'gunmetal','z');
      box(receiver,.035,.024,-.035,.003,.034,.089,'bore',.002);box(bolt,.037,.024,-.016,.004,.026,.064,'steel',.002);
      for(let i=0;i<3;i++)screw(receiver,.035,-.026,-.112+i*.092,.004);
      box(receiver,.039,-.002,.100,.009,.018,.027,'dark',.003,V(.0,.0,-.13));
      cyl(receiver,.047,.001,.102,.005,.006,'brass','x');
      tube(receiver,[[0,-.043,.079],[0,-.092,.071],[0,-.101,.023],[0,-.090,-.008],[0,-.043,-.013]],.005,'gunmetal');
      box(receiver,0,-.068,.031,.01,.035,.006,'steel',.002,V(.29,0,0));
      profile(furniture,[[.060,-.047],[.109,-.042],[.157,-.19],[.103,-.207],[.078,-.175]],.044,'dark',.005);
      for(const side of[-1,1]){
        const panel=profile(furniture,[[.079,-.071],[.104,-.07],[.137,-.18],[.107,-.187]],.006,shotgun||sniper?'wood':'leather',.003);panel.position.x=side*.026;
        for(let i=0;i<6;i++)box(furniture,side*.030,-.095-i*.014,.095+i*.004,.0018,.003,.025,'woodEdge',.0005,V(.25,0,0));
      }
      if(smg){
        for(let y of[-.006,-.048])rod(furniture,V(0,y,.13),V(0,y,.37),.009,'steel');
        profile(furniture,[[.35,.011],[.388,.002],[.407,-.107],[.378,-.131],[.351,-.087]],.037,'rubber',.005);
        box(furniture,0,-.015,.252,.055,.027,.117,'wood',.006);
      }else{
        profile(furniture,[[.126,.022],[.188,.029],[.241,.008],[.380,-.013],[.411,-.106],[.383,-.139],[.231,-.081],[.15,-.060]],.061,'wood',.006);
        profile(furniture,[[.370,-.012],[.394,-.018],[.422,-.110],[.395,-.139],[.383,-.131]],.067,'rubber',.004);
        box(furniture,0,.027,.230,.066,.031,.151,sniper?'leather':'wood',.011,V(-.045,0,0));
        for(const side of[-1,1]){screw(furniture,side*.035,-.045,.315,.004);ring(furniture,side*.040,-.079,.307,.013,.003,'dark','x');}
      }
      const barrelLength=smg?.215:shotgun?.50:sniper?.64:.40;muzzleZ=receiverFront-barrelLength;
      cyl(barrel,0,barrelY,receiverFront-barrelLength/2,.013,barrelLength,'steel');
      cyl(barrel,0,barrelY,receiverFront-.03,.022,.074,'gunmetal');
      if(shotgun){
        cyl(barrel,0,-.038,receiverFront-.225,.017,.49,'gunmetal');cyl(barrel,0,-.038,muzzleZ+.04,.021,.041,'dark');
        box(pump,0,-.025,-.332,.080,.071,.214,'wood',.021);for(let i=0;i<11;i++)ring(pump,0,-.020,-.428+i*.018,.037,.0028,'woodEdge');
        box(barrel,0,.049,(receiverFront+muzzleZ)/2,.012,.006,barrelLength-.025,'gunmetal',.001);
        for(let i=0;i<5;i++){cyl(receiver,.050,-.004,-.107+i*.04,.010,.052,'shell','y');cyl(receiver,.050,.024,-.107+i*.04,.011,.010,'brass','y');}
        supportLocation=V(-.022,-.052,-.325);
      }else if(sniper){
        cyl(barrel,0,barrelY,receiverFront-.285,.019,.54,'gunmetal');
        for(let a=0;a<6;a++){const angle=a*Math.PI/3;rod(barrel,V(Math.sin(angle)*.019,.018+Math.cos(angle)*.019,-.30),V(Math.sin(angle)*.019,.018+Math.cos(angle)*.019,-.69),.0016,'steel');}
        profile(pump,[[-.39,-.016],[-.39,-.058],[-.135,-.075],[-.118,-.034]],.078,'wood',.012);
        for(let side of[-1,1]){rod(barrel,V(side*.038,-.034,-.37),V(side*.044,-.039,-.60),.006,'dark');ring(barrel,side*.041,-.03,-.38,.009,.002,'steel','x');}
        cyl(bolt,.048,.011,.081,.009,.046,'steel','x');rod(bolt,V(.041,.014,.081),V(.090,-.026,.092),.005,'steel');ball(bolt,.091,-.027,.093,.012,.012,.012,'dark');
        supportLocation=V(-.032,-.070,-.275);
      }else{
        const guardStart=receiverFront-.02,guardEnd=receiverFront-barrelLength*.78;
        box(pump,0,.001,(guardStart+guardEnd)/2,.067,.068,guardStart-guardEnd,smg?'gunmetal':'wood',.015);
        for(const side of[-1,1])for(let i=0;i<(smg?4:7);i++){
          const z=guardStart-.015-i*.029;box(pump,side*.034,.005,z,.003,.017,.017,'bore',.004);box(pump,side*.036,-.024,z,.002,.006,.017,'steel',.001);
        }
        rail(pump,guardEnd+.018,guardStart-.010,.052,.04);
        box(barrel,0,.019,guardEnd-.022,.038,.053,.034,'dark',.004);cyl(barrel,0,.018,guardEnd-.027,.022,.018,'steel');
        supportLocation=V(-.028,-.052,(guardStart+guardEnd)/2);
      }
      if(!shotgun){
        const length=sniper?.109:smg?.228:.221;
        profile(magazine,[[-.019,-.051],[-.086,-.051],[-.083,-.13],[-.064,-.05-length],[.008,-.043-length],[-.016,-.116]],smg?.033:.045,'gunmetal',.004);
        for(const side of[-1,1])for(let i=0;i<3;i++)box(magazine,side*(smg?.018:.024),-.096-(sniper?.015:.05),-.060+i*.019,.002,sniper?.068:length*.65,.004,'dark',.001,V(-.11,0,0));
        box(magazine,0,-.05-length,-.032,.052,.014,.076,'dark',.003,V(-.11,0,0));
        if(!sniper){box(magazine,.025,-.146,-.032,.002,.068,.010,'bore',.001);for(let i=0;i<4;i++)box(magazine,.026,-.123-i*.014,-.032,.001,.004,.009,'brass',.0003);}
      }
      rail(receiver,-.136,.133,.067,.042);wear(receiver,-.130,.110,.035,.073);gripLocation=V(.036,-.127,.103);
    }
    // Muzzle internals remain open: a dark recessed bore inside concentric machined rings.
    cyl(barrel,0,barrelY,muzzleZ+.012,shotgun?.023:.019,.04,'dark');ring(barrel,0,barrelY,muzzleZ-.010,shotgun?.018:.014,.004,'steel');
    cyl(barrel,0,barrelY,muzzleZ-.004,shotgun?.014:.009,.026,'bore','z',shotgun?.014:.009,16,true);
    for(let i=0;i<4&&!pistol;i++){const a=i*Math.PI/2;box(barrel,Math.sin(a)*.019,barrelY+Math.cos(a)*.019,muzzleZ+.005,.008,.005,.012,'bore',.001,V(0,0,-a));}
    const iron=new THREE.Group(),reflex=new THREE.Group(),scope=new THREE.Group(),suppressor=new THREE.Group();root.add(iron,reflex,scope,suppressor);
    const ironY=pistol?.070:.093,frontSight=pistol?-.118:Math.max(muzzleZ+.080,-.52),rearSight=pistol?.061:.097;
    box(iron,0,ironY-.018,rearSight,pistol?.035:.047,.013,.021,'dark',.002);
    for(let side of[-1,1]){box(iron,side*(pistol?.010:.014),ironY-.003,rearSight,.007,.020,.020,'gunmetal',.002);ball(iron,side*(pistol?.010:.014),ironY+.005,rearSight+.011,.002,.002,.0008,'white');}
    box(iron,0,ironY-.013,frontSight,.018,.025,.026,'dark',.002);box(iron,0,ironY+.002,frontSight,.003,.014,.007,'steel',.0005);ball(iron,0,ironY+.009,frontSight+.003,.0018,.0018,.0015,'white');
    const opticY=pistol?.102:.133;
    box(reflex,0,opticY-.049,.032,.047,.020,.071,'dark',.003);box(reflex,0,opticY-.027,.012,.053,.025,.075,'gunmetal',.004);
    // The reflex hood is an actual extruded shape with a clear aperture.
    const sh=new THREE.Shape();sh.moveTo(-.031,-.022);sh.lineTo(-.031,.018);sh.quadraticCurveTo(-.026,.034,-.018,.034);sh.lineTo(.018,.034);sh.quadraticCurveTo(.031,.031,.031,.018);sh.lineTo(.031,-.022);sh.closePath();
    const hole=new THREE.Path();hole.moveTo(-.024,-.015);hole.lineTo(.024,-.015);hole.lineTo(.024,.016);hole.quadraticCurveTo(.02,.026,.014,.026);hole.lineTo(-.014,.026);hole.quadraticCurveTo(-.024,.026,-.024,.014);hole.closePath();sh.holes.push(hole);
    const hood=mesh(reflex,new THREE.ExtrudeGeometry(sh,{depth:.019,bevelEnabled:true,bevelSegments:2,bevelSize:.002,bevelThickness:.002,steps:1,curveSegments:6}),'gunmetal',V(0,opticY,-.003));
    mesh(reflex,new THREE.PlaneGeometry(.045,.043),'glass',V(0,opticY+.005,.006));
    ball(reflex,0,opticY+.005,.011,.0018,.0018,.0008,redDot);cyl(reflex,.037,opticY-.023,.027,.007,.014,'dark','x');screw(reflex,.045,opticY-.023,.027,.004);
    const scopeY=.143;
    for(let z of[-.095,.08]){box(scope,0,.089,z,.042,.040,.025,'dark',.003);ring(scope,0,scopeY,z,.026,.006,'gunmetal');}
    cyl(scope,0,scopeY,-.022,.025,.27,'gunmetal');cyl(scope,0,scopeY,.133,.031,.054,'dark');cyl(scope,0,scopeY,-.190,.037,.075,'gunmetal','z',.027);
    for(let z of[.113,.126,.139,.151,-.164,-.179,-.194,-.209])ring(scope,0,scopeY,z,z>0?.031:.036,.0018,'steel');
    ring(scope,0,scopeY,.163,.027,.005,'dark');ring(scope,0,scopeY,-.23,.035,.003,'steel');cyl(scope,0,scopeY,.158,.026,.003,'glass');cyl(scope,0,scopeY,-.232,.033,.002,'glass');
    cyl(scope,0,scopeY+.035,-.009,.016,.027,'dark','y');cyl(scope,.037,scopeY,-.009,.014,.027,'dark','x');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;box(scope,Math.sin(a)*.017,scopeY+.05,-.009+Math.cos(a)*.017,.003,.009,.003,'steel',.0005);}
    screw(scope,.051,scopeY,-.009,.006);
    const suppressLength=pistol?.145:sniper?.23:.18,suppressRadius=pistol?.021:sniper?.029:.026;
    cyl(suppressor,0,barrelY,muzzleZ-suppressLength/2,suppressRadius,suppressLength,'gunmetal');
    for(let i=0;i<8;i++)ring(suppressor,0,barrelY,muzzleZ-.017-i*(suppressLength-.035)/7,suppressRadius+.0008,.0017,'dark');
    ring(suppressor,0,barrelY,muzzleZ-suppressLength-.003,suppressRadius-.002,.003,'steel');cyl(suppressor,0,barrelY,muzzleZ-suppressLength+.006,suppressRadius-.007,.02,'bore','z',suppressRadius-.007,16,true);
    const muzzle=new THREE.Group();root.add(muzzle);muzzle.position.set(0,barrelY,muzzleZ-.055);
    // A clean tapered flash instead of several overlapping needle-like shards.
    mesh(muzzle,new THREE.ConeGeometry(.046,.17,8),glow,V(0,0,-.045),V(-Math.PI/2,0,0));
    const flashLight=new THREE.PointLight('#ffd391',0,.8,2);muzzle.add(flashLight);muzzle.visible=false;
    const leftRig=handRig(root,true),rightRig=handRig(root,false);
    const shellProp=new THREE.Group();leftRig.hand.add(shellProp);cyl(shellProp,0,0,-.058,.011,.048,'shell');cyl(shellProp,0,0,-.031,.012,.011,'brass');shellProp.visible=false;
    for(const g of[receiver,barrel,furniture,magazine,slide,pump,bolt,iron,reflex,scope,suppressor,shellProp])bake(g);
    return{root,receiver,barrel,furniture,magazine,slide,pump,bolt,iron,reflex,scope,suppressor,muzzle,flashLight,leftRig,rightRig,shellProp,gripLocation,supportLocation,ejectPoint,muzzleZ,barrelY,suppressLength,sightHeights:{iron:ironY+.009,reflex:opticY+.005,scope:scopeY},pistol,shotgun,sniper};
  }
  function dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());geometries.clear();materials.clear();textures.clear();}
  return{build,dispose,materials:M};
}
