/** Dimensionless visual art direction, not claimed historical measurements.
 * Shared by the articulated model, controller and hit detection. No identity
 * changes health, damage, movement speed, reaction time or weapon statistics.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const value=(v,fallback,a,b)=>clamp(Number.isFinite(v)?v:fallback,a,b);
const FOOT=[];
for(const [cy,cz,ry,rz] of [[-.327,-.045,.065,.125],[-.338,-.113,.039,.063]])
 for(let y=0;y<=8;y++)for(let x=0;x<=12;x++)FOOT.push([cy+Math.cos(y/8*Math.PI)*ry,cz+Math.sin(y/8*Math.PI)*Math.sin(x/12*Math.PI*2)*rz]);
for(const y of [-.3845,-.3595])for(const z of [-.161,.071])FOOT.push([y,z]);

export function bodyProfile(look={}){
 const build=look.build==='broad'?1.09:look.build==='slim'?.93:1;
 const stature=value(look.stature,1,.80,1.12),stoop=value(look.stoop,0,0,.17);
 const legLength=value(look.legLength,1,.65,1.15),torsoLength=value(look.torsoLength,1,.86,1.16),headLength=value(look.headLength,1,.88,1.16);
 // Bespoke headwear keeps its predecessor's height envelope so a costume
 // change cannot rescale the anatomy, camera or hit volumes.
 const hatTops={straw:.294,widebrim:.294,beret:.284,cap:.274,helmet:.337,frayedstraw:.294,slouchberet:.284,sailor:.274,bowler:.263,garden:.294,floppy:.294,bonnet:.270,portrait:.294};
 const headTop=hatTops[look.hat]??(look.hair==='pinned'||look.hair==='waved'?.270:look.hair==='curly'?.263:.247);
 const scale=(1.8*stature-.008)/(.791*legLength+.625*torsoLength*Math.cos(stoop)+headTop*headLength);
 const shoulderScale=value(look.shoulderWidth,build,.76,1.34),waistScale=value(look.waistWidth,build,.72,1.48);
 const torsoDepth=value(look.torsoDepth,1,.78,1.38),hipScale=value(look.hipWidth,waistScale,.78,1.34),legThickness=value(look.legThickness,1,.75,1.30);
 const belly=value(look.belly,0,0,.9),chest=value(look.chest,0,0,.75);
 const p={stature,stoop,legScale:legLength*scale,torsoScale:torsoLength*scale,
  shoulderScale,waistScale,hipScale,belly,chest,depthScale:Math.sqrt(waistScale)*torsoDepth,legWidth:Math.sqrt(hipScale)*legThickness,legDepth:(.94+.06*hipScale)*Math.sqrt(legThickness),
  neckWidth:value(look.neckWidth,1,.75,1.25),handScale:value(look.handScale,1,.85,1.18),
  armScale:scale*(torsoLength*.94+legLength*.06),armWidth:Math.sqrt(shoulderScale*waistScale),
  headScale:{x:value(look.headWidth,1,.84,1.18),y:headLength*scale,z:(.94+.06*value(look.headWidth,1,.84,1.18))*Math.pow(scale,.2)},headTop,
  radius:clamp(.31*Math.max(shoulderScale,waistScale,torsoDepth),.27,.46)};
 p.headRadii=[.108*p.headScale.x,.142*p.headScale.y,.110*p.headScale.z];
 p.chestRadii=[.24*shoulderScale,.235*p.torsoScale,.16*p.depthScale*(1+chest*.12)];
 p.abdomenRadii=[.20*waistScale,.17*p.torsoScale,.155*p.depthScale*(1+belly*.22)];
 const standing=bodyPose(p,{crouched:false}),crouching=bodyPose(p,{crouched:true});
 p.standingHeight=standing.height;p.crouchHeight=crouching.height;
 p.eyeStanding=standing.eye[1];p.eyeCrouched=crouching.eye[1];
 p.standingPose=standing;p.crouchingPose=crouching;
 return p;
}

/** Local offsets relative to actor.position, facing local -Z. Rotate each
 * [x,y,z] by actor.yaw before adding it to world feet. Crouch is not a uniform
 * scale: knees bend and the upper body inclines while the head remains level.
 * `crouch` accepts a 0..1 animation blend; `crouched` accepts gameplay state.
 */
export function bodyPose(profile,options={}){
 const p=profile||bodyProfile(),c=value(options.crouch,options.crouched?1:0,0,1);
 if(c===0&&p.standingPose)return p.standingPose;if(c===1&&p.crouchingPose)return p.crouchingPose;
 const hip=c*1.32,knee=-c*2.18,lower=hip+knee;
 const footLow=-.300*p.legScale*Math.cos(lower)+Math.min(...FOOT.map(([y])=>(y+.300)*p.legScale));
 const pelvisY=.008+.006*p.legScale+.393*p.legScale*Math.cos(hip)-footLow;
 const pelvisZ=c*.23*p.torsoScale,lean=c*.72+p.stoop*(1-c*.45),cos=Math.cos(lean),sin=Math.sin(lean);
 const neckY=.625*p.torsoScale*cos,neckZ=-.625*p.torsoScale*sin;
 const eye=[0,pelvisY+neckY+.142*p.headScale.y,pelvisZ+neckZ-.080*p.headScale.z];
 const head=[0,pelvisY+neckY+.112*p.headScale.y,pelvisZ+neckZ+.010*p.headScale.z];
 const chest=[0,pelvisY+.37*p.torsoScale*cos,pelvisZ-.37*p.torsoScale*sin];
 const abdomen=[0,pelvisY+.13*p.torsoScale*cos,pelvisZ-.13*p.torsoScale*sin];
 const height=pelvisY+neckY+p.headTop*p.headScale.y;
 const upperLegs=[],lowerLegs=[];
 for(const side of[-1,1]){
  const x=side*.107*(p.hipScale||p.waistScale),rootY=pelvisY-.006*p.legScale;
  upperLegs.push({center:[x,rootY-.19*p.legScale*Math.cos(hip),pelvisZ-.19*p.legScale*Math.sin(hip)],radii:[.101*p.legWidth,.205*p.legScale,.101*p.legDepth],pitch:hip});
  lowerLegs.push({center:[x,rootY-.393*p.legScale*Math.cos(hip)-.18*p.legScale*Math.cos(lower),pelvisZ-.393*p.legScale*Math.sin(hip)-.18*p.legScale*Math.sin(lower)],radii:[.077*p.legWidth,.218*p.legScale,.105*p.legDepth],pitch:lower});
 }
 return {height,eye,head,chest,abdomen,eyeHeight:eye[1],headHeight:head[1],torsoHeight:chest[1],hipHeight:pelvisY,
  pelvisY,pelvisZ,lean,indicatorY:height+.23,headRadii:p.headRadii,chestRadii:p.chestRadii,abdomenRadii:p.abdomenRadii,
  chestPitch:-lean,abdomenPitch:-lean,upperLegs,lowerLegs};
}
