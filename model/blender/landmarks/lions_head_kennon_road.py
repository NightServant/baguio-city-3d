"""lions-head-kennon-road: the Lion's Head on Kennon Road, a 12 m limestone lion's head (1972) facing the road on its
stone plinth: the lumpy gold mane, the brown face with its white eyes, the muzzle and nose, the open mouth with
white fangs, and the forepaw with white claws; trees on the slope behind (ready-made CC0 Kenney).
Dimensions: model/landmarks/lions-head-kennon-road.md ([S2] OSM outline, height 12 m; the carving is an ESTIMATE).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/lions_head_kennon_road.py"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "lions-head-kennon-road"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1972)             # seeded; carved in 1972 [S2]

MANE = lm.textured("MAT_lion_mane", lm.pattern_image("TEX_lion_mane",
                   np.array((0.78, 0.66, 0.44)) * (1 + 0.12 * np.sin(2 * np.pi * (14 * lm._grid()[1] + 2 * np.sin(2 * np.pi * 3 * lm._grid()[0]))))[..., None]),
                   srgb(196, 168, 112), 0.9)                                # [S3] combed gold mane
FACE = lm.material("MAT_lion_face", srgb(126, 92, 72), 0.85)              # [S3] the brown face
DARK = lm.material("MAT_lion_dark", srgb(52, 36, 30), 0.8)                # nose, mouth, pupils
WHITE = lm.material("MAT_lion_white", srgb(236, 232, 222), 0.7)           # eyes, fangs, claws
PLINTH = lm.material("MAT_lion_plinth", srgb(146, 140, 130), 0.95)
TREES = [lm.asset_mesh("broadleaf", 10.0, {"leafs": (90, 120, 60), "woodBark": (110, 84, 60)}),
         lm.asset_mesh("pine_tall_a", 15.0, {"leafs": (66, 98, 56), "woodBark": (96, 74, 56)})]
L = lm.Shapes(coll, 90.0, {MANE.name: 3.0})     # [S2] Kennon Road runs past the east side: the lion faces east (a)
ring = fp["rings"][0]
zt = max(lm.rel_ground(fp, ring))
zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
z0 = zt + 0.8                                   # top of the plinth (ESTIMATE)
H = 12.0                                        # [S2] height=12
S = lm.Shapes(coll, 0.0, {})
S.prism("plinth", [(y, x) for x, y in ring], zl, z0, PLINTH, tessellate=True)

# The mane: a seeded, lumpy dome 7 m deep, 10 m wide and 12 m tall, flattened at the front where the face sits
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
verts = []
for v in bm.verts:
    x, y, z = v.co
    k = 1 + 0.06 * math.sin(7 * x + 3 * y) * math.cos(5 * z + 2 * x) + rng.uniform(-0.03, 0.03)
    a = min(x * 3.5 * k, 2.6)                   # the front is cut flat at a = 2.6 for the face
    verts.append((a - 0.8, y * 5.0 * k, z0 + (max(z, -0.85) + 0.85) / 1.85 * H))
faces = [tuple(v.index for v in f.verts) for f in bm.faces]
bm.free()
L.mesh("mane", verts, faces, MANE)

# The face [S3]: a brown, slightly tapered block on the mane's flat front, then brow, eyes, muzzle, nose, mouth
FA = 1.8                                        # the face's back, inside the mane
L.hexa("face", [(FA, -2.7, z0 + 1.6), (FA + 1.2, -2.6, z0 + 1.6), (FA + 1.2, 2.6, z0 + 1.6), (FA, 2.7, z0 + 1.6)],
       [(FA, -2.4, z0 + 9.2), (FA + 1.0, -2.2, z0 + 9.2), (FA + 1.0, 2.2, z0 + 9.2), (FA, 2.4, z0 + 9.2)], FACE)
L.box("brow", FA + 0.9, FA + 1.5, -2.3, 2.3, z0 + 6.6, z0 + 7.2, FACE)
for side in (-1, 1):
    L.disc(f"eye_{side}", "a", FA + 1.25, side * 1.2, z0 + 6.0, 0.55, 0.1, WHITE, seg=12)
    L.disc(f"pupil_{side}", "a", FA + 1.32, side * 1.2, z0 + 6.0, 0.22, 0.08, DARK, seg=8)
L.hexa("muzzle", [(FA + 1.0, -1.6, z0 + 2.9), (FA + 2.6, -1.3, z0 + 2.9), (FA + 2.6, 1.3, z0 + 2.9), (FA + 1.0, 1.6, z0 + 2.9)],
       [(FA + 1.0, -0.9, z0 + 6.0), (FA + 1.6, -0.6, z0 + 6.0), (FA + 1.6, 0.6, z0 + 6.0), (FA + 1.0, 0.9, z0 + 6.0)], FACE)
L.box("nose", FA + 2.4, FA + 2.85, -0.7, 0.7, z0 + 4.2, z0 + 4.9, DARK)
L.box("mouth", FA + 1.6, FA + 2.65, -1.5, 1.5, z0 + 1.7, z0 + 2.9, DARK)         # [S3] the open mouth
for k, (fw, up) in enumerate(((-1.0, 1), (1.0, 1), (-1.1, -1), (1.1, -1))):      # fangs, upper and lower
    zb = z0 + (2.9 if up > 0 else 1.7)
    L.cone(f"fang_{k}", FA + 2.5, fw, 0.18, zb, zb - up * 0.7, WHITE, seg=5)
# the forepaw at the lion's left (the viewer's right) with its white claws [S3]
L.hexa("paw", [(FA + 1.0, -4.6, z0), (FA + 4.2, -4.6, z0), (FA + 4.2, -2.4, z0), (FA + 1.0, -2.4, z0)],
       [(FA + 1.0, -4.4, z0 + 1.5), (FA + 3.8, -4.4, z0 + 1.2), (FA + 3.8, -2.6, z0 + 1.2), (FA + 1.0, -2.6, z0 + 1.5)], MANE)
for k in range(4):
    L.cone(f"claw_{k}", FA + 4.2, -2.7 - 0.5 * k, 0.18, z0, z0 + 0.6, WHITE, seg=5)

n = 0
for x, y in ((-14.0, -10.0), (-16.0, 4.0), (-12.0, 14.0), (-24.0, -2.0), (-22.0, 16.0), (-20.0, -16.0)):
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    zl = min(zl, z)
    lm.place(coll, f"tree_{n}", TREES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

lm.human_reference(coll, 9.0, -5.0)
print("PLINTH", round(z0, 2))
lm.report(SLUG, coll, -zl)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
