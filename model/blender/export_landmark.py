"""Landmark procedure step D: export LM_<slug> to model/data/out/<slug>.raw.glb.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/export_landmark.py -- <slug>"""
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]


def export_landmark_glb(collection_name, out_path, image_format="WEBP", image_quality=80):
    """Verified on Blender 4.5.2 (research §1d)."""
    scene_colls = {c.name for c in bpy.context.scene.collection.children_recursive}
    assert collection_name in scene_colls, f"collection {collection_name!r} is not linked into the scene"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=out_path, check_existing=False, will_save_settings=False,
        export_format="GLB", collection=collection_name,
        use_visible=True, use_renderable=True, use_selection=False,
        export_yup=True, export_apply=True, export_gn_mesh=False,
        export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False,
        export_materials="EXPORT", export_image_format=image_format, export_image_quality=image_quality,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_vertex_color="NONE", export_attributes=False, export_extras=False,
        export_draco_mesh_compression_enable=False, export_use_gltfpack=False,
    )
    assert result == {"FINISHED"}, result
    data = open(out_path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    tris = 0
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            n = j["accessors"][p["indices"]]["count"] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]["count"]
            tris += n // 3
    assert j.get("nodes"), f"empty GLB for {collection_name!r}: no visible objects?"
    return {"bytes": len(data), "triangles": tris, "nodes": len(j["nodes"]), "sha256": hashlib.sha256(data).hexdigest()}


slug = sys.argv[sys.argv.index("--") + 1]
print("EXPORT", json.dumps(export_landmark_glb(f"LM_{slug}", str(ROOT / "model" / "data" / "out" / f"{slug}.raw.glb"))))
