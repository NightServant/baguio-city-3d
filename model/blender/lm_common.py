"""Shared helpers for landmark modeling scripts (landmark procedure, step C). Blender 4.5.2.

A landmark lives in collection LM_<slug> under 40_LANDMARKS, authored around the local origin:
(0, 0, 0) is the footprint centroid on the ground, +Y is north, 1 unit = 1 m. A collection
instance placed at the anchor in 00_REFERENCE shows it in context for renders."""
import json
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

TIER_TRIANGLES = {1: 25_000, 2: 10_000}


def begin(slug):
    name = f"LM_{slug}"
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.data.collections["40_LANDMARKS"].children.link(coll)
    fp = json.loads((ROOT / "model" / "data" / "landmarks" / slug / "footprint.json").read_text())
    return coll, fp


def material(name, rgb, roughness=0.8):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    mat.diffuse_color = (*rgb, 1.0)  # viewport/Workbench colour (renders and MCP screenshots)
    return mat


def prism(coll, name, ring, z0, z1, mat):
    """Vertical extrusion of a CCW ring [[x, y], …] (local metres) from z0 up to z1, capped both ends."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in ring]
    top = [bm.verts.new((x, y, z1)) for x, y in ring]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def foundation(coll, fp, mat):
    """Contract C2: geometry below Z=0 reaches the lowest terrain under the footprint plus 1 m."""
    ax, ay = fp["anchor_tm"]
    pts = [(ax + x, ay + y) for ring in fp["rings"] for x, y in ring]
    zs = [z for z in terrain_z(pts + [(ax, ay)]) if z is not None]
    ground, lowest = zs[-1], min(zs)
    depth = (ground - lowest) + 1.0
    for i, ring in enumerate(fp["rings"]):
        prism(coll, f"{coll.name}_foundation_{i}", ring, -depth, 0.0, mat)
    return depth


def human_reference(coll, x, y):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.8, location=(x, y, 0.9))
    ob = bpy.context.active_object
    ob.name = f"{coll.name}_HUMAN_REF"
    for c in ob.users_collection:
        c.objects.unlink(ob)
    bpy.data.collections["00_REFERENCE"].objects.link(ob)
    return ob


def report(slug, coll, depth):
    tier = json.loads((ROOT / "model" / "landmarks.json").read_text())[slug]["tier"]
    dg = bpy.context.evaluated_depsgraph_get()
    tris, zmin = 0, float("inf")
    for ob in coll.all_objects:
        if ob.type != "MESH":
            continue
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        zmin = min(zmin, min((ob.matrix_world @ v.co).z for v in me.vertices))
        ob.evaluated_get(dg).to_mesh_clear()
    out = {"slug": slug, "tier": tier, "triangles": tris, "budget": TIER_TRIANGLES[tier], "depth": depth, "z_min": zmin}
    print("REPORT", json.dumps(out))
    assert tris <= TIER_TRIANGLES[tier], f"{slug}: {tris} triangles > {TIER_TRIANGLES[tier]}"
    assert zmin <= -depth + 1e-3, f"{slug}: lowest point {zmin:.2f} doesn't reach the foundation depth {-depth:.2f}"
    return out


def context_instance(slug, fp):
    name = f"CTX_{slug}"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    inst = bpy.data.objects.new(name, None)
    inst.instance_type = "COLLECTION"
    inst.instance_collection = bpy.data.collections[f"LM_{slug}"]
    ax, ay = fp["anchor_tm"]
    inst.location = (ax, ay, terrain_z([(ax, ay)])[0])
    bpy.data.collections["00_REFERENCE"].objects.link(inst)
    return inst
