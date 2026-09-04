import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {bodyProfile,bodyPose} from './actor-profile.js';
import {createSprayCan} from './spray-prop.js';
import {getArtistTag} from './art-tags.js';
import {getArtistTaunt,sampleTaunt} from './artist-taunts.js';
import {createNameplate,setNameplateRelation,updateNameplate as renderNameplate} from './nameplate.js';
import {characterClothMaterial,applyTailoring} from './character-materials.js';
import {createCharacterMotion,sampleCharacterMotion} from './character-motion.js';
import {loadCharacterAssets,createPortraitAsset} from './character-assets.js';
await loadCharacterAssets();
export {bodyProfile,bodyPose} from './actor-profile.js';

// Articulated, tailored bodies share the same artist profiles as the Blender portraits.
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const DOWN = V(0, -1, 0);
const sharedCloth = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .88, metalness: 0, flatShading: false});
const sharedWeapon = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .61, metalness: .21, flatShading: true});
const primitives = new Map();
const relationTextures = new Map();
const RELATION_COLORS = {friendly:'#76e6ad',enemy:'#ff8577'};
let shadowTexture;

const ROLE_STYLE = {
  vanguard: {hat: 'straw', hair: 'short', beard: 'short', coat: 'short', accessory: 'apron', build: 'broad', weapon: 'rifle'},
  flanker: {hat: 'beret', hair: 'long', beard: 'moustache', coat: 'short', accessory: 'scarf', build: 'slim', weapon: 'smg'},
  anchor: {hat: 'cap', hair: 'short', beard: 'short', coat: 'vest', accessory: 'backpack', build: 'broad', weapon: 'shotgun'},
  marksman: {hat: 'beret', hair: 'short', beard: 'full', coat: 'long', accessory: 'satchel', build: 'slim', weapon: 'sniper'},
  support: {hat: 'none', hair: 'bald', beard: 'full', coat: 'long', accessory: 'apron', build: 'regular', weapon: 'rifle'},
  scout: {hat: 'cap', hair: 'curly', beard: 'none', coat: 'short', accessory: 'satchel', build: 'slim', weapon: 'pistol'},
};

function primitive(key, make) {
  if (!primitives.has(key)) primitives.set(key, make());
  return primitives.get(key).clone();
}

function color(value) { return new THREE.Color(value); }
function tone(value, amount) {
  return color(value).lerp(color(amount > 0 ? '#f2dfb6' : '#142937'), Math.abs(amount));
}

function scalePart(group,x,y,z){group.traverse(o=>{if(o.geometry){o.geometry.scale(x,y,z);o.geometry.computeBoundingSphere();}});}
function shapeTorso(group,profile){group.traverse(o=>{
 if(!o.geometry)return;const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=clamp((y-.16)/.33,0,1);
  const baseWidth=mix(profile.waistScale,profile.shoulderScale,t),neckWidth=mix(profile.shoulderScale,profile.neckWidth,.92);
  const neckT=clamp((y-.525)/.055,0,1),neckBlend=neckT*neckT*(3-2*neckT),width=mix(baseWidth,neckWidth,neckBlend);
  const belly=profile.belly*.039*Math.exp(-(((y-.225)/.155)**2)),chest=profile.chest*.017*Math.exp(-(((y-.41)/.11)**2));
  const depth=profile.depthScale+(z<0?(belly+chest)/.13:0);
  // These profiles reshape the actual surface. Its normal must follow the
  // inverse-transpose Jacobian too; stale normals make a round chest look flat.
  if(n){
   const baseSlope=t>0&&t<1?(profile.shoulderScale-profile.waistScale)/.33:0;
   const neckSlope=neckT>0&&neckT<1?6*neckT*(1-neckT)/.055:0;
   const widthSlope=baseSlope*(1-neckBlend)+(neckWidth-baseWidth)*neckSlope;
   const depthSlope=z<0?(-2*(y-.225)/(.155*.155)*belly-2*(y-.41)/(.11*.11)*chest)/.13:0;
   const nx=n.getX(i)/width,nz=n.getZ(i)/depth,ny=(n.getY(i)-x*widthSlope*nx-z*depthSlope*nz)/profile.torsoScale;
   const length=Math.hypot(nx,ny,nz)||1;n.setXYZ(i,nx/length,ny/length,nz/length);
  }
  p.setXYZ(i,x*width,y*profile.torsoScale,z*depth);
 }
 p.needsUpdate=true;if(n)n.needsUpdate=true;o.geometry.computeBoundingSphere();
});}

class Sculpture {
  constructor(material) { this.pieces = []; this.material=material; this.surfaceClass=0; }
  surface(value=0) { this.surfaceClass=value; return this; }
  add(geometry, pigment, position = V(), scale = V(1, 1, 1), rotation = V(), variation = .026) {
    if (geometry.index) { const indexed = geometry; geometry = geometry.toNonIndexed(); indexed.dispose(); }
    if(!geometry.attributes.uv){
      const p=geometry.attributes.position,uv=[];
      for(let i=0;i<p.count;i++)uv.push(p.getX(i)*4+.5,p.getY(i)*4+.5);
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    }
    const base = pigment?.isColor ? pigment : color(pigment);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const p = geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const noise=Math.sin(p.getX(i)*43.7+p.getY(i)*91.3+p.getZ(i)*67.1)*variation;
      colors[i*3]=clamp(base.r*(1+noise),0,1);colors[i*3+1]=clamp(base.g*(1+noise),0,1);colors[i*3+2]=clamp(base.b*(1+noise),0,1);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSurface',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(this.surfaceClass),1));
    geometry.applyMatrix4(new THREE.Matrix4().compose(position,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z)), scale));
    this.pieces.push(geometry);
    return this;
  }
  box(x, y, z, w, h, d, pigment, rx = 0, ry = 0, rz = 0) {
    return this.add(primitive('box', () => new THREE.BoxGeometry(1, 1, 1)), pigment, V(x, y, z), V(w, h, d), V(rx, ry, rz));
  }
  oval(x, y, z, rx, ry, rz, pigment, turn = 0) {
    // Spend tessellation on silhouette, not sub-centimetre fingers and buttons.
    const detail=Math.max(rx,ry,rz)<.045?[12,8]:Math.max(rx,ry,rz)<.075?[16,10]:[24,16];
    return this.add(primitive(`sphere-${detail.join('-')}`, () => new THREE.SphereGeometry(1,...detail)), pigment, V(x, y, z), V(rx, ry, rz), V(0, 0, turn));
  }
  cylinder(x, y, z, top, bottom, height, pigment, rx = 0, ry = 0, rz = 0, sides = 20) {
    return this.add(new THREE.CylinderGeometry(top, bottom, height, sides), pigment, V(x, y, z), V(1, 1, 1), V(rx, ry, rz));
  }
  brim(y, rx, rz, pigment, {wave=0,tilt=0,fray=0,offset=0}={}) {
    const vertices=[],segments=40,point=(i,inner,lower)=>{
      const a=i/segments*TAU,r=inner?.57:1+(Math.sin(a*11+1.4)*.5+.5)*fray;
      return [Math.sin(a)*rx*r+offset,y+Math.sin(a)*tilt+Math.cos(a*3+.4)*wave*(inner?.2:1)-(lower?.009:0),Math.cos(a)*rz*r+.008];
    };
    const quad=(a,b,c,d)=>vertices.push(...a,...b,...c,...a,...c,...d);
    for(let i=0;i<segments;i++){
      quad(point(i,true,false),point(i,false,false),point(i+1,false,false),point(i+1,true,false));
      quad(point(i,true,true),point(i+1,true,true),point(i+1,false,true),point(i,false,true));
      quad(point(i,false,false),point(i+1,false,false),point(i+1,false,true),point(i,false,true));
    }
    const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    const geometry=mergeVertices(source,1e-6);source.dispose();geometry.computeVertexNormals();return this.add(geometry,pigment);
  }
  line(a, b, radius, pigment, endRadius = radius) {
    const direction = b.clone().sub(a), length = direction.length();
    const geometry = new THREE.CylinderGeometry(endRadius, radius, length, 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), direction.normalize()));
    return this.add(geometry, pigment, a.clone().add(b).multiplyScalar(.5));
  }
  panel(points, pigment) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for (let i = 1; i < points.length - 1; i++) for (const point of [points[0], points[i], points[i + 1]]) vertices.push(...point);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    // Counter-wound back gives a folded lapel physical visibility from either side.
    const back = geometry.clone();
    const bp = back.attributes.position;
    for (let i = 0; i < bp.count; i += 3) {
      const a = V().fromBufferAttribute(bp, i), b = V().fromBufferAttribute(bp, i + 2);
      bp.setXYZ(i, b.x, b.y, b.z); bp.setXYZ(i + 2, a.x, a.y, a.z);
    }
    back.computeVertexNormals();
    this.add(back, pigment); return this.add(geometry, pigment);
  }
  cloth(points,pigment,fullness=.006){
    // A rolled fabric patch preserves the tailor's pointed cut, but has a
    // continuous surface and a real hem instead of two paper-flat triangles.
    if(points.length<3||points.length>4)return this.panel(points,pigment);
    const divisions=8,positions=[],indices=[],edge=[],point=(u,v)=>{
      const a=points[0],b=points[1],c=points[2],d=points[3];
      const p=d?a.map((_,k)=>mix(mix(a[k],b[k],u),mix(d[k],c[k],u),v)):
        a.map((_,k)=>a[k]*(1-u-v)+b[k]*u+c[k]*v);
      p[2]-=fullness*(d?Math.sin(Math.PI*u)*Math.sin(Math.PI*v):27*u*v*(1-u-v));return p;
    };
    if(points.length===4){
      for(let y=0;y<=divisions;y++)for(let x=0;x<=divisions;x++)positions.push(...point(x/divisions,y/divisions));
      for(let y=0;y<divisions;y++)for(let x=0;x<divisions;x++){
        const a=y*(divisions+1)+x,b=a+1,c=b+divisions+1,d=a+divisions+1;indices.push(a,b,c,a,c,d);
      }
      for(let i=0;i<divisions;i++)edge.push(i);
      for(let i=0;i<divisions;i++)edge.push(i*(divisions+1)+divisions);
      for(let i=divisions;i>0;i--)edge.push(divisions*(divisions+1)+i);
      for(let i=divisions;i>0;i--)edge.push(i*(divisions+1));
    }else{
      const rows=[];
      for(let y=0;y<=divisions;y++){
        rows[y]=[];for(let x=0;x<=divisions-y;x++){rows[y].push(positions.length/3);positions.push(...point(x/divisions,y/divisions));}
      }
      for(let y=0;y<divisions;y++)for(let x=0;x<divisions-y;x++){
        indices.push(rows[y][x],rows[y][x+1],rows[y+1][x]);
        if(x<divisions-y-1)indices.push(rows[y][x+1],rows[y+1][x+1],rows[y+1][x]);
      }
      for(let x=0;x<divisions;x++)edge.push(rows[0][x]);
      for(let y=0;y<divisions;y++)edge.push(rows[y].at(-1));
      for(let y=divisions;y>0;y--)edge.push(rows[y][0]);
    }
    const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    if(area>0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const back=geometry.clone(),backPositions=back.attributes.position,backIndices=back.index;
    for(let i=0;i<backPositions.count;i++)backPositions.setZ(i,backPositions.getZ(i)+.0025);
    for(let i=0;i<backIndices.count;i+=3){const b=backIndices.getX(i+1);backIndices.setX(i+1,backIndices.getX(i+2));backIndices.setX(i+2,b);}back.computeVertexNormals();
    const hem=[];
    for(let i=0;i<edge.length;i++){
      const a=positions.slice(edge[i]*3,edge[i]*3+3),b=positions.slice(edge[(i+1)%edge.length]*3,edge[(i+1)%edge.length]*3+3),c=[b[0],b[1],b[2]+.0025],d=[a[0],a[1],a[2]+.0025];
      hem.push(...a,...b,...c,...a,...c,...d);
    }
    const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(hem,3));edgeGeometry.computeVertexNormals();
    this.add(edgeGeometry,pigment);this.add(back,pigment);return this.add(geometry,pigment);
  }
  loft(levels,pigment,sides=32){
    // Monotone cubic meridians round sleeves and trouser volume without
    // overshooting any authored ring, shoulder width or limb endpoint.
    const slopes=levels.map((ring,j)=>ring.slice(1).map((_,k)=>{
      const component=k+1,previous=Math.max(0,j-1),next=Math.min(levels.length-1,j+1);
      const left=j?(ring[component]-(levels[previous][component]||0))/(ring[0]-levels[previous][0]):0;
      const right=j<levels.length-1?((levels[next][component]||0)-ring[component])/(levels[next][0]-ring[0]):0;
      return j===0?right:j===levels.length-1?left:left*right<=0?0:2*left*right/(left+right);
    }));
    const rings=[];
    for(let j=0;j<levels.length-1;j++)for(let step=0;step<3;step++){
      const a=levels[j],b=levels[j+1],t=step/3,t2=t*t,t3=t2*t,dy=b[0]-a[0],ring=[mix(a[0],b[0],t)];
      for(let k=1;k<4;k++)ring[k]=(2*t3-3*t2+1)*(a[k]||0)+(t3-2*t2+t)*dy*(slopes[j][k-1]||0)+(-2*t3+3*t2)*(b[k]||0)+(t3-t2)*dy*(slopes[j+1][k-1]||0);
      rings.push(ring);
    }
    rings.push(levels.at(-1));
    const positions=[],uv=[],indices=[];
    for(let j=0;j<rings.length;j++)for(let i=0;i<=sides;i++){
      const ring=rings[j],a=i/sides*TAU;positions.push(Math.sin(a)*ring[1],ring[0],Math.cos(a)*ring[2]+(ring[3]||0));uv.push(i/sides,ring[0]*3);
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
      const a=j*(sides+1)+i,b=a+1,c=b+sides+1,d=a+sides+1;indices.push(a,b,c,a,c,d);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    // The UV seam is duplicated; weld only its normals, retaining the UV wrap.
    const normals=geometry.attributes.normal;
    for(let j=0;j<rings.length;j++){
      const a=j*(sides+1),b=a+sides,n=V().fromBufferAttribute(normals,a).add(V().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
    }
    this.add(geometry,pigment);
    // Separate flat end caps avoid pulling side normals into a dark rim.
    for(const [j,reverse]of[[0,true],[rings.length-1,false]]){
      const vertices=[],ring=rings[j],center=[0,ring[0],ring[3]||0];
      for(let i=0;i<sides;i++){
        const point=index=>[Math.sin(index/sides*TAU)*ring[1],ring[0],Math.cos(index/sides*TAU)*ring[2]+(ring[3]||0)];
        vertices.push(...center,...point(reverse?i+1:i),...point(reverse?i:i+1));
      }
      const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));cap.computeVertexNormals();this.add(cap,pigment);
    }
    return this;
  }
  sole(x,y,z,w,h,d,pigment){
    const outline=new THREE.Shape(),rx=w/2,rz=d/2;
    outline.moveTo(-rx*.63,-rz);outline.bezierCurveTo(-rx,-rz,-rx,-rz*.7,-rx,-rz*.32);
    outline.lineTo(-rx*.88,rz*.70);outline.quadraticCurveTo(-rx*.84,rz,-rx*.52,rz);outline.lineTo(rx*.52,rz);
    outline.quadraticCurveTo(rx*.84,rz,rx*.88,rz*.70);outline.lineTo(rx,-rz*.32);
    outline.bezierCurveTo(rx,-rz*.7,rx,-rz,rx*.63,-rz);outline.closePath();
    const geometry=new THREE.ExtrudeGeometry(outline,{depth:h*.65,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:h*.175,bevelThickness:h*.175,curveSegments:7});
    geometry.rotateX(Math.PI/2);geometry.translate(0,h*.325,0);
    return this.add(geometry,pigment,V(x,y,z));
  }
  finish(parent, name, material = this.material||sharedCloth) {
    const group = new THREE.Group(); group.name = name; parent.add(group);
    if (this.pieces.length) {
      const geometry = mergeGeometries(this.pieces, false);
      this.pieces.forEach(piece => piece.dispose());
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `${name} sculpture`; mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
    return group;
  }
}

function getShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(48, 48, 4, 48, 48, 47);
  gradient.addColorStop(0, '#06182396'); gradient.addColorStop(.35, '#071d2670'); gradient.addColorStop(1, '#071d2600');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 96, 96);
  shadowTexture = new THREE.CanvasTexture(canvas); return shadowTexture;
}

function relationTexture(friendly) {
  if(relationTextures.has(friendly))return relationTextures.get(friendly);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),points=friendly?[[27,39],[64,67],[101,39],[101,66],[64,96],[27,66]]:[[64,21],[106,64],[64,107],[22,64]];
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  ctx.lineWidth=9;ctx.lineJoin='round';ctx.strokeStyle='#162c31';ctx.stroke();
  ctx.fillStyle=friendly?RELATION_COLORS.friendly:RELATION_COLORS.enemy;ctx.fill();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;relationTextures.set(friendly,texture);return texture;
}

function buildHead(parent, look, palette, name) {
  const group=new THREE.Group();group.name='head and portrait details';parent.add(group);
  const portrait=createPortraitAsset(look.characterId||name);group.add(portrait);
  group.userData.updatePortrait=portrait.userData.updatePortrait;
  const s=new Sculpture(palette.material);
  const hatColor = look.hatColor || palette.coat;
  if(look.hat==='frayedstraw'){
    s.brim(.205,.170,.145,hatColor,{wave:.009,tilt:-.007,fray:.08});
    s.cylinder(-.007,.247,.013,.083,.103,.080,tone(hatColor,.10),0,0,.035,28);
    s.cylinder(-.009,.222,.013,.099,.104,.026,look.hatBandColor||'#745a34',0,0,.035,28);
    for(let i=0;i<11;i++){const a=i*2.31;s.line(V(Math.sin(a)*.163,.205+Math.cos(a*3+.4)*.009,Math.cos(a)*.141+.008),V(Math.sin(a)*(.180+(i%3)*.007),.197+(i%2)*.013,Math.cos(a)*.157+.008),.0018,tone(hatColor,.16));}
  }else if(look.hat==='slouchberet'){
    s.cylinder(0,.201,.008,.101,.103,.023,tone(hatColor,-.23),0,0,0,28);
    s.cylinder(-.020,.215,.014,.120,.107,.026,hatColor,0,0,.08,28);
    s.oval(-.043,.232,.020,.150,.043,.113,hatColor,.14);
    s.oval(-.101,.216,.011,.072,.031,.095,tone(hatColor,-.06),.24);
    s.cylinder(-.053,.271,.011,.006,.008,.014,tone(hatColor,-.24),0,0,.35,6);
  }else if(look.hat==='sailor'){
    s.cylinder(0,.206,.009,.106,.104,.030,'#23353f',0,0,0,28);
    s.cylinder(0,.239,.010,.145,.122,.054,hatColor,0,0,-.035,32);
    s.oval(0,.206,-.078,.107,.006,.067,'#21313a');
    s.box(0,.210,-.098,.059,.012,.004,palette.accent);
    s.panel([[-.063,.210,.103],[-.038,.210,.110],[-.031,.112,.140],[-.055,.115,.140]],'#25353d');
  }else if(look.hat==='bowler'){
    s.brim(.198,.138,.124,hatColor,{wave:.003});
    s.add(new THREE.SphereGeometry(1,20,9,0,TAU,0,Math.PI/2),hatColor,V(0,.198,.009),V(.098,.063,.094));
    s.cylinder(0,.210,.009,.098,.100,.027,look.hatBandColor||'#9e7848',0,0,0,32);
  }else if(look.hat==='garden'){
    s.brim(.207,.211,.171,hatColor,{wave:.009,tilt:.008});
    s.loft([[.206,.111,.097,.007],[.238,.099,.088,.004],[.283,.078,.070,.004]],tone(hatColor,.07),24);
    s.cylinder(0,.221,.004,.109,.113,.025,look.hatBandColor||'#605338',0,0,0,28);
    s.oval(.057,.262,.015,.049,.029,.059,tone(hatColor,-.07),-.32);
  }else if(look.hat==='floppy'){
    s.brim(.208,.179,.163,hatColor,{wave:.012,tilt:-.007});
    s.oval(-.014,.246,.018,.107,.042,.099,hatColor,.10);
    s.oval(-.068,.227,.023,.079,.032,.101,tone(hatColor,-.07),.19);
    s.cylinder(0,.218,.009,.105,.109,.020,look.hatBandColor||'#827362',0,0,.035,28);
  }else if(look.hat==='bonnet'){
    s.add(new THREE.SphereGeometry(1,18,7,0,TAU,0,Math.PI*.58),hatColor,V(0,.199,.041),V(.112,.065,.098));
    s.oval(0,.198,.115,.111,.021,.028,tone(hatColor,.10));
    for(const side of[-1,1]){
      s.panel([[side*.093,.179,.024],[side*.110,.171,.031],[side*.046,-.022,-.041],[side*.026,-.014,-.050]],look.hatBandColor||'#8e8298');
      s.oval(side*.032,-.019,-.046,.035,.014,.009,look.hatBandColor||'#8e8298',side*.4);
    }
  }else if(look.hat==='portrait'){
    s.brim(.208,.233,.173,hatColor,{wave:.012,tilt:.026,offset:.020});
    s.oval(.027,.241,.022,.125,.041,.103,hatColor,-.12);
    s.oval(-.100,.254,.004,.060,.022,.043,look.hatBandColor||'#a5b6bd',.20);
    s.oval(-.139,.244,.014,.057,.025,.032,tone(look.hatBandColor||'#a5b6bd',-.07),-.28);
    s.panel([[-.107,.253,-.007],[-.157,.278,.005],[-.260,.283,.041],[-.207,.252,.025],[-.125,.241,.007]],tone(look.hatBandColor||'#a5b6bd',.16));
    s.line(V(-.111,.250,.002),V(-.242,.276,.034),.0025,look.hatBandColor||'#a5b6bd');
    s.panel([[-.123,.238,.027],[-.151,.241,.023],[-.171,.112,.090],[-.140,.139,.083]],look.hatBandColor||'#a5b6bd');
  }else if (look.hat === 'straw' || look.hat === 'widebrim') {
    const straw=look.hatColor||'#b79850',brim=look.hat==='widebrim'?1.24:1;
    s.cylinder(0,.207,.008,.173*brim,.176*brim,.012,straw,0,0,-.025,32);
    s.cylinder(.001,.249,.008,.093,.111,.082,tone(straw,.12),0,0,-.025,28);
    s.cylinder(.001,.220,.008,.109,.113,.023,look.hatBandColor||'#766343',0,0,-.025,28);
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * TAU;
      s.line(V(Math.sin(a)*.115,.214,Math.cos(a)*.115+.008),V(Math.sin(a)*.169*brim,.214,Math.cos(a)*.169*brim+.008),.0018,tone(straw,i%2?.10:-.08));
    }
  } else if (look.hat === 'beret') {
    s.cylinder(0,.201,.006,.100,.103,.026,tone(hatColor,-.3),0,0,-.03,28);
    s.oval(.020,.229,.009,.132,.047,.115,hatColor,-.14);
    s.cylinder(.024,.272,.015,.007,.009,.019,tone(hatColor,-.25),0,0,-.2,6);
    s.box(-.067,.225,-.088,.026,.014,.008,palette.accent,0,.28,-.12);
  } else if (look.hat === 'helmet') {
    s.add(new THREE.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI * .54), hatColor, V(0, .201, 0), V(.138, .132, .132));
    s.cylinder(0, .189, 0, .133, .134, .016, tone(hatColor, -.25), 0, 0, 0, 12);
    for (const side of [-1, 1]) s.line(V(side * .111, .197, -.02), V(side * .062, .004, -.006), .006, '#776147');
  } else if (look.hat === 'cap') {
    s.oval(0,.225,.012,.111,.047,.103,hatColor);
    s.oval(0,.204,-.077,.108,.009,.059,tone(hatColor,-.16));
    s.cylinder(0,.202,.008,.100,.102,.023,tone(hatColor,-.25),0,0,0,28);
    s.box(0,.223,-.094,.025,.015,.005,palette.accent);
  }
  s.finish(group,'tailored headwear');group.position.y=.625;
  return group;
}

function buildWeapon(parent, id, palette) {
  const s = new Sculpture(), pistol = id === 'pistol', smg = id === 'smg', sniper = id === 'sniper', shotgun = id === 'shotgun';
  const steel = '#2b4148', edge = '#71817d', wood = '#785034', ink = '#172c31';
  const body = pistol ? .17 : smg ? .23 : .30;
  const barrel = pistol ? .11 : smg ? .17 : sniper ? .48 : shotgun ? .39 : .29;
  s.box(0, .018, 0, .065, .077, body, steel);
  s.box(0, .061, -.003, .061, .009, body * .92, edge);
  s.cylinder(0, .034, -body / 2 - barrel / 2, shotgun ? .021 : .013, shotgun ? .021 : .013, barrel, steel, Math.PI / 2, 0, 0, 8);
  s.cylinder(0, .034, -body / 2 - barrel, shotgun ? .025 : .019, shotgun ? .025 : .019, .029, ink, Math.PI / 2, 0, 0, 8);
  s.box(0, -.06, .04, .046, .106, .065, wood, -.28);
  s.box(.036, .024, .005, .004, .018, body * .42, edge);
  if (!pistol) {
    s.box(0, -.024, body / 2 + .1, .06, .08, .21, wood, .11);
    s.box(0, -.014, body / 2 + .207, .067, .095, .022, ink);
    s.box(0, -.032, -body / 2 - barrel * .25, .064, .064, barrel * .56, shotgun || sniper ? wood : steel);
    if (!shotgun) s.box(0, -.111, -.035, .041, smg ? .14 : .115, .071, steel, .12);
    else s.cylinder(0, -.011, -body / 2 - barrel / 2, .013, .013, barrel * .87, ink, Math.PI / 2);
    for (let i = 0; i < 5; i++) s.box(.035, -.013, -body / 2 - .025 - i * .029, .006, .028, .007, edge);
  }
  s.box(0, .08, -body * .36, .009, .03, .012, ink);
  if (sniper) {
    s.cylinder(0, .13, -.015, .022, .022, .215, ink, Math.PI / 2);
    for (const z of [-.11, .093]) s.cylinder(0, .13, z, .03, .03, .025, steel, Math.PI / 2);
    s.cylinder(0, .13, -.126, .022, .022, .002, '#608b91', Math.PI / 2);
    s.box(0, .089, .005, .03, .06, .071, steel);
  }
  s.box(-.034, .024, body * .32, .006, .034, .026, palette.accent, 0, 0, -.14);
  const group = s.finish(parent, `${id} carried weapon`, sharedWeapon);
  group.userData.muzzleZ = -body / 2 - barrel - .03;
  return group;
}

function makeArm(parent, side, palette, vest, look={}) {
  const upper = new Sculpture(palette.material), lower = new Sculpture(palette.material);
  const rolled=look.sleeves==='rolled',puff=look.sleeves==='puff',sleeve=vest?palette.shirt:palette.coat;
  const sleeveVolume=puff?1.15:1;
  upper.loft([[-.286,.062,.058],[-.238,.068,.061],[-.152,.078,.067],[-.061,.087,.075],[.010,.085,.075],[.030,.077,.067],[.045,.056,.050],[.054,.028,.025],[.058,.005,.004]].map(([y,x,z])=>[y,x*sleeveVolume,z*sleeveVolume]),sleeve);
  for(const offset of[-.22,-.205])upper.line(V(-.043,offset,-.05),V(.034,offset-.011,-.053),.0012,tone(sleeve,-.11));
  if(rolled)upper.loft([[-.282,.065,.060],[-.274,.075,.069],[-.211,.078,.071],[-.201,.071,.064]],tone(palette.shirt,.10));
  upper.loft([[-.151,.080*sleeveVolume,.069*sleeveVolume],[-.072,.088*sleeveVolume,.077*sleeveVolume]],palette.accent);
  lower.surface(rolled?1:0);
  lower.loft([[-.258,.044,.041],[-.209,.048,.046],[-.139,.060,.052],[-.066,.070,.059],[.005,.061,.057],[.025,.043,.041]],rolled?(look.skin||'#c99269'):sleeve);
  lower.surface(0);
  if(look.sleeves==='cuffed')lower.cylinder(0,-.224,0,.052,.052,.058,palette.trim,0,0,0,32);
  lower.surface(.5);
  lower.cylinder(0, -.235, 0, .047, .048, .043, '#584a37');
  const hand=look.handScale||1,skin=look.skin||'#c99269';
  lower.oval(0,-.279,-.003,.034*hand,.041*hand,.023*hand,'#615449');
  lower.surface(1);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.016*hand,y=-.303-Math.sin((i+1)/5*Math.PI)*.014*hand;
    lower.oval(x,y,-.010,.0085*hand,.020*hand,.0105*hand,skin);
    lower.oval(x,y-.006,-.019,.008*hand,.011*hand,.010*hand,tone(skin,-.035));
    lower.line(V(x-.005,y,-.020),V(x+.005,y,-.020),.0009,tone(skin,-.16));
  }
  lower.oval(-side*.033*hand,-.276,-.019,.013*hand,.024*hand,.013*hand,skin,side*-.40);
  return {upper: upper.finish(parent, side < 0 ? 'left upper arm' : 'right upper arm'),
    lower: lower.finish(parent, side < 0 ? 'left forearm and glove' : 'right forearm and glove'), side};
}

function solveArm(arm, shoulder, hand, bend) {
  const lengthA=arm.lengthA||.285,lengthB=arm.lengthB||.284;
  const direction = hand.clone().sub(shoulder), distance = clamp(direction.length(), .08, lengthA+lengthB-.004);
  direction.normalize();
  const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
  const reach = Math.sqrt(Math.max(.001, lengthA * lengthA - along * along));
  const outward = bend.clone().addScaledVector(direction, -bend.dot(direction)).normalize();
  const elbow = shoulder.clone().addScaledVector(direction, along).addScaledVector(outward, reach);
  arm.upper.position.copy(shoulder);
  arm.upper.quaternion.setFromUnitVectors(DOWN, elbow.clone().sub(shoulder).normalize());
  arm.lower.position.copy(elbow);
  arm.lower.quaternion.setFromUnitVectors(DOWN, hand.clone().sub(elbow).normalize());
}

/**
 * Artist-operative figure. `look` is costume art direction, not portrait proof.
 * Faces local -Z; actor.position is feet. Call update once per rendered frame.
 * setRelation(friendly) selects green chevrons or coral diamonds relative to
 * the human. setIndicator({visible,focused}) accepts the game's wall/smoke LOS
 * result; it can be called before or after update. Indicators default hidden.
 */
export function createActorModel(scene, {team = 0, color: teamColor, role = 'vanguard', look = {}, name = ''} = {}) {
  if (typeof look === 'string') look = ROLE_STYLE[look] || {};
  const suppliedLook=look;
  look={...(ROLE_STYLE[role]||ROLE_STYLE.vanguard),...(look.presentation==='woman'?{beard:'none',hair:'pinned',hat:'none',coat:'highcollar',accessory:'shawl'}:{}),...suppliedLook};
  const profile=bodyProfile(look);
  const movement=createCharacterMotion(profile,look.motion);
  const accent = color(teamColor ?? (team ? '#70cbed' : '#f1ca63'));
  const palette = {accent, trim: look.trim || accent, coat: look.coatColor || (team ? '#355f76' : '#58634a'),
    shirt: look.shirtColor || (team ? '#a1ada2' : '#d0c1a0'), pants: look.pantsColor || (team ? '#3a4e5b' : '#514f48'),material:characterClothMaterial(look)};
  const width=1;
  const group = new THREE.Group(); group.name = `${name || role} · artist operative`; scene.add(group);
  const body = new THREE.Group(); body.position.y = .79; group.add(body);
  const pelvis = new Sculpture(palette.material);
  pelvis.loft([[-.08, .16 * width, .115], [.06, .19 * width, .132], [.14, .16 * width, .122]], palette.pants);
  pelvis.surface(.5);
  pelvis.cylinder(0, .08, 0, .186 * width, .185 * width, .047, '#5d4b37');
  pelvis.box(0, .084, -.181 * width, .052, .039, .012, '#b29b67');
  pelvis.box(0, .084, -.19 * width, .032, .025, .006, '#645338');
  const hipModel = pelvis.finish(body, 'hips and utility belt');
  scalePart(hipModel,profile.hipScale,profile.torsoScale,profile.depthScale);

  let waistApron;
  const upper = new THREE.Group(); upper.name = 'upper body aim'; body.add(upper);
  const torso=new Sculpture(palette.material),highCollar=look.coat==='highcollar'||look.coat==='cape',smock=look.coat==='smock',sailor=look.coat==='sailor',formal=look.coat==='frock'||look.coat==='doublebreast',long=look.coat==='long'||highCollar||formal||smock,vest=look.coat==='vest';
  torso.loft([[.065,.18,.122],[.14,.183,.119],[.24,.18,.115],[.33,.205,.123],[.42,.239,.132],[.49,.249,.133],[.517,.230,.127],[.538,.196,.112],[.550,.149,.084],[.559,.103,.062],[.566,.063,.048]],palette.coat);
  torso.cylinder(0,.557,.006,.073,.082,.038,palette.shirt,0,0,0,32);
  torso.cloth([[-.073,.572,-.043],[-.031,.583,-.061],[-.017,.525,-.140],[-.070,.540,-.102]],tone(palette.shirt,.08));
  torso.cloth([[.073,.572,-.043],[.070,.540,-.102],[.017,.525,-.140],[.031,.583,-.061]],tone(palette.shirt,-.05));
  if(highCollar){
    torso.cloth([[-.095,.529,-.138],[.095,.529,-.138],[.080,.15,-.130],[-.080,.15,-.130]],palette.shirt);
    torso.cylinder(0,.580,.006,.067,.075,.066,palette.shirt,0,0,0,32);
    torso.cloth([[-.225,.486,-.084],[-.067,.549,-.131],[-.081,.253,-.154],[-.145,.154,-.137]],tone(palette.coat,.11));
    torso.cloth([[.225,.486,-.084],[.145,.154,-.137],[.081,.253,-.154],[.067,.549,-.131]],tone(palette.coat,-.04));
    torso.oval(0,.511,-.154,.021,.025,.008,palette.trim);
  }else if(smock){
    torso.cloth([[-.082,.546,-.121],[.080,.546,-.121],[.066,.422,-.143],[-.031,.452,-.153]],tone(palette.shirt,.08));
    torso.line(V(.005,.434,-.145),V(.005,.096,-.135),.005,tone(palette.coat,-.18));
  }else if(sailor){
    torso.cloth([[-.216,.512,-.087],[-.070,.548,-.131],[.002,.305,-.147],[-.147,.423,-.157]],palette.shirt);
    torso.cloth([[.216,.512,-.087],[.147,.423,-.157],[.002,.305,-.147],[.070,.548,-.131]],palette.shirt);
    for(const side of[-1,1])torso.line(V(side*.184,.495,-.117),V(side*.066,.376,-.159),.009,palette.accent);
  }else{
    torso.cloth([[-.14,.521,-.125],[-.048,.531,-.149],[.018,.23,-.125],[-.097,.38,-.144]],tone(palette.coat,.15));
    torso.cloth([[.14,.521,-.125],[.048,.531,-.153],[-.018,.25,-.125],[.10,.39,-.144]],tone(palette.coat,-.17));
    torso.cloth([[-.047,.53,-.157],[.047,.53,-.157],[0,.318,-.137]],palette.shirt);
  }
  applyTailoring(torso,look,palette);
  // Permanent team signal stays restricted to cloth, avoiding emissive bodies.
  torso.box(.136 * width,.421,-.141,.079,.035,.008,accent,0,0,-.03);
  if(look.neckwear==='bow'){
    for(const side of[-1,1])torso.panel([[0,.530,-.145],[side*.060,.550,-.139],[side*.066,.508,-.148],[0,.514,-.150]],palette.trim);
    torso.oval(0,.521,-.155,.014,.015,.010,palette.trim);
  }else if(look.neckwear==='cravat'||look.neckwear==='stock'){
    const broad=look.neckwear==='stock';torso.panel([[-.033,.550,-.131],[.039,.550,-.131],[broad?.060:.017,.364,-.150],[-.012,.330,-.151],[-.036,.457,-.153]],palette.trim);
  }else if(look.neckwear==='kerchief'){
    torso.panel([[-.078,.550,-.110],[.083,.550,-.110],[.024,.421,-.168],[-.023,.416,-.165]],palette.trim);
    torso.panel([[-.014,.435,-.171],[.033,.435,-.171],[.089,.242,-.156],[.021,.277,-.161]],palette.trim);
  }
  if (look.accessory === 'apron') {
    torso.panel([[-.105, .414, -.15], [.106, .414, -.15], [.136, .034, -.156], [-.132, .034, -.156]], team ? '#a4b5a4' : '#c6b37b');
    torso.box(0, .203, -.164, .16, .096, .02, team ? '#84968a' : '#aa955f');
    for (const side of [-1, 1]) torso.line(V(side * .1, .41, -.155), V(side * .105, .54, -.087), .014, '#aa9967');
  }else if(look.accessory==='waistapron'){
    const apron=new Sculpture(palette.material),pigment=look.apronColor||'#b5a584';
    for(let i=0;i<8;i++){const x=-.176+i*.044,next=x+.044;apron.panel([[x,.182,-.155],[next,.182,-.155],[next*1.06,-.164,-.158-Math.sin((i+1)*Math.PI/4)*.010],[x*1.06,-.164,-.158-Math.sin(i*Math.PI/4)*.010]],pigment);}
    apron.box(0,.029,-.174,.185,.080,.009,tone(pigment,-.09));
    waistApron=apron.finish(upper,'draped waist apron');shapeTorso(waistApron,profile);
    const hinge=V(0,.18*profile.torsoScale,-.155*profile.depthScale);waistApron.traverse(o=>{if(o.geometry)o.geometry.translate(-hinge.x,-hinge.y,-hinge.z);});waistApron.position.copy(hinge);
  } else if(look.accessory==='shawl'||look.accessory==='capelet'){
    torso.panel([[-.232,.480,.07],[-.242,.474,-.07],[-.065,.530,-.153],[.14,.246,-.161],[.184,.330,-.155]],tone(palette.coat,.15));
    torso.line(V(-.236,.471,-.074),V(.14,.248,-.164),.010,palette.trim);
    if(look.accessory==='capelet'){
      torso.panel([[.213,.514,.079],[.240,.493,-.050],[.173,.298,-.171],[-.084,.390,-.164],[.052,.537,-.120]],tone(palette.coat,-.15));
      torso.oval(.025,.503,-.161,.024,.025,.010,palette.trim);
    }
  } else if (look.accessory === 'scarf') {
    torso.panel([[.02, .561, -.107], [.10, .529, -.123], [.12, .279, -.152], [.065, .227, -.151]], accent);
  } else if (look.accessory === 'satchel') {
    torso.surface(.5);
    torso.line(V(-.145, .523, -.111), V(.145, .047, -.151), .018, '#795c39');
    torso.box(.214 * width, .078, .075, .115, .19, .13, '#83683f', 0, 0, -.08);
    torso.box(.214 * width, .163, .077, .122, .062, .141, '#9b7b44', 0, 0, -.08);
  } else if (look.accessory === 'backpack') {
    torso.oval(0, .29, .177, .165, .224, .085, '#687163');
    torso.box(0, .43, .199, .30, .06, .135, '#8c9478');
    for (const side of [-1, 1]) {
      torso.line(V(side * .135, .50, -.105), V(side * .125, .08, -.147), .017, '#5c5943');
    }
    torso.box(0, .307, .266, .08, .081, .008, accent);
  }
  torso.surface(0);
  shapeTorso(torso.finish(upper,'layered coat and equipment'),profile);
  const head = buildHead(upper, look, palette, name);
  head.position.y=.625*profile.torsoScale;head.scale.set(profile.headScale.x,profile.headScale.y,profile.headScale.z);
  const arms = [-1, 1].map(side => makeArm(upper, side, palette, vest,look));
  for(const arm of arms){scalePart(arm.upper,profile.armWidth,profile.armScale,profile.armWidth);scalePart(arm.lower,profile.armWidth,profile.armScale,profile.armWidth);arm.lengthA=.285*profile.armScale;arm.lengthB=.284*profile.armScale;}
  const legs = [-1, 1].map(side => {
    const thigh=new Sculpture(palette.material),shin=new Sculpture(palette.material),boot=new Sculpture(palette.material);
    thigh.loft([[-.39,.073,.069],[-.33,.079,.075],[-.24,.093,.085],[-.12,.105,.094],[-.02,.104,.093]],palette.pants);
    thigh.oval(0,-.37,-.001,.075,.050,.071,tone(palette.pants,-.035));
    thigh.line(V(side*.096,-.065,.004),V(side*.075,-.336,.006),.0015,tone(palette.pants,-.14));
    shin.loft([[-.30,.050,.048],[-.23,.055,.052],[-.16,.067,.066],[-.065,.077,.069],[0,.074,.068]],palette.pants);
    for(let i=0;i<3;i++)shin.line(V(-.04,-.235-i*.015,-.032),V(.036,-.245-i*.013,-.035),.0015,tone(palette.pants,-.08));
    boot.surface(.5);
    boot.cylinder(0,.035,0,.054,.062,.13,'#494039');
    boot.oval(0,-.027,-.045,.070,.060,.121,'#51453b');
    boot.sole(0,-.072,-.045,.131,.025,.219,'#263039');
    boot.oval(0,-.038,-.111,.064,.039,.064,'#605147');
    for(let i=0;i<4;i++)boot.line(V(-.032,.004-i*.011,-.067-i*.006),V(.032,-.001-i*.011,-.067-i*.006),.002,'#b19c78');
    const upperLeg=thigh.finish(body,side<0?'left trouser leg':'right trouser leg');upperLeg.position.set(side*.107*profile.hipScale,-.006*profile.legScale,0);
    scalePart(upperLeg,profile.legWidth,profile.legScale,profile.legDepth);
    const lowerLeg=shin.finish(upperLeg,side<0?'left calf':'right calf');lowerLeg.position.y=-.393*profile.legScale;
    scalePart(lowerLeg,profile.legWidth,profile.legScale,profile.legDepth);
    const foot=boot.finish(lowerLeg,side<0?'left articulated boot':'right articulated boot');foot.position.y=-.300*profile.legScale;
    scalePart(foot,profile.legWidth,profile.legScale,profile.legDepth);
    const footPositions=[],seen=new Set(),position=foot.children[0].geometry.attributes.position;
    for(let i=0;i<position.count;i++)if(position.getY(i)<-.03*profile.legScale){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),key=`${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if(!seen.has(key)){seen.add(key);footPositions.push(x,y,z);}
    }
    return{upper:upperLeg,lower:lowerLeg,foot,side,footPositions};
  });
  const tails = [];
  if (long) for (const side of [-1, 1]) {
    const tail = new Sculpture(palette.material);
    const desiredLength=look.coat==='frock'?.46:smock?.24:look.coat==='cape'?.32:.386,length=Math.min(desiredLength,(profile.legScale*.70-.10)/profile.torsoScale),spread=look.coat==='cape'?.27:smock?.24:.218;
    tail.panel([[side * .017,.08,.085],[side*.18,.08,.073],[side*spread,-length+.046,.131],[side*.043,-length,.146]],tone(palette.coat,-.08));
    tail.line(V(side*.177,.053,.08),V(side*(spread-.005),-length+.054,.136),.005,tone(palette.coat,.19));
    const skirt=tail.finish(body,'split coat skirt');scalePart(skirt,profile.waistScale,profile.torsoScale,profile.depthScale);skirt.userData.drop=length*profile.torsoScale;tails.push(skirt);
  }

  const weaponRoot = new THREE.Group(); weaponRoot.name = 'carried weapon motion'; upper.add(weaponRoot);
  const slingSculpture=new Sculpture().surface(.5);
  slingSculpture.line(V(-.161,.512,-.123),V(.135,.074,-.144),.013,'#675740');
  const tauntSling=slingSculpture.finish(upper,'celebration weapon sling');tauntSling.visible=false;scalePart(tauntSling,profile.shoulderScale,profile.torsoScale,profile.depthScale);
  let weaponId = look.weapon || ROLE_STYLE[role]?.weapon || 'rifle';
  let weapon = buildWeapon(weaponRoot, weaponId, palette);
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(.065), new THREE.MeshBasicMaterial({color: '#ffe7a6', transparent: true, opacity: .8, depthWrite: false}));
  flash.scale.set(.5, .6, 1.5); flash.visible = false; weaponRoot.add(flash);
  const marker = createNameplate(name || role); group.add(marker);
  const shadow = new THREE.Mesh(primitive('shadow-plane', () => new THREE.PlaneGeometry(1.15, .9)),
    new THREE.MeshBasicMaterial({map: getShadowTexture(), transparent: true, depthWrite: false, opacity: .72, polygonOffset: true, polygonOffsetFactor: -1}));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; group.add(shadow);
  const protection = new THREE.Mesh(primitive('protection-ring', () => new THREE.RingGeometry(.35, .375, 32)),
    new THREE.MeshBasicMaterial({color: accent, transparent: true, opacity: .26, side: THREE.DoubleSide, depthWrite: false}));
  protection.rotation.x = -Math.PI / 2; protection.position.y = .017; protection.visible = false; group.add(protection);

  // Relation is relative to the human player, independently of faction cloth.
  // The game supplies visibility after its wall/smoke LOS check; depth testing
  // remains enabled as a second occlusion boundary for both shapes.
  const indicator=new THREE.Group();indicator.name='player relation indicator';indicator.visible=false;group.add(indicator);
  const halo=new THREE.Mesh(primitive('relation-halo',()=>new THREE.RingGeometry(.405,.47,40)),new THREE.MeshBasicMaterial({
    color:RELATION_COLORS.friendly,transparent:true,opacity:.68,side:THREE.DoubleSide,depthWrite:false,depthTest:true,toneMapped:false}));
  halo.rotation.x=-Math.PI/2;halo.position.y=.027;indicator.add(halo);
  const relationMark=new THREE.Sprite(new THREE.SpriteMaterial({map:relationTexture(true),transparent:true,depthTest:true,depthWrite:false,toneMapped:false}));
  relationMark.name='friendly chevron or enemy diamond';relationMark.scale.set(.51,.51,1);relationMark.position.y=1.95;indicator.add(relationMark);
  let friendly=true,indicatorVisible=false,indicatorFocused=false,indicatorSize=.51;
  function setRelation(value){friendly=!!value;setNameplateRelation(marker,friendly);const pigment=friendly?RELATION_COLORS.friendly:RELATION_COLORS.enemy;
    halo.material.color.set(pigment);protection.material.color.set(pigment);relationMark.material.map=relationTexture(friendly);state.friendly=friendly;}
  function setIndicator({visible=false,focused=false}={}){indicatorVisible=!!visible;indicatorFocused=!!focused;
    indicator.visible=indicatorVisible&&state.alive!==false;halo.material.opacity=indicatorFocused?.9:.64;
    const size=indicatorSize*(indicatorFocused?1.15:1);relationMark.scale.set(size,size,1);relationMark.material.opacity=indicatorFocused?1:.94;
    if(!indicatorVisible)protection.visible=false;}

  let gait = .7 + team, crouch = 0, lastAlive = true, deathAt = -1, wasReloading = false, reloadAt = 0, reloadDuration = 1;
  let shotAt = -100, observedAmmo, previousWeapon = weaponId;
  let renderYaw,smoothedSpeed=0,smoothedForward=0,smoothedSide=0,smoothedPitch=0,aimBlend=0;
  let sprayProp=null,sprayStamp=-Infinity,sprayEnd=0,sprayCancelled=false;
  let tauntStamp=-Infinity,tauntCancelled=false,tauntDefinition=null;
  const inverseUpper=new THREE.Quaternion(),weaponPosition=V(),sprayHand=V(),sprayShoulder=V(),sprayRotation=new THREE.Quaternion();
  const slingRotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,.65,0));
  const state={role,look,profile,weaponId,drawCalls:0,triangles:0};
  group.traverse(object => {if (object.isMesh || object.isSprite) {state.drawCalls++; if (object.geometry) state.triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3;}});

  function update(dt, actor, time, camera) {
    dt = Math.min(.08, Math.max(0, dt || 0));
    group.position.copy(actor.position);
    const yaw=actor.yaw||0;
    if(renderYaw===undefined||dt===0)renderYaw=yaw;
    const yawDifference=Math.atan2(Math.sin(yaw-renderYaw),Math.cos(yaw-renderYaw));
    renderYaw+=yawDifference*(1-Math.exp(-dt*16));
    group.rotation.set(0,renderYaw,0);
    group.scale.set(1, 1, 1);
    const alive = actor.alive !== false;
    if (alive && !lastAlive) {deathAt=-1;crouch=0;gait=.5;renderYaw=yaw;smoothedSpeed=smoothedForward=smoothedSide=0;sprayCancelled=true;sprayEnd=0;tauntCancelled=true;}
    if (!alive && lastAlive) deathAt = time;
    lastAlive = alive;
    const activeWeapon = actor.weaponId || weaponId;
    if (activeWeapon !== previousWeapon) {
      weapon.traverse(object => {if (object.geometry) object.geometry.dispose();});
      weaponRoot.remove(weapon); weapon = buildWeapon(weaponRoot, activeWeapon, palette);
      weaponId = previousWeapon = activeWeapon; state.weaponId = activeWeapon;
    }
    // Works with the public timing field, and also older cores that expose ammo.
    if (Number.isFinite(actor.lastShotAt)) shotAt = Math.max(shotAt, actor.lastShotAt);
    if (observedAmmo !== undefined && actor.ammo < observedAmmo && actor.reloadUntil <= time) shotAt = time;
    observedAmmo = actor.ammo;
    const shotAge = time - shotAt, recoil = shotAge >= 0 && shotAge < .22 ? Math.exp(-shotAge * 23) : 0;
    const reloading = alive && actor.reloadUntil > time;
    if(Number.isFinite(actor.lastSprayAt)&&actor.lastSprayAt>sprayStamp&&actor.sprayUntil>time){
      sprayStamp=actor.lastSprayAt;sprayEnd=actor.sprayUntil;sprayCancelled=false;
      if(!sprayProp){sprayProp=createSprayCan({palette:getArtistTag(actor).palette});sprayProp.group.name='offhand spray can';upper.add(sprayProp.group);}
      else sprayProp.setPalette(getArtistTag(actor).palette);
    }
    // A fresh hit or shot wins immediately, even if the caller has not yet
    // cleared sprayUntil. The same timestamp cannot restart a cancelled pose.
    if(!alive||reloading||(actor.lastShotAt??-Infinity)>sprayStamp||(actor.lastDamageAt??-Infinity)>sprayStamp||actor.sprayUntil===0)sprayCancelled=true;
    const sprayDuration=Math.max(.22,sprayEnd-sprayStamp),sprayAge=time-sprayStamp;
    const raiseTime=Math.min(.13,sprayDuration*.25),recoverTime=Math.min(.18,sprayDuration*.33);
    const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
    const sprayActive=alive&&!sprayCancelled&&sprayAge>=0&&time<sprayEnd;
    const sprayBlend=sprayActive?smooth(sprayAge/raiseTime)*smooth((sprayEnd-time)/recoverTime):0;
    const spraying=sprayActive&&sprayAge>=raiseTime&&time<sprayEnd-recoverTime;
    const sprayStroke=sprayActive?clamp((sprayAge-raiseTime)/Math.max(.08,sprayDuration-raiseTime-recoverTime),0,1):0;
    if(Number.isFinite(actor.tauntStarted)&&actor.tauntStarted>tauntStamp&&actor.tauntUntil>time){
      tauntStamp=actor.tauntStarted;tauntDefinition=getArtistTaunt(actor.tauntId||actor);tauntCancelled=false;
    }
    // The winning shot may share the start timestamp. Only a newer attack
    // cancels; clear/death/spray/reload cancellation needs no end animation.
    if(!alive||reloading||sprayActive||!(actor.tauntUntil>time)||(actor.lastShotAt??-Infinity)>tauntStamp+.00001||(actor.lastDamageAt??-Infinity)>tauntStamp+.00001)tauntCancelled=true;
    const taunt=!tauntCancelled&&tauntDefinition?sampleTaunt(tauntDefinition,time-tauntStamp):null,tauntWeight=taunt?.weight||0;
    tauntSling.visible=tauntWeight>.25;
    if (reloading && !wasReloading) {reloadAt = time; reloadDuration = Math.max(.3, actor.reloadUntil - time);}
    wasReloading = reloading;
    const reloadProgress = reloading ? clamp((time - reloadAt) / reloadDuration, 0, 1) : 0;
    const reloadMotion = reloading ? Math.sin(Math.PI * reloadProgress) : 0;
    const speed = Math.hypot(actor.velocity?.x || 0, actor.velocity?.z || 0);
    const easing=1-Math.exp(-dt*12);
    smoothedSpeed=mix(smoothedSpeed,speed,easing);
    const motion=alive?clamp(smoothedSpeed/5.4,0,1):0;
    smoothedForward=mix(smoothedForward,(actor.velocity?.x||0)*-Math.sin(renderYaw)+(actor.velocity?.z||0)*-Math.cos(renderYaw),easing);
    smoothedSide=mix(smoothedSide,(actor.velocity?.x||0)*Math.cos(renderYaw)+(actor.velocity?.z||0)*-Math.sin(renderYaw),easing);
    smoothedPitch=mix(smoothedPitch,clamp(actor.pitch||0,-.8,.8),1-Math.exp(-dt*18));
    aimBlend=mix(aimBlend,alive&&(actor.ads||actor.aiming||shotAge<.65)?1:0,1-Math.exp(-dt*10));
    const forward=smoothedForward,side=smoothedSide,aimTurn=clamp(Math.atan2(Math.sin(yaw-renderYaw),Math.cos(yaw-renderYaw)),-.55,.55);
    crouch = mix(crouch, actor.crouched && alive ? 1 : 0, 1 - Math.exp(-dt * 13));
    const pose=bodyPose(profile,{crouch});
    head.userData.updatePortrait?.(time,alive,camera?.position.distanceTo(actor.position)||0);
    const locomotion=sampleCharacterMotion(movement,{dt,actor,time,crouch,aimBlend,turnDelta:aimTurn,renderYaw});
    gait=locomotion.phase;
    const motionWeight=alive?1-tauntWeight:0;
    const breath=locomotion.breath*motionWeight;
    upper.position.y=breath;
    const deadProgress = alive ? 0 : clamp((time - deathAt) / .65, 0, 1);
    const fall = deadProgress * deadProgress * (3 - 2 * deadProgress);
    body.position.set(locomotion.bodyOffset[0]*motionWeight,mix(pose.pelvisY+locomotion.bodyOffset[1]*motionWeight,.35*profile.legScale,fall),pose.pelvisZ+locomotion.bodyOffset[2]*motionWeight);
    body.rotation.set(locomotion.bodyRotation[0]*motionWeight,locomotion.bodyRotation[1]*motionWeight,mix(locomotion.bodyRotation[2]*motionWeight,(team? -1:1)*1.24,fall));
    const hurt = alive && time - (actor.lastDamageAt ?? -100) < .2 ? Math.exp(-(time - actor.lastDamageAt) * 16) * .065 : 0;
    upper.rotation.set(-pose.lean+locomotion.torsoRotation[0]*motionWeight-fall*.25+hurt,aimTurn*(1-fall)+locomotion.torsoRotation[1]*motionWeight,locomotion.torsoRotation[2]*motionWeight);
    if(waistApron){waistApron.rotation.x=crouch*1.90;waistApron.scale.y=1-crouch*.78;}
    head.rotation.set(pose.lean*(1-fall)+smoothedPitch*.62+locomotion.headRotation[0]*motionWeight-fall*.16,locomotion.headRotation[1]*motionWeight,locomotion.headRotation[2]*motionWeight-fall*.17);
    if(tauntWeight>0){
      body.position.x+=taunt.shift[0]*profile.legScale;body.position.z+=taunt.shift[2]*profile.legScale;
      body.rotation.x+=taunt.body[0];body.rotation.y+=taunt.body[1];body.rotation.z+=taunt.body[2];
      upper.rotation.x+=taunt.torso[0];upper.rotation.y+=taunt.torso[1];upper.rotation.z+=taunt.torso[2];
      head.rotation.x+=taunt.head[0]+taunt.torso[0]*.55;head.rotation.y+=taunt.head[1];head.rotation.z+=taunt.head[2];
    }
    legs.forEach((leg,i)=>{
      const motionLeg=i?locomotion.right:locomotion.left,step=taunt?.legs[i],crouchLimit=1-crouch*.65;
      leg.upper.position.x=leg.side*.107*profile.hipScale+(step?.stance||0)*profile.legScale;
      leg.upper.rotation.set(mix(motionLeg.hip[0]*(1-tauntWeight)+crouch*1.32*tauntWeight,i?-.2:.93,fall),motionLeg.hip[1]*motionWeight,mix(motionLeg.hip[2]*motionWeight,i?.13:-.18,fall));
      leg.lower.rotation.x=mix(motionLeg.knee*(1-tauntWeight)-crouch*2.18*tauntWeight,i?-.45:-1.13,fall);
      if(step){leg.upper.rotation.x+=step.hip[0]*crouchLimit;leg.upper.rotation.y+=step.hip[1]*crouchLimit;leg.upper.rotation.z+=step.hip[2]*crouchLimit;leg.lower.rotation.x+=step.knee*crouchLimit;}
      leg.foot.rotation.set(mix(mix(motionLeg.ankle,-(leg.upper.rotation.x+leg.lower.rotation.x)*.7,tauntWeight),0,fall),0,0);
      if(motionLeg.ankleQuaternion&&tauntWeight<.001&&alive)leg.foot.quaternion.fromArray(motionLeg.ankleQuaternion);
    });
    tails.forEach((tail,i)=>{tail.scale.y=alive?clamp((pose.pelvisY-.10)/tail.userData.drop,.25,1):1;tail.rotation.x=locomotion.tailSwing*(1-tauntWeight)+Math.sin(time*3+i)*.035*tauntWeight;tail.rotation.z=Math.sin(time*2+i*2)*.012;});
    // Keep a raised weapon level with the aim while the torso bends to crouch.
    // Low ready and stride settling give patrols a relaxed, distinct posture.
    upper.updateMatrix();inverseUpper.copy(upper.quaternion).invert();
    const eyeAboveHip=pose.eye[1]-pose.pelvisY;
    weaponPosition.set(.07*profile.shoulderScale,eyeAboveHip-.28+aimBlend*.15-reloadMotion*.11-fall*.26,-(.245+.055*profile.depthScale)-crouch*.14*profile.torsoScale+recoil*.035+reloadMotion*.055);
    weaponPosition.x+=sprayBlend*.10*profile.shoulderScale;weaponPosition.y-=sprayBlend*.19;weaponPosition.z+=sprayBlend*.07;
    weaponRoot.position.copy(weaponPosition).applyQuaternion(inverseUpper);
    const lowReady=-(1-aimBlend)*(actor.sprinting?.34:.18);
    weaponRoot.rotation.set(smoothedPitch+lowReady-upper.rotation.x+recoil*.065+reloadMotion*.4+fall*.8-sprayBlend*.48,0,reloadMotion*-.34+fall*-.23+sprayBlend*.10);
    weaponRoot.updateMatrix();
    const rightHand = V(0, -.045, .064).applyMatrix4(weaponRoot.matrix);
    const leftGripZ = weaponId === 'pistol' ? -.025 : weaponId === 'smg' ? -.135 : -.17;
    const leftHand = V(-.022, -.02, leftGripZ).applyMatrix4(weaponRoot.matrix);
    if(tauntWeight>0){
      weaponRoot.position.lerp(V(.11*profile.shoulderScale,.25*profile.torsoScale,.225*profile.depthScale),tauntWeight);
      weaponRoot.position.x+=Math.sin(tauntWeight*Math.PI)*.38;
      weaponRoot.quaternion.slerp(slingRotation,tauntWeight);weaponRoot.updateMatrix();
    }
    if (reloading) {
      leftHand.lerp(V(-.08,.115*profile.torsoScale,-.174),Math.sin(Math.PI*clamp(reloadProgress*1.25,0,1))*.88);
      if (reloadProgress > .74) leftHand.z -= Math.sin((reloadProgress - .74) / .26 * Math.PI) * .12;
      // The off-hand travels to the magazine and bolt within this artist's reach.
      // Broad shoulders and shorter forearms must not stretch to a generic path.
      const shoulder=V(-.235*profile.shoulderScale,.477*profile.torsoScale,0);
      leftHand.sub(shoulder).clampLength(0,(arms[0].lengthA+arms[0].lengthB)*.98).add(shoulder);
    }
    if(sprayBlend>0){
      sprayShoulder.set(-.235*profile.shoulderScale,.477*profile.torsoScale,0).applyQuaternion(upper.quaternion);
      sprayHand.set(-.22*profile.shoulderScale+Math.sin(sprayStroke*TAU)*.043,
        eyeAboveHip-.16+Math.sin(sprayStroke*TAU*2)*.020,sprayShoulder.z-.42*profile.armScale).applyQuaternion(inverseUpper);
      leftHand.lerp(sprayHand,sprayBlend);
    }
    if(tauntWeight>0){
      leftHand.multiplyScalar(1-tauntWeight).add(V(taunt.leftHand[0]*profile.shoulderScale,taunt.leftHand[1]*profile.torsoScale,taunt.leftHand[2]*profile.armScale));
      rightHand.multiplyScalar(1-tauntWeight).add(V(taunt.rightHand[0]*profile.shoulderScale,taunt.rightHand[1]*profile.torsoScale,taunt.rightHand[2]*profile.armScale));
    }
    if (!alive) {rightHand.lerp(V(.33, .025, -.1), fall); leftHand.lerp(V(-.32, -.03, -.09), fall);}
    solveArm(arms[0],V(-.235*profile.shoulderScale,.477*profile.torsoScale,0),leftHand,V(-.7,-.6,.13));
    solveArm(arms[1],V(.235*profile.shoulderScale,.477*profile.torsoScale,0),rightHand,V(.7,-.6,.18));
    state.gripError=arms.map((arm,i)=>V(0,-.283*profile.armScale,0).applyQuaternion(arm.lower.quaternion).add(arm.lower.position).distanceTo(i?rightHand:leftHand));
    if(sprayProp){
      // Place the grip on the rendered palm, not the IK target: short/broad
      // characters and crouched shoulders therefore keep a physical hold.
      sprayProp.group.position.set(0,-.283*profile.armScale,-.004*profile.armWidth).applyQuaternion(arms[0].lower.quaternion).add(arms[0].lower.position);
      sprayRotation.setFromEuler(new THREE.Euler(-.08+Math.sin(sprayStroke*TAU)*.035,Math.sin(sprayStroke*TAU)*.065,-.06));
      sprayProp.group.quaternion.copy(inverseUpper).multiply(sprayRotation);
      sprayProp.group.visible=sprayBlend>.035;
      sprayProp.update(dt,{spraying:spraying&&sprayProp.group.visible,time});
    }
    // Feet stay planted despite thigh/knee rotation; the other leg is free to
    // swing. This is visual support only and never changes gameplay positions.
    group.updateMatrixWorld(true);
    let lowest = Infinity;
    const supports=[locomotion.debug.left.support,locomotion.debug.right.support],hasSupport=actor.grounded!==false&&supports.some(Boolean);
    if (alive) for (const [index,leg] of legs.entries()) {
      if(hasSupport&&!supports[index])continue;
      const matrix = leg.foot.matrixWorld.elements, points = leg.footPositions;
      for (let i = 0; i < points.length; i += 3) lowest = Math.min(lowest,
        matrix[1] * points[i] + matrix[5] * points[i + 1] + matrix[9] * points[i + 2] + matrix[13]);
    } else {
      const box = new THREE.Box3();
      body.traverse(object => {
        // A stowed cosmetic prop must not lift a fallen body off the floor.
        if (!object.geometry || object.parent===sprayProp?.group) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
        lowest = Math.min(lowest, box.min.y);
      });
    }
    if(Number.isFinite(lowest)){const correction=actor.position.y+.008-lowest;body.position.y+=alive&&!hasSupport?Math.max(0,correction):correction;}
    flash.position.set(0, .034, weapon.userData.muzzleZ - .035);
    flash.visible = alive && shotAge >= 0 && shotAge < .045;
    flash.rotation.z = time * 31;
    shadow.material.opacity = alive ? .7 : .49;
    shadow.scale.set(1 + fall * .48, 1 + fall * .3, 1);
    protection.visible=alive&&indicatorVisible&&actor.protectedUntil>time;
    protection.material.opacity = .22 + Math.sin(time * 7) * .08;
    indicator.visible=alive&&indicatorVisible;
    relationMark.position.y=pose.indicatorY;
    if(camera?.position){indicatorSize=clamp(camera.position.distanceTo(actor.position)*.026,.095,.66);const size=indicatorSize*(indicatorFocused?1.15:1);relationMark.scale.set(size,size,1);}
    if (!alive) marker.visible = false;
    // Exterior marker visibility is owned by the game's LOS/team policy.
    state.locomotion=locomotion.debug;state.alive=alive;state.crouched=crouch;state.reloading=reloading;state.speed=speed;state.pose=pose;
    state.spraying=spraying;state.sprayBlend=sprayBlend;state.sprayCanVisible=sprayProp?.group.visible||false;state.sprayCancelled=sprayCancelled;
    state.taunting=!!taunt?.active;state.tauntWeight=tauntWeight;state.tauntId=state.taunting?tauntDefinition.id:null;
    return state;
  }

  function updateNameplate(options={}) {
    renderNameplate(marker,{...options,headHeight:state.pose?.height??profile.standingHeight,visible:!!options.visible&&state.alive!==false});
    relationMark.material.opacity=(indicatorFocused?1:.94)*(1-(marker.userData.nameplate?.opacity||0));
  }

  function dispose() {
    if(sprayProp){sprayProp.dispose();sprayProp=null;}
    group.removeFromParent();
    const geometries=new Set(),materials=new Set(),textures=new Set();
    group.traverse(object=>{
      if(object.geometry&&!geometries.has(object.geometry)){geometries.add(object.geometry);object.geometry.dispose();}
      for(const material of(Array.isArray(object.material)?object.material:[object.material])){
        if(!material||material===sharedCloth||material===sharedWeapon||materials.has(material))continue;
        materials.add(material);
        for(const key of['map','normalMap','roughnessMap','metalnessMap','bumpMap','aoMap']){
          const texture=material[key];if(!texture||textures.has(texture)||texture.userData.characterShared||texture===shadowTexture||[...relationTextures.values()].includes(texture))continue;
          textures.add(texture);texture.dispose();
        }
        material.dispose();
      }
    });
  }
  update(0, {position: V(), alive: true, yaw: 0, velocity: V()}, 0);
  return {group,g:group,marker,shadow,indicator,profile,update,updateNameplate,setRelation,setIndicator,setVisible:value=>{group.visible=!!value;},dispose,state};
}

export default createActorModel;
