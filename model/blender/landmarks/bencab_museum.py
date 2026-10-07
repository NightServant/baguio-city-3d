"""bencab-museum: the BenCab Museum on Asin Road: the dark slate-clad building stepping down the hillside on its OSM
outline, with its glazed bands, the white roof slabs, the white cantilevered entrance canopy toward the road and
the red "bencab" sign; pines on the slope (ready-made CC0 Kenney).
Dimensions: model/landmarks/bencab-museum.md ([S2] OSM outline and road; heights are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/bencab_museum.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "bencab-museum"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(2009)


def slate(band):
    """Dark slate cladding (3.4 m tile = one level): 0.6 x 0.3 m stones in running bond, and a 1 m glazed band with
    mullions every 1.2 m whose foot is `band` m up the tile (mod 3.4)."""
    Y, X, grain = lm._grid()
    v, u = (Y * 3.4 - band) % 3.4, X * 3.4
    row = np.floor(Y * 3.4 / 0.3)
    bx = (u / 0.6 + (row % 2) * 0.5) % 1
    joint = (np.minimum(bx, 1 - bx) < 0.03) | (np.minimum((Y * 3.4 / 0.3) % 1, 1 - (Y * 3.4 / 0.3) % 1) < 0.05)
    tint = 1 + 0.10 * np.sin(np.floor(u / 0.6 + (row % 2) * 0.5) * 12.9898 + row * 78.233)
    out = np.where(joint[..., None], np.array((0.14, 0.14, 0.15)), np.array((0.26, 0.26, 0.27)) * (tint * (1 + 0.04 * grain[..., 0]))[..., None])
    glass = (v < 1.0) & (np.minimum((u / 1.2) % 1, 1 - (u / 1.2) % 1) > 0.03)
    return np.where(glass[..., None], np.array((0.42, 0.48, 0.50)), out)


WHITE = lm.material("MAT_bencab_white", srgb(240, 240, 236), 0.6)        # [S3] white roof slabs and canopy
RED = lm.material("MAT_bencab_red", srgb(214, 32, 48), 0.5)              # [S3] the "bencab" sign
PINES = lm.FloraMix("forest")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
S = lm.Shapes(coll, 0.0, {})
ring = fp["rings"][0]
# [S2] Asin Road runs past the north side; the building steps down the slope away from it
ROAD_SIDE = [(-5.3, 27.6), (0.5, 22.7), (3.8, 21.2), (12.1, 14.1)]
zr = max(lm.rel_ground(fp, ROAD_SIDE))                 # the street level at the entrance
zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
TOP = zr + 7.0                                         # ESTIMATE: two levels above the street (S3)
WALL = lm.textured("MAT_bencab_slate", lm.pattern_image("TEX_bencab_slate", slate((zr + 4.4) % 3.4)), srgb(66, 66, 68), 0.8)
S.tile = {WALL.name: 3.4}


def clip(poly, nx, ny, d, keep_below=True):
    """Sutherland-Hodgman: the part of `poly` with n.p <= d (or >= d)."""
    out = []
    f = (lambda p: d - (nx * p[0] + ny * p[1])) if keep_below else (lambda p: (nx * p[0] + ny * p[1]) - d)
    for p, q in zip(poly, poly[1:] + poly[:1]):
        fp_, fq = f(p), f(q)
        if fp_ >= 0:
            out.append(p)
        if (fp_ >= 0) != (fq >= 0):
            t = fp_ / (fp_ - fq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


# [S1, S3] the museum steps down the hillside: 8 m strips across the slope (away from the road, bearing 220),
# each with two levels above its own highest ground, never above the street-side roof
NX, NY = math.sin(math.radians(220)), math.cos(math.radians(220))
proj = [NX * x + NY * y for x, y in ring]
for k, d0 in enumerate(np.arange(min(proj), max(proj), 8.0)):
    strip = clip(clip(ring, NX, NY, d0, keep_below=False), NX, NY, d0 + 8.0)
    if len(strip) < 3:
        continue
    top = min(TOP, max(lm.rel_ground(fp, strip)) + 7.0)
    S.prism(f"body_{k}", [(y, x) for x, y in strip], zl, top, WALL, tessellate=True)
    S.prism(f"roof_{k}", [(y, x) for x, y in strip], top, top + 0.45, WHITE, tessellate=True)
# the white cantilevered canopy over the entrance, reaching toward the road [S3]
C = lm.Shapes(coll, 130.0, {})                         # along the entrance face; -w is out toward the road
(x0, y0), (x1, y1) = ROAD_SIDE[0], ROAD_SIDE[1]
ca, cw, _ = C.xy((x0 + x1) / 2, (y0 + y1) / 2, 0)
C.box("canopy", ca - 3.5, ca + 3.5, cw - 3.2, cw + 0.2, zr + 3.0, zr + 3.4, WHITE)
C.box("upper_slab", ca - 6.0, ca + 2.0, cw - 1.8, cw + 0.2, TOP - 0.2, TOP + 0.45, WHITE)        # [S3] the upper cantilever
sa, sw, _ = C.xy(8.0, 17.6, 0)                         # the sign on the road face's eastern part
C.box("sign", sa - 2.0, sa + 2.0, sw - 0.15, sw - 0.05, zr + 4.4, zr + 5.4, RED)

n = 0
for t in np.linspace(0, 2 * math.pi, 9, endpoint=False):
    x, y = 26.0 * math.cos(t) + rng.uniform(-3, 3), 26.0 * math.sin(t) + rng.uniform(-3, 3) - 4.0
    if y > 24.0:                                       # keep the road side clear
        continue
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    zl = min(zl, z)
    lm.place(coll, f"tree_{n}", PINES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

lm.human_reference(coll, -2.0, 30.0)
print("STREET", round(zr, 2), "LOWEST", round(zl, 2))
lm.report(SLUG, coll, -zl)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
