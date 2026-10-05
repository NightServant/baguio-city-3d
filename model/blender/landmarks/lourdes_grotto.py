"""lourdes-grotto: the pilgrims' stairway up the hill (white posts and blue rails), the twin flights flanking the
grotto, the mossy rock grotto with its arched niche, white Marian statue with a blue sash, arch sign and blue
candle altar, the plaza before it, and the Chapel of Jesus and Maria; a few trees (ready-made CC0 Kenney).
Dimensions: model/landmarks/lourdes-grotto.md ([S2] OSM stair chain, grotto node and chapel; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/lourdes_grotto.py"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "lourdes-grotto"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1913)

PAVING = lm.textured("MAT_lourdes_paving", lm.pattern_image("TEX_lourdes_paving", lm.flagstones((0.62, 0.60, 0.56), 1961)), srgb(158, 153, 143), 0.9)
ROCK = lm.material("MAT_lourdes_rock", srgb(92, 100, 82), 0.95)          # [S3] dark mossy rock
FRAME = lm.material("MAT_lourdes_frame", srgb(214, 206, 188), 0.9)       # [S3] pale stone arch round the niche
NICHE = lm.material("MAT_lourdes_niche", srgb(40, 44, 48), 0.9)
WHITE = lm.material("MAT_lourdes_white", srgb(238, 238, 234), 0.7)       # [S3] statue, rail posts, chapel walls
BLUE = lm.material("MAT_lourdes_blue", srgb(52, 120, 196), 0.6)          # [S3] the sash, rails and candle altar
SIGN = lm.material("MAT_lourdes_sign", srgb(70, 72, 74), 0.6)            # [S3] the arched "Tota Pulchra es Maria" frame
FLOWER = lm.material("MAT_lourdes_flower", srgb(206, 40, 48), 0.8)       # [S3] red poinsettias and roses
ROOF = lm.material("MAT_lourdes_roof", srgb(120, 124, 128), 0.6)         # [S3] grey chapel roof
WOOD = lm.material("MAT_lourdes_wood", srgb(150, 98, 58), 0.7)           # [S3] the porch gable's wood panelling
PILLAR = lm.material("MAT_lourdes_pillar", srgb(128, 122, 112), 0.9)     # [S3] stone porch pillars
TREES = [lm.asset_mesh("broadleaf", 11.0, {"leafs": (80, 118, 58), "woodBark": (110, 84, 60)}),
         lm.asset_mesh("pine_tall_a", 16.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
S = lm.Shapes(coll, 0.0, {PAVING.name: 3.0})
lowest = 0.0

# [S2] OSM points, measured from the grotto node (node/384119717), which sits at G in this frame
G = (-24.5, 8.56)
g = lambda x, y: (G[0] + x, G[1] + y)
MAIN = [g(36, 49), g(25, 34), g(21, 28), g(15, 21), g(12, 16), g(7, 9)]          # the climb, foot to plaza
TWIN = [[g(7, 9), g(9, 5), g(0, -5)], [g(7, 9), g(3, 11), g(-6, 1)]]             # 34 steps each, past the grotto


def top(pts):
    return max(lm.rel_ground(fp, pts))


def low(pts):
    return min(lm.rel_ground(fp, pts, low=True))


def stair(name, line, width):
    """1 m-deep stone treads along a polyline, each on the highest map terrain under it; white posts every
    2 m with a blue handrail, both sides [S3]."""
    global lowest
    posts = {-1: [], 1: []}
    k = 0
    for (x0, y0), (x1, y1) in zip(line, line[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        dx, dy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -dy, dx
        for t in np.arange(0.0, L, 1.0):
            t1 = min(t + 1.05, L)
            quad = [(x0 + dx * u + nx * o, y0 + dy * u + ny * o) for u, o in ((t, -width / 2), (t1, -width / 2), (t1, width / 2), (t, width / 2))]
            h = top(quad) + 0.15
            z0 = low(quad) - 1.0
            lowest = min(lowest, z0)
            S.hexa(f"{name}_{k:03d}", [S.xy(x, y, z0) for x, y in quad], [S.xy(x, y, h) for x, y in quad], PAVING)
            if k % 2 == 0:
                for side in (-1, 1):
                    px, py = x0 + dx * t + nx * side * (width / 2 + 0.1), y0 + dy * t + ny * side * (width / 2 + 0.1)
                    S.beam(f"{name}_post_{k:03d}_{side}", (px, py, h - 0.1), (px, py, h + 1.0), 0.05, WHITE)
                    posts[side].append((px, py, h + 1.0))
            k += 1
    for side, ps in posts.items():
        for i, (p0, p1) in enumerate(zip(ps, ps[1:])):
            S.beam(f"{name}_rail_{side}_{i:02d}", p0, p1, 0.04, BLUE)


stair("main", MAIN, 2.6)
for i, line in enumerate(TWIN):
    stair(f"twin_{i}", line, 1.8)

# --- The grotto [S3]: a lumpy rock mass between the twin flights, its face to the north-east (down the stair)
FACE = math.degrees(math.atan2(9, 10))         # [S2] the twin flights run along bearing ~42 deg
R = lm.Shapes(coll, FACE, {PAVING.name: 3.0})
gx, gy = g(0, 0)
ox, oy, _ = R.xy(gx, gy, 0.0)                  # the grotto's origin in its own frame
plaza_aw = [(ox + 2.4, oy - 3.5), (ox + 7.4, oy - 3.5), (ox + 7.4, oy + 3.5), (ox + 2.4, oy + 3.5)]
plaza = [R.P(a, w, 0.0)[:2] for a, w in plaza_aw]
zp = top(plaza) + 0.15                          # the plaza before the grotto, level
R.hexa("plaza", [(a, w, low(plaza) - 1.0) for a, w in plaza_aw], [(a, w, zp) for a, w in plaza_aw], PAVING)
lowest = min(lowest, low(plaza) - 1.0)
zb = low([(gx, gy)]) - 1.0
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
vs = [(v.co.x * 2.4 * rng.uniform(0.85, 1.1), v.co.y * 3.8 * rng.uniform(0.85, 1.1), max(v.co.z, -0.2)) for v in bm.verts]
faces = [tuple(v.index for v in f.verts) for f in bm.faces]
bm.free()
HG = zp + 6.0 - zb                               # the rock rises about 6 m above the plaza (ESTIMATE)
R.mesh("grotto_rock", [(ox + a, oy + w, zb + (z + 0.2) / 1.2 * HG) for a, w, z in vs], faces, ROCK)
lowest = min(lowest, zb)
fa = ox + 2.2                                   # the rock's front, where the niche opens
R.arch_panel("niche_frame", "a", fa + 0.35, oy, 2.6, zp + 0.6, zp + 4.6, 0.6, FRAME)
R.arch_panel("niche", "a", fa + 0.37, oy, 1.8, zp + 0.9, zp + 4.1, 0.05, NICHE)
R.box("statue", fa + 0.38, fa + 0.75, oy - 0.25, oy + 0.25, zp + 1.0, zp + 2.7, WHITE)        # [S3] Our Lady in white
R.box("statue_sash", fa + 0.39, fa + 0.78, oy - 0.27, oy + 0.27, zp + 1.7, zp + 1.85, BLUE)  # with a blue sash
R.box("statue_head", fa + 0.45, fa + 0.7, oy - 0.13, oy + 0.13, zp + 2.7, zp + 3.0, WHITE)
for i in range(9):                              # the arched sign frame over the niche
    t0, t1 = math.pi * i / 9, math.pi * (i + 1) / 9
    p0 = R.P(fa + 0.6, oy + 2.0 * math.cos(t0), zp + 4.4 + 1.2 * math.sin(t0))
    p1 = R.P(fa + 0.6, oy + 2.0 * math.cos(t1), zp + 4.4 + 1.2 * math.sin(t1))
    S.beam(f"sign_{i}", p0, p1, 0.08, SIGN)
R.box("altar", fa + 1.6, fa + 2.4, oy - 1.5, oy + 1.5, zp - 0.2, zp + 1.0, BLUE)             # [S3] the candle altar
R.box("altar_top", fa + 1.55, fa + 2.45, oy - 1.55, oy + 1.55, zp + 1.0, zp + 1.1, WHITE)
for side in (-1, 1):                            # flower beds either side of the niche
    R.box(f"flowers_{side}", fa + 0.4, fa + 1.4, oy + side * 1.7 - 0.6, oy + side * 1.7 + 0.6, zp - 0.2, zp + 0.7, FLOWER)

# --- The Chapel of Jesus and Maria [S2] way/1153950697: a 15 m square set at 45 deg, porch to the north-west
C = lm.Shapes(coll, 135.0, {}, pitch_deg=28.0)
sq = [C.xy(x, y, 0)[:2] for x, y in fp["rings"][0][:4]]
a0, a1 = min(a for a, w in sq), max(a for a, w in sq)
w0, w1 = min(w for a, w in sq), max(w for a, w in sq)
zc = top(fp["rings"][0]) + 0.3
zcl = low(fp["rings"][0]) - 1.0
lowest = min(lowest, zcl)
C.box("chapel_walls", a0 + 0.3, a1 - 0.3, w0 + 0.3, w1 - 0.3, zcl, zc + 4.0, WHITE)
C.gable_along_a("chapel_roof", a0, a1, w0 - 0.4, w1 + 0.4, zc + 4.0, ROOF)
zr = zc + 4.0 + (w1 - w0 + 0.8) / 2 * math.tan(math.radians(28))
C.gable_wall("chapel_gable", a0 + 0.3, a0 + 0.5, w0 + 0.3, w1 - 0.3, zc + 4.0, zr - 0.3, WHITE)
C.box("porch_floor", a0 - 3.0, a0 + 0.3, -3.0, 3.0, zcl, zc, PAVING)
for side in (-1, 1):                            # [S3] stone pillars and a wood-panelled porch gable
    C.box(f"porch_pillar_{side}", a0 - 2.9, a0 - 2.3, side * 2.7 - 0.3, side * 2.7 + 0.3, zc, zc + 3.4, PILLAR)
C.gable_along_a("porch_roof", a0 - 3.2, a0 + 0.3, -3.4, 3.4, zc + 3.4, ROOF)
C.gable_wall("porch_gable", a0 - 3.1, a0 - 2.95, -3.2, 3.2, zc + 3.4, zc + 3.4 + 3.2 * math.tan(math.radians(28)), WOOD)

for n, (tx, ty) in enumerate((g(-8, 6), g(10, -2), g(-4, -12), g(18, 30), g(30, 26), g(28, 44), g(-14, 14), (14.0, 8.0))):
    z = lm.rel_ground(fp, [(tx, ty)], low=True)[0] - 0.3
    lowest = min(lowest, z)
    lm.place(coll, f"tree_{n}", TREES[n % 2], tx, ty, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))

hx, hy = plaza[1]
lm.human_reference(coll, hx, hy)
print("PLAZA", round(zp, 2), "CHAPEL FLOOR", round(zc, 2))
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
