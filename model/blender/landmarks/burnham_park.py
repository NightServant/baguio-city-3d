"""burnham-park: Burnham Lake: water, concrete rim, rental boats (swans, pedal boats, rowboats), the
green-roofed rental stalls on the north shore, the blue-roofed pavilion, and the ring of trees
(ready-made CC0 Kenney pines, broadleaf trees and rowboats).
Dimensions: model/landmarks/burnham-park.md ([S2] OSM outline; water level, rim and boats are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/burnham_park.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "burnham-park"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb


def ripples(rgb=(0.10, 0.47, 0.50)):   # [S5] turquoise-teal
    """Lake surface: soft crossing ripples and grain (1 tile = 4 m)."""
    Y, X, grain = lm._grid()
    wave = 0.5 * np.sin(2 * np.pi * (3 * X + 2 * Y)) + 0.5 * np.sin(2 * np.pi * (5 * X - 3 * Y))
    return np.array(rgb) * ((1 + 0.045 * wave)[..., None] * (1 + 0.03 * grain))


WATER = lm.textured("MAT_burnham_water", lm.pattern_image("TEX_burnham_water", ripples()), srgb(26, 120, 128), 0.15)
RIM = lm.textured("MAT_burnham_rim", lm.pattern_image("TEX_burnham_rim", lm.wall_blocks((0.62, 0.62, 0.60))), srgb(158, 158, 153), 0.9)
BED = lm.material("MAT_burnham_bed", srgb(84, 80, 72), 0.95)
SWAN = lm.material("MAT_burnham_swan", srgb(240, 240, 236), 0.6)          # [S5] white swan boats
BEAK = lm.material("MAT_burnham_beak", srgb(230, 120, 40), 0.6)
PEDAL = lm.material("MAT_burnham_pedal", srgb(236, 196, 40), 0.6)        # [S5] yellow pedal boats
CANOPY = lm.material("MAT_burnham_canopy", srgb(210, 60, 40), 0.7)       # [S5] their red-orange canopies
STALL_ROOF = lm.material("MAT_burnham_stall_roof", srgb(40, 150, 120), 0.6)   # [S5] green-roofed rental stalls
PAVILION_ROOF = lm.material("MAT_burnham_pavilion_roof", srgb(50, 90, 170), 0.6)  # [S5] blue-roofed pavilion
POST = lm.material("MAT_burnham_post", srgb(200, 200, 194), 0.8)
# Ready-made CC0 assets (Kenney kits, model/sources.json), recoloured toward S5's greens
PINES = [lm.asset_mesh("pine_tall_c", 18.0, {"leafs": (58, 92, 56), "woodBark": (92, 70, 54)}),
         lm.asset_mesh("pine_tall_a", 15.0, {"leafs": (52, 86, 52), "woodBark": (92, 70, 54)})]
BROADLEAF = lm.asset_mesh("broadleaf", 11.0, {"leafs": (88, 122, 60), "woodBark": (110, 84, 60)})
ROWBOAT = lm.asset_mesh("rowboat", 0.7)    # Kenney wooden rowboat, about 2.6 m long at this height
S = lm.Shapes(coll, 0.0, {WATER.name: 4.0, RIM.name: 2.0})   # bearing 0: a = north (y), w = east (x)

ring = fp["rings"][0]                       # local metres around the lake's centroid, CCW
ax, ay = fp["anchor_tm"]


def inside(px, py):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


# Water level: above every terrain sample on the shore AND on a 5 m grid inside the lake. The 30 m DEM
# bulges above the water in the lake's middle (2026-10-02 render); S5 shows open water there.
grid = [(x, y) for x in np.arange(-100, 101, 5.0) for y in np.arange(-100, 101, 5.0) if inside(x, y)]
water = max(lm.rel_ground(fp, ring + grid)) + 0.3      # the map's terrain (lm.rel_ground); ESTIMATE offset
depth = lm.foundation(coll, fp, BED)

S.prism("lake_water", [(y, x) for x, y in ring], water - 0.2, water, WATER, tessellate=True)

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


rng = np.random.default_rng(1925)           # seeded; the park's founding year [S1]
xs, ys = [p[0] for p in ring], [p[1] for p in ring]


def boat_frame(bx, by, heading):
    c, s_ = math.cos(heading), math.sin(heading)
    return lambda l, w, z: (by + l * s_ + w * c, bx + l * c - w * s_, z)   # boat (length, width, z) -> (a, w, z)


def slab(name, f, l0, l1, w0, w1, z0, z1, mat):
    S.hexa(name, [f(l0, w0, z0), f(l1, w0, z0), f(l1, w1, z0), f(l0, w1, z0)],
           [f(l0, w0, z1), f(l1, w0, z1), f(l1, w1, z1), f(l0, w1, z1)], mat)


boats = 0
while boats < 40:                           # [S5] about 40 to 60 boats out on a busy day; ESTIMATE mix
    bx, by = rng.uniform(min(xs) + 6, max(xs) - 6), rng.uniform(min(ys) + 6, max(ys) - 6)
    if not all(inside(bx + 4 * math.cos(t), by + 4 * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 8, endpoint=False)):
        continue
    f = boat_frame(bx, by, rng.uniform(0, 2 * math.pi))
    kind = rng.uniform()
    if kind < 0.35:                         # swan boat: white hull, neck, head, beak
        slab(f"boat_{boats:02d}_hull", f, -1.3, 1.3, -0.8, 0.8, water - 0.1, water + 0.55, SWAN)
        slab(f"boat_{boats:02d}_neck", f, 0.9, 1.25, -0.15, 0.15, water + 0.55, water + 1.75, SWAN)
        slab(f"boat_{boats:02d}_head", f, 0.95, 1.6, -0.17, 0.17, water + 1.55, water + 1.9, SWAN)
        slab(f"boat_{boats:02d}_beak", f, 1.6, 1.85, -0.08, 0.08, water + 1.62, water + 1.74, BEAK)
    elif kind < 0.80:                       # pedal boat: yellow hull, red canopy on posts
        slab(f"boat_{boats:02d}_hull", f, -1.2, 1.2, -0.75, 0.75, water - 0.1, water + 0.5, PEDAL)
        for i, (pl, pw) in enumerate(((-0.6, -0.55), (-0.6, 0.55), (0.5, -0.55), (0.5, 0.55))):
            slab(f"boat_{boats:02d}_post_{i}", f, pl - 0.04, pl + 0.04, pw - 0.04, pw + 0.04, water + 0.5, water + 1.5, POST)
        slab(f"boat_{boats:02d}_canopy", f, -0.8, 0.7, -0.75, 0.75, water + 1.5, water + 1.6, CANOPY)
    else:                                   # wooden rowboat (ready-made asset)
        lm.place(coll, f"boat_{boats:02d}_rowboat", ROWBOAT, bx, by, water - 0.2, rng.uniform(0, 360))
    boats += 1

# [S5] rental stalls under green roofs along the north shore, set back 2 m from the rim
cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
for i in range(len(ring)):
    (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % len(ring)]
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 8:
        continue
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = dy, -dx
    if ny < 0.6:                            # only edges facing north
        continue
    f = lambda l, w, z, x0=x0, y0=y0, dx=dx, dy=dy, nx=nx, ny=ny: (y0 + dy * l + ny * w, x0 + dx * l + nx * w, z)
    slab(f"stall_{i:02d}", f, 1.0, L - 1.0, 3.2, 6.2, 0.0, 2.6, POST)
    S.mesh(f"stall_{i:02d}_roof", [f(0.6, 2.8, 2.6), f(L - 0.6, 2.8, 2.6), f(L - 0.6, 6.6, 2.6), f(0.6, 6.6, 2.6), f(0.6, 4.7, 3.5), f(L - 0.6, 4.7, 3.5)],
           [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 3, 4), (1, 2, 5)], STALL_ROOF)

# [S5] blue-roofed pavilion at the lake's north-west corner, on the water's edge
px, py = max(ring, key=lambda p: -p[0] + p[1])
ux, uy = (cx - px), (cy - py)
k = math.hypot(ux, uy)
px, py = px + ux / k * 5, py + uy / k * 5
S.box("pavilion_deck", py - 5, py + 5, px - 4, px + 4, water - 0.2, water + 0.5, POST)
S.box("pavilion_room", py - 3.5, py + 3.5, px - 2.8, px + 2.8, water + 0.5, water + 3.3, POST)
S.pyramid("pavilion_roof", py, px, 4.6, water + 3.3, water + 5.8, PAVILION_ROOF)

# Trees ringing the lake, 7 m out from the rim: pines and broadleaf (ESTIMATE spacing; S5 shows a dense ring)
perim = [(ring[i], ring[(i + 1) % len(ring)]) for i in range(len(ring))]
total = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in perim)
for n in range(int(total // 11)):
    d = n * 11.0 + rng.uniform(0, 4)
    for (x0, y0), (x1, y1) in perim:
        L = math.hypot(x1 - x0, y1 - y0)
        if d <= L:
            break
        d -= L
    if L < 1e-6:
        continue
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    tx, ty = x0 + dx * d + dy * 7.0, y0 + dy * d - dx * 7.0
    if inside(tx, ty):                  # concave corners: keep trees out of the water
        continue
    gz = lm.rel_ground(fp, [(tx, ty)], low=True)[0]
    mesh = BROADLEAF if n % 3 == 0 else PINES[n % 2]   # two pines to one broadleaf (S5)
    lm.place(coll, f"tree_{n:02d}", mesh, tx, ty, gz - 0.3, rng.uniform(0, 360), rng.uniform(0.85, 1.15))

lm.human_reference(coll, ring[0][0] * 1.08, ring[0][1] * 1.08)
print("WATER", round(water, 2), "m above the centroid's ground")
lm.detail(coll, fp, roofs=[STALL_ROOF, PAVILION_ROOF])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
