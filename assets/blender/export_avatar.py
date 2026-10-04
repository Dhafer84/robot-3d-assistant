# export_avatar.py — exporte avatar_03_face.blend vers frontend/models/avatar.glb
#   blender -b avatar_03_face.blend -P export_avatar.py -- <racine du projet>
import bpy, sys, os
ROOT = sys.argv[sys.argv.index("--") + 1]

rig = bpy.data.objects["Avatar_Rig"]
# Seules les animations nommées sont exportées (pas la pose T importée avec le rig)
for a in list(bpy.data.actions):
    if a.name not in ("Idle", "Talking", "Waving"):
        bpy.data.actions.remove(a)
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
for kb in bpy.data.objects["Avatar_Body"].data.shape_keys.key_blocks:
    kb.value = 0

out = os.path.join(ROOT, "frontend", "models", "avatar.glb")
bpy.ops.export_scene.gltf(
    filepath=out, export_format='GLB',
    export_animations=True, export_animation_mode='ACTIONS',
    export_skins=True, export_morph=True, export_morph_normal=True,
    export_image_format='WEBP', export_yup=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_optimize_animation_size=True,
)
print("RESULT", out, os.path.getsize(out) // 1024, "Ko")
