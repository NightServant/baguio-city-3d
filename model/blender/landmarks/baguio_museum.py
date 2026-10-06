"""baguio-museum: the Baguio Museum: dark vertical-plank walls on a stone base under a broad, low grey hip roof
with wide eaves, and the entrance pavilion on the north-west: two tapered rough-stone pillars, the stair up
between them, and the glazed box above with the museum's name band and its own small hip roof. Pines round it
(ready-made CC0 Kenney).
Dimensions: model/landmarks/baguio-museum.md ([S2] OSM outline; heights are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_museum.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-museum"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1975)


def planks(rgb=(0.36, 0.33, 0.30)):            # [S3] dark grey-brown vertical planks
    """Vertical board siding (1 m tile): 6 boards, dark battens, slight per-board tint."""
    Y, X, grain = lm._grid()
    b = X * 6
    batten = np.minimum(b % 1, 1 - b % 1) < 0.06
    tint = 1 + 0.06 * np.sin(np.floor(b) * 12.9898)
    return np.where(batten[..., None], np.array(rgb) * 0.6, np.array(rgb) * (tint * (1 + 0.03 * grain[..., 0]))[..., None])


WALL = lm.textured("MAT_museum_planks", lm.pattern_image("TEX_museum_planks", planks()), srgb(94, 86, 78), 0.85)
ROOF = lm.material("MAT_museum_roof", srgb(150, 150, 140), 0.5)          # [S3] grey-silver metal roof
STONE = lm.material("MAT_museum_stone", srgb(118, 116, 110), 0.95)       # [S3] rough grey stone pillars and base
CREAM = lm.material("MAT_museum_cream", srgb(222, 210, 170), 0.7)        # [S3] the name band and trim
GLASS = lm.material("MAT_museum_glass", srgb(52, 60, 66), 0.3)
STEP = lm.material("MAT_museum_step", srgb(58, 58, 60), 0.8)             # [S3] dark tiled stair
PINES = [lm.asset_mesh("pine_tall_c", 18.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("broadleaf", 11.0, {"leafs": (86, 124, 60), "woodBark": (110, 84, 60)})]
# [S2] the outline's long side runs at bearing 43.5: a north-east, w south-east; the entrance bump is on the
# north-west (-w) side
M = lm.Shapes(coll, 43.5, {WALL.name: 1.0}, pitch_deg=22.0)
ring = fp["rings"][0]
aw = [M.xy(x, y, 0)[:2] for x, y in ring]
body = [p for i, p in enumerate(aw) if i in (0, 5, 6, 7)]       # [S2] the four corners of the main body
A0, A1 = min(a for a, w in body), max(a for a, w in body)
W0, W1 = min(w for a, w in body), max(w for a, w in body)
bump = [p for i, p in enumerate(aw) if i in (1, 2, 3, 4)]       # [S2] the entrance projection
BA0, BA1 = min(a for a, w in bump), max(a for a, w in bump)
BW0 = min(w for a, w in bump)
cA0 = (min(a for a, w in [p for i, p in enumerate(aw) if i in (1, 2, 3, 4)]) + max(a for a, w in [p for i, p in enumerate(aw) if i in (1, 2, 3, 4)])) / 2
zt = max(lm.rel_ground(fp, [M.P(cA0 + da, min(w for a, w in aw) - 2.0, 0)[:2] for da in (-2.0, 0.0, 2.0)]))   # the street at the stair's foot
zb = min(lm.rel_ground(fp, ring, low=True)) - 1.0
z0 = zt + 1.6                                   # the raised floor: the entrance stair climbs about 1.6 m (S3); the
                                                # building's back is cut into the rising ground, as on its real slope
EAVE = z0 + 4.4
M.box("base", A0 + 1.2, A1 - 1.2, W0 + 1.2, W1 - 1.2, zb, z0, STONE)
M.box("walls", A0 + 1.2, A1 - 1.2, W0 + 1.2, W1 - 1.2, z0, EAVE, WALL)
zr = M.hip("roof", A0 - 0.8, A1 + 0.8, W0 - 0.8, W1 + 0.8, EAVE, ROOF)
# the entrance pavilion
cA = (BA0 + BA1) / 2
for side in (-1, 1):                            # tapered rough-stone pillars at the pavilion's front corners
    ca = cA + side * 2.6
    M.hexa(f"pillar_{side}", [(ca - 0.7, BW0 - 0.2, zb), (ca + 0.7, BW0 - 0.2, zb), (ca + 0.7, BW0 + 1.2, zb), (ca - 0.7, BW0 + 1.2, zb)],
           [(ca - 0.4, BW0 + 0.1, EAVE), (ca + 0.4, BW0 + 0.1, EAVE), (ca + 0.4, BW0 + 0.9, EAVE), (ca - 0.4, BW0 + 0.9, EAVE)], STONE)
M.box("pavilion_hall", cA - 2.0, cA + 2.0, BW0 + 1.0, W0 + 1.3, z0, EAVE, GLASS)
for k in range(8):                              # the stair, between the pillars, up to the floor
    M.box(f"stair_{k}", cA - 1.9, cA + 1.9, BW0 - 0.2 - 0.32 * (8 - k), BW0 + 1.0, zb, zt + 0.2 * (k + 1), STEP)
M.box("name_band", cA - 3.3, cA + 3.3, BW0 - 0.3, W0 + 1.3, EAVE, EAVE + 0.7, CREAM)
M.box("upper_glass", cA - 3.1, cA + 3.1, BW0 - 0.1, W0 + 1.3, EAVE + 0.7, EAVE + 2.6, GLASS)
P = lm.Shapes(coll, 43.5, {}, pitch_deg=34.0)
P.hip("upper_roof", cA - 3.8, cA + 3.8, BW0 - 0.8, W0 + 2.2, EAVE + 2.6, ROOF)

n = 0
for a, w in ((A0 - 6, W0 - 4), (A1 + 6, W0 - 2), (A1 + 5, W1 + 5), (A0 - 5, W1 + 4), (cA + 9, BW0 - 7)):
    x, y, _ = M.P(a + rng.uniform(-1.5, 1.5), w + rng.uniform(-1.5, 1.5), 0.0)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    lm.place(coll, f"tree_{n}", PINES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    zb = min(zb, z)
    n += 1

hx, hy, _ = M.P(cA + 3.5, BW0 - 3.0, 0.0)
lm.human_reference(coll, hx, hy)
print("BODY", round(A1 - A0, 1), "x", round(W1 - W0, 1), "FLOOR", round(z0, 2), "RIDGE", round(zr, 2))
lm.detail(coll, fp, roofs=[ROOF], blocks=[STONE])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -zb)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
