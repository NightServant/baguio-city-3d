"""burnham-park: Burnham Lake, its water surface, concrete rim and rental rowboats.
Dimensions: model/landmarks/burnham-park.md ([S2] OSM outline; water level, rim and boats are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/burnham_park.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402
from terrain_sample import terrain_z  # noqa: E402

SLUG = "burnham-park"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb


def ripples(rgb=(0.282, 0.408, 0.392)):
    """Lake surface: soft crossing ripples and grain (1 tile = 4 m)."""
    Y, X, grain = lm._grid()
    wave = 0.5 * np.sin(2 * np.pi * (3 * X + 2 * Y)) + 0.5 * np.sin(2 * np.pi * (5 * X - 3 * Y))
    return np.array(rgb) * ((1 + 0.045 * wave)[..., None] * (1 + 0.03 * grain))


WATER = lm.textured("MAT_burnham_water", lm.pattern_image("TEX_burnham_water", ripples()), srgb(72, 104, 100), 0.15)
RIM = lm.textured("MAT_burnham_rim", lm.pattern_image("TEX_burnham_rim", lm.wall_blocks((0.62, 0.62, 0.60))), srgb(158, 158, 153), 0.9)
BED = lm.material("MAT_burnham_bed", srgb(84, 80, 72), 0.95)
HULLS = [lm.material(f"MAT_burnham_boat_{k}", srgb(*c), 0.6) for k, c in enumerate(
    ((196, 52, 44), (52, 92, 170), (226, 190, 60), (236, 236, 232), (220, 120, 50)))]   # ESTIMATE fleet colours
SEAT = lm.material("MAT_burnham_seat", srgb(120, 90, 60), 0.8)
S = lm.Shapes(coll, 0.0, {WATER.name: 4.0, RIM.name: 2.0})   # bearing 0: a = north (y), w = east (x)

ring = fp["rings"][0]                       # local metres around the lake's centroid, CCW
ax, ay = fp["anchor_tm"]
zs = terrain_z([(ax + x, ay + y) for x, y in ring] + [(ax, ay)])
ground = zs[-1]
water = max(zs[:-1]) - ground + 0.3         # ESTIMATE: 0.3 m above the highest terrain under the lake
depth = lm.foundation(coll, fp, BED)

S.prism("lake_water", [(y, x) for x, y in ring], water - 0.2, water, WATER)

# Rim: one concrete segment per shore edge, 1.2 m wide outward, overlapping 0.6 m at each end
for i in range(len(ring)):
    (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % len(ring)]
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 0.5:
        continue
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = dy, -dx                        # outward for a CCW ring
    a0x, a0y, a1x, a1y = x0 - dx * 0.6, y0 - dy * 0.6, x1 + dx * 0.6, y1 + dy * 0.6
    quad = [(a0x, a0y), (a1x, a1y), (a1x + nx * 1.2, a1y + ny * 1.2), (a0x + nx * 1.2, a0y + ny * 1.2)]
    S.hexa(f"rim_{i:02d}", [(y, x, -depth) for x, y in quad], [(y, x, water + 0.6) for x, y in quad], RIM)


def inside(px, py):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


rng = np.random.default_rng(1925)           # seeded; the park's founding year [S1]
xs, ys = [p[0] for p in ring], [p[1] for p in ring]
boats = 0
while boats < 14:
    bx, by = rng.uniform(min(xs) + 8, max(xs) - 8), rng.uniform(min(ys) + 8, max(ys) - 8)
    heading = rng.uniform(0, math.pi)
    if not all(inside(bx + 6 * math.cos(t), by + 6 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 8, endpoint=False)):
        continue
    c, s = math.cos(heading), math.sin(heading)
    corner = lambda l, w, z: (by + l * s + w * c, bx + l * c - w * s, z)   # boat-frame (length, width) -> (a, w, z)
    lo = [corner(-1.3, -0.5, water - 0.1), corner(1.3, -0.5, water - 0.1), corner(1.3, 0.5, water - 0.1), corner(-1.3, 0.5, water - 0.1)]
    hi = [corner(-1.5, -0.65, water + 0.45), corner(1.5, -0.65, water + 0.45), corner(1.5, 0.65, water + 0.45), corner(-1.5, 0.65, water + 0.45)]
    S.hexa(f"boat_{boats:02d}", lo, hi, HULLS[boats % len(HULLS)])
    S.hexa(f"boat_{boats:02d}_seat", [corner(-0.15, -0.6, water + 0.3), corner(0.15, -0.6, water + 0.3), corner(0.15, 0.6, water + 0.3), corner(-0.15, 0.6, water + 0.3)],
           [corner(-0.15, -0.6, water + 0.42), corner(0.15, -0.6, water + 0.42), corner(0.15, 0.6, water + 0.42), corner(-0.15, 0.6, water + 0.42)], SEAT)
    boats += 1

lm.human_reference(coll, ring[0][0] * 1.08, ring[0][1] * 1.08)
print("WATER", round(water, 2), "m above the centroid's ground")
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
