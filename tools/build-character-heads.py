"""Blender background asset build. Uses artist profiles and the anatomical face sculptor."""
import bpy,sys,json,math,argparse
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from human_base_head import build_head,get_head_mesh
from character_groom import add_groom
from character_surface import bake_head_occlusion
parser=argparse.ArgumentParser()
parser.add_argument('--output',type=Path,default=root/'assets/characters')
parser.add_argument('--only',help='Comma-separated design IDs for a staging preview')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
cast=json.loads((root/'build/characters/designs.json').read_text())
if args.only:
    requested=set(args.only.split(','));cast=[artist for artist in cast if artist['id'] in requested]
    if len(cast)!=len(requested):raise ValueError('Unknown artist in --only')
output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
manifest=[]
for index,artist in enumerate(cast):
    head=build_head(artist['name'],{**artist['look'],'skipGroom':True})
    add_groom(head,get_head_mesh(head),artist['name'],artist['look'])
    surface=bake_head_occlusion(head,get_head_mesh(head))
    head.name=artist['id']+'_portrait'
    for obj in head.children_recursive:
        if obj.type=='MESH' and obj.data.shape_keys:
            for key in obj.data.shape_keys.key_blocks:
                if key.name!='Basis':key.value=0.
    head['artist']=artist['fullName'];head['design_id']=artist['id']
    # Keep the full facial sculpture close up and a cheaper mesh in the arena.
    high=bpy.data.objects.new(artist['id']+'_portrait_detail',None);bpy.context.collection.objects.link(high);high.parent=head
    for obj in list(head.children):
        if obj!=high:obj.parent=high
    low=bpy.data.objects.new(artist['id']+'_portrait_distance',None);bpy.context.collection.objects.link(low);low.parent=head
    for original in high.children_recursive:
        if original.type!='MESH':continue
        obj=original.copy();obj.data=original.data.copy();bpy.context.collection.objects.link(obj);obj.parent=low;obj.name=original.name+'_distance'
        if obj.data.shape_keys:obj.shape_key_clear()
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Distance detail reduction','DECIMATE');modifier.ratio=.24
        try:bpy.ops.object.modifier_apply(modifier=modifier.name)
        except RuntimeError:obj.modifiers.remove(modifier)
    bpy.ops.object.select_all(action='DESELECT')
    objects=[head,*head.children_recursive]
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=head
    path=output/(artist['id']+'-head.glb')
    temporary=path.with_name(path.stem+'.building.glb')
    bpy.ops.export_scene.gltf(filepath=str(temporary),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_vertex_color='ACTIVE',export_morph=True,export_animations=False,export_cameras=False,export_lights=False)
    temporary.replace(path)
    meshes=[o for o in objects if o.type=='MESH']
    tris=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    manifest.append({'id':artist['id'],'name':artist['name'],'file':path.name,'bytes':path.stat().st_size,'triangles':tris,'meshes':len(meshes),'surface':surface,'detailTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in high.children_recursive if o.type=='MESH'),'distanceTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in low.children_recursive if o.type=='MESH')})
    low.hide_viewport=True;low.hide_render=True
    head.location=(index%6*.38,index//6*.52,0)
    print('BUILT',artist['id'],tris,path.stat().st_size,flush=True)
# Keep the actual editable heads, materials and morphs in one source document.
bpy.ops.wm.save_as_mainfile(filepath=str(output/'Artist-Portrait-Sculpts.blend'))
(output/'manifest.json').write_text(json.dumps({'pipeline':'Blender sculpted heads with live articulated game bodies','characters':manifest},indent=2)+'\n')
print(json.dumps(manifest),flush=True)
