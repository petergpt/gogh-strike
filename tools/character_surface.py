"""Deterministic local surface occlusion for the authored artist heads.

Call ``bake_head_occlusion(root, head_mesh)`` after ``add_groom`` and before LOD
copies. Actual skin, eyes and grooming all contribute to one BVH. Only existing
skin/groom Col attributes receive the result; eyes retain their clear material.
This adds no runtime geometry, textures, materials or shader dependencies.
"""
import json
import math
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def _clamp(value,low=0.,high=1.):return max(low,min(high,value))


def _combined_bvh(objects):
    """Build in world coordinates, including evaluated groom modifiers."""
    vertices=[];polygons=[]
    depsgraph=bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        evaluated=obj.evaluated_get(depsgraph)
        mesh=evaluated.to_mesh()
        try:
            offset=len(vertices);matrix=obj.matrix_world
            vertices.extend(matrix@v.co for v in mesh.vertices)
            polygons.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons)
        finally:
            evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(vertices,polygons,all_triangles=False,epsilon=0.)


def _hemisphere(samples):
    # Cosine-distributed equal-area disc samples lifted to the unit hemisphere.
    # A deterministic per-position rotation removes aligned ray banding.
    golden_angle=math.pi*(3-math.sqrt(5))
    result=[]
    for index in range(samples):
        radius=math.sqrt((index+.5)/samples)
        angle=index*golden_angle
        result.append((radius*math.cos(angle),radius*math.sin(angle),math.sqrt(1-radius*radius)))
    return result


def _smooth_local(values,mesh):
    """Remove ray speckle without blurring across disconnected groom strands."""
    neighbours=[[] for _ in values]
    for edge in mesh.edges:
        a,b=edge.vertices;neighbours[a].append(b);neighbours[b].append(a)
    for _ in range(2):
        values=[v*.65+sum(values[n] for n in neighbours[i])/len(neighbours[i])*.35
                if neighbours[i] else v for i,v in enumerate(values)]
    return values


def bake_head_occlusion(root,head_mesh=None,*,rays=20,max_distance=.038,bias=.00055,
                        skin_strength=.28,groom_strength=.30):
    """Gently multiply linear vertex colour by measured local recess occlusion.

    Distances are metres in the character's origin-scale build coordinates.
    The default 3.8 cm reach resolves eyelids, nose/ear folds and beard roots
    without baking directional sun or a broad shadow onto an exposed cheek.
    Rerunning on the same root is a no-op to avoid cumulative darkening.
    """
    if root.get('surface_occlusion_version')==1:
        return json.loads(root['surface_occlusion_json'])
    if not 8<=rays<=64:raise ValueError('Local head bake requires 8–64 rays')
    if not 0.<bias<max_distance<=.08:raise ValueError('Invalid local bake distances')
    if not 0<=skin_strength<=.40 or not 0<=groom_strength<=.45:
        raise ValueError('Surface strengths must preserve the authored complexion')
    started=time.perf_counter()
    if head_mesh is None:head_mesh=bpy.data.objects.get(root.get('head_mesh',''))
    if head_mesh is None or head_mesh.type!='MESH':raise ValueError('An authored skin mesh is required')
    bpy.context.view_layer.update()
    objects=[obj for obj in root.children_recursive if obj.type=='MESH']
    bvh=_combined_bvh(objects);directions=_hemisphere(rays);entries=[]
    for obj in objects:
        skin=obj==head_mesh
        if not skin and not obj.get('character_groom',False):continue
        # Metal spectacle rims occlude the skin but should keep their own finish.
        if not skin and all(mat and mat.use_nodes and
                            mat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value>.4
                            for mat in obj.data.materials):continue
        colors=obj.data.color_attributes.get('Col')
        if colors is None or colors.domain!='POINT':
            raise ValueError(f'{obj.name} needs an existing POINT Col attribute')
        matrix=obj.matrix_world;normal_matrix=matrix.to_3x3().inverted().transposed()
        values=[]
        for vertex in obj.data.vertices:
            point=matrix@vertex.co;normal=(normal_matrix@vertex.normal).normalized()
            # Stable at coincident positions, including the groom's UV seams.
            phase=math.sin(point.x*738.56+point.y*193.49+point.z*834.92)*43758.5453
            angle=(phase-math.floor(phase))*math.tau;ca,sa=math.cos(angle),math.sin(angle)
            reference=Vector((0.,0.,1.)) if abs(normal.z)<.93 else Vector((0.,1.,0.))
            tangent=normal.cross(reference).normalized();bitangent=normal.cross(tangent)
            origin=point+normal*bias;occlusion=0.
            for dx,dy,dz in directions:
                direction=tangent*(dx*ca-dy*sa)+bitangent*(dx*sa+dy*ca)+normal*dz
                location,_,_,distance=bvh.ray_cast(origin,direction,max_distance)
                if location is not None:
                    # A short local falloff keeps distant cheek/neck geometry
                    # from staining open skin. Very near recesses remain legible.
                    occlusion+=(1-_clamp(distance/max_distance))**1.65
            values.append(occlusion/rays)
        values=_smooth_local(values,obj.data)
        strength=skin_strength if skin else groom_strength
        multipliers=[]
        for color,occlusion in zip(colors.data,values):
            factor=max(1-strength,1-strength*_clamp(occlusion))
            previous=color.color[:]
            color.color=tuple(_clamp(channel*factor) for channel in previous[:3])+(previous[3],)
            multipliers.append(factor)
        obj.data.color_attributes.active_color=colors
        obj['local_surface_occlusion']=True
        entries.append({'mesh':obj.name,'kind':'skin' if skin else 'groom','vertices':len(values),
                        'meanOcclusion':round(sum(values)/max(1,len(values)),5),
                        'meanMultiplier':round(sum(multipliers)/max(1,len(values)),5),
                        'minimumMultiplier':round(min(multipliers,default=1.),5)})
    result={'version':1,'rays':rays,'maxDistance':max_distance,'bias':bias,
            'skinStrength':skin_strength,'groomStrength':groom_strength,
            'seconds':round(time.perf_counter()-started,3),'meshes':entries}
    root['surface_occlusion_version']=1;root['surface_occlusion_json']=json.dumps(result)
    return result
