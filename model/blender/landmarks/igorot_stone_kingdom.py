"""igorot-stone-kingdom: the Igorot Stone Kingdom, a hillside of fieldstone terraces in a gully: stone tiers stepping
down the slope (the ground under each 6 m cell, rounded up to 1.5 m steps), the perimeter walls with pointed
stone pinnacles, crenellations along the upper wall, and the round arena with its green rings and fountain;
trees on the slopes (ready-made CC0 Kenney).
Dimensions: model/landmarks/igorot-stone-kingdom.md ([S2] OSM outline; the rest are ESTIMATEs from [S3]).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/igorot_stone_kingdom.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "igorot-stone-kingdom"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(2017)

STONE = lm.textured("MAT_isk_stone", lm.pattern_image("TEX_isk_stone", lm.flagstones((0.74, 0.72, 0.67), 2017)), srgb(186, 182, 170), 0.95)
GRASS = lm.material("MAT_isk_grass", srgb(92, 150, 64), 0.95)           # [S3] the arena's green rings
WATER = lm.material("MAT_isk_water", srgb(110, 160, 170), 0.2)
TREES = [lm.asset_mesh("broadleaf", 12.0, {"leafs": (74, 116, 54), "woodBark": (110, 84, 60)}),
         lm.asset_mesh("pine_tall_a", 18.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
S = lm.Shapes(coll, 0.0, {STONE.name: 2.0})
ring = fp["rings"][0]
xs, ys = [p[0] for p in ring], [p[1] for p in ring]
lowest = min(lm.rel_ground(fp, ring, low=True)) - 1.0
CELL, STEP = 6.0, 1.5                            # ESTIMATE: terrace cells and tier height (S3)
AX, AY, AR = -10.0, 12.0, 11.0                   # ESTIMATE: the arena, mid-bowl in the main block (S3 aerial)

# --- the terraces: one stone block per 6 m cell inside the outline, its top the ground rounded up to 1.5 m
for i, gx in enumerate(np.arange(min(xs), max(xs), CELL)):
    for j, gy in enumerate(np.arange(min(ys), max(ys), CELL)):
        cx, cy = gx + CELL / 2, gy + CELL / 2
        if not lm.inside(ring, cx, cy) or math.hypot(cx - AX, cy - AY) < AR - 4.0:   # cells run under the arena edge: no gaps
            continue
        cell = [(gx, gy), (gx + CELL, gy), (gx + CELL, gy + CELL), (gx, gy + CELL)]
        top = math.ceil((max(lm.rel_ground(fp, cell)) + 0.2) / STEP) * STEP
        S.box(f"tier_{i:02d}_{j:02d}", gy, gy + CELL, gx, gx + CELL, lowest, top, STONE)

# --- the arena [S3]: a level stone floor, two green rings and a round fountain
za = math.ceil((max(lm.rel_ground(fp, [(AX + AR * math.cos(t), AY + AR * math.sin(t)) for t in np.linspace(0, 6.28, 12)])) + 0.2) / STEP) * STEP
oct_ = lambda r, n=16: [(AY + r * math.sin(2 * math.pi * k / n), AX + r * math.cos(2 * math.pi * k / n)) for k in range(n)]
S.prism("arena", oct_(AR), lowest, za, STONE)
for k, (r0, r1) in enumerate(((7.5, 9.0), (4.5, 6.0))):                          # green rings, each a step up
    S.prism(f"arena_green_{k}", oct_(r1), za, za + 0.15 + 0.1 * k, GRASS)
    S.prism(f"arena_band_{k}", oct_(r0), za, za + 0.2 + 0.1 * k, STONE)          # the stone ring inside each green one
S.prism("fountain_rim", oct_(2.0, 12), za, za + 0.8, STONE)
S.prism("fountain_water", oct_(1.7, 12), za + 0.5, za + 0.75, WATER)
S.cone("fountain_spire", AY, AX, 0.4, za + 0.5, za + 2.4, STONE, seg=6)

# --- the tower of the Gatan and Bangan legend [S1], at the top of the bowl (ESTIMATE: place and 12 m height, S3)
TX, TY = -12.0, 42.0
zt = math.ceil((max(lm.rel_ground(fp, [(TX + dx, TY + dy) for dx in (-3, 3) for dy in (-3, 3)])) + 0.2) / STEP) * STEP
S.box("tower", TY - 2.6, TY + 2.6, TX - 2.6, TX + 2.6, lowest, zt + 12.0, STONE)
for k, (mx, my) in enumerate([(TX + dx, TY + dy) for dx in (-2.2, 0.0, 2.2) for dy in (-2.2, 0.0, 2.2) if abs(dx) + abs(dy) >= 2.2]):
    S.box(f"tower_merlon_{k}", my - 0.4, my + 0.4, mx - 0.4, mx + 0.4, zt + 12.0, zt + 12.8, STONE)
S.cone("tower_spire", TY, TX, 0.7, zt + 12.0, zt + 15.5, STONE, seg=4)

# --- the perimeter wall along the outline, 2.5 m above its own ground, with pinnacles every ~7 m [S3]
n_pin = 0
north = max(ys) - 30.0                           # crenellations on the upper (north) stretch, the "castle" in S3
for k in range(len(ring)):
    (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % len(ring)]
    L = math.hypot(x1 - x0, y1 - y0)
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = dy, -dx                             # outward for a CCW ring
    for t0 in np.arange(0.0, L, 6.0):
        t1 = min(t0 + 6.05, L)
        q = [(x0 + dx * t0, y0 + dy * t0), (x0 + dx * t1, y0 + dy * t1), (x0 + dx * t1 - nx * 0.8, y0 + dy * t1 - ny * 0.8), (x0 + dx * t0 - nx * 0.8, y0 + dy * t0 - ny * 0.8)]
        top = max(lm.rel_ground(fp, q)) + 2.5
        S.hexa(f"wall_{k:02d}_{t0:03.0f}", [(y, x, lowest) for x, y in q], [(y, x, top) for x, y in q], STONE)
        if (y0 + y1) / 2 > north:                # merlons on the upper wall
            for tm in np.arange(t0 + 0.75, t1, 1.5):
                mx, my = x0 + dx * tm - nx * 0.4, y0 + dy * tm - ny * 0.4
                S.box(f"merlon_{k:02d}_{tm:05.1f}", my - 0.4, my + 0.4, mx - 0.4, mx + 0.4, top, top + 0.7, STONE)
        px, py = x0 + dx * t0 - nx * 0.4, y0 + dy * t0 - ny * 0.4
        if rng.uniform() < 0.85:
            S.cone(f"pinnacle_{n_pin:03d}", py, px, 0.55, top, top + rng.uniform(1.8, 3.2), STONE, seg=4)   # [S3] stone spires
            n_pin += 1

# --- trees on the slopes just outside the walls [S3]
n = 0
for k in range(0, len(ring)):
    (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % len(ring)]
    L = math.hypot(x1 - x0, y1 - y0)
    for t in np.arange(5.0, L, 20.0):
        nx, ny = (y1 - y0) / L, -(x1 - x0) / L
        x, y = x0 + (x1 - x0) * t / L + nx * 7.0, y0 + (y1 - y0) * t / L + ny * 7.0
        if lm.inside(ring, x, y):
            continue
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{n:02d}", TREES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        n += 1

lm.human_reference(coll, AX + AR - 2.0, AY)
print("ARENA", round(za, 2), "PINNACLES", n_pin, "TREES", n)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
