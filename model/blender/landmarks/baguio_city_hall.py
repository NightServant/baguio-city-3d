"""baguio-city-hall: Baguio City Hall: the white two-storey building on its OSM outline with dark-green window
bands and dark-green hip roofs, the tall four-column portico with its pediment and front stair, and the white
clock tower with its pyramidal cap; pines round it (ready-made CC0 Kenney).
Dimensions: model/landmarks/baguio-city-hall.md ([S2] OSM outline; heights are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_city_hall.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-city-hall"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1909)             # seeded; the city's charter year


def facade(sill):
    """White wall (3.6 m tile = one storey): a dark-green band at the floor line and one 2.2 x 2.0 m window with
    a dark-green frame and mullions per tile; `sill` sets where the window's foot falls (mod 3.6 m)."""
    Y, X, grain = lm._grid()
    v, u = (Y * 3.6 - sill) % 3.6, X * 3.6
    out = np.array((0.94, 0.94, 0.92)) * (1 + 0.01 * grain)
    band = (v > 3.25) & (v < 3.45)
    win = (np.abs(u - 1.8) < 1.1) & (v > 0.6) & (v < 2.6)
    frame = win & ((np.abs(u - 1.8) > 1.0) | (v < 0.7) | (v > 2.5) | (np.abs(u - 1.8) < 0.04) | (np.abs(v - 1.9) < 0.04))
    out = np.where(win[..., None], np.array((0.20, 0.24, 0.26)), out)
    out = np.where((frame | band)[..., None], np.array((0.12, 0.30, 0.22)), out)
    return out


ROOF = lm.material("MAT_cityhall_roof", srgb(40, 84, 62), 0.6)          # [S3] dark-green roofs
WHITE = lm.material("MAT_cityhall_white", srgb(240, 240, 236), 0.7)
STEP = lm.material("MAT_cityhall_steps", srgb(200, 196, 188), 0.9)
CLOCK = lm.material("MAT_cityhall_clock", srgb(36, 40, 44), 0.5)
PINES = lm.FloraMix("park")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
# [S2] the outline's sides run at 45 / 135 deg: a along the building (north-east), w across; the portico's
# projection is on the -w side, so the front faces north-west
B = lm.Shapes(coll, 45.0, {}, pitch_deg=20.0)   # [S3] low hips
ring = fp["rings"][0]
z_hi = max(lm.rel_ground(fp, ring))
z_lo = min(lm.rel_ground(fp, ring, low=True))
z0 = z_hi + 0.3                               # ground floor (ESTIMATE): clear of the map terrain everywhere
zl = z_lo - 1.0
EAVE = z0 + 7.2                               # two 3.6 m storeys
WALL = lm.textured("MAT_cityhall_wall", lm.pattern_image("TEX_cityhall_wall", facade(z0 % 3.6)), srgb(232, 232, 228), 0.8)
B.tile[WALL.name] = 3.6
B.prism("walls", [B.xy(x, y, 0)[:2] for x, y in ring], zl, EAVE, WALL, tessellate=True)
# Hip roofs over the outline's rectangles (a0, a1, w0, w1), read off S2 in this frame
for i, r in enumerate(((-19.1, 38.5, -9.6, 13.9), (38.5, 59.7, -19.2, 20.0), (-62.0, -19.0, -19.0, 5.5), (-69.2, -62.0, -7.0, 4.0),
                       (-37.3, -19.0, 5.5, 20.3), (1.6, 15.9, 13.9, 20.3), (1.6, 15.9, -14.8, -9.6))):
    a0, a1, w0, w1 = r
    B.hip(f"roof_{i}", a0 - 0.5, a1 + 0.5, w0 - 0.5, w1 + 0.5, EAVE, ROOF)

# The portico [S3]: four tall square columns, a pediment-fronted gable running back into the front block,
# and the broad stair down to the forecourt
PA0, PA1, PW = 5.7, 11.6, -19.3
P = lm.Shapes(coll, 135.0, {}, pitch_deg=22.0)  # a turned frame: its a is B's w, its w is B's -a
TOP = EAVE + 2.0
DEEP = 3.0                                      # the loggia's depth in front of the wall (ESTIMATE, S3)
for k, ca in enumerate(np.linspace(PA0 + 0.4, PA1 - 0.4, 4)):
    B.box(f"column_{k}", ca - 0.35, ca + 0.35, PW - DEEP, PW - DEEP + 0.7, z0 + 1.2, TOP, WHITE)
B.box("loggia_shade", PA0 + 0.2, PA1 - 0.2, PW - 0.05, PW + 0.02, z0 + 1.2, TOP - 0.8, CLOCK)   # the shaded wall behind
B.box("portico_floor", PA0, PA1, PW - DEEP, PW, zl, z0 + 1.2, STEP)
_, zr = P.gable_along_a("portico_roof", PW - DEEP - 0.4, -9.6, -PA1 - 0.4, -PA0 + 0.4, TOP, ROOF)   # ridge front to back
P.gable_wall("pediment", PW - DEEP - 0.3, PW - DEEP, -PA1 - 0.2, -PA0 + 0.2, TOP, zr - 0.25, WHITE)
B.box("entablature", PA0 - 0.3, PA1 + 0.3, PW - DEEP - 0.3, -14.8, TOP - 0.8, TOP, WHITE)
for k in range(6):                              # the front stair, 0.2 m risers out from the portico
    B.box(f"stair_{k}", PA0 - 1.5, PA1 + 1.5, PW - DEEP - 0.7 * (k + 1), PW - DEEP - 0.7 * k, zl, z0 + 1.2 - 0.2 * k, STEP)

# The clock tower [S3]: a white square shaft above the front block, a smaller upper stage with the clock on its
# front, and a pyramidal cap with a finial
TA, TW = (PA0 + PA1) / 2, -12.0
B.box("tower", TA - 2.3, TA + 2.3, TW - 2.3, TW + 2.3, EAVE, EAVE + 6.5, WHITE)
B.box("tower_cornice", TA - 2.6, TA + 2.6, TW - 2.6, TW + 2.6, EAVE + 6.5, EAVE + 6.9, WHITE)
B.box("tower_upper", TA - 1.7, TA + 1.7, TW - 1.7, TW + 1.7, EAVE + 6.9, EAVE + 10.2, WHITE)
B.disc("clock", "w", TW - 1.7, TA, EAVE + 8.6, 0.9, -0.08, CLOCK)
B.pyramid("tower_cap", TA, TW, 2.0, EAVE + 10.2, EAVE + 12.4, WHITE)
B.beam("finial", B.P(TA, TW, EAVE + 12.3), B.P(TA, TW, EAVE + 13.6), 0.06, CLOCK)

n = 0
for a, w in ((-30.0, -27.0), (-50.0, -27.0), (25.0, -18.0), (50.0, -27.0), (-10.0, 26.0), (25.0, 27.0), (-60.0, 14.0), (65.0, 0.0)):
    x, y, _ = B.P(a + rng.uniform(-2, 2), w + rng.uniform(-2, 2), 0.0)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    lm.place(coll, f"tree_{n}", PINES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    zl = min(zl, z)
    n += 1

hx, hy, _ = B.P(TA, PW - DEEP - 6.0, 0.0)
lm.human_reference(coll, hx, hy)
print("FLOOR", round(z0, 2), "EAVE", round(EAVE, 2), "terrain span", round(z_hi - z_lo, 2))
lm.detail(coll, fp, roofs=[ROOF], blocks=[STEP])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -zl)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
