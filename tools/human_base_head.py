"""CC0 MakeHuman hm08 head experiment; build_head(name, look) returns an origin Empty.

Only the official base OBJ's body group supplies skin topology. Head and neck are
extracted above raw Y=5.85; authored lips, eyelids, ears and nostrils are preserved.
Mesh coordinates are baked as Blender (logical x, -logical z, logical y).
Head width/length remain the runtime's responsibility. No hats or dependencies.
Source: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
License: vendor/makehuman/LICENSE.ASSETS.md; explicit CC0 header in base.obj.
"""
import bpy, math, json, sys, argparse
from collections import Counter, defaultdict, deque
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
DEFAULT=dict(jawWidth=1.,chinWidth=1.,cheekbone=1.,cheekFullness=.45,foreheadSlope=.35,
 noseLength=1.,noseWidth=1.,noseBridge=1.,noseTip=1.,eyeSpacing=1.,eyeSize=1.,eyeTilt=0.,
 eyeDepth=.45,browWeight=1.,lidWeight=.35,mouthWidth=1.,lipFullness=1.,earSize=1.,age=.4,
 asymmetry=0.,freckles=0.,beardLength=1.,beardDensity=1.,moustacheShape='trimmed',hairPart=0.,hairWave=.2)
def clamp(x,a=0.,b=1.):return max(a,min(b,x))
def g(x,s):return math.exp(-(x/s)**2)
def xyz(p):return (p[0],-p[2],p[1])
def rgb(h):
 h=h.lstrip('#');s=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in s)
def mix(a,b,t):return tuple(x*(1-t)+y*t for x,y in zip(a,b))

def skin_pigment(position,skin,face,eye_center,seed=0):
 """Anatomical colour in linear light; no painted lighting or make-up masks.

 Broad, overlapping pigment fields survive the original topology's subdivision.
 The reference complexion remains dominant everywhere, with blood-rich areas
 warmer, thin eyelid skin slightly cooler and age folds gently differentiated.
 """
 x,y,z=position;ax=abs(x);front=clamp((-z-.014)/.055)
 age=clamp((face['age']-.22)/.68)
 warm=tuple(clamp(c*m) for c,m in zip(skin,(1.035,.77,.72)))
 lip=tuple(clamp(c*m) for c,m in zip(skin,(.94,.48,.47)))
 thin=tuple(clamp(c*m) for c,m in zip(skin,(.91,.89,1.015)))
 fold=tuple(clamp(c*m) for c,m in zip(skin,(.85,.72,.68)))
 # Coherent, very low amplitude mottling replaces the isolated per-vertex
 # speckles; facial skin should read as living tissue rather than a flat clay.
 phase=seed*.013
 mottling=(math.sin(x*181+phase)*math.sin(y*133-phase)*math.sin(z*167+.8)
           +.45*math.sin(x*389-y*257+phase))*.009
 col=tuple(clamp(c*(1+mottling)) for c in skin)
 cheek=g(ax-.047,.027)*g(y-.105,.028)*front
 nose=g(x,.013)*g(y-.084,.019)*front
 nostril_wing=g(ax-.015,.010)*g(y-.079,.009)*front
 ear=clamp((ax-.074)/.017)*g(y-.120,.049)
 col=mix(col,warm,clamp(cheek*.29+nose*.30+nostril_wing*.12+ear*.22,0,.40))
 # A small double-lobed vermilion field, with a softer lower lip. Keep the
 # neighbouring philtrum/chin free of the broad pink oval in the older model.
 upper_lip=g(y-(.0565+.0012*g(x,.007)),.0038)*g(x,.022)
 lower_lip=g(y-.048,.0044)*g(x,.019)
 col=mix(col,lip,clamp((upper_lip*.52+lower_lip*.40)*front,0,.58))
 # Eyelid colour follows each artist's actual macro eye height and spacing.
 ex,ey,_=eye_center
 thin_skin=g(ax-abs(ex),.021)*g(y-(ey-.009),.010)*front
 col=mix(col,thin,thin_skin*(.10+.12*age))
 # Crease pigment is restrained and non-directional. Geometry and the local
 # occlusion bake supply recess depth; these fields never paint cast shadows.
 fold_x=.020+.20*clamp(.090-y,0,.05)
 nasolabial=g(ax-fold_x,.004)*g(y-.069,.020)*front
 eye_fold=g(ax-(abs(ex)+.020),.010)*g(y-(ey-.009),.007)*front
 brow_folds=sum(g(y-yy,.0028)*g(x,.059) for yy in (.178,.190,.203))*front
 col=mix(col,fold,clamp(age*(nasolabial*.10+eye_fold*.065+brow_folds*.047),0,.12))
 # Existing artist-specific freckling becomes a subtle pigment variation,
 # with a tightly limited contribution instead of high-contrast random dots.
 freckles=face['freckles']*.020*max(0,math.sin(x*977+y*701+phase)-.78)*cheek
 return tuple(clamp(c*(1-freckles),.001,1.) for c in col)

def material(name,color,rough=.67,vertex=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 p.inputs['IOR'].default_value=1.42
 if vertex:
  n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Col';m.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
 return m

def skin_microstructure(mat):
 """Seeded embedded image maps, exported as ordinary glTF normal/roughness."""
 import numpy as np
 size=1024;normal=bpy.data.images.get('AuthoredHead_MicroNormal');rough=bpy.data.images.get('AuthoredHead_MicroRoughness')
 if normal is None or rough is None:
  rng=np.random.default_rng(1888);noise=rng.normal(0,1,(size,size)).astype(np.float32)
  field=(noise+np.roll(noise,1,0)+np.roll(noise,-1,0)+np.roll(noise,1,1)+np.roll(noise,-1,1))/5
  dx=(np.roll(field,1,1)-np.roll(field,-1,1))*.065;dy=(np.roll(field,1,0)-np.roll(field,-1,0))*.065
  data=np.ones((size,size,4),dtype=np.float32);data[:,:,0]=.5+dx;data[:,:,1]=.5+dy;data[:,:,2]=np.sqrt(np.maximum(0,1-4*dx*dx-4*dy*dy))*.5+.5
  normal=bpy.data.images.new('AuthoredHead_MicroNormal',width=size,height=size,alpha=False);normal.colorspace_settings.name='Non-Color';normal.pixels.foreach_set(data.ravel());normal.pack()
  values=np.clip(.72+field*.045,.62,.84);data[:,:,:3]=values[:,:,None]
  rough=bpy.data.images.new('AuthoredHead_MicroRoughness',width=size,height=size,alpha=False);rough.colorspace_settings.name='Non-Color';rough.pixels.foreach_set(data.ravel());rough.pack()
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
 tex=nodes.new('ShaderNodeTexImage');tex.image=normal;tex.interpolation='Linear';n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.18
 links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs['Normal'])
 texr=nodes.new('ShaderNodeTexImage');texr.image=rough;sep=nodes.new('ShaderNodeSeparateColor');sep.mode='RGB'
 links.new(texr.outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],p.inputs['Roughness'])
def mesh(name,verts,faces,mat,parent,colors=None,subdivide=False,uvs=None):
 d=bpy.data.meshes.new(name);d.from_pydata([xyz(v) for v in verts],[],faces);d.update()
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=parent;d.materials.append(mat)
 for p in d.polygons:p.use_smooth=True
 if colors:
  a=d.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
  for item,c in zip(a.data,colors):item.color=(*c,1)
  d.color_attributes.active_color=a
 if uvs:
  layer=d.uv_layers.new(name='UVMap')
  for polygon,coords in zip(d.polygons,uvs):
   for loop,uv in zip(polygon.loop_indices,coords):layer.data[loop].uv=uv
 if subdivide:
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  mod=o.modifiers.new('Authored topology, one subdivision','SUBSURF');mod.levels=1
  bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
 return o
def sphere(name,center,scale,mat,parent,segments=32,rings=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=(0,0,0))
 o=bpy.context.object;o.name=name;o.parent=parent
 for v in o.data.vertices:
  # Blender sphere's +Y becomes logical front -Z.
  v.co=(center[0]+v.co.x*scale[0],-center[2]+v.co.y*scale[2],center[1]+v.co.z*scale[1])
 for p in o.data.polygons:p.use_smooth=True
 o.data.materials.append(mat);o.select_set(False);return o
def tube(name,pts,radii,mat,parent,sides=5):
 vs=[];fs=[]
 for i,p in enumerate(pts):
  d=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])).normalized()
  u=d.cross(Vector((0,0,1))).normalized();v=d.cross(u).normalized()
  for j in range(sides):vs.append(Vector(p)+radii[i]*(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides)))
 for i in range(len(pts)-1):
  for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j))
 return mesh(name,vs,fs,mat,parent)

def read_base():
 vs=[];groups={};texcoords=[];uvgroups={};group=''
 for line in (ROOT/'vendor/makehuman/base.obj').read_text().splitlines():
  p=line.split()
  if not p:continue
  if p[0]=='v':vs.append(tuple(map(float,p[1:4])))
  elif p[0]=='vt':texcoords.append(tuple(map(float,p[1:3])))
  elif p[0]=='g':group=p[1]
  elif p[0]=='f':
   groups.setdefault(group,[]).append(tuple(int(a.split('/')[0])-1 for a in p[1:]))
   uvgroups.setdefault(group,[]).append(tuple(int(a.split('/')[1])-1 for a in p[1:]))
 return vs,groups,texcoords,uvgroups
def normalize(p):
 # Near-uniform adult dimensions: chin 0, crown .248, eyes .128; .197 ear span.
 return (p[0]*.112,(p[1]-6.10)*.1037,-(p[2]-.55)*.1037)

def apply_macro_targets(base,look,f):
 """Official CC0 deltas retain original OBJ vertex indices and topology."""
 gender='female' if look.get('presentation')=='woman' else 'male'
 age=look.get('age1888')
 # MakeHuman's official adult macro endpoints are 25 and 90 years.
 old=clamp((float(age)-25)/65) if age is not None else clamp((f['age']-.20)/1.0)
 coords=[list(p) for p in base];applied=[]
 for stage,weight in [('young',1-old),('old',old)]:
  path=ROOT/'vendor/makehuman/targets'/f'caucasian-{gender}-{stage}.target'
  if not path.exists() or weight<=0:continue
  for line in path.read_text().splitlines():
   if not line or line.startswith('#'):continue
   row=line.split()
   if len(row)!=4:continue
   i=int(row[0])
   for axis in range(3):coords[i][axis]+=float(row[axis+1])*weight
  applied.append({'target':str(path.relative_to(ROOT)),'weight':weight})
 return [tuple(p) for p in coords],applied

def build_head(name,look):
 f={**DEFAULT,**look.get('face',{})}
 for k in ('jawWidth','noseLength','noseWidth'):
  if k not in look.get('face',{}) and k in look:f[k]=look[k]
 source_base,groups,texcoords,uvgroups=read_base()
 base,applied_targets=apply_macro_targets(source_base,look,f)
 # Macro targets contain stature as well as facial form. Re-anchor the head
 # before any artist morph; otherwise male/female targets drift above/below hats.
 bodyids={i for p in groups['body'] for i in p}
 chin_id=min(bodyids,key=lambda i:sum((source_base[i][k]-(0,6.14,1.30)[k])**2 for k in range(3)))
 crown_id=max(bodyids,key=lambda i:source_base[i][1])
 eyeids={i for p in groups['joint-l-eye'] for i in p}
 raw_eye=tuple(sum(base[i][axis] for i in eyeids)/len(eyeids) for axis in range(3))
 chin_y=base[chin_id][1];head_scale=.248/(base[crown_id][1]-chin_y)
 z_origin=raw_eye[2]-.0721/head_scale
 def normalize(p):return (p[0]*head_scale*1.08,(p[1]-chin_y)*head_scale,-(p[2]-z_origin)*head_scale)
 rawpairs=[(p,uv) for p,uv in zip(groups['body'],uvgroups['body']) if min(source_base[i][1] for i in p)>=5.85]
 rawfaces=[p for p,uv in rawpairs]
 ids=sorted({i for face in rawfaces for i in face});reindex={i:j for j,i in enumerate(ids)}
 # Raw OBJ front +Z becomes logical front -Z, a handedness reflection.
 # Reverse winding and matching UV corners so every authored normal faces out.
 faces=[tuple(reindex[i] for i in reversed(p)) for p in rawfaces]
 skinuvs=[tuple(texcoords[i] for i in reversed(uv)) for p,uv in rawpairs]
 root=bpy.data.objects.new(name+'_head',None);bpy.context.collection.objects.link(root)
 root['logical_axes']='X right, Y up, -Z front; baked Blender=(x,-z,y)';root['source']='MakeHuman hm08, CC0 body topology'
 root['profile_face_controls']=json.dumps(f);root['no_hat']=True
 root['macro_targets_json']=json.dumps(applied_targets)
 eye0=normalize(raw_eye)
 eyehelper={i for p in groups['helper-l-eye'] for i in p}
 eyeR=sum(max(base[i][a] for i in eyehelper)-min(base[i][a] for i in eyehelper) for a in range(3))/6*head_scale*1.035
 def morph(p):
  x,y,z=p;s=1 if x>=0 else -1;front=clamp((-z-.005)/.06)
  jaw=g(y-.035,.045)*front;chin=g(y-.006,.025)*g(x,.042)*front
  x*=1+(f['jawWidth']-1)*jaw*.72+(f['chinWidth']-1)*chin*.5
  cheek=g(abs(x)-.05,.036)*g(y-.104,.031)*front
  x+=s*(f['cheekbone']-1)*.016*cheek
  z-=(f['cheekFullness']-.45)*.014*cheek
  z+=(f['foreheadSlope']-.35)*.026*clamp((y-.16)/.083)*front
  nose=g(x,.019)*g(y-.091,.033)*front
  z-=(f['noseLength']-1)*.034*nose;y-=(f['noseLength']-1)*.014*nose
  x*=1+(f['noseWidth']-1)*g(y-.081,.025)*g(x,.03)*front*.8
  z-=(f['noseBridge']-1)*.025*g(x,.015)*g(y-.115,.029)*front
  z-=(f['noseTip']-1)*.017*g(x,.016)*g(y-.085,.015)*front
  eye=g(abs(p[0])-eye0[0],.027)*g(y-eye0[1],.028)*front
  x+=s*(f['eyeSpacing']-1)*eye0[0]*eye
  x+=(p[0]-s*eye0[0])*(f['eyeSize']-1)*eye*.65
  y+=(p[1]-eye0[1])*(f['eyeSize']-1)*eye*.65
  y+=f['eyeTilt']*(abs(p[0])-eye0[0])*eye
  z+=(f['eyeDepth']-.45)*.010*eye
  # Eyelid edge deforms with its surrounding authored loops, avoiding added rings.
  y-=(f['lidWeight']-.35)*.0035*eye*clamp((p[1]-eye0[1]+.002)/.009)
  z-=(f['browWeight']-1)*.006*g(abs(p[0])-eye0[0],.034)*g(p[1]-.146,.012)*front
  mouth=g(p[1]-.053,.020)*g(p[0],.036)*front
  x*=1+(f['mouthWidth']-1)*mouth*.7
  z-=(f['lipFullness']-1)*.006*mouth
  # Tuck the slight neutral lip separation; original upper/lower vermilion stays.
  y+=(.053-p[1])*.16*g(p[1]-.053,.006)*g(p[0],.023)*front
  ear=clamp((abs(p[0])-.073)/.021)*g(p[1]-.112,.047)
  x+=s*(f['earSize']-1)*.012*ear;y+=(p[1]-.112)*(f['earSize']-1)*ear
  z+=(f['age']-.25)*.004*cheek
  z+=f['age']*.0011*g(abs(p[0])-.034,.006)*g(p[1]-.067,.028)*front
  # Fine mature expression folds follow the face planes, before subdivision.
  maturity=clamp((f['age']-.28)/.60)
  for yy in (.178,.190,.203):
   z+=maturity*.0018*g(p[1]-yy,.0025)*g(p[0],.062)*front
  outer_eye=g(abs(p[0])-(eye0[0]+.018),.014)*g(p[1]-(eye0[1]-.010),.008)*front
  z+=maturity*.0017*outer_eye
  fold_x=.020+.20*clamp(.090-p[1],0,.05)
  z+=maturity*.0015*g(abs(p[0])-fold_x,.003)*g(p[1]-.069,.021)*front
  y+=f['asymmetry']*.010*s*g(p[1]-.108,.07)*front
  return (x,y,z)
 verts=[morph(normalize(base[i])) for i in ids]
 # Extend the actual cut boundary into a level, tapered neck collar, then cap.
 edgecounts=Counter(tuple(sorted((a,b))) for face in faces for a,b in zip(face,face[1:]+face[:1]))
 neckedges=[edge for edge,n in edgecounts.items() if n==1 and all(source_base[ids[i]][1]<6.10 for i in edge)]
 neckids={i for edge in neckedges for i in edge};adj=defaultdict(list)
 for a,b in neckedges:adj[a].append(b);adj[b].append(a)
 for i in neckids:
  x,y,z=verts[i];verts[i]=(x*.85,-.045,.033+(z-.033)*.85)
 if neckids:
  # Feather only the anatomical neck into the garment opening. The source
  # region excludes the chin/jaw surface; everything at/above Y=.01 is fixed.
  neck_center_z=(min(verts[i][2] for i in neckids)+max(verts[i][2] for i in neckids))*.5
  neck_rx=max(abs(verts[i][0]) for i in neckids)
  neck_rz=(max(verts[i][2] for i in neckids)-min(verts[i][2] for i in neckids))*.5
  scale_x=min(1.,.050/max(neck_rx,.001));scale_z=min(1.,.040/max(neck_rz,.001))
  for i,(x,y,z) in enumerate(verts):
   source=source_base[ids[i]]
   if y>=.01 or (i not in neckids and (source[1]>=6.34 or source[2]>=1.15)):continue
   t=clamp((.01-y)/.055);weight=t*t*(3-2*t)
   verts[i]=(x*(1+(scale_x-1)*weight),y-.023*weight,
             z+(-.01+(z-neck_center_z)*scale_z-z)*weight)
  start=min(neckids);ring=[start];previous=None;current=start
  while True:
   candidates=[i for i in adj[current] if i!=previous]
   nxt=next((i for i in candidates if i not in ring),start)
   if nxt==start:break
   ring.append(nxt);previous,current=current,nxt
  normal_y=sum((verts[a][2]-verts[b][2])*(verts[a][0]+verts[b][0]) for a,b in zip(ring,ring[1:]+ring[:1]))
  if normal_y>0:ring.reverse()
  faces.append(tuple(ring));skinuvs.append(tuple((.5,.5) for i in ring))
 skin=rgb(look.get('skin','#d7b194'))
 pigment_seed=sum((i+1)*ord(c) for i,c in enumerate(str(name)))
 colors=[skin_pigment(normalize(base[i]),skin,f,eye0,pigment_seed) for i in ids]
 skinmat=material(name+'_skin',skin,.71,True)
 skin_microstructure(skinmat)
 head=mesh(name+'_authored_skin',verts,faces,skinmat,root,colors,True,skinuvs)
 root['head_mesh']=head.name
 eye_centers=[morph((side*eye0[0],eye0[1],eye0[2])) for side in (-1,1)]
 def surface_landmark(raw):
  i=min(ids,key=lambda i:sum((source_base[i][k]-raw[k])**2 for k in range(3)))
  return morph(normalize(base[i]))
 landmarks={'coordinate_system':'logical X right, Y up, -Z front',
  'eyes':eye_centers,'eyeRadius':eyeR,'noseBase':surface_landmark((0,6.76,1.56)),
  'mouthCenter':surface_landmark((0,6.61,1.56)),
  'earCenters':[surface_landmark((s*.79,7.17,.45)) for s in (-1,1)],
  'chin':surface_landmark((0,6.14,1.30)),
  'bounds':[[min(p[k] for p in verts) for k in range(3)],[max(p[k] for p in verts) for k in range(3)]],
  'scalpFrontY':.175,'scalpBackY':.070,'neckBottomY':-.068,'neckBaseCenter':[0.,-.068,-.01]}
 root['landmarks_json']=json.dumps(landmarks)
 # Native socket loops occlude spheres: there are no pasted-on white eye discs.
 eye_mat=material(name+'_sclera',rgb('#d4cec1'),.29)
 iris_color=rgb(look.get('eyeColor','#596353'))
 iris_mat=material(name+'_iris',(1.,1.,1.),.26,True)
 pupil_mat=material(name+'_pupil',rgb('#111715'),.21)
 # Standard Principled clearcoat exports as KHR_materials_clearcoat. A light
 # tear-film highlight belongs to the eyes only, without another corneal mesh.
 for mat,weight in ((eye_mat,.16),(iris_mat,.24),(pupil_mat,.28)):
  shader=mat.node_tree.nodes.get('Principled BSDF')
  shader.inputs['Coat Weight'].default_value=weight
  shader.inputs['Coat Roughness'].default_value=.10
 iris_phase=sum((i+1)*ord(c) for i,c in enumerate(str(name)))*.013
 limbal=rgb('#202921');collarette=rgb('#967044')
 for side in (-1,1):
  center=morph((side*eye0[0],eye0[1],eye0[2]));r=eyeR*(.95+.05*f['eyeSize'])
  sphere(name+'_eye_'+str(side),center,(r,r,r),eye_mat,root)
  # Iris is a gently convex cap contiguous with the scleral sphere, not an orb.
  cr=.0060;cv=[];cf=[];cc=[];rings=6;segs=40
  for j in range(rings+1):
   rr=cr*j/rings
   for k in range(segs):
    a=k*math.tau/segs;cv.append((center[0]+rr*math.cos(a),center[1]+rr*math.sin(a),center[2]-math.sqrt(r*r-rr*rr)-.00010))
    t=j/rings
    fibers=(.075*math.sin(13*a+iris_phase)+.035*math.sin(7*a-iris_phase))*math.sin(math.pi*clamp((t-.32)/.68))
    col=tuple(clamp(c*(1+fibers),.001,1.) for c in iris_color)
    col=mix(col,collarette,.13*g(t-.53,.14))
    col=mix(col,limbal,.48*g(1-t,.095)+.10*g(t-.42,.07))
    cc.append(col)
  for j in range(rings):
   for k in range(segs):cf.append((j*segs+k,j*segs+(k+1)%segs,(j+1)*segs+(k+1)%segs,(j+1)*segs+k))
  iris=mesh(name+'_iris_'+str(side),cv,cf,iris_mat,root,cc)
  sphere(name+'_pupil_'+str(side),(center[0],center[1],center[2]-r-.00018),(.00245,.00245,.00024),pupil_mat,root,24,8)
 if look.get('skipGroom',False):
  add_blink(head,eye_centers,eyeR)
  root['head_triangle_count']=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
  return root
 # Hair uses the scalp's actual topology. Cap is closely fitted, never a sphere.
 hairmat=material(name+'_hair',rgb(look.get('hairColor','#514036')),.81)
 beardmat=material(name+'_beard',rgb(look.get('beardColor',look.get('hairColor','#514036'))),.83)
 def surface_layer(label,predicate,mat,offset):
  fs=[p for p in faces if all(predicate(base[ids[j]]) for j in p)]
  used=sorted({i for p in fs for i in p});remap={i:j for j,i in enumerate(used)};vv=[]
  for i in used:
   p=Vector(verts[i]);n=Vector((p.x*.7,(p.y-.14)*.65,(p.z-.008)*.8)).normalized()
   vv.append(p+n*offset)
  return mesh(name+label,vv,[tuple(remap[i] for i in p) for p in fs],mat,root,subdivide=False) if fs else None
 recession=look.get('hairline',.12);hairtype=look.get('hair','short')
 def hair_region(p):
  front=clamp((p[2]-.5)/.9);line=6.72+front*(.9+recession*.62)
  line+=f['hairPart']*p[0]*.11+f['hairWave']*.06*math.sin(p[0]*6)
  if hairtype=='bald':return p[1]>6.8 and p[1]<7.73 and p[2]<.76
  return p[1]>line
 surface_layer('_fitted_scalp',hair_region,hairmat,.0022)
 if hairtype in ('pinned','waved'):
  sphere(name+'_pinned_bun',(.0,.162,.126),(.041,.037,.032),hairmat,root,28,18)
 elif hairtype=='long':
  sphere(name+'_nape_hair',(0,.064,.094),(.071,.058,.026),hairmat,root,28,18)
 def front_at(x,y):
  return min(verts,key=lambda p:(p[0]-x)**2+(p[1]-y)**2+max(0,p[2])**2*.2)[2]
 for side in (-1,1):
  pts=[]
  for j in range(12):
   x=side*(.017+j*.0035);y=.149+.004*math.sin(j/11*math.pi)
   pts.append((x,y,front_at(x,y)-.0014))
  tube(name+'_brow_'+str(side),pts,[.0006+.0010*f['browWeight']*math.sin(math.pi*(j+.5)/12) for j in range(12)],hairmat,root)
 beard=look.get('beard','none')
 if beard in ('short','full'):
  def beard_region(p):
   # A close beard follows jaw and sideburns; vermilion remains uncovered.
   return p[2]>.57 and p[1]<6.81 and p[1]>6.12 and not (abs(p[0])<.27 and 6.47<p[1]<6.74)
  surface_layer('_jaw_beard',beard_region,beardmat,.0015+.0013*f['beardDensity'])
  if beard=='full':
   sphere(name+'_beard_under_chin',(0,-.002,-.073),(.039,.018*f['beardLength'],.026),beardmat,root,28,16)
 if beard!='none' and f['moustacheShape']!='none':
  for side in (-1,1):
   pts=[]
   for j in range(11):
    u=j/10;x=side*(.002+.023*u)*f['mouthWidth'];y=.064-.006*u
    if f['moustacheShape']=='drooping':y-=.006*u*u
    if f['moustacheShape']=='handlebar':y+=.007*u**3
    pts.append((x,y,front_at(x,y)-.002))
   tube(name+'_moustache_'+str(side),pts,[.0004+.0018*math.sin(math.pi*(j+.5)/11) for j in range(11)],beardmat,root,6)
 triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in root.children_recursive if o.type=='MESH')
 root['head_triangle_count']=triangles
 add_blink(head,eye_centers,eyeR)
 if triangles>50000:raise RuntimeError(f'Head exceeds triangle budget: {triangles}')
 return root

def add_blink(head,centers,radius):
 """Close the existing open eyelid loops; feather motion over adjacent skin rings."""
 d=head.data;edgecounts=Counter(tuple(sorted((a,b))) for p in d.polygons for a,b in zip(list(p.vertices),list(p.vertices)[1:]+list(p.vertices)[:1]))
 adjacency=defaultdict(set)
 for a,b in edgecounts:adjacency[a].add(b);adjacency[b].add(a)
 logical=[(v.co.x,v.co.z,-v.co.y) for v in d.vertices]
 boundary={i for edge,n in edgecounts.items() if n==1 for i in edge}
 head.shape_key_add(name='Basis');key=head.shape_key_add(name='Blink')
 moved=set()
 for ex,ey,ez in centers:
  eyelid=[i for i in boundary if abs(logical[i][0]-ex)<.026 and abs(logical[i][1]-ey)<.019 and logical[i][2]<ez]
  # hm08 closes each socket behind its opening, so no topological boundary is
  # guaranteed. Its closely packed front lid loops are the geometric fallback.
  if not eyelid:
   eyelid=[i for i,p in enumerate(logical) if abs(p[0]-ex)<.023 and abs(p[1]-ey)<.009 and p[2]<ez-.004]
  distance={i:0 for i in eyelid};queue=deque(eyelid)
  while queue:
   i=queue.popleft()
   if distance[i]>=4:continue
   for n in adjacency[i]:
    if n not in distance:distance[n]=distance[i]+1;queue.append(n)
  for i,steps in distance.items():
   x,y,z=logical[i];w=(1.,.78,.44,.16,0.)[steps]
   w*=math.exp(-((x-ex)/.025)**6)
   if abs(x-ex)>.034 or abs(y-ey)>.036:continue
   # Upper lid travels farther; the lower lid rises only slightly.
   closed_y=ey-.0035;ny=y+(closed_y-y)*w
   nz=z
   if abs(x-ex)<radius:
    surface=ez-math.sqrt(max(.000001,radius*radius-(x-ex)**2))-.0006
    nz=z+(min(z,surface)-z)*w
   key.data[i].co=xyz((x,ny,nz))
   if w>0:moved.add(i)
 key.slider_min=0.;key.slider_max=1.;key.value=0.
 head['blink_affected_vertices']=len(moved)

def get_head_mesh(root):return bpy.data.objects[root['head_mesh']]
def get_landmarks(root):return json.loads(root['landmarks_json'])

def main(out):
 out=Path(out);out.mkdir(parents=True,exist_ok=True)
 cast=json.loads((ROOT/'build/characters/designs.json').read_text())
 selected=[a for a in cast if a['id'] in ('van-gogh','morisot')];stats=[]
 for artist in selected:
  bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
  actual_age={'van-gogh':35,'morisot':47}[artist['id']]
  root=build_head(artist['id'],{**artist['look'],'skipGroom':True,'age1888':actual_age})
  bpy.ops.object.select_all(action='DESELECT')
  for o in [root,*root.children_recursive]:o.select_set(True)
  bpy.context.view_layer.objects.active=root
  bpy.ops.export_scene.gltf(filepath=str(out/(artist['id']+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
  scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
  scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
  scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.15,.17,.19,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
  scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
  for label,power,pos,size in [('key',6,(-.30,.42,-.40),.35),('fill',2,(.30,.18,-.30),.28),('rim',5,(.2,.35,.28),.25)]:
   d=bpy.data.lights.new(label,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(label,d);scene.collection.objects.link(o);o.location=xyz(pos);o.rotation_euler=(Vector(xyz((0,.12,0)))-o.location).to_track_quat('-Z','Y').to_euler()
  d=bpy.data.cameras.new('camera');d.type='ORTHO';d.ortho_scale=.33;cam=bpy.data.objects.new('camera',d);scene.collection.objects.link(cam);scene.camera=cam
  for view,pos in [('front',(0,.125,-.75)),('three-quarter',(.34,.14,-.66))]:
   cam.location=xyz(pos);cam.rotation_euler=(Vector(xyz((0,.117,0)))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(artist['id']+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
  skin=get_head_mesh(root);skin.data.shape_keys.key_blocks['Blink'].value=1.
  cam.location=xyz((0,.125,-.75));cam.rotation_euler=(Vector(xyz((0,.117,0)))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(artist['id']+'-blink.png'));bpy.ops.render.render(write_still=True)
  skin.data.shape_keys.key_blocks['Blink'].value=0.
  stats.append({'id':artist['id'],'triangles':root['head_triangle_count'],'source':'MakeHuman CC0 hm08 body','subdivision':1,'uvLayer':skin.data.uv_layers.active.name,'blinkAffectedVertices':skin['blink_affected_vertices'],'macroTargets':json.loads(root['macro_targets_json']),'landmarks':get_landmarks(root)})
  bpy.ops.wm.save_as_mainfile(filepath=str(out/(artist['id']+'.blend')))
 (out/'stats.json').write_text(json.dumps(stats,indent=2)+'\n');print('HUMAN_BASE_STATS',json.dumps(stats),flush=True)

if __name__=='__main__':
 argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 p=argparse.ArgumentParser();p.add_argument('--out-dir',default=str(ROOT/'build/characters/base-head-test'));a=p.parse_args(argv);main(a.out_dir)
