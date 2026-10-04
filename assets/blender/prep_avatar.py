import bpy, sys, os
from mathutils import Vector
glb, root = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=glb)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
world = mesh.parent
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
if world: bpy.data.objects.remove(world)
mesh.name = mesh.data.name = "Avatar"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Échelle réelle (1,80 m), pieds à z=0, centré
bpy.context.view_layer.update()
pts = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
s = 1.80 / (mx.z - mn.z)
mesh.scale = (s, s, s)
mesh.location = (-(mn.x + mx.x) / 2 * s, -(mn.y + mx.y) / 2 * s, -mn.z * s)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

before = sum(len(p.vertices) - 2 for p in mesh.data.polygons)
# La tête (au-dessus du cou) est protégée : l'allègement porte surtout sur le corps
head = mesh.vertex_groups.new(name="Tete")
head.add([v.index for v in mesh.data.vertices if v.co.z > 1.45], 1.0, 'REPLACE')
dec = mesh.modifiers.new("Decimate", 'DECIMATE')
dec.ratio = 110000 / before
dec.vertex_group = "Tete"
dec.invert_vertex_group = True
dec.vertex_group_factor = 1.0
bpy.ops.object.modifier_apply(modifier=dec.name)
bpy.ops.object.shade_smooth()
after = sum(len(p.vertices) - 2 for p in mesh.data.polygons)

# Textures en PNG à côté du .blend
mat = mesh.active_material
mat.name = "Avatar_Material"
names = {"Image_0": "avatar_basecolor.png", "Image_1": "avatar_metal_rough.png"}
for node in mat.node_tree.nodes:
    if node.type == 'TEX_IMAGE' and node.image and node.image.name in names:
        old = node.image
        path = os.path.join(root, "blender", "textures", names[old.name])
        old.save(filepath=path)
        new = bpy.data.images.load(path)
        new.name = names[old.name][:-4]
        new.colorspace_settings.name = old.colorspace_settings.name
        node.image = new
        bpy.data.images.remove(old)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root, "blender", "avatar_01_prep.blend"), relative_remap=True)
bpy.ops.export_scene.fbx(
    filepath=os.path.join(root, "mixamo", "avatar-pour-mixamo.fbx"),
    use_selection=False, object_types={'MESH'}, apply_unit_scale=True,
    path_mode='COPY', embed_textures=True, mesh_smooth_type='FACE')
head_after = sum(1 for v in mesh.data.vertices if v.co.z > 1.45)
print("RESULT", "tete verts", head_after, round(mx.z - mn.z, 3), "->1.80m", before, "->", after, "tris")
