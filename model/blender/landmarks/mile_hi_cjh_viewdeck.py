"""mile-hi-cjh-viewdeck: the Mile Hi Center in Camp John Hay, the former US commissary turned shopping arcade
(reopened 2025): the long, single-storey U of shops on its OSM outline, cream wooden shopfronts, rust-red hip
roofs over its three arms, the covered walkway along the parking side with its dark-green fascia and shop
signs, a stone-walled flower bed, and pines (ready-made CC0 Kenney).
Dimensions: model/landmarks/mile-hi-cjh-viewdeck.md ([S2] OSM outline and parking; heights are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/mile_hi_cjh_viewdeck.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "mile-hi-cjh-viewdeck"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1958)


def shopfront(sill):
    """Cream vertical boarding (4 m tile = one storey): a dark glazed shopfront 2.6 m wide and 2.2 m tall per 4 m bay,
    its foot `sill` m up the tile (mod 4)."""
    Y, X, grain = lm._grid()
    v, u = (Y * 4 - sill) % 4.0, X * 4
    board = np.minimum((u / 0.15) % 1, 1 - (u / 0.15) % 1) < 0.08
    out = np.array((0.86, 0.78, 0.62)) * np.where(board, 0.88, 1.0)[..., None] * (1 + 0.02 * grain)
    glass = (np.abs(u - 2.0) < 1.3) & (v > 0.2) & (v < 2.4)
    frame = glass & ((np.abs(u - 2.0) > 1.2) | (v < 0.28) | (np.abs(u - 2.0) < 0.04))
    out = np.where(glass[..., None], np.array((0.20, 0.17, 0.14)), out)
    return np.where(frame[..., None], np.array((0.30, 0.22, 0.16)), out)


ROOF = lm.material("MAT_milehi_roof", srgb(140, 74, 54), 0.6)            # [S3] rust-red roofs
GREEN = lm.material("MAT_milehi_green", srgb(28, 90, 62), 0.6)           # [S3] dark-green fascia and signs
POST = lm.material("MAT_milehi_post", srgb(238, 234, 222), 0.7)          # [S3] white posts
SIGNS = [lm.material(f"MAT_milehi_sign_{i}", srgb(*c), 0.6) for i, c in enumerate(((232, 228, 214), (28, 90, 62), (60, 60, 64), (196, 140, 60)))]
STONE = lm.material("MAT_milehi_stone", srgb(150, 144, 132), 0.95)
FLOWER = lm.material("MAT_milehi_flower", srgb(206, 40, 44), 0.8)        # [S3] red flowers
PINES = lm.FloraMix("forest")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
S = lm.Shapes(coll, 0.0, {})
ring = fp["rings"][0]
zt = max(lm.rel_ground(fp, ring))
zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
INNER = [(23.9, 77.6), (-0.7, 20.6), (-6.3, -31.6), (38.9, -48.3)]      # [S2] the shopfronts face the parking
WALL = lm.textured("MAT_milehi_wall", lm.pattern_image("TEX_milehi_wall", shopfront(0.0)), srgb(208, 188, 150), 0.8)

# [S2] the outline is three arms (quads); each is cut into ~16 m segments along its length that step down the
# slope, so the arcade stays one storey above its own ground (a single level read as three storeys downhill)
ARMS = [[(8.5, 84.2), (-16.9, 25.6), (-0.7, 20.6), (23.9, 77.6)], [(-16.9, 25.6), (-26.2, -42.5), (-6.3, -31.6), (-0.7, 20.6)],
        [(-26.2, -42.5), (34.2, -65.7), (38.9, -48.3), (-6.3, -31.6)]]
seg_n = 0
for i, arm in enumerate(ARMS):
    best = None
    for k in range(4):
        (x0, y0), (x1, y1) = arm[k], arm[(k + 1) % 4]
        R = lm.Shapes(coll, math.degrees(math.atan2(x1 - x0, y1 - y0)), {WALL.name: 4.0}, pitch_deg=20.0)
        aw = [R.xy(x, y, 0)[:2] for x, y in arm]
        box = (min(a for a, w in aw), max(a for a, w in aw), min(w for a, w in aw), max(w for a, w in aw))
        if best is None or (box[1] - box[0]) * (box[3] - box[2]) < best[0]:
            best = ((box[1] - box[0]) * (box[3] - box[2]), R, box)
    _, R, (A0, A1, W0, W1) = best
    if (A1 - A0) < (W1 - W0):                     # make a the arm's length
        R = lm.Shapes(coll, math.degrees(math.atan2(*R.U)) + 90.0, {WALL.name: 4.0}, pitch_deg=20.0)
        aw = [R.xy(x, y, 0)[:2] for x, y in arm]
        A0, A1, W0, W1 = min(a for a, w in aw), max(a for a, w in aw), min(w for a, w in aw), max(w for a, w in aw)
    (ix0, iy0), (ix1, iy1) = INNER[i], INNER[i + 1]
    wi = (R.xy(ix0, iy0, 0)[1] + R.xy(ix1, iy1, 0)[1]) / 2
    side = 1 if abs(wi - W1) < abs(wi - W0) else -1   # the parking side
    wf = W1 if side > 0 else W0                       # the shopfront line
    n = max(1, math.ceil((A1 - A0) / 16.0))
    for k in range(n):
        a0, a1 = A0 + (A1 - A0) * k / n, A0 + (A1 - A0) * (k + 1) / n
        pts = [R.P(a, w, 0)[:2] for a in (a0, a1) for w in (W0, W1, wf + side * 3.0)]
        z0 = max(lm.rel_ground(fp, pts)) + 0.3        # the segment's floor (ESTIMATE)
        zb = min(lm.rel_ground(fp, pts, low=True)) - 1.0
        zl = min(zl, zb)
        eave = z0 + 4.0                               # one storey (S3)
        R.box(f"plinth_{seg_n:02d}", a0, a1, W0, W1, zb, z0, STONE)
        R.box(f"shops_{seg_n:02d}", a0, a1, W0, W1, z0, eave, WALL)
        R.hip(f"roof_{seg_n:02d}", a0 - 0.4, a1 + 0.4, W0 - 0.6, W1 + 0.6, eave, ROOF)
        wo = wf + side * 3.0                          # the walkway's outer edge
        R.box(f"walk_{seg_n:02d}", a0, a1, *sorted((wf, wo)), zb, z0, STONE)
        R.mesh(f"walk_roof_{seg_n:02d}", [(a0, wf, eave - 0.4), (a1, wf, eave - 0.4), (a1, wo, eave - 0.9), (a0, wo, eave - 0.9),
                                          (a0, wf, eave - 0.25), (a1, wf, eave - 0.25), (a1, wo, eave - 0.75), (a0, wo, eave - 0.75)],
               [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], ROOF)
        R.box(f"fascia_{seg_n:02d}", a0, a1, wo - 0.08, wo + 0.08, eave - 1.6, eave - 0.75, GREEN)
        for t in np.arange(a0 + 0.5, a1, 3.5):
            R.box(f"post_{seg_n:02d}_{t:05.1f}", t - 0.1, t + 0.1, wo - side * 0.3 - 0.1, wo - side * 0.3 + 0.1, z0, eave - 0.9, POST)
        sw = (wo + 0.08, wo + 0.16) if side > 0 else (wo - 0.16, wo - 0.08)
        for t in np.arange(a0 + 1.0, a1 - 3.0, 7.0):  # shop signs on the fascia, varied [S3]
            R.box(f"sign_{seg_n:02d}_{t:05.1f}", t, t + 2.8, *sw, eave - 1.5, eave - 0.85, SIGNS[int(rng.integers(len(SIGNS)))])
        seg_n += 1

# The stone-walled flower bed by the road [S3]
FX, FY = 14.0, -22.0
zf = max(lm.rel_ground(fp, [(FX + dx, FY + dy) for dx in (-3, 3) for dy in (-3, 3)])) + 0.1   # on its own ground
bed = [(FY + 3.0 * math.sin(2 * math.pi * k / 10), FX + 3.0 * math.cos(2 * math.pi * k / 10)) for k in range(10)]
S.prism("bed_wall", bed, zl, zf + 0.7, STONE)
S.prism("bed_flowers", [(FY + 2.6 * math.sin(2 * math.pi * k / 10), FX + 2.6 * math.cos(2 * math.pi * k / 10)) for k in range(10)], zf + 0.7, zf + 1.1, FLOWER)

n = 0
for x, y in ((-30.0, 60.0), (-40.0, 10.0), (-45.0, -30.0), (-30.0, -70.0), (10.0, -85.0), (50.0, -70.0), (30.0, 100.0), (-10.0, 95.0), (45.0, 40.0)):
    x, y = x + rng.uniform(-4, 4), y + rng.uniform(-4, 4)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    zl = min(zl, z)
    lm.place(coll, f"tree_{n}", PINES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

lm.human_reference(coll, 8.0, 0.0)
print("SEGMENTS", seg_n)
lm.detail(coll, fp, roofs=[ROOF])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -zl)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
