"""M2: build the terrain authoring mesh and the collection tree; save model/data/blend/baguio.blend.

Run headless from the repo root:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/build_terrain.py
Starts from factory settings every time, so a rerun replaces rather than duplicates."""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "model" / "data" / "terrain"
BLEND = ROOT / "model" / "data" / "blend" / "baguio.blend"
TREE = ["00_REFERENCE", "10_TERRAIN", "20_ROADS", ("30_BUILDINGS", ["BLD_PROCEDURAL", "BLD_HERO"]),
        "40_LANDMARKS", "50_VEGETATION", "55_STREETFURNITURE", "60_MATERIALS", "90_EXPORT"]
LODS = {"TERRAIN_LOD1": 0.5, "TERRAIN_LOD2": 0.15}


def clear_factory_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def make_tree(scene):
    master = bpy.data.collections.new("BAGUIO_MASTER")
    scene.collection.children.link(master)
    made = {}
    for item in TREE:
        name, kids = (item, []) if isinstance(item, str) else item
        c = bpy.data.collections.new(name)
        master.children.link(c)
        made[name] = c
        for kid in kids:
            k = bpy.data.collections.new(kid)
            c.children.link(k)
            made[kid] = k
    return made


def grid_mesh_from_xyz(name, X, Y, Z, collection):
    """Verified on 4.5.2 (research §3b). Row 0 = south, col 0 = west; quads wind CCW from +Z."""
    rows, cols = Z.shape
    co = np.empty((rows, cols, 3), np.float32)
    co[..., 0], co[..., 1], co[..., 2] = X, Y, Z
    idx = np.arange(rows * cols, dtype=np.int32).reshape(rows, cols)
    quad = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1)
    nq = (rows - 1) * (cols - 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(rows * cols)
    me.loops.add(nq * 4)
    me.polygons.add(nq)
    me.vertices.foreach_set("co", co.ravel())
    me.loops.foreach_set("vertex_index", quad)
    me.polygons.foreach_set("loop_start", np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(calc_edges=True)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def decimated_copy(src, name, ratio, collection):
    """Research §4b method B: evaluate a Decimate modifier and copy the result; src stays intact."""
    md = src.modifiers.new("Decimate", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = ratio
    md.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    src.modifiers.remove(md)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def triangles(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def vertex_sha256(ob):
    co = np.empty(len(ob.data.vertices) * 3, np.float32)
    ob.data.vertices.foreach_get("co", co)
    return hashlib.sha256(co.tobytes()).hexdigest()


def neutral_material():
    mat = bpy.data.materials.new("MAT_TERRAIN_NEUTRAL")
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")  # by type, never by name
    bsdf.inputs["Base Color"].default_value = (0.42, 0.40, 0.37, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def main():
    scene = bpy.context.scene
    clear_factory_scene()
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    for scr in bpy.data.screens:
        for area in scr.areas:
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.clip_start, space.clip_end = 1.0, 100_000.0
    cols = make_tree(scene)

    E, N, Z = (np.load(TERRAIN / f"{k}.npy") for k in ("E", "N", "Z"))
    lod0 = grid_mesh_from_xyz("TERRAIN_LOD0", E, N, Z, cols["10_TERRAIN"])
    lod0.data.materials.append(neutral_material())
    objs = {"LOD0": lod0}
    for name, ratio in LODS.items():
        ob = decimated_copy(lod0, name, ratio, cols["10_TERRAIN"])
        ob.hide_viewport = ob.hide_render = True
        objs[name.split("_")[1]] = ob

    report = {"triangles": {k: triangles(o) for k, o in objs.items()},
              "sha256": {k: vertex_sha256(o) for k, o in objs.items()}}
    (TERRAIN / "build.json").write_text(json.dumps(report, indent=2) + "\n")
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
    print("BUILD", json.dumps(report["triangles"]))


main()
