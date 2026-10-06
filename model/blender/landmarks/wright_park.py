"""wright-park: the Pool of Pines: the long reflecting pool running down toward The Mansion in one unbroken sheet,
its concrete rim and end walls, the red-brick promenades and grass verges either side, potted plants along the
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


def low(pts_aw):
    return min(lm.rel_ground(fp, [P(a, w) for a, w in pts_aw], low=True))


# The pool and its walks are continuous strips that follow the slope along their length and stay level across it
# ([S3]: one unbroken pool between unbroken promenades; owner report 2026-10-06, level slabs stepped jaggedly).
STA = np.arange(A0 - 6.0, A1 + 6.0 + 1e-6, 3.0)            # stations every 3 m, past each end of the pool
POOL = STA[(STA > A0) & (STA < A1)]
POOL = np.concatenate(([A0], POOL, [A1]))
RIM_W = 0.45


def profile(a_s, w0, w1):
    """The highest ground across [w0, w1] at each station."""
    g = lm.rel_ground(fp, [P(a, w) for a in a_s for w in (w0, (w0 + w1) / 2, w1)])
    return np.array(g).reshape(len(a_s), 3).max(axis=1)


def ribbon(name, a_s, w0, w1, zt, mat):
    """A closed strip from w0 to w1: its top at zt[i] over station a_s[i], a flat bottom 1 m under the lowest ground."""
    global lowest
    zb = low([(a, w) for a in a_s for w in (w0, w1)]) - 1.0
    lowest = min(lowest, zb)
    n = len(a_s)
    verts = [(a, w0, z) for a, z in zip(a_s, zt)] + [(a, w1, z) for a, z in zip(a_s, zt)]
    verts += [(a_s[0], w0, zb), (a_s[-1], w0, zb), (a_s[0], w1, zb), (a_s[-1], w1, zb)]
    bl0, bl1, br0, br1 = 2 * n, 2 * n + 1, 2 * n + 2, 2 * n + 3
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    faces += [(bl0, bl1, *range(n - 1, -1, -1)), (br0, *range(n, 2 * n), br1), (bl0, br0, br1, bl1),
              (bl0, 0, n, br0), (bl1, br1, 2 * n - 1, n - 1)]
    S.mesh(name, verts, faces, mat)


pool = profile(POOL, -HW - RIM_W, HW + RIM_W)
ribbon("water", POOL, -HW, HW, pool + 0.05, WATER)        # water just above the ground, rim 0.3 m above the water
for side in (-1, 1):
    ribbon(f"rim_{side}", POOL, *sorted((side * HW, side * (HW + RIM_W))), pool + 0.35, RIM)
for a, z in ((A0, pool[0]), (A1, pool[-1])):              # the end walls
    S.box(f"end_{a:.0f}", a - 0.2, a + 0.2, -HW - RIM_W, HW + RIM_W, z - 1.0, z + 0.35, RIM)

# Promenades: 4 m of red brick each side, then a 3 m grass verge
walk = {}
for side in (-1, 1):
    w0, w1 = sorted((side * (HW + RIM_W), side * (HW + RIM_W + 4.0)))
    walk[side] = profile(STA, w0, w1) + 0.15
    ribbon(f"walk_{side}", STA, w0, w1, walk[side], BRICK)
    g0, g1 = sorted((side * (HW + RIM_W + 4.0), side * (HW + RIM_W + 7.0)))
    ribbon(f"verge_{side}", STA, g0, g1, profile(STA, g0, g1) + 0.1, GRASS)
    for i, a0 in enumerate(np.arange(A0 + 3.0, A1, 6.0)):  # [S3] potted plants along the water's edge, about every 6 m
        pw, ph = side * (HW + RIM_W + 0.5), float(np.interp(a0, STA, walk[side]))
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
