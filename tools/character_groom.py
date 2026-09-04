"""Surface-fitted, exportable artist grooming for the authored CC0 head.

Public API: add_groom(root, head_mesh, name, look) -> list[bpy.types.Object].
The caller builds human_base_head.build_head(name, {**look, 'skipGroom': True}).
Geometry is sampled from that actual mesh with a BVH, never from an unrelated
ellipsoid. Logical X/right, Y/up and -Z/front convert to Blender (x, -z, y).
No hats. All transforms stay at the origin. No external textures or add-ons.
Export with export_vertex_color='ACTIVE' so the packed fiber color multiplier
retains artist-specific vertex colors in glTF (Blender's material scan misses it).
"""
import argparse
from array import array
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TAU=math.tau
ROOT=Path(__file__).resolve().parents[1]


def clamp(x,a=0.,b=1.):return min(b,max(a,x))
def mix(a,b,t):return a*(1-t)+b*t
def smooth(t):
    t=clamp(t)
    return t*t*(3-2*t)
def xyz(p):return (p[0],-p[2],p[1])
def logical(p):return Vector((p[0],p[2],-p[1]))
def rgb(h):
    h=h.lstrip('#')
    values=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)
def blend(a,b,t):return tuple(mix(x,y,clamp(t)) for x,y in zip(a,b))
def tone(c,t):return tuple(clamp(x*(1+t),.001,1) for x in c)


def fiber_normal():
    """A packed tangent normal map; subtle continuous fibers, no painted stripes."""
    image=bpy.data.images.get('VGS_Groom_Fiber_Normal')
    color_image=bpy.data.images.get('VGS_Groom_Fiber_Color')
    if image and color_image:return image
    width,height=2048,256
    pixels=array('f')
    colors=array('f')
    for y in range(height):
        v=(y+.5)/height
        drift=2.4*math.sin(v*4.6)+.65*math.sin(v*11)
        for x in range(width):
            u=(x+.5)/width
            # Wavy grouped fibers sit beneath the sculpted locks. Strong regular
            # pinstripes made the beard read as vertically corrugated cardboard.
            phase=TAU*340*u+drift+1.65*math.sin(u*TAU*13+v*5.0)
            nx=.19*math.cos(phase)+.035*math.cos(phase*.497+v*9)
            ny=.026*math.cos(phase)*math.sin(v*4.6)
            nz=math.sqrt(max(.001,1-nx*nx-ny*ny))
            pixels.extend((nx*.5+.5,ny*.5+.5,nz*.5+.5,1.0))
            strand=.5+.5*math.sin(phase)
            cluster=.5+.5*math.sin(phase*.497+v*9)
            shade=.83+.10*strand+.035*cluster
            colors.extend((shade,shade,shade,1.0))
    image=bpy.data.images.new('VGS_Groom_Fiber_Normal',width,height,alpha=True)
    image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(pixels)
    image.pack()
    color_image=bpy.data.images.new('VGS_Groom_Fiber_Color',width,height,alpha=True)
    color_image.pixels.foreach_set(colors)
    color_image.pack()
    return image


def groom_material(name,rough=.78,metal=0.,fibers=True):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    mat.use_backface_culling=False
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=rough
    bsdf.inputs['Metallic'].default_value=metal
    col=nodes.new('ShaderNodeVertexColor')
    col.layer_name='Col'
    links.new(col.outputs['Color'],bsdf.inputs['Base Color'])
    if fibers:
        tex=nodes.new('ShaderNodeTexImage')
        tex.image=fiber_normal()
        normal=nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value=.28
        links.new(tex.outputs['Color'],normal.inputs['Color'])
        links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
        color_texture=nodes.new('ShaderNodeTexImage')
        color_texture.image=bpy.data.images['VGS_Groom_Fiber_Color']
        multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY'
        multiply.inputs[0].default_value=1.0
        links.new(col.outputs['Color'],multiply.inputs[1])
        links.new(color_texture.outputs['Color'],multiply.inputs[2])
        links.new(multiply.outputs[0],bsdf.inputs['Base Color'])
    return mat


class Bucket:
    def __init__(self,name,mat):
        self.name,self.mat=name,mat
        self.v,self.f,self.c,self.uv=[],[],[],[]

    def vert(self,p,c,uv=None):
        self.v.append(tuple(p));self.c.append(tuple(c))
        self.uv.append(uv or (math.atan2(p[0],-p[2])/TAU+.5,p[1]/.25))
        return len(self.v)-1

    def quad(self,a,b,c,d):self.f.append((a,b,c,d))

    def tube(self,pts,radii,color,sides=3,closed=False):
        pts=[Vector(p) for p in pts]
        start=len(self.v)
        for i,p in enumerate(pts):
            before=pts[(i-1)%len(pts)] if closed else pts[max(0,i-1)]
            after=pts[(i+1)%len(pts)] if closed else pts[min(len(pts)-1,i+1)]
            tangent=(after-before).normalized()
            reference=Vector((0,1,0)) if abs(tangent.y)<.91 else Vector((1,0,0))
            u=tangent.cross(reference).normalized();v=tangent.cross(u).normalized()
            r=radii[i] if isinstance(radii,(list,tuple)) else radii
            c=color[i] if isinstance(color[0],(list,tuple)) else color
            for j in range(sides):
                a=TAU*j/sides
                self.vert(p+r*(math.cos(a)*u+math.sin(a)*v),c)
        for i in range(len(pts) if closed else len(pts)-1):
            ni=(i+1)%len(pts)
            for j in range(sides):
                nj=(j+1)%sides
                self.quad(start+i*sides+j,start+i*sides+nj,start+ni*sides+nj,start+ni*sides+j)
        if not closed:
            self.f.append(tuple(start+j for j in reversed(range(sides))))
            self.f.append(tuple(start+(len(pts)-1)*sides+j for j in range(sides)))

    def sphere(self,center,scale,color,segments=24,rings=14):
        start=len(self.v)
        for j in range(rings+1):
            t=math.pi*j/rings
            for i in range(segments):
                a=TAU*i/segments
                self.vert((center[0]+scale[0]*math.sin(t)*math.sin(a),
                           center[1]+scale[1]*math.cos(t),
                           center[2]-scale[2]*math.sin(t)*math.cos(a)),color,(i/segments,j/rings))
        for j in range(rings):
            for i in range(segments):
                ni=(i+1)%segments
                self.quad(start+j*segments+i,start+j*segments+ni,start+(j+1)*segments+ni,start+(j+1)*segments+i)

    def object(self,parent):
        if not self.f:return None
        mesh=bpy.data.meshes.new(self.name+'_mesh')
        mesh.from_pydata([xyz(p) for p in self.v],[],self.f);mesh.update()
        mesh.materials.append(self.mat)
        col=mesh.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
        for value,c in zip(col.data,self.c):value.color=(*c,1)
        mesh.color_attributes.active_color=col
        uv=mesh.uv_layers.new(name='UVMap')
        for loop in mesh.loops:uv.data[loop.index].uv=self.uv[loop.vertex_index]
        for polygon in mesh.polygons:polygon.use_smooth=True
        obj=bpy.data.objects.new(self.name,mesh)
        bpy.context.collection.objects.link(obj);obj.parent=parent
        obj['character_groom']=True
        return obj


class Surface:
    def __init__(self,head):
        bpy.context.view_layer.update()
        self.head=head
        self.bvh=BVHTree.FromObject(head,bpy.context.evaluated_depsgraph_get())
        self.cache={}
        self.top=max(v.co.z for v in head.data.vertices)

    def ray(self,origin,direction):
        hit,normal,_,_=self.bvh.ray_cast(Vector(xyz(origin)),Vector(xyz(direction)),1.0)
        if hit is None:return None
        # The imported OBJ has crossed coordinate conventions during normalization.
        # Face winding must not make a fitted groom sink below the skin surface.
        n=logical(normal)
        if n.dot(Vector(direction))>0:n=-n
        return logical(hit),n

    def radial(self,y,a):
        key=(round(y,6),round(a,6))
        if key in self.cache:
            p,n=self.cache[key]
            return p.copy(),n.copy()
        direction=Vector((math.sin(a),0,-math.cos(a)))
        center=Vector((0,y,-.005))
        result=self.ray(center+direction*.35,-direction)
        if result is None:
            hit,normal,_,_=self.bvh.find_nearest(Vector(xyz(center+direction*.085)))
            if hit is None:raise RuntimeError('Head BVH could not supply scalp surface')
            n=logical(normal)
            if n.dot(direction)<0:n=-n
            result=logical(hit),n
        # Consumers deform guide points. Never hand out the cached mutable Vectors:
        # repeated beard rows otherwise widen/taper the same chin sample, and nape
        # rows repeatedly lower the same scalp point into long vertical strips.
        self.cache[key]=(result[0].copy(),result[1].copy())
        return result[0].copy(),result[1].copy()

    def front(self,x,y):
        result=self.ray((x,y,-.4),(0,0,1))
        if result:return result
        hit,normal,_,_=self.bvh.find_nearest(Vector(xyz((x,y,-.075))))
        n=logical(normal)
        if n.z>0:n=-n
        return logical(hit),n


class Groom:
    def __init__(self,root,head,name,look):
        self.root,self.name,self.look=root,name,look
        self.f=look.get('face',{})
        self.landmarks=json.loads(root.get('landmarks_json','{}'))
        self.s=Surface(head)
        self.rng=random.Random(sum((i+1)*ord(c) for i,c in enumerate(name)))
        self.hair=rgb(look.get('hairColor','#65503c'))
        self.beard=rgb(look.get('beardColor',look.get('hairColor','#65503c')))
        self.skin=rgb(look.get('skin','#d5ad8e'))
        self.wave=self.f.get('hairWave',.2)
        self.part=self.f.get('hairPart',0)
        self.style=look.get('hair','short')
        self.buckets={
            'hair':Bucket(name+'_groom_hair',groom_material(name+'_groom_hair_material')),
            'beard':Bucket(name+'_groom_beard',groom_material(name+'_groom_beard_material',.81)),
        }
        self.mouth_y=self.landmarks.get('mouthCenter',(0,.053,-.105))[1]
        self.hidden_fibers=0

    def hair_fiber(self,bucket,points,radii,color,sides=3):
        # Runtime hat bases share this logical head space. The margin includes the
        # brim thickness, so fibers cannot emerge through the crown/band surface.
        ceiling={'bowler':.190,'frayedstraw':.196,'slouchberet':.192,
                 'sailor':.197,'garden':.198,'floppy':.199,
                 'bonnet':.189,'portrait':.197}.get(self.look.get('hat'),math.inf)
        radius=max(radii) if isinstance(radii,(list,tuple)) else radii
        if any(p[1]+radius>=ceiling for p in points):
            self.hidden_fibers+=1
            return
        bucket.tube(points,radii,color,sides)

    def hairline(self,a):
        c=math.cos(a)
        rec=self.look.get('hairline',.12)
        if c>=0:
            line=.151+.032*c+rec*(.017+.025*c*c)
        else:
            line=.151-.066*(-c)**.72+rec*.008
        # Preserve the complete authored ear; hair turns behind its top rim.
        if abs(c)<.32:line=max(line,.156+.010*(1-abs(c)/.32))
        line+=self.part*.004*math.sin(a)*max(c,0)
        # Small grouped roots break up a cut-out cap edge. The dominant contour
        # remains the artist's recession/part; this is not independent fuzz.
        line+=.0011*math.sin(a*17+.24*math.sin(a*5))+.00045*math.sin(a*29)
        return line

    def scalp_point(self,a,t,lift=0):
        low=self.hairline(a)
        top=(.190+.013*max(0,-math.cos(a))) if self.style=='bald' else self.s.top-.0006
        if self.style=='bald':top=max(low+.0001,top)
        yy=mix(low,top,t)
        p,n=self.s.radial(yy,a)
        mass=(.0043 if self.style in ('curly','waved','pinned') else .0022)
        offset=.00010+mass*math.sin(math.pi*t)**.8
        if self.style=='bald':offset*=smooth((abs(a)-1.46)/.18)
        lock=.5+.5*math.sin(a*18+self.part*t*3+.32*math.sin(a*7))
        offset+=(.00065+.00065*self.wave)*lock**2*math.sin(math.pi*t)
        offset+=.00028*self.wave*math.sin(a*14+t*6)*math.sin(math.pi*t)
        return p+n*(offset+lift)

    def scalp(self):
        m=self.buckets['hair']
        bald=self.style=='bald'
        cols,rows=(56,10) if bald else (72,18)
        start=len(m.v)
        for j in range(rows+1):
            t=j/rows
            for i in range(cols+1):
                a=-math.pi+TAU*i/cols
                c=tone(self.hair,-.04+.09*math.sin(a*23+t*5)+.055*math.sin(a*41-t*3))
                c=blend(c,self.skin,.88*math.exp(-t/.033))
                if bald:
                    fade=smooth((abs(a)-1.46)/.18)*smooth(t/.12)*smooth((1-t)/.12)
                    c=blend(self.skin,c,fade)
                m.vert(self.scalp_point(a,t),c,(i/cols,t))
        for j in range(rows):
            for i in range(cols):
                a=-math.pi+TAU*(i+.5)/cols
                if bald and (abs(a)<1.46 or self.hairline(a)>=.190+.013*max(0,-math.cos(a))-.002):continue
                p=start+j*(cols+1)+i
                m.quad(p,p+cols+1,p+cols+2,p+1)
        if not bald:
            # A small smooth top disk closes the cap without a pointed helmet apex.
            ring=[start+rows*(cols+1)+i for i in range(cols)]
            center=Vector((0,0,0))
            for idx in ring:center+=Vector(m.v[idx])
            center/=len(ring)
            center.y=self.s.top+.00035
            ci=m.vert(center,self.hair,(.5,1))
            for i in range(cols):m.f.append((ring[i],ci,ring[(i+1)%cols]))
            # Rays nearly tangent to an asymmetric crown can leave a skin sliver
            # above the last sampled ring. Cover only this cap with the authored
            # scalp topology, slightly lifted along its own vertex normals.
            source=self.s.head.data
            faces=[face for face in source.polygons
                   if min(source.vertices[i].co.z for i in face.vertices)>self.s.top-.023]
            used=sorted({i for face in faces for i in face.vertices})
            remap={}
            for i in used:
                vertex=source.vertices[i]
                p=logical(vertex.co);n=logical(vertex.normal)
                if n.y<0:n=-n
                p+=n*.00085
                remap[i]=m.vert(p,self.hair,(math.atan2(p.x,-p.z)/TAU+.5,.90+(p.y-self.s.top+.023)/.23))
            for face in faces:m.f.append(tuple(remap[i] for i in face.vertices))
        # Rounded cap relief carries the hair mass. Fewer, wider guides survive
        # minification better than hundreds of bright needle-thin strands.
        count=34 if bald else (100 if self.style=='curly' else 88)
        for index in range(count):
            a=self.rng.uniform(-math.pi,math.pi)
            if bald and abs(a)<1.50:a=(1 if a>=0 else -1)*self.rng.uniform(1.50,math.pi)
            t0=self.rng.uniform(.025,.79)
            span=self.rng.uniform(.15,.29)
            pts=[]
            for j in range(6):
                u=j/5
                t=clamp(t0+span*u,.005,.98)
                aa=a+(self.part*.17+.10*math.sin(a))*u+.035*self.wave*math.sin(u*4)
                lift=.00090
                if self.style=='curly':
                    aa+=.07*math.sin(u*TAU)
                    lift+=.0018*math.sin(math.pi*u)**2
                pts.append(self.scalp_point(aa,t,lift))
            r=self.rng.uniform(.00048,.00090)*(1.3 if self.style=='curly' else 1)
            color=tone(self.hair,self.rng.uniform(-.18,.15))
            if bald:color=blend(self.skin,color,smooth((abs(a)-1.46)/.18))
            self.hair_fiber(m,pts,[r*(.13+.87*math.sin(math.pi*(j+.3)/5.6)) for j in range(6)],color,4)
        if self.style in ('waved','pinned'):self.pinned_hair()
        if self.style=='long':self.long_hair()

    def pinned_hair(self):
        m=self.buckets['hair']
        # Swept front waves are sampled to the forehead/crown and stop above ears.
        for side in (-1,1):
            for n in range(13):
                band=n/12
                pts=[]
                for j in range(8):
                    u=j/7
                    a=mix(self.part*.40,side*1.47,u)
                    t=mix(.10+.20*band,.028+.080*band,u)+.13*math.sin(math.pi*u)
                    t+=.016*self.wave*math.sin(u*TAU+band*3)
                    pts.append(self.scalp_point(a,t,.0015+.0015*math.sin(math.pi*u)*self.wave))
                r=.0008+.0005*self.wave
                self.hair_fiber(m,pts,[r*(.15+.85*math.sin(math.pi*(j+.3)/7.6)) for j in range(8)],tone(self.hair,(n%5-2)*.04),4)
        back,_=self.s.radial(.158,math.pi)
        center=Vector((0,.157,back.z+.023))
        scale=(.039,.034,.028)
        m.sphere(center,scale,self.hair,24,14)
        for n in range(28):
            a=TAU*n/28
            pts=[]
            for j in range(7):
                u=(j+.12)/6.24
                aa=a+.65*u
                pts.append((center.x+scale[0]*math.cos(aa)*math.sin(math.pi*u),
                            center.y+scale[1]*math.cos(math.pi*u),
                            center.z+scale[2]*math.sin(aa)*math.sin(math.pi*u)))
            self.hair_fiber(m,pts,.00065,tone(self.hair,.09*math.sin(a*7)),3)

    def long_hair(self):
        m=self.buckets['hair']
        # Loose hair stays on the rear half and at the nape, leaving ears readable.
        def nape_point(a,t,lift=0):
            p,n=self.s.radial(self.hairline(a),a)
            p+=n*(.0015+.0035*math.sin(math.pi*t)+lift)
            # The ends turn gently toward the neck, with a varying hem rather
            # than parallel hanging sheets. This deformation never changes BVH data.
            p.x*=1-.19*smooth(t)
            p.y-=(.041+.008*math.sin(a*3)**2)*t
            p.z+=.007*math.sin(math.pi*t)-.003*t*t
            p.x+=.002*self.wave*math.sin(a*9+t*4)*math.sin(math.pi*t)
            return p
        cols,rows=36,10
        start=len(m.v)
        for j in range(rows+1):
            t=j/rows
            for i in range(cols+1):
                a=1.70+(TAU-3.40)*i/cols
                p=nape_point(a,t)
                m.vert(p,tone(self.hair,.06*math.sin(a*19+t*5)),(i/cols,t))
        for j in range(rows):
            for i in range(cols):
                p=start+j*(cols+1)+i
                m.quad(p,p+1,p+cols+2,p+cols+1)
        for n in range(40):
            a=self.rng.uniform(1.73,TAU-1.73)
            pts=[]
            for j in range(7):
                u=j/6
                q=nape_point(a,u,.0008)
                q.z+=.0010*self.wave*math.sin(u*5+n)*math.sin(math.pi*u)
                pts.append(q)
            self.hair_fiber(m,pts,[.00065*(.18+.82*math.sin(math.pi*(j+.25)/6.5)) for j in range(7)],tone(self.hair,self.rng.uniform(-.10,.15)),3)

    def beard_point(self,a,v,lift=0):
        kind=self.look.get('beard','none')
        shape=self.look.get('beardShape','square' if kind=='short' else 'fan')
        length=self.f.get('beardLength',1)
        side=abs(a)/1.38
        high=self.mouth_y-.013+.042*smooth(abs(a)/.95)+.050*smooth((abs(a)-.89)/.49)
        high+=.00115*math.sin(a*19+.23*math.sin(a*7))+.00035*math.sin(a*37)
        # Use a reliable contour ABOVE the chin/neck transition for every guide.
        # Growth is a smooth deformation of the entire lower jaw surface, not a
        # second lobe extruded after a horizontal y=.008 sampling threshold.
        anchor=.026+.016*side**1.65
        high=max(high,anchor+.006)
        guide_y=mix(anchor,high,v)
        p,n=self.s.radial(guide_y,a)
        q=1-v
        if kind=='short':extension=.027*length;taper=.045
        elif shape=='pointed':extension=.068*length;taper=.67
        elif shape=='flowing':extension=.090*length;taper=.21
        elif shape=='square':extension=.041*length;taper=.10
        else:extension=.055*length;taper=.065
        side_falloff=1-.68*side**1.65
        growth=extension*side_falloff*q**1.72
        lock=.5+.5*math.sin(a*18+.38*math.sin(a*7))
        growth+=(.0012+.0020*lock**2)*q**7
        p.y-=growth
        p.x*=1-taper*q**1.85
        p.z-=.0028*math.sin(math.pi*q)*side_falloff
        density=self.f.get('beardDensity',1)
        bulk=(.0014 if kind=='short' else .0040)*density
        feather=1-smooth((v-.72)/.28)
        # Broad coherent lobes, with a rounded lower edge, give the groom volume
        # instead of a corrugated sheet. Existing pointed/fan/flowing taper stays.
        lobe=(.00075 if kind=='short' else .0021)*density*lock**2
        rounded=.28+.72*smooth(v/.11)
        return p+n*(.00012+(bulk+lobe)*feather*rounded+lift)

    def beard_mesh(self):
        if self.look.get('beard','none') not in ('short','full'):return
        m=self.buckets['beard']
        cols,rows=64,18
        start=len(m.v)
        for j in range(rows+1):
            v=j/rows
            for i in range(cols+1):
                a=-1.38+2.76*i/cols
                c=tone(self.beard,-.045+.10*math.sin(a*18+.38*math.sin(a*7))+.035*math.sin(a*39+v*4))
                c=blend(c,self.skin,.90*smooth((v-.82)/.18))
                m.vert(self.beard_point(a,v),c,(a/TAU+.5,1-v))
        for j in range(rows):
            for i in range(cols):
                p=start+j*(cols+1)+i
                m.quad(p,p+cols+1,p+cols+2,p+1)
        # A shallow return rounds the silhouette at the hem. It closes the hard
        # one-polygon cut edge without adding an unrelated under-chin blob.
        hem=[]
        for i in range(cols+1):
            a=-1.38+2.76*i/cols
            p=self.beard_point(a,0)
            _,normal=self.s.radial(.026+.016*(abs(a)/1.38)**1.65,a)
            p-=normal*.0028;p.y+=.0020
            hem.append(m.vert(p,tone(self.beard,-.09),(a/TAU+.5,1.02)))
        for i in range(cols):m.quad(start+i,start+i+1,hem[i+1],hem[i])
        count=int((54 if self.look.get('beard')=='short' else 76)*self.f.get('beardDensity',1))
        for n in range(count):
            a=self.rng.uniform(-1.36,1.36)
            v0=self.rng.uniform(.32,.999)
            drop=self.rng.uniform(.16,.40)
            pts=[]
            for j in range(6):
                u=j/5
                aa=a*(1-.026*u)+.009*self.wave*math.sin(u*4+n)
                pts.append(self.beard_point(aa,max(.01,v0-drop*u),.00085))
            r=self.rng.uniform(.00048,.00084)
            m.tube(pts,[r*(.12+.88*math.sin(math.pi*(j+.25)/5.5)) for j in range(6)],tone(self.beard,self.rng.uniform(-.13,.13)),4)

    def facial_hair(self):
        hair,beard=self.buckets['hair'],self.buckets['beard']
        eyes=self.landmarks.get('eyes',[(-.0345,.123,-.072),(.0345,.123,-.072)])
        for side,eye in zip((-1,1),eyes):
            ex,ey,_=eye
            weight=self.f.get('browWeight',1)
            # A fitted, gently domed brow supplies the readable form. The old
            # isolated wire strands disappeared into pale skin at portrait size.
            start=len(hair.v);steps,cross=20,4
            for j in range(steps+1):
                t=j/steps
                taper=math.sin(math.pi*(.04+.94*t))**.58
                xx=ex+side*(t-.50)*.042
                yy=ey+.017+.0035*math.sin(math.pi*t)-.002*t
                half=(.00165+.00110*weight)*taper*(1-.35*t)
                for k in range(cross+1):
                    v=k/cross
                    p,normal=self.s.front(xx,yy+(v-.5)*2*half)
                    bulge=math.sin(math.pi*v)**.75*taper
                    c=blend(tone(self.hair,-.055),self.skin,.58*(1-bulge)**4)
                    hair.vert(p+normal*(.00014+.00105*weight*bulge),c,(t,v))
            for j in range(steps):
                for k in range(cross):
                    p=start+j*(cross+1)+k;hair.quad(p,p+1,p+cross+2,p+cross+1)
            for n in range(20):
                t=n/19
                xx=ex+side*(t-.50)*.042
                yy=ey+.017+.0035*math.sin(math.pi*t)-.002*t
                pts=[]
                for j in range(4):
                    u=j/3
                    p,normal=self.s.front(xx+side*.0035*u,yy+.0010*math.sin(math.pi*u)-.0018*u)
                    pts.append(p+normal*.00112)
                r=.00038*weight*math.sin(math.pi*(n+.6)/20.2)**.35
                hair.tube(pts,[.0001,r,r*.65,.00008],tone(self.hair,(n%4-2)*.035),3)
        style=self.f.get('moustacheShape','trimmed')
        if self.look.get('beard','none')=='none' or style=='none':return
        width=self.f.get('mouthWidth',1)
        for side in (-1,1):
            # Two tapered lobes grow outward from the philtrum. Their width and
            # droop/curl are profile driven, with sparse surface guides layered
            # on top rather than a pencil line floating above the upper lip.
            start=len(beard.v);steps,cross=22,4
            density=self.f.get('beardDensity',1)
            for j in range(steps+1):
                u=j/steps
                xx=side*mix(.0018,.0235,u)*width
                yy=self.mouth_y+.0105-.006*u
                if style=='drooping':yy-=.010*u*u
                if style=='handlebar':yy+=.009*u**3;xx+=side*.006*u*u
                taper=math.sin(math.pi*(.055+.925*u))**.67
                half=(.00165+.00200*density)*taper
                for k in range(cross+1):
                    v=k/cross
                    p,normal=self.s.front(xx,yy+(v-.5)*2*half)
                    dome=math.sin(math.pi*v)**.75*taper
                    color=blend(tone(self.beard,-.025),self.skin,.74*(1-dome)**5)
                    beard.vert(p+normal*(.00014+.00150*density*dome),color,(u,v))
            for j in range(steps):
                for k in range(cross):
                    p=start+j*(cross+1)+k;beard.quad(p,p+1,p+cross+2,p+cross+1)
            for n in range(10):
                band=n/9
                jitter=self.rng.uniform(-.0006,.0006)
                reach=self.rng.uniform(.86,1.05)
                pts=[]
                for j in range(6):
                    u=j/5
                    end=(.016+.009*math.sin(math.pi*(band+.05)/1.1)**.7)*reach
                    xx=side*mix(.002+.002*band,end,u)*width
                    yy=self.mouth_y+.011+(band-.5)*.0035-.006*u+jitter*math.sin(math.pi*u)
                    if style=='drooping':yy-=.011*u*u
                    if style=='handlebar':
                        yy+=.009*u**3;xx+=side*.006*u*u
                    p,normal=self.s.front(xx,yy)
                    pts.append(p+normal*(.0010+.00115*math.sin(math.pi*u)))
                r=.00026+.00012*math.sin(math.pi*band)
                beard.tube(pts,[.00007,r,r,r*.82,r*.5,.00005],tone(self.beard,(n%5-2)*.037),3)

    def spectacles(self):
        if not (self.look.get('glasses') or self.look.get('accessory')=='glasses'):return
        if any('spectacl' in child.name.lower() or 'glasses' in child.name.lower() for child in self.root.children_recursive):return
        m=Bucket(self.name+'_groom_spectacles',groom_material(self.name+'_groom_metal',.31,.65,False))
        eyes=self.landmarks.get('eyes',[(-.0345,.123,-.072),(.0345,.123,-.072)])
        col=rgb('#8a795f')
        fronts=[]
        for side,eye in zip((-1,1),eyes):
            ex,ey,ez=eye
            front=ez-.024
            fronts.append(front)
            pts=[(ex+.023*math.sin(a),ey+.020*math.cos(a),front) for a in [TAU*i/40 for i in range(40)]]
            m.tube(pts,.00085,col,4,True)
            m.tube([(ex+side*.023,ey,front),(side*.083,ey+.002,-.044),(side*.091,ey-.007,.006)],.0008,col,4)
        bridgez=min(fronts)-.003
        m.tube([(eyes[0][0]+.023,eyes[0][1]+.003,fronts[0]),(0,mix(eyes[0][1],eyes[1][1],.5)+.008,bridgez),(eyes[1][0]-.023,eyes[1][1]+.003,fronts[1])],.0008,col,4)
        self.buckets['metal']=m

    def build(self):
        self.scalp();self.beard_mesh();self.facial_hair();self.spectacles()
        objects=[obj for bucket in self.buckets.values() if (obj:=bucket.object(self.root))]
        stats={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),
               'objects':len(objects),'materials':len({m.name for o in objects for m in o.data.materials}),
               'vertices':sum(len(o.data.vertices) for o in objects)}
        self.root['groom_stats']=json.dumps(stats)
        self.root['groom_version']='surface-groom-v3-rounded-locks'
        self.root['groom_hidden_hat_fibers']=self.hidden_fibers
        self.root['groom_requires_active_vertex_colors']=True
        return objects


def add_groom(root,head_mesh,name,look):
    """Attach 1–3 material-batched groom meshes to an origin head; preserve anatomy."""
    return Groom(root,head_mesh,str(name),look).build()


def self_test(out_dir,artist_ids):
    from human_base_head import build_head,get_head_mesh
    out=Path(out_dir);out.mkdir(parents=True,exist_ok=True)
    cast=json.loads((ROOT/'build/characters/designs.json').read_text())
    stats=[]
    for artist in [a for a in cast if a['id'] in artist_ids]:
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        ages={'van-gogh':35,'gauguin':40,'cezanne':49,'seurat':29,'signac':25,'lautrec':24,
              'monet':48,'renoir':47,'degas':54,'morisot':47,'pissarro':58,'cassatt':44}
        look={**artist['look'],'age1888':artist.get('age1888',ages.get(artist['id'],47))}
        root=build_head(artist['id'],{**look,'skipGroom':True})
        # Regression for cumulative cached-guide deformation (shelf/strip defect).
        probe=Surface(get_head_mesh(root));point,_=probe.radial(.032,.40)
        original=point.copy();point.x+=1;point.y-=1
        again,_=probe.radial(.032,.40)
        assert (again-original).length<1e-9,'BVH guide cache was mutated by a consumer'
        for obj in root.children_recursive:
            if obj.type=='MESH' and obj.data.shape_keys:
                for key in obj.data.shape_keys.key_blocks:
                    if key.name!='Basis':key.value=0.0
        add_groom(root,get_head_mesh(root),artist['id'],look)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in [root,*root.children_recursive]:obj.select_set(True)
        bpy.context.view_layer.objects.active=root
        bpy.ops.export_scene.gltf(filepath=str(out/(artist['id']+'.glb')),export_format='GLB',use_selection=True,
                                  export_yup=True,export_animations=False,export_vertex_color='ACTIVE')
        stats.append({'id':artist['id'],**json.loads(root['groom_stats'])})
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU'
        scene.cycles.samples=24;scene.cycles.use_denoising=True
        scene.render.resolution_x=800;scene.render.resolution_y=900;scene.render.resolution_percentage=100
        scene.world.use_nodes=True
        scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.15,.17,.19,1)
        scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
        scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
        for label,power,pos,size in [('key',6,(-.30,.42,-.40),.35),('fill',2,(.30,.18,-.30),.28),('rim',5,(.2,.35,.28),.25)]:
            data=bpy.data.lights.new(label,'AREA');data.energy=power;data.shape='DISK';data.size=size
            obj=bpy.data.objects.new(label,data);scene.collection.objects.link(obj);obj.location=xyz(pos)
            obj.rotation_euler=(Vector(xyz((0,.12,0)))-obj.location).to_track_quat('-Z','Y').to_euler()
        camera=bpy.data.cameras.new('camera');camera.type='ORTHO';camera.ortho_scale=.35
        cam=bpy.data.objects.new('camera',camera);scene.collection.objects.link(cam);scene.camera=cam
        for view,pos in [('front',(0,.125,-.75)),('three-quarter',(.34,.14,-.66))]:
            cam.location=xyz(pos);cam.rotation_euler=(Vector(xyz((0,.110,0)))-cam.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(out/(artist['id']+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(out/(artist['id']+'.blend')))
    (out/'stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    print('GROOM_STATS '+json.dumps(stats),flush=True)


if __name__=='__main__':
    if str(Path(__file__).parent) not in sys.path:sys.path.insert(0,str(Path(__file__).parent))
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--out-dir',default=str(ROOT/'build/characters/groom-test'))
    parser.add_argument('--artists',default='van-gogh,morisot')
    args=parser.parse_args(argv)
    if args.self_test:self_test(args.out_dir,args.artists.split(','))
