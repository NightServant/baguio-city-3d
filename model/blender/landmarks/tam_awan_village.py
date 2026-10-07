"""tam-awan-village: Tam-awan Village, the Chanum Foundation's reconstructed Cordillera village on a wooded slope:
seven Ifugao huts (a raised room on four posts with round rat-guards, a ladder, and the steep pyramidal cogon
roof hanging low), the two Kalinga houses (one the octagonal binayon), and the village's larger buildings on
their OSM outlines as thatched houses on posts; trees through the village (ready-made CC0 Kenney).
Dimensions: model/landmarks/tam-awan-village.md ([S2] OSM outline and buildings; hut sizes and places are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/tam_awan_village.py"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "tam-awan-village"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1996)             # seeded; the Chanum Foundation began the village in 1996 [S1]

THATCH = lm.textured("MAT_tamawan_thatch", lm.pattern_image("TEX_tamawan_thatch",
                     np.array((0.62, 0.52, 0.34)) * (1 + 0.10 * np.sin(2 * np.pi * 40 * lm._grid()[1] + 3 * np.sin(2 * np.pi * 7 * lm._grid()[0])))[..., None]
                     * (1 + 0.05 * lm._grid()[2])), srgb(158, 132, 88), 0.95)   # [S3] cogon thatch, combed downward
WOOD = lm.material("MAT_tamawan_wood", srgb(86, 62, 44), 0.85)            # [S3] dark weathered timber
GUARD = lm.material("MAT_tamawan_guard", srgb(104, 78, 56), 0.85)
STONE = lm.material("MAT_tamawan_stone", srgb(128, 120, 106), 0.95)      # [S3] stone-paved yards
TREES = lm.FloraMix("forest")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
S = lm.Shapes(coll, 0.0, {THATCH.name: 2.0}, pitch_deg=55.0)
park = fp["rings"][0]
lowest = 0.0


def ground(pts):
    global lowest
    zt, zl = max(lm.rel_ground(fp, pts)), min(lm.rel_ground(fp, pts, low=True)) - 1.0
    lowest = min(lowest, zl)
    return zt, zl


def ifugao_hut(name, cx, cy, half=1.6, heading=0.0):
    """[S3] A bale: four posts with rat-guard discs, a raised room, a ladder, and a steep cogon pyramid that comes
    down to about 1.5 m off the ground and overhangs well past the room."""
    H = lm.Shapes(coll, heading, {THATCH.name: 2.0}, pitch_deg=55.0)
    a0, w0, _ = H.xy(cx, cy, 0)
    zt, zl = ground([(cx + dx, cy + dy) for dx in (-half - 1, half + 1) for dy in (-half - 1, half + 1)])
    H.box(f"{name}_yard", a0 - half - 1.2, a0 + half + 1.2, w0 - half - 1.2, w0 + half + 1.2, zl, zt + 0.05, STONE)
    for da in (-half + 0.3, half - 0.3):
        for dw in (-half + 0.3, half - 0.3):
            H.box(f"{name}_post_{da:+.1f}_{dw:+.1f}", a0 + da - 0.12, a0 + da + 0.12, w0 + dw - 0.12, w0 + dw + 0.12, zt, zt + 1.9, WOOD)
            H.cone(f"{name}_guard_{da:+.1f}_{dw:+.1f}", a0 + da, w0 + dw, 0.32, zt + 1.45, zt + 1.55, GUARD, seg=8)   # rat-guard
    H.box(f"{name}_room", a0 - half + 0.1, a0 + half - 0.1, w0 - half + 0.1, w0 + half - 0.1, zt + 1.9, zt + 3.2, WOOD)
    H.pyramid(f"{name}_roof", a0, w0, half + 1.3, zt + 1.6, zt + 1.6 + (half + 1.3) * math.tan(math.radians(55)), THATCH)
    H.beam(f"{name}_ladder_l", H.P(a0 - 0.35, w0 + half + 1.0, zt), H.P(a0 - 0.35, w0 + half - 0.1, zt + 1.9), 0.05, WOOD)
    H.beam(f"{name}_ladder_r", H.P(a0 + 0.35, w0 + half + 1.0, zt), H.P(a0 + 0.35, w0 + half - 0.1, zt + 1.9), 0.05, WOOD)


def thatched_house(name, ring, octagonal=False):
    """A larger house on posts under a thatched roof: on an OSM outline (hip over its rectangle), or the binayon's
    octagonal cone."""
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    zt, zl = ground(ring)
    if octagonal:
        r = max(math.hypot(x - cx, y - cy) for x, y in ring) * 0.8
        oct_ = [(cx + r * math.cos(math.pi / 8 + k * math.pi / 4), cy + r * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
        for k, (px, py) in enumerate(oct_):
            S.beam(f"{name}_post_{k}", (px, py, zl), (px, py, zt + 1.6), 0.13, WOOD)
        S.prism(f"{name}_room", [(y, x) for x, y in oct_], zt + 1.6, zt + 3.0, WOOD)
        S.cone(f"{name}_roof", cy, cx, r + 1.4, zt + 2.6, zt + 2.6 + (r + 1.4) * 1.2, THATCH, seg=8)
        return
    best = None
    for k in range(len(ring)):                    # the minimum-area rectangle's frame
        (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % len(ring)]
        R = lm.Shapes(coll, math.degrees(math.atan2(x1 - x0, y1 - y0)), {THATCH.name: 2.0}, pitch_deg=50.0)
        aw = [R.xy(x, y, 0)[:2] for x, y in ring]
        box = (min(a for a, w in aw), max(a for a, w in aw), min(w for a, w in aw), max(w for a, w in aw))
        if best is None or (box[1] - box[0]) * (box[3] - box[2]) < best[0]:
            best = ((box[1] - box[0]) * (box[3] - box[2]), R, box)
    _, R, (a0, a1, w0, w1) = best
    for da in np.linspace(a0 + 0.4, a1 - 0.4, 3):
        for dw in (w0 + 0.4, w1 - 0.4):
            R.box(f"{name}_post_{da:.0f}_{dw:.0f}", da - 0.13, da + 0.13, dw - 0.13, dw + 0.13, zl, zt + 1.6, WOOD)
    R.box(f"{name}_room", a0 + 0.3, a1 - 0.3, w0 + 0.3, w1 - 0.3, zt + 1.6, zt + 3.4, WOOD)
    R.hip(f"{name}_roof", a0 - 1.0, a1 + 1.0, w0 - 1.0, w1 + 1.0, zt + 2.9, THATCH)


# [S2] the village's mapped buildings; [S1] two of the houses are Kalinga, one the octagonal binayon (ESTIMATE:
# the smallest mapped outline is taken as the binayon)
blds = json.loads((lm.ROOT / "model" / "data" / "landmarks" / SLUG / "buildings.json").read_text())
area = lambda r: 0.5 * abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(r, r[1:] + r[:1])))
smallest = min(range(len(blds)), key=lambda i: area(blds[i]["ring"]))
for i, b in enumerate(blds):
    thatched_house(f"house_{i}", b["ring"], octagonal=(i == smallest))

# [S1] seven Ifugao huts, at seeded places inside the village, 7 m apart and clear of the mapped houses
centres = [(sum(p[0] for p in b["ring"]) / len(b["ring"]), sum(p[1] for p in b["ring"]) / len(b["ring"])) for b in blds]
huts, tries = [], 0
xs, ys = [p[0] for p in park], [p[1] for p in park]
while len(huts) < 7 and tries < 4000:
    tries += 1
    x, y = rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys))
    if not lm.inside(park, x, y) or min(math.hypot(x - px, y - py) for px, py in park) < 6:
        continue
    if any(math.hypot(x - hx, y - hy) < 7.0 for hx, hy in huts + centres):
        continue
    if centres and min(math.hypot(x - hx, y - hy) for hx, hy in centres) > 45:   # keep the village together
        continue
    huts.append((x, y))
for k, (x, y) in enumerate(huts):
    ifugao_hut(f"hut_{k}", x, y, half=1.6, heading=rng.uniform(0, 90))

# Trees through the village [S3]
n = 0
for gx in np.arange(min(xs), max(xs), 26.0):
    for gy in np.arange(min(ys), max(ys), 26.0):
        x, y = gx + rng.uniform(-9, 9), gy + rng.uniform(-9, 9)
        if not lm.inside(park, x, y) or any(math.hypot(x - hx, y - hy) < 6 for hx, hy in huts + centres):
            continue
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{n:02d}", TREES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.8, 1.15))
        n += 1

hx, hy = huts[0]
lm.human_reference(coll, hx + 3.5, hy)
print("HOUSES", len(blds), "HUTS", len(huts), "TREES", n)
lm.detail(coll, fp, blocks=[STONE])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
