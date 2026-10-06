"""M5 Task 5: render-only roads (never shipped), draped on TERRAIN_LOD0, one mesh per highway class in 20_ROADS.
Widths by class (spec §6). Each cross-section is 0.3 m above the terrain under its own edge.
Run: uv run model/scripts/context_data.py, then
     /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/context_roads.py"""
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

WIDTH = {"motorway": 12, "trunk": 12, "primary": 9, "secondary": 8, "tertiary": 7, "unclassified": 5.5,
         "residential": 5.5, "living_street": 5, "service": 3, "track": 3}
COLOUR = (0.16, 0.16, 0.17, 1.0)
d = np.load(ROOT / "model" / "data" / "context" / "roads.npz")
xy, lens, kinds, classes = d["xy"].astype(np.float64), d["lens"], d["kinds"], [str(c) for c in d["classes"]]
coll = bpy.data.collections.get("20_ROADS") or bpy.data.collections.new("20_ROADS")
if coll.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(coll)
for ob in list(coll.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
mat = bpy.data.materials.get("MAT_road_context") or bpy.data.materials.new("MAT_road_context")
mat.diffuse_color = COLOUR
starts = np.concatenate([[0], np.cumsum(lens)[:-1]])
worst = 0.0
for k, name in enumerate(classes):
    verts, faces = [], []
    half = WIDTH[name] / 2
    for s, n in zip(starts[kinds == k], lens[kinds == k]):
        p = xy[s:s + n]
        t = np.gradient(p, axis=0)
        t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
        nrm = np.column_stack([-t[:, 1], t[:, 0]]) * half
        edges = np.vstack([p + nrm, p - nrm])
        z = terrain_z([tuple(e) for e in edges])
        if any(v is None for v in z):
            continue
        z = np.asarray(z) + 0.3
        mid = (edges[:n - 1] + edges[1:n]) / 2                       # deviation check at segment midpoints
        zm = terrain_z([tuple(m) for m in mid])
        worst = max(worst, max((abs((z[i] + z[i + 1]) / 2 - 0.3 - zm[i]) for i in range(n - 1) if zm[i] is not None), default=0.0))
        b = len(verts)
        verts += [(x, y, zz) for (x, y), zz in zip(edges, z)]
        faces += [(b + i, b + i + 1, b + n + i + 1, b + n + i) for i in range(n - 1)]
    if not faces:
        continue
    me = bpy.data.meshes.new(f"ROADS_{name}")
    me.from_pydata(verts, [], faces)
    me.materials.append(mat)
    coll.objects.link(bpy.data.objects.new(f"ROADS_{name}", me))
    print(f"ROADS {name}: {len(faces):,} quads")
print(f"ROADS max deviation from the terrain at segment midpoints: {worst:.2f} m (gate: <= 1 m)")
bpy.ops.wm.save_mainfile()
