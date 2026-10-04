# face_rig.py — prépare le visage de l'avatar pour l'animation dans le navigateur.
#   blender -b avatar_02_rig.blend -P face_rig.py -- <dossier assets>
#
# - coupe une fente de bouche sur la ligne des lèvres + cavité sombre derrière
# - shape keys "MouthOpen" et "MouthSmile" (pilotées par le lip-sync côté site)
# - deux écrans "Lens_L" / "Lens_R" dans les verres, où le site dessine les yeux
#
# Repères mesurés sur le modèle (mètres, repère Blender : le personnage regarde -Y)

import bpy, bmesh, sys, os
from mathutils import Matrix, Vector

A = sys.argv[sys.argv.index("--") + 1]

MOUTH_Z = 1.561       # ligne des lèvres
MOUTH_HALF_W = 0.030  # demi-largeur de la bouche
LENS_X = (0.017, 0.068)   # bord intérieur / extérieur d'un verre (côté +X)
LENS_Z = (1.613, 1.658)   # bas / haut des verres
LENS_Y = (-0.134, -0.121) # profondeur de l'écran au bord intérieur / extérieur

rig = bpy.data.objects["Avatar_Rig"]
body = bpy.data.objects["Avatar_Body"]
HEAD_BONE = "mixamorig:Head"

# Pose de repos pour travailler sur la géométrie d'origine
rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()

M = body.matrix_world
Mi = M.inverted()


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ====== 1) Fente de bouche ======
me = body.data
bm = bmesh.new()
bm.from_mesh(me)


def world(v):
    return M @ v.co


region = [
    f for f in bm.faces
    if all(
        abs(world(v).x) < MOUTH_HALF_W + 0.008
        and abs(world(v).z - MOUTH_Z) < 0.008
        and world(v).y < -0.11
        for v in f.verts
    )
]
edges = list({e for f in region for e in f.edges})
verts = list({v for f in region for v in f.verts})
plane_no = (M.to_3x3().inverted().transposed() @ Vector((0, 0, 1))).normalized()
cut = bmesh.ops.bisect_plane(
    bm, geom=region + edges + verts, dist=1e-6,
    plane_co=Mi @ Vector((0, 0, MOUTH_Z)), plane_no=plane_no,
)
cut_edges = [
    e for e in cut["geom_cut"]
    if isinstance(e, bmesh.types.BMEdge)
    and all(abs(world(v).x) < MOUTH_HALF_W for v in e.verts)
]
bmesh.ops.split_edges(bm, edges=cut_edges)
bm.to_mesh(me)
bm.free()
me.update()

# ====== 2) Shape keys ======
if not me.shape_keys:
    body.shape_key_add(name="Basis")
k_open = body.shape_key_add(name="MouthOpen", from_mix=False)
k_smile = body.shape_key_add(name="MouthSmile", from_mix=False)

# Côté de chaque vertex par rapport à la fente (les vertex de la coupe sont dédoublés)
side = {}
for p in me.polygons:
    cz = (M @ p.center).z
    for vi in p.vertices:
        side.setdefault(vi, []).append(cz)

to_local = M.to_3x3().inverted()
for v in me.vertices:
    w = M @ v.co
    if w.y > -0.07 or abs(w.x) > 0.07 or not (MOUTH_Z - 0.07 < w.z < MOUTH_Z + 0.03):
        continue
    if abs(w.z - MOUTH_Z) < 1e-4:
        below = sum(side[v.index]) / len(side[v.index]) < MOUTH_Z
    else:
        below = w.z < MOUTH_Z

    front = smoothstep(-0.07, -0.10, w.y)
    oval = max(0.0, 1 - (w.x / MOUTH_HALF_W) ** 2)
    gx = 1 - smoothstep(MOUTH_HALF_W, MOUTH_HALF_W + 0.03, abs(w.x))

    # Bouche ouverte : mâchoire et lèvre inférieure descendent, lèvre supérieure monte un peu
    if below:
        gz = 1 - smoothstep(MOUTH_Z - 0.035, MOUTH_Z - 0.065, w.z)
        lip = 1 - smoothstep(0.0, 0.012, MOUTH_Z - w.z)
        dz = -(0.004 * gx * gz + 0.009 * oval * lip) * front
        d = Vector((0, -dz * 0.3, dz))
    else:
        gz = 1 - smoothstep(0.0, 0.012, w.z - MOUTH_Z)
        d = Vector((0, 0, 0.003 * oval * gz * front))
    k_open.data[v.index].co = v.co + to_local @ d

    # Sourire : les coins de la bouche montent et s'écartent
    for sx in (-1, 1):
        corner = Vector((sx * MOUTH_HALF_W, w.y, MOUTH_Z))
        dist = (Vector((w.x, w.y, w.z)) - corner).length
        f = (1 - smoothstep(0.0, 0.022, dist)) * front
        if f > 0:
            k_smile.data[v.index].co = v.co + to_local @ Vector((sx * 0.004 * f, 0.001 * f, 0.004 * f))

# ====== 3) Cavité de la bouche ======
def parent_to_head(obj):
    obj.parent = rig
    obj.parent_type = 'BONE'
    obj.parent_bone = HEAD_BONE
    bone = rig.pose.bones[HEAD_BONE]
    # Garde la position monde actuelle sous l'os de la tête
    obj.matrix_parent_inverse = (rig.matrix_world @ bone.matrix @ Matrix.Translation((0, bone.length, 0))).inverted()


for name in ("Mouth_Inside", "Lens_L", "Lens_R"):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name])

bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1, location=(0, -0.108, MOUTH_Z - 0.004))
cavity = bpy.context.active_object
cavity.name = cavity.data.name = "Mouth_Inside"
cavity.scale = (MOUTH_HALF_W * 0.95, 0.011, 0.011)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
m_in = bpy.data.materials.new("Mouth_Inside")
m_in.use_nodes = True
m_in.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.06, 0.015, 0.02, 1)
m_in.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
cavity.data.materials.append(m_in)
parent_to_head(cavity)

# ====== 4) Écrans dans les verres ======
m_lens = bpy.data.materials.new("LensScreen")
m_lens.use_nodes = True
nt = m_lens.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.02, 0.06, 0.15, 1)
bsdf.inputs["Emission Color"].default_value = (0.25, 0.6, 1.0, 1)
bsdf.inputs["Emission Strength"].default_value = 1.0

for name, sx in (("Lens_L", 1), ("Lens_R", -1)):
    x0, x1 = (sx * LENS_X[0], sx * LENS_X[1])
    y0, y1 = LENS_Y
    z0, z1 = LENS_Z
    co = [(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1)]
    mesh = bpy.data.meshes.new(name)
    face = (0, 1, 2, 3) if sx > 0 else (3, 2, 1, 0)
    mesh.from_pydata(co, [], [face])
    uv = mesh.uv_layers.new(name="UVMap")
    # u suit l'axe X du monde (gauche → droite à l'écran), v monte
    for loop in mesh.loops:
        x, _, z = co[loop.vertex_index]
        uv.data[loop.index].uv = ((x - min(x0, x1)) / abs(x1 - x0), (z - z0) / (z1 - z0))
    mesh.materials.append(m_lens)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    parent_to_head(obj)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(A, "blender", "avatar_03_face.blend"), relative_remap=True)
print("RESULT cut_edges", len(cut_edges), "shape_keys", [k.name for k in me.shape_keys.key_blocks])
