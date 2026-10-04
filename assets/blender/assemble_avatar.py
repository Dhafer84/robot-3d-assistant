# Assemble le personnage riggé par Mixamo + ses animations dans avatar_02_rig.blend
import bpy, sys, os
A = sys.argv[sys.argv.index("--") + 1]
M = os.path.join(A, "mixamo")
FBX = dict(automatic_bone_orientation=False, ignore_leaf_bones=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(M, "avatar-rig.fbx"), **FBX)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
rig.name, body.name = "Avatar_Rig", "Avatar_Body"

# Matériau reconstruit à partir de nos textures PNG (Mixamo a perdu la carte métal/rugosité)
mat = bpy.data.materials.new("Avatar_Material")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
base = nt.nodes.new("ShaderNodeTexImage")
base.image = bpy.data.images.load(os.path.join(A, "blender", "textures", "avatar_basecolor.png"))
nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
mr = nt.nodes.new("ShaderNodeTexImage")
mr.image = bpy.data.images.load(os.path.join(A, "blender", "textures", "avatar_metal_rough.png"))
mr.image.colorspace_settings.name = "Non-Color"
sep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(mr.outputs["Color"], sep.inputs["Color"])
nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])  # convention glTF : G = rugosité
nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])    # B = métal
body.data.materials.clear()
body.data.materials.append(mat)

# Animations : on garde uniquement l'action, on supprime le personnage importé avec
anims = {"Breathing Idle": "Idle", "Talking-2": "Talking", "Waving": "Waving"}
for fname, name in anims.items():
    before_objs = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=os.path.join(M, fname + ".fbx"), **FBX)
    action = (set(bpy.data.actions) - before_actions).pop()
    action.name = name
    action.use_fake_user = True
    for o in set(bpy.data.objects) - before_objs:
        bpy.data.objects.remove(o, do_unlink=True)

# Pistes NLA : chaque animation est exportée comme un clip séparé dans le glTF
rig.animation_data_create()
for name in anims.values():
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    action = bpy.data.actions[name]
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    if hasattr(strip, "action_slot") and action.slots:
        strip.action_slot = action.slots[0]
    track.mute = True
rig.animation_data.action = None

# Nettoyage des données orphelines (meshes, matériaux, images des imports d'animations)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
    for d in list(coll):
        if d.users == 0:
            coll.remove(d)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A, "blender", "avatar_02_rig.blend"), relative_remap=True)
print("RESULT", [t.name for t in rig.animation_data.nla_tracks], [ (a.name, a.frame_range[:]) for a in bpy.data.actions])
