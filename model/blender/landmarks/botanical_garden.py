"""botanical-garden: the Baguio Botanical Garden's entrance quarter and its landmarks:
- the dark bronze relief wall bearing the garden's name at the gate;
- the stone stair down to the round Centennial Garden plaza (paved ring, low stone wall, lawn island with a
  flower mound and a log tepee);
- the main paths, the round Orchidarium, the two round native huts, the greenhouse and the small green-roofed
  house by the plaza;
- Benguet pines across the 3.4 ha garden (ready-made CC0 Kenney).
Dimensions: model/landmarks/botanical-garden.md ([S2] OSM outline, paths and buildings; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/botanical_garden.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "botanical-garden"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1920)

PAVING = lm.textured("MAT_botanical_paving", lm.pattern_image("TEX_botanical_paving", lm.flagstones((0.66, 0.62, 0.56), 1920)), srgb(166, 156, 142), 0.9)
BRONZE = lm.material("MAT_botanical_bronze", srgb(62, 56, 48), 0.6)        # [S3] the dark relief wall
GOLD = lm.material("MAT_botanical_gold", srgb(196, 150, 92), 0.5)          # [S3] its raised name letters
STONE = lm.material("MAT_botanical_stone", srgb(138, 128, 112), 0.95)      # [S3] low stone walls and hut bases
GRASS = lm.material("MAT_botanical_grass", srgb(98, 140, 62), 0.95)
FLOWER = lm.material("MAT_botanical_flower", srgb(196, 50, 64), 0.8)       # [S3] the plaza's red and pink mound
LOG = lm.material("MAT_botanical_log", srgb(120, 88, 58), 0.85)
THATCH = lm.material("MAT_botanical_thatch", srgb(132, 104, 64), 0.95)     # native huts' cogon-style roofs
GREEN = lm.material("MAT_botanical_green_roof", srgb(52, 120, 84), 0.6)    # [S3] green roofs
WHITE = lm.material("MAT_botanical_white", srgb(232, 232, 226), 0.8)
GLASS = lm.material("MAT_botanical_glass", srgb(176, 196, 186), 0.2)
PINES = lm.FloraMix("park")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
S = lm.Shapes(coll, 0.0, {PAVING.name: 3.0})
lowest = 0.0


def top(pts):
    return max(lm.rel_ground(fp, pts))


def low(pts):
    return min(lm.rel_ground(fp, pts, low=True))


def solid(name, plan, z1, mat, z0=None, tess=False):
    """Prism over a plan [(x, y), …] from z0 (default 1 m under the lowest ground) up to z1."""
    global lowest
    z0 = low(plan) - 1.0 if z0 is None else z0
    lowest = min(lowest, z0)
    S.prism(name, [(y, x) for x, y in plan], z0, z1, mat, tessellate=tess)


def ring(cx, cy, r, n=16, phase=0.0):
    return [(cx + r * math.cos(phase + 2 * math.pi * i / n), cy + r * math.sin(phase + 2 * math.pi * i / n)) for i in range(n)]


def ribbon(name, line, width, step=1.0, stairs=False):
    """A paved walk along a polyline in pieces of `step` m, each on the highest map terrain under it."""
    k = 0
    for (x0, y0), (x1, y1) in zip(line, line[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        dx, dy = (x1 - x0) / L, (y1 - y0) / L
        nx, ny = -dy, dx
        for t in np.arange(0.0, L, step):
            t1 = min(t + step + 0.05, L)
            q = [(x0 + dx * u + nx * o, y0 + dy * u + ny * o) for u, o in ((t, -width / 2), (t1, -width / 2), (t1, width / 2), (t, width / 2))]
            h = top(q) + 0.15
            solid(f"{name}_{k:03d}", q, h, PAVING)
            k += 1


# --- The gate [S2] node/4703956743 "Botanical Garden Sign": the relief wall beside the entrance walk, facing
# the road; [S3] dark bronze relief, a wavy crest, the name in raised gold letters on two lines
W = lm.Shapes(coll, 342.0, {})                  # a: the way the wall faces (up the walk, to the road)
WX, WY = -101.5, 83.5
wa, ww, _ = W.xy(WX, WY, 0.0)
zw = top([(WX - 5, WY), (WX + 5, WY)]) + 0.1
zwl = low([(WX - 5, WY), (WX + 5, WY)]) - 1.0
lowest = min(lowest, zwl)
for k in range(10):                             # ten 1 m bays with a wavy crest (2.7-3.5 m)
    w0, w1 = ww - 5.0 + k, ww - 4.0 + k
    W.box(f"gate_wall_{k}", wa - 0.6, wa, w0, w1, zwl, zw + 3.1 + 0.4 * math.sin(k * 0.9), BRONZE)
W.box("gate_name_top", wa + 0.0, wa + 0.08, ww - 2.0, ww + 1.5, zw + 2.4, zw + 2.9, GOLD)        # "Baguio"
W.box("gate_name_main", wa + 0.0, wa + 0.08, ww - 4.4, ww + 4.2, zw + 1.6, zw + 2.2, GOLD)       # "Botanical Garden"
W.disc("gate_sun", "a", wa + 0.1, ww - 2.6, zw + 1.1, 0.35, 0.1, GOLD)                          # [S3] the sun disc
solid("gate_forecourt", [(WX - 6, WY - 2.5), (WX + 5, WY - 2.5), (WX + 5, WY + 4.5), (WX - 6, WY + 4.5)], zw, PAVING)

# --- The walk down from the gate [S2] ways 1134607015, 1385115363: 3 m of stone, 1 m treads
ribbon("walk_gate", [(-96.9, 95.1), (-95.3, 90.1), (-93.8, 85.5), (-93.5, 73.9), (-92.9, 61.2)], 3.0)

# --- The Centennial Garden plaza [S2] way/1385115361 (the island) and the ring walk way/33613716; [S3] a round
# paved plaza with a lawn island, a flower mound and a log tepee, ringed by a low stone wall
PX, PY = -92.8, 48.7
zp = top(ring(PX, PY, 13.0, 24)) + 0.15         # level: the plaza is flat in S3
for i in range(16):                             # paved annulus, r 7.5-12.5
    t0, t1 = 2 * math.pi * i / 16, 2 * math.pi * (i + 1) / 16
    q = [(PX + r * math.cos(t), PY + r * math.sin(t)) for r, t in ((7.5, t0), (12.5, t0), (12.5, t1), (7.5, t1))]
    solid(f"plaza_{i:02d}", q, zp, PAVING)
    mid = (t0 + t1) / 2
    if min(abs(math.atan2(math.sin(mid - g), math.cos(mid - g))) for g in (math.pi / 2, 0.0)) > 0.35:   # gaps: N walk, E walk
        wq = [(PX + r * math.cos(t), PY + r * math.sin(t)) for r, t in ((12.5, t0), (13.1, t0), (13.1, t1), (12.5, t1))]
        solid(f"plaza_wall_{i:02d}", wq, zp + 0.6, STONE)
solid("island", ring(PX, PY, 7.5, 16), zp + 0.3, GRASS)
S.cone("flower_mound", PY, PX, 3.0, zp + 0.3, zp + 1.6, FLOWER, seg=10)
for k in range(8):                              # [S3] a tepee of logs on the island
    t = 2 * math.pi * k / 8
    S.beam(f"tepee_{k}", (PX + 2.0 + 1.4 * math.cos(t), PY - 2.0 + 1.4 * math.sin(t), zp + 0.3),
           (PX + 2.0 - 0.3 * math.cos(t), PY - 2.0 - 0.3 * math.sin(t), zp + 3.4), 0.08, LOG)

# --- Walks on to the Orchidarium and the lower garden [S2] ways 1347296867, 1385115359, 33613718
ribbon("walk_east", [(-80.3, 49.0), (-77.4, 51.9), (-70.8, 50.0), (-64.9, 49.8), (-54.5, 48.6), (-14.9, 43.0), (-2.0, 41.6)], 2.5, step=3.0)
ribbon("walk_south", [(-64.9, 49.8), (-63.9, 44.8), (-59.5, 40.7), (-56.6, 39.8), (-49.2, 37.3), (-41.1, 32.2), (-37.8, 27.1),
                      (-33.5, 17.7), (-27.4, 10.6), (-21.9, 4.5), (-18.4, 0.7)], 2.5, step=3.0)

# --- Buildings [S2]
ORCH = [(-9.2, 53.2), (-9.8, 56.6), (-8.2, 59.7), (-5.0, 61.3), (-1.4, 60.5), (0.9, 57.6), (0.9, 54.0), (-1.4, 51.1), (-4.9, 50.3), (-8.1, 51.8)]
zo = top(ORCH) + 0.2
solid("orchidarium", ORCH, zo + 3.2, GLASS)                       # way/1347296865, the round Orchidarium
S.cone("orchidarium_roof", 55.8, -4.3, 6.2, zo + 3.2, zo + 6.6, GREEN, seg=10)
for name, (hx, hy, hr) in (("hut_west", (-11.0, 28.4, 5.8)), ("hut_east", (48.3, 66.9, 3.4))):   # ways 1347301014, 1385115357
    zh = top(ring(hx, hy, hr, 8)) + 0.1
    solid(f"{name}_base", ring(hx, hy, hr - 0.4, 8), zh + 0.5, STONE)
    for k, (px, py) in enumerate(ring(hx, hy, hr - 0.7, 6)):
        S.beam(f"{name}_post_{k}", (px, py, zh + 0.5), (px, py, zh + 2.4), 0.1, LOG)
    S.cone(f"{name}_roof", hy, hx, hr + 0.4, zh + 2.4, zh + 2.4 + hr * 1.1, THATCH, seg=10)   # steep, native style
GH = [(-45.2, -61.0), (-51.8, -70.9), (-67.3, -60.8), (-60.6, -50.8)]  # way/1063563331, the greenhouse
zg = top(GH) + 0.1
solid("greenhouse", GH, zg + 2.6, GLASS)
G = lm.Shapes(coll, math.degrees(math.atan2(-67.3 + 51.8, -60.8 + 70.9)), {}, pitch_deg=25.0)
ga = [G.xy(x, y, 0)[:2] for x, y in GH]
G.gable_along_a("greenhouse_roof", min(a for a, w in ga), max(a for a, w in ga), min(w for a, w in ga), max(w for a, w in ga), zg + 2.6, GLASS)
HOUSE = [(-79.4, 47.6), (-80.8, 41.9), (-75.4, 40.7), (-74.0, 46.3)]  # way/1385115362, by the plaza
zh = top(HOUSE) + 0.2
solid("house", HOUSE, zh + 3.0, WHITE)
S.cone("house_roof", 44.1, -77.4, 4.2, zh + 3.0, zh + 5.2, GREEN, seg=4)

# --- Pines across the garden [S3]: a jittered 26 m grid inside the outline, clear of the plaza and buildings
outline = fp["rings"][0]
keep_clear = [(PX, PY, 16.0), (-4.3, 55.8, 9.0), (-11.0, 28.4, 9.0), (48.3, 66.9, 6.0), (-56.0, -61.0, 11.0), (-77.4, 44.1, 6.0), (WX, WY, 8.0)]
n = 0
for gx in np.arange(-110.0, 110.0, 26.0):
    for gy in np.arange(-95.0, 105.0, 26.0):
        x, y = gx + rng.uniform(-8, 8), gy + rng.uniform(-8, 8)
        if not lm.inside(outline, x, y) or any(math.hypot(x - cx, y - cy) < r for cx, cy, r in keep_clear):
            continue
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{n:02d}", PINES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        n += 1

lm.human_reference(coll, WX + 3.0, WY + 3.0)
print("PLAZA", round(zp, 2), "GATE", round(zw, 2), "TREES", n)
lm.detail(coll, fp, roofs=[GREEN], blocks=[WHITE, STONE])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
