# export_avatar.py — exporte avatar_03_face.blend vers frontend/models/avatar.glb
#   blender -b avatar_03_face.blend -P export_avatar.py -- <racine du projet> [fichier de sortie]
#
# Réglages de poids (le modèle est chargé par chaque visiteur à l'ouverture de la bulle) :
# - pas de normales dans les déformations du visage (MouthOpen, MouthSmile) : elles étaient
#   stockées pour les 118 000 sommets (2,8 Mo) alors que seule la bouche bouge
# - textures 2048 → 1024 px, WebP qualité 92 : invisible à la taille d'une bulle ou d'un buste
# - positions Draco sur 12 bits (précision < 0,5 mm sur 1,80 m)
# Résultat : 6,9 Mo → 3,1 Mo, comparé côte à côte dans le navigateur (05/10/2026).
# ⚠️ Deux réglages essayés puis écartés, ils tachent le crâne (surface lisse et brillante) :
#    texture métal/rugosité en 512 px, et normales Draco sur 8 bits.
import bpy, sys, os

args = sys.argv[sys.argv.index("--") + 1:]
ROOT = args[0]
OUT = args[1] if len(args) > 1 else os.path.join(ROOT, "frontend", "models", "avatar.glb")

TEXTURE_SIZES = {"avatar_basecolor": 1024, "avatar_metal_rough": 1024}
TEXTURE_QUALITY = 92

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

# Réduction des textures (en mémoire seulement : le .blend et les PNG d'origine ne changent pas)
for image in bpy.data.images:
    base = image.name.rsplit(".", 1)[0]
    if base in TEXTURE_SIZES and image.size[0] > TEXTURE_SIZES[base]:
        size = TEXTURE_SIZES[base]
        image.scale(size, size)

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    export_animations=True, export_animation_mode='ACTIONS',
    export_skins=True, export_morph=True, export_morph_normal=False,
    export_image_format='WEBP', export_image_quality=TEXTURE_QUALITY, export_yup=True,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
    export_draco_position_quantization=12, export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=11, export_draco_generic_quantization=10,
    export_optimize_animation_size=True,
)
print("RESULT", OUT, os.path.getsize(OUT) // 1024, "Ko")
