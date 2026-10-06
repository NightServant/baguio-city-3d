"""good-shepherd-convent: the Good Shepherd Convent's Mountain Maid Training Center: the white two-storey building
with its green trim and name band, the green-and-white shop canopies along its front, the flowering vertical
garden wall, the white statue of the Good Shepherd on its pedestal, and the view deck over the city; pines
round the hillside (ready-made CC0 Kenney).
Dimensions: model/landmarks/good-shepherd-convent.md ([S2] OSM outline and view deck node; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/good_shepherd_convent.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "good-shepherd-convent"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1961)


def facade(sill):
    """White wall (3.4 m tile = one storey): a green band at the floor line, one 2.4 x 1.4 m window per tile in a
    dark frame; `sill` sets where the window's foot falls (mod 3.4 m)."""
    Y, X, grain = lm._grid()
    v, u = (Y * 3.4 - sill) % 3.4, X * 3.4
    out = np.array((0.95, 0.95, 0.93)) * (1 + 0.01 * grain)
    band = v > 3.15
    win = (np.abs(u - 1.7) < 1.2) & (v > 0.9) & (v < 2.3)
    mull = win & ((np.abs(u - 1.7) > 1.12) | (v < 0.98) | (v > 2.22) | (np.abs(u - 1.3) < 0.03) | (np.abs(u - 2.1) < 0.03))
    out = np.where(win[..., None], np.array((0.30, 0.36, 0.40)), out)
    out = np.where(mull[..., None], np.array((0.55, 0.52, 0.48)), out)
    return np.where(band[..., None], np.array((0.16, 0.42, 0.26)), out)


GREEN = lm.material("MAT_shepherd_green", srgb(40, 110, 66), 0.6)          # [S3] green roof trim and canopies
WHITE = lm.material("MAT_shepherd_white", srgb(240, 240, 236), 0.7)
CREAM = lm.material("MAT_shepherd_cream", srgb(232, 222, 196), 0.7)        # [S3] the name band
LEAF = lm.material("MAT_shepherd_leaf", srgb(54, 96, 46), 0.9)             # [S3] the planted wall
BLOOM = lm.material("MAT_shepherd_bloom", srgb(214, 72, 108), 0.8)
PAVE = lm.material("MAT_shepherd_pave", srgb(178, 172, 160), 0.9)
PINES = [lm.asset_mesh("pine_tall_c", 20.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("broadleaf", 11.0, {"leafs": (80, 118, 58), "woodBark": (110, 84, 60)})]
B = lm.Shapes(coll, 140.3, {}, pitch_deg=12.0)   # [S2] the outline's long side runs at 140.3 deg; +w faces south-west
ring = fp["rings"][0]
zt = max(lm.rel_ground(fp, ring))
zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
z0 = max(lm.rel_ground(fp, [B.P(a, 14.0, 0)[:2] for a in (-10.5, -4.5, 1.5)])) + 0.2   # the shop front's level; the uphill
                                                  # back is cut into the slope, the downhill end shows a lower level
EAVE = z0 + 6.8                                   # two 3.4 m storeys (ESTIMATE, S3)
WALL = lm.textured("MAT_shepherd_wall", lm.pattern_image("TEX_shepherd_wall", facade(z0 % 3.4)), srgb(236, 236, 232), 0.8)
B.tile[WALL.name] = 3.4
B.prism("walls", [B.xy(x, y, 0)[:2] for x, y in ring], zl, EAVE, WALL, tessellate=True)
for i, (a0, a1, w0, w1) in enumerate(((-15.0, 8.8, -10.9, 12.9), (8.8, 14.4, -10.9, 5.6), (14.4, 19.5, -10.9, -4.1))):
    B.hip(f"roof_{i}", a0 - 0.4, a1 + 0.4, w0 - 0.4, w1 + 0.4, EAVE, GREEN)            # [S3] low green roofs
B.box("name_band", -12.0, 6.0, 12.9, 13.1, z0 + 3.5, z0 + 4.1, CREAM)                         # "MOUNTAIN MAID TRAINING CENTER"
for k, ca in enumerate((-10.5, -4.5, 1.5)):                                                     # shop canopies along the front
    B.gable_along_a(f"canopy_{k}", ca - 2.8, ca + 2.8, 13.1, 16.4, z0 + 2.7, GREEN)
    for cw in (16.2,):
        for da in (-2.6, 2.6):
            B.box(f"canopy_post_{k}_{da:+.0f}", ca + da - 0.06, ca + da + 0.06, cw - 0.06, cw + 0.06, z0, z0 + 2.7, WHITE)
fz = max(lm.rel_ground(fp, [B.P(-15.0 - d, w, 0)[:2] for d in (2.0, 3.0) for w in (13.0, 25.0)])) + 0.1
B.box("garden_wall", -18.6, -17.8, 13.0, 25.0, zl, fz + 5.0, LEAF)                              # [S3] the planted wall
for k in range(24):
    bw, bz = 13.4 + rng.uniform(0, 11.2), fz + rng.uniform(0.4, 4.6)
    B.box(f"bloom_{k:02d}", -17.6, -17.45, bw - 0.25, bw + 0.25, bz - 0.2, bz + 0.2, BLOOM)

# The Good Shepherd [S3]: a white robed figure with a crook on a white pedestal, in the garden by the deck
SA, SW = 22.0, 12.0
zs = max(lm.rel_ground(fp, [B.P(SA + da, SW + dw, 0)[:2] for da in (-1, 1) for dw in (-1, 1)])) + 0.1
B.box("statue_base", SA - 0.7, SA + 0.7, SW - 0.7, SW + 0.7, zl, zs + 1.1, WHITE)
B.hexa("statue_robe", [(SA - 0.45, SW - 0.35, zs + 1.1), (SA + 0.45, SW - 0.35, zs + 1.1), (SA + 0.45, SW + 0.35, zs + 1.1), (SA - 0.45, SW + 0.35, zs + 1.1)],
       [(SA - 0.25, SW - 0.2, zs + 2.9), (SA + 0.25, SW - 0.2, zs + 2.9), (SA + 0.25, SW + 0.2, zs + 2.9), (SA - 0.25, SW + 0.2, zs + 2.9)], WHITE)
B.box("statue_head", SA - 0.14, SA + 0.14, SW - 0.14, SW + 0.14, zs + 2.9, zs + 3.25, WHITE)
B.beam("statue_crook", B.P(SA - 0.55, SW + 0.25, zs + 1.1), B.P(SA - 0.55, SW + 0.25, zs + 3.5), 0.04, WHITE)
B.beam("statue_crook_hook", B.P(SA - 0.55, SW + 0.25, zs + 3.5), B.P(SA - 0.3, SW + 0.25, zs + 3.3), 0.04, WHITE)

# The view deck [S2] node/1252077236: a paved platform over the slope with a white rail
DA, DW = 28.0, 20.2
deck = [B.P(DA + da, DW + dw, 0)[:2] for da, dw in ((-4, -2.5), (4, -2.5), (4, 2.5), (-4, 2.5))]
zd = max(lm.rel_ground(fp, deck)) + 0.15
B.box("deck", DA - 4, DA + 4, DW - 2.5, DW + 2.5, min(lm.rel_ground(fp, deck, low=True)) - 1.0, zd, PAVE)
for k, (p0, p1) in enumerate((((DA - 4, DW + 2.5), (DA + 4, DW + 2.5)), ((DA + 4, DW - 2.5), (DA + 4, DW + 2.5)))):
    B.beam(f"deck_rail_{k}", B.P(*p0, zd + 1.0), B.P(*p1, zd + 1.0), 0.04, WHITE)
    for t in np.linspace(0, 1, 5):
        pa, pw = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        B.beam(f"deck_post_{k}_{t:.2f}", B.P(pa, pw, zd), B.P(pa, pw, zd + 1.0), 0.04, WHITE)

n = 0
for a, w in ((-22.0, -16.0), (-20.0, 4.0), (0.0, -17.0), (24.0, -12.0), (30.0, 2.0), (16.0, 22.0), (34.0, 26.0), (-8.0, 22.0)):
    x, y, _ = B.P(a + rng.uniform(-2, 2), w + rng.uniform(-2, 2), 0.0)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    zl = min(zl, z)
    lm.place(coll, f"tree_{n}", PINES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

hx, hy, _ = B.P(-6.0, 18.0, 0.0)
lm.human_reference(coll, hx, hy)
print("FLOOR", round(z0, 2), "DECK", round(zd, 2))
lm.detail(coll, fp, roofs=[GREEN])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -zl)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
