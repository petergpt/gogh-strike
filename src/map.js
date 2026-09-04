
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Verbatim generation from the checksum-verified original, scoped as a reusable map.
export function createTown() {

// No textures or models: this entire geography is drawn with geometry and pigment.
const $ = s => document.querySelector(s);
const TAU=Math.PI*2, clamp=THREE.MathUtils.clamp, lerp=THREE.MathUtils.lerp;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
let rng=18881890;
function rand(){rng=(Math.imul(1664525,rng)+1013904223)|0;return (rng>>>0)/4294967296;}
const rr=(a,b)=>a+(b-a)*rand(), pick=a=>a[Math.floor(rand()*a.length)];
const scene=new THREE.Scene();
scene.background=new THREE.Color('#15294d');
const camera=new THREE.PerspectiveCamera(69,innerWidth/innerHeight,.055,800);
camera.rotation.order='YXZ';
scene.add(camera);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});}
catch(e){$('#error').style.display='block';$('#error').textContent='This painted world needs WebGL. Please enable graphics acceleration and reload.';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
renderer.domElement.id='world';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Van Gogh Strike game world. Click to capture the mouse.');
document.body.prepend(renderer.domElement);
scene.add(new THREE.HemisphereLight('#d3e2ff','#69746c',.95));
const sun=new THREE.DirectionalLight('#ffe0aa',.85);sun.position.set(-18,45,27);scene.add(sun);
const warmRoom=new THREE.PointLight('#ffd787',7,16,1.7);warmRoom.position.set(-1,3.8,-2);scene.add(warmRoom);
const cafeLight=new THREE.PointLight('#ffd052',30,30,1.5);cafeLight.position.set(-17,5,-4);scene.add(cafeLight);

const palettes=[
['#233c4d','#7c99bd','#99b3d0','#648bb4','#999fc4','#deb144','#f1d170','#a57937','#a63525','#c34c30','#b67c5f','#d29b73','#398474','#79a68b','#e5d7a8','#526679'],
['#101d36','#132e64','#2d5291','#e7b03b','#f3cd59','#f7e1a0','#a87338','#9b593c','#6c6a71','#4a5c7b','#aa925f','#284239','#1c2431','#793f37','#cb9138','#ccd0b6'],
['#071b35','#0c2a4b','#194365','#265d78','#527c91','#cf992f','#e9bd4d','#f6d880','#405756','#243b35','#877348','#759399','#070f24','#374b5b','#b69649','#dde0b7'],
['#102940','#163e67','#20528a','#4275a1','#d8ac34','#efce52','#bc862f','#af7040','#805443','#4f693f','#222c32','#839c58','#dcba57','#936c36','#101821','#7692a6'],
['#8d692c','#b68b31','#d5ae3c','#ecd250','#f2d96a','#d49221','#ad711f','#87501f','#624527','#667444','#849644','#b99a38','#e5bd49','#d9bc61','#f6df89','#3d482f']
];
const paletteUniforms=palettes.map(p=>p.map(c=>new THREE.Color(c)));
const brushUniforms=[];
const brushVertex=`
attribute float aPigment;attribute float aSeed;attribute vec3 aAnchor;
uniform float uTime;uniform float uMode;uniform float uTempo;
varying float vPigment;varying float vSeed;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;
void main(){
  vPigment=aPigment;vSeed=aSeed;vLocal=position;
  vec3 p=position;float flutter=sin(uTime*uTempo+aSeed*18.1)*.013;
  p.xy=mat2(cos(flutter),-sin(flutter),sin(flutter),cos(flutter))*p.xy;
  vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);
  if(uMode==1.){float h=max(0.,w.y-aAnchor.y);float wind=sin(w.x*.19+w.z*.29-uTime*1.25)+.45*sin(w.z*.58-uTime*1.65);w.x+=wind*h*h*.19;w.z+=sin(w.x*.27-uTime*.8)*h*.075;}
  if(uMode==2.||uMode==3.){w.y+=sin(w.x*.34+w.z*.52+uTime*.55)*.037;w.x+=sin(w.z*.5+uTime*.46+aSeed*.9)*.16;if(uMode==3.)w.x+=sin(uTime*.72+w.z*.7)*.14;}
  if(uMode==4.){vec3 d=w.xyz-aAnchor;float a=sin(uTime*.23+aAnchor.x*.7)*.035;w.x=aAnchor.x+d.x*cos(a)+d.z*sin(a)+sin(uTime*.48+aAnchor.z)*d.y*d.y*.011;w.z=aAnchor.z-d.x*sin(a)+d.z*cos(a);}
  if(uMode==5.){w.xyz=aAnchor+(w.xyz-aAnchor)*(1.+.045*sin(uTime*.58+aSeed));}
  if(uMode==6.){float y=mod(w.y-aAnchor.y+uTime*.28,5.);w.y=aAnchor.y+y;w.x+=sin(y*1.5+uTime*.35)*.36;}
  if(uMode==7.){w.z+=sin(uTime*.8+w.y*1.8+w.x*2.)*.055*(1.-smoothstep(3.1,4.,w.y));}
  if(uMode==8.){w.y+=sin(uTime*.35+aSeed*20.)*.07;w.x+=sin(uTime*.21+aSeed*31.)*.075;}
  vec3 sc=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
  vNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*(normal/max(sc,vec3(.00001))));vWorld=w.xyz;
  gl_Position=projectionMatrix*viewMatrix*w;
}`;
const brushFragment=`
uniform vec3 uPalette[16];uniform float uHour;uniform float uTime;uniform float uMode;uniform float uAlpha;
varying float vPigment;varying float vSeed;varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;
void main(){
  vec3 col=uPalette[0];for(int i=0;i<16;i++){if(abs(vPigment-float(i))<.45)col=uPalette[i];}
  float lambert=max(dot(normalize(vNormal),normalize(vec3(-.48,.86,.46))),0.);
  float grooves=.96+.045*sin(vLocal.x*83.+sin(vLocal.y*18.+vSeed)*1.3)+.017*sin(vLocal.x*191.+vSeed);
  float edge=smoothstep(.51,.31,abs(vLocal.x));
  col*= (.79+lambert*.32)*grooves*(.91+.09*edge)*(.94+.10*fract(vSeed*9.41));
  col*=vec3(1.+uHour*.055,1.+uHour*.012,1.-uHour*.05);
  if(uMode==3.){float ribbon=sin(uTime*.48+vWorld.z*1.8+vSeed*4.);if(ribbon<-.67)discard;col*=1.06+.2*sin(uTime*.6+vWorld.z*.6);}
  if(uMode==5.)col*=1.23+.15*sin(uTime*.6+vSeed);
  float alpha=uAlpha;if(uMode==6.)alpha*=.44;
  gl_FragColor=vec4(col,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function brushMaterial(zone,mode=0){const m=new THREE.ShaderMaterial({vertexShader:brushVertex,fragmentShader:brushFragment,uniforms:{uPalette:{value:paletteUniforms[zone]},uTime:{value:0},uHour:{value:0},uMode:{value:mode},uTempo:{value:[.26,.75,.34,1.1,.44][zone]},uAlpha:{value:1}},side:THREE.DoubleSide,transparent:mode===6,depthWrite:mode!==6});brushUniforms.push(m.uniforms);return m;}
function makeBrush(){
 const outline=[[-.40,-.5], [.24,-.49],[.48,-.28],[.46,.31],[.23,.49],[-.34,.47],[-.48,.18],[-.5,-.29]], pos=[],idx=[];
 outline.forEach(([x,y])=>pos.push(x,y,-.1));outline.forEach(([x,y],i)=>pos.push(x*.94,y*.94,.17+(i%3)*.035));pos.push(-.06,0,.39);
 for(let i=0;i<8;i++){const j=(i+1)%8;idx.push(i,j,i+8,j,j+8,i+8,16,i+8,j+8);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const brushGeo=makeBrush(), batchMap=new Map(), brushBatches=[], allMeshes=[];
const basis=new THREE.Matrix4(), dummy=new THREE.Object3D();
function dab(zone,p,dir,len,width,depth=0.07,pigment=0,mode=0,normal=V(0,0,1),anchor=null,localBatch=null){
 let y=dir.clone().normalize(),z=normal.clone().normalize();if(Math.abs(y.dot(z))>.97)z=V(1,0,0);let x=new THREE.Vector3().crossVectors(y,z).normalize();z.crossVectors(x,y).normalize();
 basis.makeBasis(x,y,z);dummy.quaternion.setFromRotationMatrix(basis);dummy.position.copy(p);dummy.scale.set(width,len,depth);dummy.updateMatrix();
 const data={m:dummy.matrix.clone(),c:pigment,s:rand()*100,a:(anchor||p).clone()};
 if(localBatch){localBatch.data.push(data);return;}
 let key=zone+'_'+mode+'_'+Math.floor(p.x/24)+'_'+Math.floor(p.z/24);if(!batchMap.has(key))batchMap.set(key,{zone,mode,data:[],center:V(Math.floor(p.x/24)*24+12,0,Math.floor(p.z/24)*24+12),parent:scene});batchMap.get(key).data.push(data);
}
function buildBatch(b,local=false){
 const d=b.data;for(let i=d.length-1;i>0;i--){let j=Math.floor(rand()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
 const g=brushGeo.clone(),pig=new Float32Array(d.length),seeds=new Float32Array(d.length),anchors=new Float32Array(d.length*3);
 const mesh=new THREE.InstancedMesh(g,brushMaterial(b.zone,b.mode),d.length);for(let i=0;i<d.length;i++){mesh.setMatrixAt(i,d[i].m);pig[i]=d[i].c;seeds[i]=d[i].s;d[i].a.toArray(anchors,i*3);}
 g.setAttribute('aPigment',new THREE.InstancedBufferAttribute(pig,1));g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,1));g.setAttribute('aAnchor',new THREE.InstancedBufferAttribute(anchors,3));
 mesh.frustumCulled=false;mesh.userData={max:d.length,zone:b.zone,mode:b.mode,local,center:b.center||V()};b.parent.add(mesh);brushBatches.push(mesh);return mesh;
}
const matCache=new Map(),solidBins=new Map();
function material(color){if(!matCache.has(color))matCache.set(color,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));return matCache.get(color);}
function solid(g,color,pos=V(),rot=V(),parent=null){
 const matrix=new THREE.Matrix4().compose(pos,new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x,rot.y,rot.z)),V(1,1,1));
 if(parent){const m=new THREE.Mesh(g,material(color));m.applyMatrix4(matrix);parent.add(m);return m;}
 const key=color;g.applyMatrix4(matrix);if(!solidBins.has(key))solidBins.set(key,[]);solidBins.get(key).push(g);
}
function box(x,y,z,w,h,d,color,rot=V(),parent=null){return solid(new THREE.BoxGeometry(w,h,d),color,V(x,y,z),rot,parent);}
function rod(a,b,r,color,parent=null){let dir=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5),g=new THREE.CylinderGeometry(r,r,dir.length(),5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0,1,0),dir.normalize()));solid(g,color,mid,V(),parent);}
function outlineBox(x,y,z,w,h,d,color='#283e4d',r=.022,parent=null){
 const pts=[];for(let i=0;i<8;i++)pts.push(V(x+((i&1)?1:-1)*w/2,y+((i&2)?1:-1)*h/2,z+((i&4)?1:-1)*d/2));for(let i=0;i<8;i++)for(let bit of[1,2,4])if(!(i&bit))rod(pts[i],pts[i|bit],r,color,parent);
}
function quad(a,b,c,d,color){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...b.toArray(),...c.toArray(),...d.toArray()],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();solid(g,color);}
function panel(a,b,c,d,zone,colors,stepU=.19,stepV=.48,mode=0,flip=false){
 let u=b.clone().sub(a),v=d.clone().sub(a),nx=Math.max(1,Math.round(u.length()/stepU)),ny=Math.max(1,Math.round(v.length()/stepV));const normal=u.clone().cross(v).normalize();
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){let fu=(i+rr(.18,.82))/nx,fv=(j+rr(.2,.8))/ny;let low=a.clone().lerp(b,fu),hi=d.clone().lerp(c,fu),p=low.lerp(hi,fv).addScaledVector(normal,.022);let dir=flip?u.clone().normalize():v.clone().normalize();dir.addScaledVector(flip?v:u,rr(-.009,.009)).normalize();dab(zone,p,dir,(flip?u.length()/nx:v.length()/ny)*rr(.78,1.5),(flip?v.length()/ny:u.length()/nx)*rr(.44,.9),rr(.025,.09),pick(colors),mode,normal);}
}
function paintedBox(x,y,z,w,h,d,zone,pigments,color,opts={}){
 box(x,y,z,w,h,d,color);const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,f=z-d/2,g=z+d/2;
 if(opts.outline!==false)outlineBox(x,y,z,w,h,d,palettes[zone][0],opts.radius||.024);
 const st=opts.step||.17;
 panel(V(a,c,g),V(b,c,g),V(b,e,g),V(a,e,g),zone,pigments,st,.4);
 panel(V(b,c,f),V(a,c,f),V(a,e,f),V(b,e,f),zone,pigments,st,.4);
 panel(V(a,c,f),V(a,c,g),V(a,e,g),V(a,e,f),zone,pigments,st,.4);
 panel(V(b,c,g),V(b,c,f),V(b,e,f),V(b,e,g),zone,pigments,st,.4);
 panel(V(a,e,g),V(b,e,g),V(b,e,f),V(a,e,f),zone,pigments,st,.4);
}
function ellipsoid(x,y,z,rx,ry,rz,color,parent=null){const g=new THREE.SphereGeometry(1,12,8);g.scale(rx,ry,rz);return solid(g,color,V(x,y,z),V(),parent);}
function ring(x,y,z,r,t,color,rot=V(-Math.PI/2,0,0),parent=null){return solid(new THREE.TorusGeometry(r,t,5,28),color,V(x,y,z),rot,parent);}
function curve(points,r,color,parent=null){const path=new THREE.CatmullRomCurve3(points);solid(new THREE.TubeGeometry(path,Math.max(6,points.length*4),r,5,false),color,V(),V(),parent);}
const colliders=[];
function wallCollision(a,b){colliders.push({a:V(a[0],0,a[1]),b:V(b[0],0,b[1])});}
function rectCollision(x,z,w,d){wallCollision([x-w/2,z-d/2],[x+w/2,z-d/2]);wallCollision([x+w/2,z-d/2],[x+w/2,z+d/2]);wallCollision([x+w/2,z+d/2],[x-w/2,z+d/2]);wallCollision([x-w/2,z+d/2],[x-w/2,z-d/2]);}
function ground(x,z){const field=clamp((x-20)/16,0,1);return field*(.2+.8*Math.sin((x-18)*.034)*Math.sin((z+17)*.037))-(1-field)*clamp((-z-20)/25,0,1)*.43;}
function groundStroke(zone,x,z,dir,len,width,pigment,mode=0){const y=ground(x,z);dab(zone,V(x,y+.035,z),dir,len,width,.05,pigment,mode,V(0,1,0));}
function shadow(x,z,rx,rz,color,y=0){const g=new THREE.CircleGeometry(1,26);g.rotateX(-Math.PI/2);g.scale(rx,1,rz);solid(g,color,V(x,y+.008,z));}

// THE BEDROOM: the four corners really do not meet at right angles.
function makeBedroom(){
 const A=V(-5.25,0,-4.8),B=V(5.1,0,-4.5),C=V(5.8,0,6.0),D=V(-5.95,0,6.0),h=4.75;
 quad(A,D,C,B,'#ab745c');panel(A,D,C,B,0,[10,10,11],.60,.14,0,true);
 // A complete ceiling keeps the first composition wholly inside the bedroom.
 quad(A.clone().setY(h),B.clone().setY(h),C.clone().setY(h),D.clone().setY(h),'#7e98bb');
 panel(A.clone().setY(h-.025),B.clone().setY(h-.025),C.clone().setY(h-.025),D.clone().setY(h-.025),0,[1,1,4],.19,.65);
 for(let i=0;i<23;i++){const t=i/22;const a=A.clone().lerp(B,t),b=D.clone().lerp(C,t);a.y=b.y=.026;rod(a,b,.016,'#71594a');for(let j=0;j<5;j++){const q=lerp(-4.6,5.5,(j+.4)/5);rod(V(lerp(a.x,b.x,(q+4.8)/10.8),.026,q),V(lerp(a.x,b.x,(q+4.8)/10.8)+.43,.026,q+.024),.012,'#825f4c');}}
 // Back wall and tilted right wall, woven with short, impasto lavender strokes.
 quad(A,B,B.clone().setY(h),A.clone().setY(h),'#819ec1');panel(A,B,B.clone().setY(h),A.clone().setY(h),0,[1,1,2,4],.11,.40);
 quad(B,C,C.clone().setY(h),B.clone().setY(h),'#8ba4c5');panel(B,C,C.clone().setY(h),B.clone().setY(h),0,[1,1,2,4],.11,.40);
 // The left-hand opening is genuinely open, continuing into the golden passage.
 const doorZ0=.30,doorZ1=2.25;const leftX=z=>lerp(-5.25,-5.95,(z+4.8)/10.8);
 for(let[a,b,low,high]of[[-4.8,doorZ0,0,h],[doorZ1,6,0,h],[doorZ0,doorZ1,3.45,h]]){let p=V(leftX(a),low,a),q=V(leftX(b),low,b),r=V(leftX(b),high,b),s=V(leftX(a),high,a);quad(q,p,s,r,'#8b9fc1');panel(q,p,s,r,0,[1,2,4],.18,.5);}
 // Front wall behind the viewpoint, with a second return door onto the bedroom lane.
 for(let[a,b]of[[-5.95,-2.6],[-.7,5.8]]){quad(V(a,0,6),V(b,0,6),V(b,h,6),V(a,h,6),'#859ebc');panel(V(a,0,5.98),V(b,0,5.98),V(b,h,5.98),V(a,h,5.98),0,[1,2,4],.18,.5);}
 box(-1.65,4.13,6,1.9,1.23,.13,'#859ebc');
 rod(A.clone().setY(.1),B.clone().setY(.1),.055,'#536b85');rod(B.clone().setY(.1),C.clone().setY(.1),.055,'#536b85');
 wallCollision([-5.25,-4.8],[5.1,-4.5]);wallCollision([5.1,-4.5],[5.8,6]);wallCollision([-5.25,-4.8],[leftX(doorZ0),doorZ0]);wallCollision([leftX(doorZ1),doorZ1],[-5.95,6]);wallCollision([-5.95,6],[-2.6,6]);wallCollision([-.7,6],[5.8,6]);
 // Raised yellow bed, with a long red quilt and pale pillows.
 const bx=3.0,bz=-.5,bw=3.35,bd=5.7;
 shadow(bx,bz,bw*.58,bd*.55,'#746864');
 paintedBox(bx,.75,bz,bw,.35,bd,0,[5,6,7],'#c59439',{step:.14});
 for(let x of[bx-bw*.44,bx+bw*.44])for(let z of[bz-bd*.46,bz+bd*.46]){paintedBox(x,.63,z,.24,1.24,.27,0,[5,6,7],'#e4b844',{step:.13});ellipsoid(x,1.31,z,.18,.12,.18,'#edc95a');}
 paintedBox(bx,1.10,bz,bw-.18,.36,bd-.13,0,[14,6],'#d7bf80',{step:.16});
 paintedBox(bx,1.33,.37,bw-.15,.22,3.91,0,[8,8,9],'#ac3c29',{step:.10});
 // The red blanket hangs over the right side, its strokes following the fold.
 panel(V(4.55,.82,-1.47),V(4.7,.82,2.28),V(4.65,1.43,2.28),V(4.6,1.43,-1.47),0,[8,9],.13,.3);
 for(let j=0;j<6;j++)curve([V(1.48+j*.48,1.46,-1.5),V(1.5+j*.49,1.44,.2),V(1.54+j*.48,1.45,2.27)],.019,j%2?'#9d3428':'#c95835');
 paintedBox(bx,1.55,-2.42,2.88,.31,1.29,0,[14,14,6],'#e3d7a4',{step:.14});
 for(let i=0;i<15;i++)dab(0,V(rr(1.66,4.27),1.738,rr(-2.9,-1.85)),V(1,0,rr(-.15,.15)),rr(.25,.65),rr(.035,.09),.03,pick([14,6]),0,V(0,1,0));
 // Broad rails and the uneven bedstead seen in the original painting.
 for(let zz of[-3.36,2.39]){let hh=zz<0?2.08:1.51;paintedBox(bx,hh,zz,bw+.18,.35,.21,0,[5,5,6,7],'#dfb14c',{step:.16});for(let xx of[1.27,4.75]){paintedBox(xx,hh-.45,zz,.26,1.34,.28,0,[5,6,7],'#d5a23b',{step:.12});ellipsoid(xx,hh+.21,zz,.18,.17,.18,'#ebc55d');}if(zz<0)for(let xx of[1.8,2.6,3.4,4.2])paintedBox(xx,hh-.43,zz,.10,.67,.12,0,[5,7],'#bd8c36',{step:.1});}
 rectCollision(bx,bz,bw+.16,bd+.25);
 makeChair(-3.66,2.48,-.12,0,1.02);makeChair(-2.80,-3.34,.05,0,.79);
 // Wash table, bowl, water jug, bottle and the small mirror.
 paintedBox(-4.18,1.3,-2.27,1.86,.18,1.71,0,[5,6,7,10],'#ca8c42',{step:.12});
 for(let x of[-4.87,-3.5])for(let z of[-2.91,-1.65]){rod(V(x,0,z),V(x+.02,1.26,z),.09,'#a56d32');dab(0,V(x+.06,.66,z+.08),V(0,1,0),1.14,.09,.08,5);}
 rectCollision(-4.18,-2.27,1.86,1.71);
 ellipsoid(-4.03,1.46,-2.10,.56,.16,.42,'#babfba');ring(-4.03,1.54,-2.1,.47,.035,'#ddd7a5');ellipsoid(-4.03,1.55,-2.1,.39,.025,.30,'#608e9b');
 const jug=new THREE.LatheGeometry([new THREE.Vector2(.14,0),new THREE.Vector2(.3,.08),new THREE.Vector2(.33,.42),new THREE.Vector2(.15,.59),new THREE.Vector2(.18,.68)],14);solid(jug,'#aac4ce',V(-4.6,1.40,-2.68));ring(-4.88,1.78,-2.64,.2,.038,'#778d9a',V(0,Math.PI/2,0));
 for(let i=0;i<35;i++){const a=rand()*TAU,h=rr(0,.62);dab(0,V(-4.6+Math.cos(a)*(.2+.09*Math.sin(h*5)),1.44+h,-2.68+Math.sin(a)*.24),V(0,1,0),rr(.10,.22),.052,.02,pick([2,14,15]),0,V(Math.cos(a),0,Math.sin(a)));}
 solid(new THREE.CylinderGeometry(.07,.09,.5,9),'#367366',V(-3.53,1.65,-2.73));solid(new THREE.CylinderGeometry(.038,.04,.15,7),'#254b46',V(-3.53,1.97,-2.73));
 box(-3.81,1.43,-1.61,.42,.06,.22,'#dcac5a',V(0,.16,0));
 // Green casement, a window ajar: the glass is a small piece of the cobalt world.
 const wx=-.14,wz=-4.66;
 paintedBox(wx,3.03,wz+.09,2.04,2.28,.14,0,[7,5,6],'#baa345',{step:.13});box(wx,3.04,wz+.19,1.82,2.03,.07,'#244d54');
 for(let x of[-1.11,.84])paintedBox(x,3.03,wz+.25,.11,2.27,.14,0,[12,13],'#3e8070',{step:.11});
 paintedBox(wx,3.03,wz+.28,.10,2.13,.15,0,[12,13],'#4a8c77',{step:.1});paintedBox(wx,3.08,wz+.3,1.96,.09,.16,0,[12,13],'#4e8d76',{step:.12});
 for(let i=0;i<4;i++)box(-.66+(i%2)*.91,2.59+Math.floor(i/2)*.93,wz+.3,.77,.77,.012,i<2?'#598d83':'#316e78');
 // Left shutter projects into the room, with real slanted slats.
 const sh=new THREE.Group();sh.position.set(-1.08,3.03,wz+.34);sh.rotation.y=.50;scene.add(sh);
 box(-.41,0,0,.83,2.12,.09,'#3e7a67',V(),sh);for(let y=-.94;y<1;y+=.17){box(-.41,y,.07,.76,.075,.09,y>0?'#77a280':'#5e9273',V(.09,0,0),sh);}for(let x of[-.81,-.03])box(x,0,.07,.07,2.1,.13,'#b5b875',V(),sh);
 const curtainB={zone:0,mode:7,data:[],parent:scene};
 for(let side of[-1,1]){const x=wx+side*1.14;for(let i=0;i<6;i++)for(let j=0;j<22;j++){let yy=1.96+j*.093,xx=x+side*i*.075;dab(0,V(xx,yy,wz+.47+Math.sin(i)*.08),V(0,1,0),.18,.065,.025,pick([14,2,13]),7,V(0,0,1),V(),curtainB);}}buildBatch(curtainB,true);
 // Portraits and drawings are themselves little strokes, never imported images.
 portrait(5.21,3.51,-2.82,.93,1.12,-Math.PI/2,1);portrait(5.34,3.54,-1.15,.89,1.15,-Math.PI/2,2);portrait(5.43,2.18,-2.40,.74,.56,-Math.PI/2,3);portrait(5.53,2.24,-.86,.77,.58,-Math.PI/2,4);
 portrait(2.87,3.89,-4.40,.82,.66,0,5);portrait(4.11,3.83,-4.38,.79,.65,0,6);
 // Straw hat and hanging blue clothes.
 const hat=new THREE.Group();hat.position.set(-3.46,3.47,-4.56);hat.rotation.x=Math.PI/2-.09;scene.add(hat);ellipsoid(0,0,0,.55,.065,.55,'#d6b56b',hat);ellipsoid(0,.08,0,.30,.24,.30,'#c79444',hat);ring(0,.15,0,.30,.055,'#7e7049',V(-Math.PI/2,0,0),hat);
 for(let i=0;i<80;i++){let a=rand()*TAU,r=rr(.20,.56);dab(0,V(-3.46+Math.cos(a)*r,3.47+Math.sin(a)*r,-4.43),V(-Math.sin(a),Math.cos(a),0),.18,.044,.025,pick([5,6,7]));}
 paintedBox(2.20,2.18,-4.38,.76,1.07,.09,0,[1,3,15],'#5c82a3',{step:.10});rod(V(1.75,2.82,-4.34),V(2.85,2.82,-4.3),.027,'#586b78');
 // Brush-built sunlight and floating dust at the open window.
 for(let i=0;i<155;i++){let d=rr(0,4);dab(0,V(wx+rr(-.8,.8)+d*.15,rr(.9,3.9),wz+.8+d),V(.2,1,.2),rr(.015,.032),rr(.009,.025),.01,pick([14,6]),8,V(0,0,1));}
 // Doorposts, warm edge light and the lavender door pulled inward.
 const dx=leftX(1.25)+.05;for(let zz of[.30,2.25]){paintedBox(dx,1.78,zz,.17,3.57,.17,0,[5,6,7],'#d2b66b',{step:.15});rod(V(dx+.11,0,zz),V(dx+.11,3.5,zz),.035,'#f0d48c');}box(dx,3.51,1.27,.22,.2,2.11,'#c5a963');
 const door=new THREE.Group();door.position.set(dx+.08,0,2.22);door.rotation.y=-.86;scene.add(door);box(0,1.66,-.86,.13,3.3,1.72,'#647f98',V(),door);for(let z of[-.35,-1.25])box(.085,1.63,z,.05,2.86,.64,'#8497ac',V(),door);ellipsoid(.15,1.54,-1.48,.05,.05,.05,'#c7a343',door);
 const lamp=new THREE.PointLight('#ffc14e',22,7,1.7);lamp.position.set(-6.8,2.2,1.3);scene.add(lamp);
}
function makeChair(x,z,angle,zone=0,scale=1){
 const col=zone===0?'#dcb657':'#65714b',dark=zone===0?'#54635a':'#253a36';const group=new THREE.Group();group.position.set(x,ground(x,z),z);group.rotation.y=angle;group.scale.setScalar(scale);scene.add(group);
 const b={zone,mode:0,data:[],parent:group};
 function piece(a,c,w,p){rod(a,c,w,dark,group);dab(zone,a.clone().lerp(c,.5),c.clone().sub(a),a.distanceTo(c),w*1.6,w*1.1,p,0,V(0,0,1),V(),b);}
 for(let xx of[-.43,.43])for(let zz of[-.4,.4])piece(V(xx,0,zz),V(xx,zz<0?1.82:.92,zz-.09),.055,zone===0?5:11);
 box(0,.84,0,.88,.13,.87,col,V(),group);outlineBox(0,.84,0,.88,.13,.87,dark,.035,group);
 for(let i=0;i<14;i++){let n=-.38+i*.058;dab(zone,V(n,.917,0),V(.14,0,1),.83,.052,.034,zone===0?pick([5,6,7]):pick([6,10,11]),0,V(0,1,0),V(),b);}
 for(let yy of[1.14,1.46,1.73]){piece(V(-.44,yy,-.45),V(.44,yy,-.45),.048,zone===0?5:11);}
 piece(V(-.42,.35,.40),V(.42,.35,.40),.035,zone===0?7:11);piece(V(-.43,.3,-.4),V(-.43,.3,.4),.034,zone===0?7:11);buildBatch(b,true);return group;
}
function portrait(x,y,z,w,h,rotY,variant){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;scene.add(g);box(0,0,0,w+.13,h+.13,.10,'#645b46',V(),g);box(0,0,.061,w,h,.03,'#c7b16f',V(),g);box(0,0,.082,w-.11,h-.10,.012,variant<3?'#6e8f8e':'#c3c0a0',V(),g);
 const b={zone:0,mode:0,data:[],parent:g};for(let i=0;i<55;i++){let xx=rr(-w*.42,w*.42),yy=rr(-h*.43,h*.43);dab(0,V(xx,yy,.099),V(.15,1,0),rr(.055,.13),rr(.025,.06),.017,pick(variant<3?[12,13,3,7]:[14,5,2]),0,V(0,0,1),V(),b);}
 if(variant<3){for(let i=0;i<30;i++){let a=rand()*TAU,r=Math.sqrt(rand());dab(0,V(Math.cos(a)*w*.2*r,Math.sin(a)*h*.23*r+h*.10,.126),V(.1,1,0),.1,.07,.025,pick([5,7,10,14]),0,V(0,0,1),V(),b);}for(let i=0;i<20;i++)dab(0,V(rr(-w*.3,w*.3),rr(-h*.4,-h*.10),.122),V(.1,1,0),.16,.06,.02,pick([0,15,3]),0,V(0,0,1),V(),b);dab(0,V(-.045,h*.11,.15),V(1,0,0),.05,.023,.01,0,0,V(0,0,1),V(),b);}else for(let j=0;j<6;j++)dab(0,V(rr(-w*.3,w*.3),rr(-h*.3,h*.3),.13),V(1,rr(-.3,.3),0),rr(.14,.33),.022,.013,7,0,V(0,0,1),V(),b);
 buildBatch(b,true);
}

const animatedPeople=[],boats=[],halos=[],crows=[];
function terrain(){
 const pos=[],colors=[],color=new THREE.Color();
 for(let x=-160;x<200;x+=6)for(let z=-49;z<145;z+=6){let zone=x>70?4:x>23?3:1;let cc=zone===1?'#353f43':zone===3?'#a88838':'#b4963a';color.set(cc);for(let [u,v]of[[0,0],[6,0],[6,6],[0,0],[6,6],[0,6]]){pos.push(x+u,ground(x+u,z+v)-.07,z+v);colors.push(color.r,color.g,color.b);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));scene.add(m);
 for(let i=0;i<5900;i++){let x=rr(-44,111),z=rr(-48,37);if(x>-6&&x<6&&z>-5&&z<6)continue;let zone=x>70?4:x>23?3:1;groundStroke(zone,x,z,V(rr(.4,1),0,rr(-.4,.4)),rr(.35,1.3),rr(.08,.28),zone===1?pick([8,9,11]):zone===3?pick([4,6,9,12]):pick([1,2,9,11]));}
}
const routePoints=[[-8.6,15],[-9,5],[-9.1,-6],[-8.3,-20],[-5.2,-31],[3,-39],[14,-43],[23,-41],[29,-35]];
function ribbon(points,width,color,zone,strokeCount=1800,pigments=[7,8,10]){
 const path=new THREE.CatmullRomCurve3(points.map(p=>V(p[0],0,p[1]))), positions=[];
 for(let i=0;i<80;i++){let t=i/80,t2=(i+1)/80,p=path.getPoint(t),q=path.getPoint(t2),tan=path.getTangent(t),tan2=path.getTangent(t2),n=V(-tan.z,0,tan.x).normalize().multiplyScalar(width/2),n2=V(-tan2.z,0,tan2.x).normalize().multiplyScalar(width/2);let a=p.clone().add(n),b=p.clone().sub(n),c=q.clone().sub(n2),d=q.clone().add(n2);for(let v of[a,b,c,a,c,d])positions.push(v.x,ground(v.x,v.z)+.015,v.z);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();solid(geo,color);
 for(let i=0;i<strokeCount;i++){const t=rand(),p=path.getPoint(t),tan=path.getTangent(t),n=V(-tan.z,0,tan.x).normalize();p.addScaledVector(n,rr(-width*.48,width*.48));groundStroke(zone,p.x,p.z,tan,rr(.3,.72),rr(.13,.30),pick(pigments));}
 return path;
}
function warmHall(){
 // A bend, rather than a portal: all of the outside light is around the corner.
 quad(V(-10.8,.01,.28),V(-5.6,.01,.28),V(-5.6,.01,2.3),V(-10.8,.01,2.3),'#a9793d');panel(V(-10.8,.024,.28),V(-5.6,.024,.28),V(-5.6,.024,2.3),V(-10.8,.024,2.3),1,[3,6,10,14],.18,.42);
 for(let z of[.25,2.33]){let end=z>2?-8.67:-10.82;paintedBox((end-5.6)/2,1.8,z,Math.abs(end+5.6),3.6,.15,1,[3,4,6,14],'#bb944a',{step:.17});wallCollision([end,z],[-5.6,z]);}
 paintedBox(-10.84,1.8,2.8,.16,3.6,5.1,1,[3,4,6],'#c19b45',{step:.16});wallCollision([-10.84,.25],[-10.84,5.35]);
 paintedBox(-8.62,1.8,3.84,.16,3.6,3.02,1,[3,4,14],'#d0a34b',{step:.17});wallCollision([-8.62,2.33],[-8.62,5.35]);
 quad(V(-10.75,.01,2.3),V(-8.69,.01,2.3),V(-8.69,.01,8.4),V(-10.75,.01,8.4),'#b38949');panel(V(-10.75,.026,8.4),V(-8.69,.026,8.4),V(-8.69,.026,2.3),V(-10.75,.026,2.3),1,[3,6,10],.16,.4);
 for(let z of[3.2,5.2]){box(-9.73,3.55,z,2.36,.19,.22,'#b18a43');for(let x of[-10.7,-8.75])rod(V(x,0,z),V(x,3.55,z),.055,'#f2c963');}
 // Cobalt on the street face, gold inside the passage.
 quad(V(-10.94,0,5.43),V(-10.94,0,.18),V(-10.94,3.7,.18),V(-10.94,3.7,5.43),'#284a78');
 panel(V(-10.95,0,5.43),V(-10.95,0,.18),V(-10.95,3.7,.18),V(-10.95,3.7,5.43),1,[1,2,8,9],.19,.52);
 quad(V(-11.05,3.75,5.5),V(-8.4,3.75,5.5),V(-8.4,3.75,.1),V(-11.05,3.75,.1),'#344d65');
}
function windowAt(x,y,z,w,h,ry=0,lit=true){
 const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;
 // Bake windows into the static solids so the entire city remains inexpensive.
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0));
 function wb(px,py,pz,ww,hh,dd,col){let p=V(px,py,pz).applyQuaternion(q).add(g.position);box(p.x,p.y,p.z,ww,hh,dd,col,V(0,ry,0));}
 wb(0,0,0,w+.18,h+.18,.12,'#182c3c');wb(0,0,.071,w,h,.07,lit?'#dfba64':'#21495d');wb(0,0,.12,.065,h,.05,'#665634');wb(0,0,.125,w,.06,.05,'#6c673f');
 for(let i=0;i<12;i++){let p=V(rr(-w*.46,w*.46),rr(-h*.46,h*.46),.14).applyQuaternion(q).add(g.position);dab(1,p,V(0,1,0),rr(.12,.3),rr(.045,.09),.025,lit?pick([3,4,5,14]):pick([0,1,2]),0,V(0,0,1).applyQuaternion(q));}
}
function building(x,z,w,d,h,variant=0,paint=true){
 const y=ground(x,z),cols=['#35527a','#6b705f','#675b54','#40516a','#8e794e'];const col=cols[variant%cols.length];
 box(x,y+h/2,z,w,h,d,col);rectCollision(x,z,w+.15,d+.15);
 if(paint){const pigments=variant===4?[3,6,10,14]:variant===1?[6,8,11]:[0,1,2,8,9];
 panel(V(x-w/2,y,z+d/2+.02),V(x+w/2,y,z+d/2+.02),V(x+w/2,y+h,z+d/2+.02),V(x-w/2,y+h,z+d/2+.02),1,pigments,.32,.8);
 panel(V(x-w/2,y,z-d/2),V(x-w/2,y,z+d/2),V(x-w/2,y+h,z+d/2),V(x-w/2,y+h,z-d/2),1,pigments,.33,.83);
 panel(V(x+w/2,y,z+d/2),V(x+w/2,y,z-d/2),V(x+w/2,y+h,z-d/2),V(x+w/2,y+h,z+d/2),1,pigments,.33,.83);}
 // Crooked, tiled roofs and thin dark contours against the stars.
 const ridge=V(x+rr(-.3,.3),y+h+1.8,z),a=V(x-w*.54,y+h,z-d*.56),b=V(x+w*.54,y+h,z-d*.56),c=V(x+w*.54,y+h,z+d*.56),dd=V(x-w*.54,y+h,z+d*.56),r1=ridge.clone().setZ(z-d*.56),r2=ridge.clone().setZ(z+d*.56);
 quad(a,r1,r2,dd,'#283d51');quad(r1,b,c,r2,'#46505a');panel(a,r1,r2,dd,1,[0,1,8,9],.42,.7);panel(r1,b,c,r2,1,[1,6,8,9],.4,.75);rod(a,dd,.06,'#15293d');rod(b,c,.06,'#192a37');rod(r1,r2,.055,'#243b47');
 const floors=Math.max(1,Math.floor((h-1)/2.6));for(let yy=0;yy<floors;yy++){for(let xx=0;xx<Math.max(1,Math.floor(w/2.0));xx++){const n=Math.max(1,Math.floor(w/2));windowAt(x-w/2+(xx+.5)*w/n,y+1.65+yy*2.65,z+d/2+.04,.65,.99,0,rand()>.32);}for(let zz=0;zz<Math.max(1,Math.floor(d/3));zz++){const n=Math.max(1,Math.floor(d/3));windowAt(x+w/2+.04,y+1.55+yy*2.65,z-d/2+(zz+.5)*d/n,.64,1.02,Math.PI/2,rand()>.37);}}
 box(x+1,y+h+1.9,z-1,.55,2.2,.58,'#334350');
 for(let i=0;i<90;i++){let t=rr(0,5),anchor=V(x+1,y+h+2.8,z-1);dab(1,V(anchor.x+Math.sin(t*1.5)*.35,anchor.y+t,anchor.z+Math.sin(t)*.18),V(Math.cos(t),1,.1),rr(.25,.6),rr(.10,.26),.035,pick([1,2,8,9]),6,V(0,0,1),anchor);}
}
function glow(x,y,z,size,color='#ffe3a3',strength=.3){
 const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uColor:{value:new THREE.Color(color)},uStrength:{value:strength},uTime:{value:0},uSeed:{value:rand()*20}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform vec3 uColor;uniform float uStrength;uniform float uTime;uniform float uSeed;void main(){float r=length(vUv-.5)*2.;float a=exp(-r*r*6.)*smoothstep(1.,.5,r)*uStrength*(.88+.12*sin(uTime*.75+uSeed));gl_FragColor=vec4(uColor,a);#include <colorspace_fragment>}'.replace(';#include',';\n#include')});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),m);mesh.position.set(x,y,z);scene.add(mesh);halos.push(mesh);return mesh;
}
function streetLamp(x,z,height=4.3,zone=1){
 const gy=ground(x,z),dark=zone===2?'#0d2939':'#24363b';rod(V(x,gy,z),V(x+.05,gy+height,z),.046,dark);box(x,gy+.14,z,.19,.28,.19,dark);
 const y=gy+height;box(x,y-.28,z,.32,.49,.30,'#eed58b');outlineBox(x,y-.28,z,.34,.52,.32,dark,.026);solid(new THREE.ConeGeometry(.30,.22,4),'#26393c',V(x,y+.065,z),V(0,Math.PI/4,0));glow(x,y-.24,z,2.7,'#f1c452',.42);
 for(let i=0;i<24;i++)dab(zone,V(x+rr(-.12,.12),y-.27+rr(-.18,.18),z+.17),V(rr(-.2,.2),1,0),rr(.08,.21),rr(.024,.065),.025,zone===2?pick([6,7,15]):pick([3,4,5]),5,V(0,0,1),V(x,y-.24,z));
}
function makeCafe(){
 ribbon(routePoints,8.2,'#656160',1,9200,[6,8,9,10,10]);
 ribbon([[-8,14],[3,15],[20,19],[42,26],[65,27],[80,24]],3.4,'#a27d45',3,1200,[6,7,8,12]);
 // Café left, the glowing canopy projects right across its own inhabited terrace.
 building(-24,-4,6.7,20,10.9,4,false);
 paintedBox(-20.55,3.0,-3.6,.24,6.0,18.4,1,[3,3,4,6,14],'#d4a439',{step:.22,outline:false});
 panel(V(-27.35,0,6.02),V(-20.65,0,6.02),V(-20.65,10.9,6.02),V(-27.35,10.9,6.02),1,[3,6,10,14],.22,.60);
 panel(V(-20.62,6,6),V(-20.62,6,-14),V(-20.62,10.9,-14),V(-20.62,10.9,6),1,[3,6,10,14],.22,.65);
 for(let z of[-10,-5.2,-.4,4.3]){windowAt(-20.35,2.15,z,2.3,3.1,Math.PI/2,true);box(-20.21,.2,z,.24,.26,2.8,'#bea050');}
 for(let z of[-11.8,-7.2,-2.6,2,5.3]){paintedBox(-20.14,2.73,z,.26,5.35,.27,1,[3,4,14],'#edbe4a',{step:.16});}
 const awA=V(-20.4,5.35,-13),awB=V(-13.35,4.28,-13),awC=V(-13.35,4.28,6.9),awD=V(-20.4,5.35,6.9);
 quad(awA,awB,awC,awD,'#edbd42');panel(awA,awB,awC,awD,1,[3,4,4,5,14],.63,.16,7,true);panel(awD.clone().add(V(0,-.08,0)),awC.clone().add(V(0,-.08,0)),awB.clone().add(V(0,-.08,0)),awA.clone().add(V(0,-.08,0)),1,[3,4,5],.61,.16,7,true);
 rod(awB,awC,.095,'#ffe195');rod(awA,awD,.07,'#a67b2e');
 for(let z=-12.8;z<6.8;z+=.26){let yy=4.05+Math.sin(z*12)*.045;dab(1,V(-13.32,yy,z),V(0,1,0),.42,.23,.065,pick([3,4,5]),7,V(1,0,0));}
 for(let z of[-12.7,-4.4,6.4]){rod(V(-13.4,0,z),V(-13.36,4.3,z),.047,'#55734c');ellipsoid(-13.39,4.27,z,.10,.10,.10,'#d9b848');}
 // The large exterior sign is a physical painted sign, not an interface title.
 paintedBox(-20.06,4.48,-3.2,.11,.48,6.7,1,[3,4,5],'#e9c35d',{step:.17});
 for(let i=0;i<15;i++){const z=-6.1+i*.39;dab(1,V(-19.975,4.49,z),V(0,1,rr(-.15,.15)),.24,.032,.018,6,0,V(1,0,0));dab(1,V(-19.97,4.48,z+.09),V(0,.4,1),.17,.026,.018,6,0,V(1,0,0));}
 for(let z of[-10,-4.4,1.4,5.5])glow(-19.45,3.75,z,5.1,'#ffd158',.12);
 const places=[[-16.5,3.8],[-18.15,.7],[-15.95,-2.3],[-18.1,-5.7],[-15.9,-8.8],[-18.4,5.9],[-14.95,8.0]];
 places.forEach(([x,z],i)=>{cafeTable(x,z,.59);makeChair(x+.83,z+.14,Math.PI/2,1,.64);makeChair(x-.13,z-.8,Math.PI,1,.66);if(i!==5)person(x+.75,z+.11,1,{seated:true,angle:-Math.PI/2,coat:i%3===0?2:13,seed:i});if(i%2===0)person(x-.1,z-.79,1,{seated:true,angle:0,coat:i===0?11:0,seed:i+8});});
 person(-14.95,-5.1,1,{waiter:true,coat:15,seed:11});person(-17.9,1.1,1,{waiter:true,coat:15,seed:19});person(-8.7,-14.4,1,{walk:true,angle:.1,coat:0,seed:4});person(-10.8,-21,1,{walk:true,angle:Math.PI,coat:13,seed:6});
 const houses=[[-26,-23,7,9,12,0],[-20,-34,6.5,9,10,1],[-29,-37,7,8,8,0],[-35,-27,5,10,10,3],[-34,-9,8,11,11,3],[.2,-12,8,6.5,10,0],[1,-21,7.6,7.1,13,2],[6,-30,8.2,6.1,10,1],[14.6,-28,5,7.5,8.8,3],[-3,-32,4.4,4.3,8.7,0],[12,2,8,10,8.6,2],[19,-10,5.8,8,11,1],[-32,10,7,8,7.7,3]];
 houses.forEach(p=>building(...p));
 // A tower makes the compressed town legible from every long view.
 building(-20,-43,5.2,5.1,15,0);solid(new THREE.ConeGeometry(4.0,5,4),'#243f65',V(-20,17.4,-43),V(0,Math.PI/4,0));
 for(let [x,z,h]of[[-6.5,11,4.3],[-6,-8,4.6],[-5.5,-20,4.5],[0,-34,4.2],[-14,-33,4.0],[14,-39,4.6],[23,-29,4.2]])streetLamp(x,z,h);
 for(let [x,z,s]of[[-29,0,1.5],[-31,22,1.1],[11,-38,.9],[16,12,1.4],[7,20,1.0],[-16,-41,1],[-42,-16,1.5]])cypress(x,z,s,1);
}
function cafeTable(x,z,r){
 const y=ground(x,z);shadow(x,z,r*1.4,r*1.05,'#394443',y);rod(V(x,y,z),V(x,y+1.0,z),.065,'#25393a');for(let a=0;a<TAU;a+=TAU/3)rod(V(x,y+.12,z),V(x+Math.cos(a)*.38,y+.04,z+Math.sin(a)*.38),.038,'#25383b');
 solid(new THREE.CylinderGeometry(r,r*.96,.095,28),'#eee1ac',V(x,y+1.025,z));ring(x,y+1.08,z,r,.025,'#9e966e');
 for(let i=0;i<100;i++){let a=rand()*TAU,rrr=Math.sqrt(rand())*r*.94;dab(1,V(x+Math.cos(a)*rrr,y+1.084,z+Math.sin(a)*rrr),V(Math.cos(a+.3),0,Math.sin(a+.3)),rr(.12,.32),rr(.035,.08),.024,pick([4,5,5,15]),0,V(0,1,0));}
 for(let j=0;j<2;j++){let gx=x+(j?-.21:.22),gz=z+(j?.17:-.14);solid(new THREE.CylinderGeometry(.064,.045,.17,8),'#dfd6a4',V(gx,y+1.18,gz));ring(gx,y+1.264,gz,.063,.009,'#ffecbc');dab(1,V(gx-.031,y+1.19,gz+.052),V(0,1,0),.16,.020,.01,5);}
 solid(new THREE.CylinderGeometry(.11,.12,.26,10),'#8b7951',V(x+.1,y+1.21,z+.25));
 rectCollision(x,z,r*1.7,r*1.7);
}
function person(x,z,zone,opts={}){
 const g=new THREE.Group();g.position.set(x,ground(x,z),z);g.rotation.y=opts.angle||0;scene.add(g);
 const body={zone,mode:0,data:[],parent:g},coat=opts.coat??0,skin=zone===2?14:6;const hip=opts.seated?.54:.87;
 // Facets of pigment assemble a silhouette; no smooth mannequin skin.
 for(let i=0;i<42;i++){let yy=rr(hip,hip+.59),xx=rr(-.18,.18),zz=rr(-.115,.115);dab(zone,V(xx,yy,zz),V(rr(-.12,.12),1,0),rr(.13,.26),rr(.08,.16),.07,rand()>.22?coat:zone===1?8:13,0,V(0,0,1),V(),body);}
 for(let i=0;i<32;i++){let a=rand()*TAU,b=rr(-1,1),r=Math.sqrt(1-b*b)*.14;dab(zone,V(Math.cos(a)*r,hip+.79+b*.19,Math.sin(a)*r),V(0,1,0),rr(.09,.15),rr(.045,.10),.04,b>.48?0:skin,0,V(Math.cos(a),0,Math.sin(a)),V(),body);}
 dab(zone,V(-.045,hip+.81,.14),V(1,0,0),.033,.019,.012,0,0,V(0,0,1),V(),body);dab(zone,V(.024,hip+.77,.161),V(.1,1,0),.095,.042,.035,skin,0,V(0,0,1),V(),body);
 const legGroups=[];
 for(let side of[-1,1]){const leg=new THREE.Group();leg.position.set(side*.105,hip,0);g.add(leg);let b={zone,mode:0,data:[],parent:leg};let end=opts.seated?V(0,-.19,.37):V(0,-hip+.13,0);for(let i=0;i<8;i++){const t=(i+.5)/8,p=V(0,0,0).lerp(end,t);dab(zone,p,end,rr(.17,.24),.125,.09,zone===1?0:12,0,V(0,0,1),V(),b);}if(opts.seated)for(let i=0;i<6;i++)dab(zone,V(0,-.22-i*.057,.38),V(0,1,0),.14,.10,.08,0,0,V(0,0,1),V(),b);dab(zone,opts.seated?V(0,-.51,.44):V(0,-hip+.055,.09),V(0,0,1),.30,.14,.11,0,0,V(0,1,0),V(),b);buildBatch(b,true);legGroups.push(leg);}
 const arms=[];for(let side of[-1,1]){const arm=new THREE.Group();arm.position.set(side*.22,hip+.46,0);g.add(arm);let b={zone,mode:0,data:[],parent:arm};const dir=opts.seated?V(side*.07,-.21,.34):V(side*.02,-.52,.10);for(let i=0;i<9;i++)dab(zone,dir.clone().multiplyScalar((i+.4)/9),dir,rr(.12,.20),.11,.09,i>7?skin:coat,0,V(0,0,1),V(),b);buildBatch(b,true);arms.push(arm);}
 if(opts.waiter){const tray=new THREE.Group();tray.position.set(.24,hip+.29,.36);g.add(tray);solid(new THREE.CylinderGeometry(.29,.30,.035,16),'#d1b671',V(),V(),tray);for(let i=0;i<3;i++)solid(new THREE.CylinderGeometry(.05,.035,.15,7),'#e0d8a1',V((i-1)*.14,.10,0),V(),tray);}
 buildBatch(body,true);animatedPeople.push({g,arms,legs:legGroups,x,z,seed:opts.seed||rand()*10,...opts});return g;
}
function cypress(x,z,s=1,zone=1){
 const y=ground(x,z);rod(V(x,y,z),V(x,y+5*s,z),.16*s,'#253a32');
 for(let i=0;i<920*s;i++){let h=rr(.4,8.4)*s,rad=(1-h/(9*s))*rr(.12,1.05)*s,ang=rand()*TAU;dab(zone,V(x+Math.cos(ang)*rad,y+h,z+Math.sin(ang)*rad),V(rr(-.18,.18),1,rr(-.13,.13)),rr(.3,.9)*s,rr(.07,.18)*s,.09,zone===1?pick([0,1,11,11]):pick([8,9,12]),1,V(Math.cos(ang),0,Math.sin(ang)),V(x,y,z));}
}

function makeRhone(){
 const waterGeo=new THREE.PlaneGeometry(175,87,1,1);waterGeo.rotateX(-Math.PI/2);solid(waterGeo,'#112f4c',V(13,-1.05,-91));
 // Thousands of little horizontal ridges, all moving on the same slow liquid clock.
 for(let i=0;i<16600;i++){let x=rr(-73,100),z=rr(-131,-49.3);dab(2,V(x,-1.018,z),V(1,0,rr(-.10,.10)),rr(.32,1.5),rr(.08,.31),.07,pick([0,1,1,2,3,4,11,13]),2,V(0,1,0));}
 ribbon([[-29,-45],[-10,-46],[8,-46],[23,-44],[31,-39]],4.1,'#555c4e',2,1900,[8,9,10,13]);
 for(let x=-39;x<44;x+=1.3){let z=-49.1+Math.max(0,x-22)*.20;paintedBox(x,-.37,z,1.28,.76,.68,2,[2,8,10,13],'#4a5a57',{step:.4,outline:false});}
 // The far bank is an arc, with houses and lanterns reflected as separate paint columns.
 const lampPoints=[];
 for(let x=-58;x<=73;x+=5.6){let z=-108+Math.pow((x-9)/66,2)*14;const y=-.4;box(x,y+1.0,z+1.8,5.5,2,6,'#182f3b');let hh=rr(2.8,6.8),ww=rr(3.8,5.5);box(x,y+hh/2,z-1.5,ww,hh,4,'#203b47');solid(new THREE.ConeGeometry(ww*.8,2.2,4),'#183546',V(x,y+hh+1,z-1.5),V(0,Math.PI/4,0));
 for(let j=0;j<5;j++){let xx=x+rr(-ww*.4,ww*.4),yy=rr(.7,hh-.3);box(xx,yy-.4,z+.55,.23,.35,.04,pick(['#d7b64c','#e3c466','#b79235']));dab(2,V(xx,yy-.4,z+.60),V(0,1,0),.32,.17,.04,pick([5,6,7]),5,V(0,0,1),V(xx,yy,z));}
 // Far lamps do not use the near-bank ground function.
 rod(V(x,-.38,z+2.9),V(x,3.1,z+2.9),.07,'#16313c');ellipsoid(x,3.1,z+2.9,.15,.25,.14,'#efcc76');glow(x,3.1,z+2.9,3.5,'#f5cc60',.58);lampPoints.push([x,z+2.9]);
 for(let k=0;k<250;k++){let a=rr(0,1),zz=lerp(z+3.4,-50,a),spread=.17+a*a*1.15,xx=x+(5-x)*a*.17+rr(-spread,spread),len=rr(.2,.75)+a*.85;dab(2,V(xx,-.94+rand()*.015,zz),V(1,0,rr(-.03,.03)),len,rr(.055,.20),.06,pick([5,6,6,7,14]),3,V(0,1,0));}
 }
 for(let x of[-33,-19,18,28])streetLamp(x,-44.7,4.1,2);
 for(let[x,z,a,s]of[[-11,-51,.15,1.1],[4,-52.4,-.19,1.4],[17,-51.2,-.5,.95]])makeBoat(x,z,a,s);
 person(1.2,-47.0,2,{walk:true,angle:Math.PI*.85,coat:1,seed:1});person(1.9,-47.3,2,{walk:true,angle:Math.PI*.88,coat:8,seed:2});
 cypress(-35,-44,1.4,2);cypress(35,-40,.9,2);
 // The seven lamps of the Plough, in the recognizable bent dipper arrangement.
 const dipper=[[-17,24,-101],[-14,30,-104],[-7,31,-104],[-5,24.8,-102],[1,24,-102],[7,26,-104],[14,27.1,-106]];
 for(let p of dipper)star(V(...p),.88,2,true);
}
function makeBoat(x,z,angle,scale){
 const g=new THREE.Group();g.position.set(x,-.84,z);g.rotation.y=angle;g.scale.setScalar(scale);scene.add(g);
 const shape=new THREE.Shape();shape.moveTo(0,-2.1);shape.lineTo(.67,-1.1);shape.lineTo(.76,.85);shape.lineTo(.42,1.72);shape.lineTo(0,2.03);shape.lineTo(-.42,1.72);shape.lineTo(-.76,.85);shape.lineTo(-.67,-1.1);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.37,bevelEnabled:true,bevelSize:.08,bevelThickness:.04,bevelSegments:1,steps:1});geo.rotateX(Math.PI/2);solid(geo,'#152e36',V(0,.15,0),V(),g);ellipsoid(0,.11,0,.60,.04,1.69,'#4d6056',g);
 for(let zz of[-1,.1,1.0])box(0,.21,zz,1.27,.10,.22,'#a18b54',V(),g);
 rod(V(0,.2,0),V(0,3.9,0),.034,'#6c785f',g);rod(V(-.5,.32,-1.5),V(.44,.37,1.4),.024,'#bba365',g);
 const b={zone:2,mode:0,data:[],parent:g};for(let i=0;i<230;i++){let zz=rr(-1.88,1.75),xx=(.20+.51*(1-Math.pow(zz/2,2)))*(rand()>.5?1:-1);dab(2,V(xx,.08,zz),V(0,0,1),rr(.18,.51),rr(.065,.12),.045,pick([1,8,9,10,14]),0,V(xx<0?-1:1,.2,0),V(),b);}buildBatch(b,true);
 for(let side of[-1,1])curve([V(side*.2,.21,-1.8),V(side*.66,.23,-1.1),V(side*.74,.22,.8),V(side*.36,.2,1.75),V(0,.19,2.0)],.04,'#b29b60',g);
 boats.push({g,x,z,angle,seed:rand()*TAU});rod(V(x-.6,-.50,-49),V(x-.6,.25,-49),.065,'#6a6b53');curve([V(x-.6,.1,-49),V(x-.3,-.38,-50),V(x,-.64,z+1.4)],.018,'#b19e6e');
}

const wheatPaths=[[[48,23],[39,7],[28,-10],[22,-31]],[[48,23],[49,8],[47,-9],[49,-33]],[[48,23],[57,10],[65,-9],[75,-32]]];
function distanceToSegment(x,z,a,b){let dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function nearWheatPath(x,z){let min=1e6;for(const p of wheatPaths)for(let i=0;i<p.length-1;i++)min=Math.min(min,distanceToSegment(x,z,p[i],p[i+1]));return min;}
function makeCountry(){
 // The riverside wall opens into the red earth of the country.
 const gx=25,gz=-36.5,gy=ground(gx,gz);
 for(let s of[-1,1])paintedBox(gx,gy+1.8,gz+s*2.32,1.32,3.6,1.25,2,[2,3,8,10,13],'#667067',{step:.26});
 for(let i=0;i<16;i++){let a=i*Math.PI/16,b=(i+1)*Math.PI/16;rod(V(gx,gy+3.08+Math.sin(a)*2.18,gz+Math.cos(a)*2.18),V(gx,gy+3.08+Math.sin(b)*2.18,gz+Math.cos(b)*2.18),.37,'#657575');for(let j=0;j<12;j++){let t=rr(a,b),r=rr(1.91,2.44);dab(2,V(gx+.39,gy+3.08+Math.sin(t)*r,gz+Math.cos(t)*r),V(0,Math.cos(t),-Math.sin(t)),.26,.13,.05,pick([2,3,4,8,10]),0,V(1,0,0));}}
 for(let s of[-1,1]){let z=gz+s*6.1;paintedBox(gx,ground(gx,z)+.83,z,.73,1.66,6.2,2,[2,8,10,13],'#586b65',{step:.32});}
 rectCollision(gx,gz-2.32,1.32,1.25);rectCollision(gx,gz+2.32,1.32,1.25);wallCollision([gx,gz-10],[gx,gz-2.9]);wallCollision([gx,gz+2.9],[gx,gz+9.2]);
 ribbon([[25,-36.5],[34,-28],[39,-8],[48,23]],2.6,'#aa7740',3,1000,[6,7,8]);
 wheatPaths.forEach((p,i)=>ribbon(p,i===1?2.2:2.8,i===1?'#9d713e':'#a65f37',3,1700,[6,7,7,8,13]));
 // Dense but instanced: every stalk is three or four ridged paint marks.
 for(let i=0;i<30300;i++){
 let x=rr(24,76),z=rr(-32.5,22),pd=nearWheatPath(x,z);if(pd<1.35)continue;
 let y=ground(x,z),h=rr(.47,1.18)+(z<0?.15:0),anchor=V(x,y,z),lean=rr(-.13,.13),base=V(x,y+h*.45,z),dir=V(lean,1,rr(-.06,.06));
 dab(3,base,dir,h,.039,.031,pick([4,5,6,12]),1,V(0,0,1),anchor);
 dab(3,V(x+lean*h*.55,y+h*.95,z),V(lean+.06,1,.02),rr(.24,.40),rr(.06,.095),.048,pick([4,5,5,12]),1,V(0,0,1),anchor);
 if(rand()>.40){dab(3,V(x-.035,y+h*.78,z+.016),V(-.26,1,.02),.26,.038,.037,pick([5,6,12]),1,V(0,0,1),anchor);}
 }
 // Wind is visible across the acreage as long, diagonal changes of pigment.
 for(let i=0;i<3000;i++){let x=rr(23,77),z=rr(-33,22);if(nearWheatPath(x,z)<1.55)continue;dab(3,V(x,ground(x,z)+rr(.25,.65),z),V(1,.13,.18),rr(.6,1.8),rr(.06,.16),.05,pick([4,6,12,13]),1,V(0,0,1),V(x,ground(x,z),z));}
 // Blue weather has physical volume: layers of enormous directional paint dabs.
 for(let i=0;i<1700;i++){let x=rr(22,93),z=rr(-55,-33),band=rand(),y=12+band*14+Math.sin(x*.08+z*.05)*2.4;dab(3,V(x,y,z),V(1,.16*Math.cos(x*.15+band*5),-.06),rr(2.2,7.8),rr(.24,.74),rr(.14,.36),pick([0,0,1,1,2,3,15]),0,V(0,.12,1));}
 for(let i=0;i<33;i++)makeCrow(i);
 // The footpath continues right into a stand of heroic yellow faces.
 ribbon([[57,24],[71,23],[81,18],[83,7],[93,-1]],2.6,'#b49746',4,1700,[0,1,11,13]);
 ribbon([[75,-20],[82,-6],[82,14],[81,26],[63,29],[40,27],[20,23],[3,14],[-1.7,8],[-1.7,5.3]],2.5,'#a6834b',4,2200,[0,1,11,13]);
 for(let i=0;i<185;i++){let x=rr(70.2,104),z=rr(-22,23);if(Math.abs(x-82)<2.1&&z>-9)continue;if(Math.hypot(x-81,z-7.5)<5.3)continue;sunflower(x,z,rr(2.1,4.5),rr(.56,.98),rand()*TAU,false);}
 // Fifteen irregular, heavy heads gather around the great earthen vessel.
 const vaseX=80.5,vaseZ=7.5,vaseY=ground(vaseX,vaseZ);
 const vasePoints=[[.79,0],[1.21,.16],[1.34,.6],[1.23,1.3],[.80,1.86],[.70,2.1],[.88,2.24]].map(p=>new THREE.Vector2(...p));
 solid(new THREE.LatheGeometry(vasePoints,26),'#c69937',V(vaseX,vaseY,vaseZ));ring(vaseX,vaseY+2.25,vaseZ,.86,.08,'#bc8429');
 for(let i=0;i<710;i++){let a=rand()*TAU,y=rr(.08,2.2),rad=y<.65?1.1:y<1.3?1.28-(y-.65)*.13:1.19-(y-1.3)*.59;dab(4,V(vaseX+Math.cos(a)*rad,vaseY+y,vaseZ+Math.sin(a)*rad),V(-Math.sin(a)*.11,1,Math.cos(a)*.11),rr(.20,.52),rr(.065,.15),.058,pick(y<1?[0,1,2,11]:[1,2,3,13]),0,V(Math.cos(a),0,Math.sin(a)));}
 const heads=[[-1.8,.3,4.3,.72],[-1.5,-.9,5.15,.89],[-.5,-1.0,5.95,.83],[.50,-.8,5.55,.79],[1.49,-.9,4.9,.82],[2.03,.15,4.05,.85],[.82,.7,3.95,.88],[-.64,.65,4.12,.71],[-1.7,1.02,3.4,.62],[1.66,1.01,3.20,.70],[-.2,-.40,4.9,.82],[.10,1.15,3.23,.72],[-2.10,-.2,3.3,.53],[1.8,-1.4,5.8,.68],[-.92,-1.9,5.5,.70]];
 heads.forEach(([dx,dz,h,r],i)=>sunflower(vaseX+dx,vaseZ+dz,h,r,rr(-.32,.32),true,V(vaseX+dx*.2,vaseY+1.95,vaseZ+dz*.2),i));
 // A ochre farm wall in the actual world holds the sunflower palette behind the blooms.
 building(98,-13,9,11,7.0,4,false);paintedBox(98,3.5,-7.46,9,7,.10,4,[0,1,2,11,13],'#b99a3e',{step:.32,outline:false});
 // Late light over this field; it never turns into a generic day/night cycle.
 glow(88,13,-27,24,'#e7bd43',.08);
 for(let i=0;i<1200;i++){let x=rr(70,113),z=rr(-30,28);groundStroke(4,x,z,V(1,0,rr(-.3,.3)),rr(.4,1.6),rr(.10,.29),pick([0,1,2,11,13]));}
}
function sunflower(x,z,height,radius,heading,hero=false,root=null,index=0){
 const gy=ground(x,z),base=root||V(x,gy,z),head=V(x,gy+height,z),anchor=base.clone();
 // Irregular stems in three segments lean toward their own sun.
 const bend=V(lerp(base.x,head.x,.55)-.17,lerp(base.y,head.y,.52),lerp(base.z,head.z,.55));
 for(let i=0;i<19;i++){let t=(i+.5)/19,p=t<.5?base.clone().lerp(bend,t*2):bend.clone().lerp(head,(t-.5)*2),dir=t<.5?bend.clone().sub(base):head.clone().sub(bend);dab(4,p,dir,.26,hero?.075:.060,.060,pick([8,9,10,15]),4,V(0,0,1),anchor);}
 for(let j=0;j<3;j++){let t=.22+j*.2,p=base.clone().lerp(head,t),sg=j%2?1:-1;dab(4,p.add(V(sg*.24,.03,.04)),V(sg,.6,.2),rr(.65,.95),rr(.19,.31),.12,pick([9,10,15]),4,V(0,0,1),anchor);dab(4,p.clone().add(V(sg*.04,0,.022)),V(sg,.57,.2),.64,.028,.025,11,4,V(0,0,1),anchor);}
 const normal=V(Math.sin(heading)*.35,-.06,Math.cos(heading)).normalize();if(!hero&&normal.z<.1)normal.z=.3;normal.normalize();
 const u=new THREE.Vector3().crossVectors(V(0,1,0),normal).normalize(),v=new THREE.Vector3().crossVectors(normal,u).normalize();
 const tired=hero&&(index===8||index===11||index===12),n=tired?22:40;
 for(let ringN=0;ringN<2;ringN++)for(let j=0;j<n;j++){
 const a=(j/n)*TAU+ringN*.093+rr(-.04,.04),r=radius*(ringN?.66:.86),p=head.clone().addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r).addScaledVector(normal,ringN?.07:0),d=u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v,Math.sin(a));
 if(tired){d.y-=.55;p.y-=Math.max(0,-Math.sin(a))*.23;}
 dab(4,p,d,radius*rr(.37,.71),radius*rr(.10,.19),radius*.13,pick(tired?[0,1,5,6,7]:[2,3,3,4,5,12,14]),4,normal,anchor);
 }
 // Overlapping dark impasto closes the seed head beneath its spiral.
 for(let k=0;k<3;k++){const a=k*Math.PI/3;dab(4,head.clone().addScaledVector(normal,.07),u.clone().multiplyScalar(Math.sin(a)).addScaledVector(v,Math.cos(a)),radius*1.02,radius*.91,.10,pick([6,7,8]),4,normal,anchor);}
 // The sunflower's dark centre is a packed spiral of palpable seeds.
 const seeds=hero?155:65;for(let j=0;j<seeds;j++){let a=j*2.3999632,r=radius*.48*Math.sqrt((j+.5)/seeds),p=head.clone().addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r).addScaledVector(normal,.105+.12*(1-r/radius));dab(4,p,u.clone().multiplyScalar(-Math.sin(a)).addScaledVector(v,Math.cos(a)),radius*rr(.062,.11),radius*rr(.05,.088),.06,pick(j%4===0?[1,5,6]:[0,6,7,8]),4,normal,anchor);}
}
function makeCrow(i){
 const group=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(.10,6,4),material('#111a22'));body.scale.set(.8,.8,2.8);group.add(body);scene.add(group);
 const wings=[];for(let s of[-1,1]){const wing=new THREE.Group();group.add(wing);const pos=[0,0,0,s*.40,.08,.02,s*.84,-.03,.13,s*.73,-.04,.31,s*.25,-.01,.25,0,0,.11];const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex([0,1,4,1,2,3,1,3,4,0,4,5,4,1,0,3,2,1,4,3,1,5,4,0]);geo.computeVertexNormals();wing.add(new THREE.Mesh(geo,material('#101a24')));rod(V(s*.13,.025,.12),V(s*.71,.035,.18),.018,'#29343e',wing);wings.push(wing);}
 const scale=rr(.65,1.15);group.scale.setScalar(scale);crows.push({group,wings,seed:i/33,spread:rr(.7,1.2)});
}
function star(center,radius,zone=1,important=false){
 const normal=V(10,2,-15).sub(center).normalize(),u=V().crossVectors(V(0,1,0),normal).normalize(),v=V().crossVectors(normal,u).normalize();
 for(let k=0;k<3;k++){let rad=radius*(.36+k*.30),n=22+k*10;for(let i=0;i<n;i++){let a=i/n*TAU+k*.2,p=center.clone().addScaledVector(u,Math.cos(a)*rad).addScaledVector(v,Math.sin(a)*rad),dir=u.clone().multiplyScalar(-Math.sin(a)).addScaledVector(v,Math.cos(a));dab(zone,p,dir,radius*rr(.19,.35),radius*rr(.07,.14),.09,zone===2?pick([6,7,15]):pick(k===2?[2,4,10]:[4,5,5]),5,normal,center);}}
 for(let i=0;i<17;i++)dab(zone,center.clone().addScaledVector(u,rr(-.16,.16)*radius).addScaledVector(v,rr(-.16,.16)*radius),v,radius*rr(.13,.38),radius*rr(.09,.19),.08,zone===2?7:5,5,normal,center);
 glow(center.x,center.y,center.z,radius*5.8,important?'#efd489':'#e5d093',important?.26:.16);
}
let skyMaterial;
function makeSky(){
 skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:{value:0},uHour:{value:0},uTop:{value:new THREE.Color('#142c64')},uLow:{value:new THREE.Color('#53748b')}},vertexShader:'varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec3 vDir;uniform float uTime;uniform float uHour;uniform vec3 uTop;uniform vec3 uLow;
 void main(){vec3 d=normalize(vDir);float h=clamp(d.y,0.,1.);float a=atan(d.z,d.x);float strokes=sin(a*36.+sin(h*28.+a*6.)*1.7+uTime*.012)*sin(h*218.+sin(a*29.)*2.);vec3 c=mix(uLow,uTop,smoothstep(-.06,.66,h));c*=.97+strokes*.032;c*=vec3(1.+uHour*.06,1.,1.-uHour*.035);gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(250,48,32),skyMaterial);sky.position.set(12,0,-17);scene.add(sky);
 for(let i=0;i<54;i++){let a=rr(0,TAU),el=rr(.13,1.12),r=rr(115,160),p=V(10+Math.cos(a)*Math.cos(el)*r,Math.sin(el)*r,-20+Math.sin(a)*Math.cos(el)*r);star(p,rr(.6,1.5),1);}
 // Stars sitting low over the café, their halos fat with paint.
 for(let p of[[-14,18,-30],[-2,21,-40],[-30,24,-46],[2,32,-58],[-21,31,-70]])star(V(...p),rr(.62,1.04),1,true);
 for(let i=0;i<1900;i++){let a=rr(0,TAU),el=rr(.1,.9),r=rr(136,172),p=V(10+Math.cos(a)*Math.cos(el)*r,Math.sin(el)*r,-20+Math.sin(a)*Math.cos(el)*r),normal=V(10,0,-20).sub(p).normalize(),dir=V(-Math.sin(a),.11*Math.sin(a*8),Math.cos(a));dab(1,p,dir,rr(1.0,3.7),rr(.13,.32),.12,pick([1,1,2,9]),0,normal);}
}

const viewpoints=[
 {name:'The Bedroom',place:'Arles · 1888',p:V(-1.28,2.57,5.42),look:V(.55,1.90,-1.85),zone:0},
 {name:'Café Terrace at Night',place:'Place du Forum · 1888',p:V(-12.0,1.96,10.6),look:V(-12.4,4.2,-19.5),zone:1},
 {name:'Starry Night Over the Rhône',place:'Arles · 1888',p:V(-2.7,2.05,-44.0),look:V(5,7.0,-98),zone:2},
 {name:'Wheatfield with Crows',place:'Auvers-sur-Oise · 1890',p:V(48,2.02,23.4),look:V(48,5.3,-21),zone:3},
 {name:'Sunflowers',place:'Arles · 1888',p:V(80.5,2.8,18.8),look:V(80.25,3.20,7.5),zone:4},
 {name:'The whole living town',place:'Five paintings · one geography',p:V(111,80,109),look:V(20,0,-27),zone:4,fov:52}
];
const markerMeshes=[];
function makeMarkers(){
 for(let k=0;k<5;k++){let p=viewpoints[k].p;const b={zone:k,mode:5,data:[],parent:scene};for(let i=0;i<48;i++){let a=i/48*TAU,r=.30+Math.sin(i*2)*.018;dab(k,V(p.x+Math.cos(a)*r,ground(p.x,p.z)+.028,p.z+Math.sin(a)*r),V(-Math.sin(a),0,Math.cos(a)),.036,.017,.012,k===0?6:k===1?4:k===2?7:k===3?5:4,5,V(0,1,0),V(p.x,0,p.z),b);}let mesh=buildBatch(b,true);mesh.userData.marker=k;markerMeshes.push(mesh);}
}

// Build once, then let the GPU keep the pigment alive.
terrain();makeSky();makeBedroom();warmHall();makeCafe();makeRhone();makeCountry();makeMarkers();
for(const b of batchMap.values())buildBatch(b);
function mergeSolidList(list){return mergeGeometries(list.map(geo=>{let g=geo.index?geo.toNonIndexed():geo;for(let name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name);if(!g.getAttribute('normal'))g.computeVertexNormals();return g;}),false);}
const colouredBaseMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
function colourGeometry(geometry,colour){const c=colour.isColor?colour:new THREE.Color(colour),a=new Float32Array(geometry.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}geometry.setAttribute('color',new THREE.BufferAttribute(a,3));return geometry;}
const staticColourPieces=[];for(const [color,list]of solidBins){const geometry=mergeSolidList(list);if(geometry)staticColourPieces.push(colourGeometry(geometry,color));}
scene.add(new THREE.Mesh(mergeGeometries(staticColourPieces,false),colouredBaseMaterial));
solidBins.clear();batchMap.clear();
// Repeated furnishings are consolidated within their local moving parent.
const groups=[];scene.traverse(o=>{if(o.isGroup)groups.push(o);});
for(const group of groups){const list=group.children.filter(c=>c.isMesh&&!c.isInstancedMesh&&(c.material.isMeshStandardMaterial||c.material.isMeshBasicMaterial));if(list.length<2)continue;const pieces=list.map(m=>{m.updateMatrix();const geometry=mergeSolidList([m.geometry.clone().applyMatrix4(m.matrix)]);return colourGeometry(geometry,m.material.color);});const g=mergeGeometries(pieces,false);if(g){group.add(new THREE.Mesh(g,colouredBaseMaterial));list.forEach(m=>group.remove(m));}}
for(const mesh of brushBatches){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=2;mesh.frustumCulled=true;}


let quality=.73, flyMode=false;
function zoneAt(p){if(p.x>-5.98&&p.x<5.94&&p.z>-4.9&&p.z<6.35)return 0;if(p.x>70)return 4;if(p.x>23)return 3;if(p.z<-36)return 2;return 1;}
function updateLOD(){
 for(const m of brushBatches){const d=m.userData;let density=quality;if(d.local)density=Math.max(.8,quality);else{const dist=Math.hypot(camera.position.x-d.center.x,camera.position.z-d.center.z);density*=dist<19?1:dist<43?.78:dist<76?.47:.27;if(d.mode===5)density=Math.max(.70,density);}
 m.count=Math.max(1,Math.floor(d.max*density));}
 animatedPeople.forEach((p,i)=>{p.g.visible=p.waiter||quality>.9||i<Math.floor(animatedPeople.length*(quality<.5?.55:.82))||p.g.position.distanceTo(camera.position)<13;});
 crows.forEach((c,i)=>c.group.visible=i<Math.ceil(crows.length*(quality<.5?.55:quality<.9?.8:1))&&(flyMode||camera.position.x>12));
}
function updatePeople(t){
 for(const p of animatedPeople){if(!p.g.visible)continue;const s=p.seed;
 if(p.waiter){let a=t*.16+s;p.g.position.x=p.x+Math.sin(a)*1.08;p.g.position.z=p.z+Math.cos(a)*2.6;p.g.rotation.y=Math.atan2(Math.cos(a)*1.08,-Math.sin(a)*2.6);p.g.position.y=ground(p.g.position.x,p.g.position.z)+Math.abs(Math.sin(t*2+s))*.025;}
 else if(p.walk){let a=t*.055+s;p.g.position.x=p.x+Math.sin(a)*.5;p.g.position.z=p.z+Math.cos(a)*.65;p.g.rotation.y=(p.angle||0)+Math.sin(a)*.16;}
 p.arms.forEach((arm,i)=>{arm.rotation.x=p.seated?-.16+Math.sin(t*.47+s+i*2)*.26:p.waiter?(i===1?-.36:Math.sin(t*2+s)*.12):Math.sin(t*1.5+s+i*Math.PI)*.21;arm.rotation.z=Math.sin(t*.39+s+i)*.08;});
 p.legs.forEach((leg,i)=>{leg.rotation.x=(p.waiter?.25:p.walk?.14:0)*Math.sin(t*(p.waiter?2:1.5)+s+i*Math.PI);});if(p.seated)p.g.rotation.z=Math.sin(t*.4+s)*.009;
 }
}
function animateCrows(t){
 for(const c of crows){if(!c.group.visible)continue;let a=(t*.028+c.seed)%1,theta=a*TAU,flight=Math.pow(Math.max(0,Math.sin(a*Math.PI)),.63),x=49+Math.cos(theta+c.seed*6)*22*c.spread,z=-11+Math.sin(theta)*18*c.spread,y=ground(x,z)+.75+flight*(5.0+c.seed*3.5);c.group.position.set(x,y,z);c.group.rotation.y=Math.atan2(-Math.sin(theta+c.seed*6),Math.cos(theta));c.group.rotation.z=Math.sin(theta)*.14;c.wings.forEach((wing,i)=>{wing.rotation.z=(i?1:-1)*(flight<.15?.02:Math.sin(t*3.5+c.seed*31)*.43);});}
}

scene.updateMatrixWorld(true);
const excludedRoots = new Set([...animatedPeople.map(p=>p.g),...boats.map(b=>b.g),...crows.map(c=>c.group),camera]);
const solidMeshes=[];
scene.traverse(o=>{
 if(!o.isMesh || o.isInstancedMesh || !(o.material.isMeshBasicMaterial||o.material.isMeshStandardMaterial))return;
 for(let p=o;p;p=p.parent)if(excludedRoots.has(p))return;
 solidMeshes.push(o);
});
let lastLod=-1;
function update(time){
 brushUniforms.forEach(u=>u.uTime.value=time);skyMaterial.uniforms.uTime.value=time;
 for(const h of halos){h.quaternion.copy(camera.quaternion);h.material.uniforms.uTime.value=time;}
 updatePeople(time);animateCrows(time);
 for(const b of boats){b.g.rotation.z=Math.sin(time*.5+b.seed)*.035;b.g.rotation.x=Math.sin(time*.39+b.seed)*.026;b.g.position.y=-.84+Math.sin(time*.6+b.seed)*.038;}
 if(time-lastLod>.65){updateLOD();lastLod=time;}
}
function setQuality(value){quality=value;updateLOD();}
function setView(index){const v=viewpoints[index];camera.fov=v.fov||69;camera.position.copy(v.p);camera.lookAt(v.look);camera.updateProjectionMatrix();}
setView(1);updateLOD();
return {scene,camera,renderer,ground,wallSegments:colliders,solidMeshes,viewpoints,zoneAt,update,setQuality,setView,
metrics:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,strokes:brushBatches.reduce((s,b)=>s+b.count,0),totalStrokes:brushBatches.reduce((s,b)=>s+b.userData.max,0)})};
}
