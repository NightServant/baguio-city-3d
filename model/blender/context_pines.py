"""M5 Task 5: render-only pine cover (never shipped) in 50_VEGETATION: Pinus kesiya proxies (a cone on a cylinder,
30-35 m, spec §7) on the candidate sites from context_data.py (clear of buildings and roads), kept by slope and
elevation (steep ground and ridges above 1,200 m), seeded. Instanced through one points mesh (vertex instancing).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/context_pines.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

xy = np.load(ROOT / "model" / "data" / "context" / "pines.npz")["xy"].astype(np.float64)
coll = bpy.data.collections.get("50_VEGETATION") or bpy.data.collections.new("50_VEGETATION")
if coll.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(coll)
for ob in list(coll.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
z = np.array([v if v is not None else np.nan for v in terrain_z([tuple(p) for p in xy])])
e = 6.0                                           # slope from four neighbours 6 m away
zx = np.array([v if v is not None else np.nan for v in terrain_z([(x + e, y) for x, y in xy])])
zy = np.array([v if v is not None else np.nan for v in terrain_z([(x, y + e) for x, y in xy])])
slope = np.degrees(np.arctan(np.hypot(zx - z, zy - z) / e))
rng = np.random.default_rng(1909)
p = np.clip(slope / 30.0, 0.2, 1.0) * (z > 1200)   # denser on steep ground; none below 1,200 m
keep = (rng.uniform(size=len(xy)) < p) & np.isfinite(slope)
me = bpy.data.meshes.new("PINE_SITES")
me.from_pydata([(x, y, zz - 0.5) for (x, y), zz in zip(xy[keep], z[keep])], [], [])
sites = bpy.data.objects.new("PINE_SITES", me)
coll.objects.link(sites)
proxy = bpy.data.meshes.new("PINE_PROXY")                   # trunk 0-12 m, crown cone 8-32 m (ESTIMATE, spec §7)
ring = lambda r, h, n=6: [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), h) for i in range(n)]
v = ring(0.35, 0.0) + ring(0.35, 12.0) + ring(3.2, 8.0) + [(0.0, 0.0, 32.0)]
f = [(i, (i + 1) % 6, 6 + (i + 1) % 6, 6 + i) for i in range(6)] + [(12 + i, 12 + (i + 1) % 6, 18) for i in range(6)] + [tuple(range(17, 11, -1))]
proxy.from_pydata(v, [], f)
mat = bpy.data.materials.get("MAT_pine_context") or bpy.data.materials.new("MAT_pine_context")
mat.diffuse_color = (0.16, 0.26, 0.15, 1.0)
proxy.materials.append(mat)
tree = bpy.data.objects.new("PINE_PROXY", proxy)
coll.objects.link(tree)
tree.parent = sites
sites.instance_type = "VERTS"
print(f"PINES {int(keep.sum()):,} instances of {len(xy):,} candidates")
bpy.ops.wm.save_mainfile()
