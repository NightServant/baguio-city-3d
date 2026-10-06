"""wright-park: the Pool of Pines: the long reflecting pool stepping down toward The Mansion in eight basins,
its concrete rim and weirs, the red-brick promenades and grass verges either side, potted plants along the
water, and the double rows of tall pines (ready-made CC0 Kenney pines and bushes).
Dimensions: model/landmarks/wright-park.md ([S2] OSM pool outline; the rest are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/wright_park.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "wright-park"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1903)             # seeded


def bricks(rgb=(0.58, 0.30, 0.24)):          # [S3] red brick pavers
    """Brick paving (1 m tile): 10 courses of 0.2 x 0.1 m bricks in running bond, pale joints, per-brick tint."""
    Y, X, grain = lm._grid()
    row = np.floor(Y * 10)
    bx = X * 5 + (row % 2) * 0.5
    joint = (np.minimum(bx % 1, 1 - bx % 1) < 0.04) | (np.minimum((Y * 10) % 1, 1 - (Y * 10) % 1) < 0.07)
    tint = 1 + 0.08 * np.sin(np.floor(bx) * 12.9898 + row * 78.233)
    return np.where(joint[..., None], np.array((0.72, 0.68, 0.62)), np.array(rgb) * (tint * (1 + 0.03 * grain[..., 0]))[..., None])


BRICK = lm.textured("MAT_wright_brick", lm.pattern_image("TEX_wright_brick", bricks()), srgb(148, 80, 64), 0.9)
WATER = lm.material("MAT_wright_water", srgb(54, 110, 104), 0.15)       # [S3] green-tinted still water
RIM = lm.material("MAT_wright_rim", srgb(196, 192, 182), 0.85)           # [S3] pale concrete rim and weirs
GRASS = lm.material("MAT_wright_grass", srgb(98, 142, 62), 0.95)
POT = lm.material("MAT_wright_pot", srgb(52, 48, 44), 0.7)               # [S3] dark planters along the pool
PINES = [lm.asset_mesh("pine_tall_c", 24.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("pine_tall_a", 20.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
BROAD = lm.asset_mesh("broadleaf", 12.0, {"leafs": (86, 124, 60), "woodBark": (110, 84, 60)})
LEAF = lm.material("MAT_wright_leaf", srgb(56, 104, 48), 0.9)

# The pool's frame: a runs along its length toward The Mansion (south-east), w across. [S2] the outline is a
# 6.5 m x 177 m rectangle; its long axis is read from the outline itself.
ring = fp["rings"][0]
(x0, y0), (x1, y1) = max(zip(ring, ring[1:] + ring[:1]), key=lambda e: math.dist(*e))   # a long side
bearing = math.degrees(math.atan2(x1 - x0, y1 - y0))
bearing = bearing if math.cos(math.radians(bearing - 135)) > 0 else bearing + 180   # point a toward the Mansion (SE)
S = lm.Shapes(coll, bearing, {BRICK.name: 1.0})
aw = [S.xy(x, y, 0)[:2] for x, y in ring]
A0, A1 = min(a for a, w in aw), max(a for a, w in aw)
HW = (max(w for a, w in aw) - min(w for a, w in aw)) / 2
lowest = 0.0


def P(a, w):
    """(a, w) in the pool frame -> local (x, y)."""
    x, y, _ = S.P(a, w, 0.0)
    return (x, y)


def top(pts_aw):
    return max(lm.rel_ground(fp, [P(a, w) for a, w in pts_aw]))


def low(pts_aw):
    return min(lm.rel_ground(fp, [P(a, w) for a, w in pts_aw], low=True))


def slab(name, a0, a1, w0, w1, z1, mat, z0=None):
    global lowest
    corners = [(a0, w0), (a1, w0), (a1, w1), (a0, w1)]
    z0 = low(corners) - 1.0 if z0 is None else z0
    lowest = min(lowest, z0)
    S.box(name, a0, a1, w0, w1, z0, z1, mat)


# Basins: eight, each level at its own ground (the pool steps down the slope with low weirs, as in S3)
BASINS = 8
edges = np.linspace(A0, A1, BASINS + 1)
RIM_W = 0.45
for i in range(BASINS):
    a0, a1 = edges[i], edges[i + 1]
    patch = [(a, w) for a in np.linspace(a0, a1, 4) for w in (-HW - RIM_W, 0.0, HW + RIM_W)]
    zw = top(patch) + 0.05                    # water just above the ground, rim 0.3 m above the water
    slab(f"water_{i}", a0, a1, -HW, HW, zw, WATER)
    for side in (-1, 1):
        slab(f"rim_{i}_{side}", a0 - 0.2, a1 + 0.2, *sorted((side * HW, side * (HW + RIM_W))), zw + 0.3, RIM)
    slab(f"weir_{i}", a0 - 0.2, a0 + 0.25, -HW, HW, zw + 0.3, RIM)
slab("weir_end", A1 - 0.25, A1 + 0.2, -HW, HW, top([(A1, 0.0)]) + 0.35, RIM)

# Promenades: 4 m of red brick each side, then a 3 m grass verge; draped in 6 m pieces on the ground
STEP = 6.0
pieces = np.arange(A0 - 6.0, A1 + 6.0, STEP)
for i, a0 in enumerate(pieces):
    a1 = a0 + STEP + 0.05
    for side in (-1, 1):
        w0, w1 = sorted((side * (HW + RIM_W), side * (HW + RIM_W + 4.0)))
        slab(f"walk_{i:02d}_{side}", a0, a1, w0, w1, top([(a0, w0), (a1, w0), (a1, w1), (a0, w1)]) + 0.15, BRICK)
        g0, g1 = sorted((side * (HW + RIM_W + 4.0), side * (HW + RIM_W + 7.0)))
        slab(f"verge_{i:02d}_{side}", a0, a1, g0, g1, top([(a0, g0), (a1, g0), (a1, g1), (a0, g1)]) + 0.1, GRASS)
        if A0 < a0 < A1:                      # [S3] potted plants along the water's edge, about every 6 m
            pw = side * (HW + RIM_W + 0.5)
            ph = top([(a0, pw)]) + 0.15
            S.box(f"pot_{i:02d}_{side}", a0 - 0.25, a0 + 0.25, pw - 0.25, pw + 0.25, ph - 0.1, ph + 0.5, POT)
            S.pyramid(f"plant_{i:02d}_{side}", a0, pw, 0.35, ph + 0.5, ph + 1.3, LEAF)   # a clipped shrub (tier 2: no asset)

# Pines in a row on each side [S3, the "Pool of Pines"]: 10 m apart, one broadleaf in six (one row keeps tier 2's
# 10k triangles; S3 shows more behind)
n = 0
for row_w in (14.0,):
    for a in np.arange(A0 - 4.0, A1 + 4.0, 10.0):
        for side in (-1, 1):
            ta, tw = a + rng.uniform(-2, 2), side * (row_w + rng.uniform(-1.5, 1.5))
            x, y = P(ta, tw)
            z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
            lowest = min(lowest, z)
            lm.place(coll, f"tree_{n:03d}", BROAD if n % 6 == 5 else PINES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
            n += 1

hx, hy = P(A0 + 4.0, HW + RIM_W + 2.0)
lm.human_reference(coll, hx, hy)
print("POOL", round(A1 - A0, 1), "m x", round(2 * HW, 1), "m; bearing", round(bearing, 1), "; trees", n)
lm.detail(coll, fp, blocks=[RIM])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
