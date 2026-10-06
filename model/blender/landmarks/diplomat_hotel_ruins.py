"""diplomat-hotel-ruins: the Diplomat Hotel ruins on Dominican Hill, built from OpenStreetMap's Simple 3D Buildings
model of it (90+ building:part polygons with heights): the weathered two-storey walls with their window openings,
the crenellated roof parapets, the entrance porch's arches, the centre block with its stone crosses, the
metal roofs, and pines on the hilltop (ready-made CC0 Kenney).
Data: model/data/landmarks/diplomat-hotel-ruins/parts.json (`uv run model/scripts/landmark_osm.py parts
diplomat-hotel-ruins`). Sources and simplifications: model/landmarks/diplomat-hotel-ruins.md.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/diplomat_hotel_ruins.py"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils.geometry import tessellate_polygon

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "diplomat-hotel-ruins"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1915)             # seeded; completed May 1915 [S1]


def weathered(rgb=(0.86, 0.85, 0.81)):          # [S3] off-white render streaked dark by the weather
    """Weathered wall (3 m tile): block joints, vertical rain streaks, darker lower band."""
    Y, X, grain = lm._grid()
    base = lm.wall_blocks(rgb)
    streak = np.clip(np.sin(2 * np.pi * (7 * X + 0.3 * np.sin(2 * np.pi * 2 * Y))) * np.sin(2 * np.pi * 3 * X) - 0.4, 0, 1)
    return base * (1 - 0.35 * streak[..., None]) * (1 - 0.12 * (Y < 0.15)[..., None])


WALL = lm.textured("MAT_diplomat_wall", lm.pattern_image("TEX_diplomat_wall", weathered()), srgb(206, 202, 192), 0.9)
ROOF = lm.material("MAT_diplomat_roof", srgb(105, 105, 105), 0.6)         # [S2] roof:colour #696969 / #7A7D80
TRIM = lm.material("MAT_diplomat_trim", srgb(222, 220, 212), 0.85)        # [S3] parapets, crosses, arches
PINES = [lm.asset_mesh("pine_tall_c", 20.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("pine_tall_a", 16.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
S = lm.Shapes(coll, 0.0, {WALL.name: 3.0})

parts = json.loads((lm.ROOT / "model" / "data" / "landmarks" / SLUG / "parts.json").read_text())
# Left out for tier 2's 10k triangles: the thin horizontal string-course bands ("bar"), the survey station on the
# roof (RTK base), and the roof-access steps; S3 reads the same without them.
SKIP = ("bar", "rtk", "step ")
outline = [v for p in parts if p["desc"] == "main roof" for v in p["rings"][0]]
base = max(lm.rel_ground(fp, outline))          # [S2] heights are above the ground; the hilltop floor, on the map's terrain
deep = min(lm.rel_ground(fp, outline, low=True)) - 1.0
groups = {}
for p in parts:
    d = (p["desc"] or "").lower()
    if any(k in d + " " for k in SKIP) or not p["max"]:
        continue
    mat = ROOF if "roof" in d and "railing" not in d and "wall" not in d else TRIM if any(k in d for k in ("railing", "cross", "bow", "gantry")) else WALL
    groups.setdefault(mat.name, []).append((p, mat))

tris = 0
for name, items in groups.items():                # one mesh per material: fewer draw calls than 600 objects
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    for p, mat in items:
        z0 = deep if p["min"] <= 0.01 else base + p["min"]
        z1 = base + p["max"]
        rings = [r for r in p["rings"] if len(r) >= 3]
        loops = [[(y, x) for x, y in r] for r in rings]      # Shapes frame, bearing 0: a = y, w = x
        bot = [[bm.verts.new(S.P(a, w, z0)) for a, w in lp] for lp in loops]
        top = [[bm.verts.new(S.P(a, w, z1)) for a, w in lp] for lp in loops]
        flat = [v for lp in top for v in lp]
        flatb = [v for lp in bot for v in lp]
        for t in tessellate_polygon([[(a, w, 0.0) for a, w in lp] for lp in loops]):
            bm.faces.new([flat[i] for i in t])
            if p["min"] > 0.01:                               # a floating part (lintels, arches): close its underside
                bm.faces.new([flatb[i] for i in reversed(t)])
        for b_lp, t_lp in zip(bot, top):
            n = len(b_lp)
            for i in range(n):
                j = (i + 1) % n
                f = bm.faces.new((b_lp[i], b_lp[j], t_lp[j], t_lp[i]))
                L = (b_lp[j].co - b_lp[i].co).length
                s0 = (b_lp[i].co.x + b_lp[i].co.y) / 3.0
                for lp_, (u, v) in zip(f.loops, ((s0, z0 / 3.0), (s0 + L / 3.0, z0 / 3.0), (s0 + L / 3.0, z1 / 3.0), (s0, z1 / 3.0))):
                    lp_[uv].uv = (u, v)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(f"{SLUG}_{name}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(items[0][1])
    coll.objects.link(bpy.data.objects.new(f"{SLUG}_{name}", me))

# Pines on the hilltop round the building [S3], clear of its outline
n = 0
for t in np.linspace(0, 2 * math.pi, 8, endpoint=False):
    r = 34.0 + rng.uniform(-4, 6)
    x, y = r * math.cos(t), r * math.sin(t)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    deep = min(deep, z)
    lm.place(coll, f"tree_{n:02d}", PINES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

lm.human_reference(coll, 0.0, -24.0)
print("BASE", round(base, 2), "PARTS", sum(len(v) for v in groups.values()))
lm.report(SLUG, coll, -deep)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
