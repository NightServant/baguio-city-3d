"""teachers-camp: the Teachers Camp Athletic Oval: the stadium-shaped track and its grass infield, draped over the
map's terrain, with the white lane edges, and the pines ringing it on the camp's slopes (ready-made CC0 Kenney).
Dimensions: model/landmarks/teachers-camp.md ([S2] OSM oval outline; the track width is an ESTIMATE).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/teachers_camp.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "teachers-camp"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1908)             # seeded; the camp opened 6 April 1908 [S1]

TRACK = lm.material("MAT_teachers_track", srgb(150, 100, 72), 0.95)       # ESTIMATE: a red-brown cinder/clay track
FIELD = lm.textured("MAT_teachers_field", lm.pattern_image("TEX_teachers_field",
                    np.array((0.36, 0.55, 0.25)) * (1 + 0.05 * np.sin(2 * np.pi * 6 * lm._grid()[1]))[..., None]), srgb(96, 140, 62), 0.95)
LINE = lm.material("MAT_teachers_line", srgb(236, 236, 230), 0.8)
PINES = lm.FloraMix("forest")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
# [S2] way/3495210: a 174 x 99 m stadium shape along bearing 25.9 deg
O = lm.Shapes(coll, 25.9, {FIELD.name: 8.0})
R_OUT, HALF = 49.5, 174.0 / 2 - 49.5           # end radius and half the straight
TRACK_W = 7.0                                   # ESTIMATE: six lanes of about 1.2 m


def stadium(r, n_end=12, step=6.0):
    """Points (a, w) round a stadium of end radius r, CCW, straights along a, a point every `step` m on the
    straights so the draped mesh follows the terrain's bumps (a first pass with bare 75 m straights let the
    ground show through)."""
    m = max(1, round(2 * HALF / step))
    pts = []
    for k in range(n_end + 1):                  # far end, w from -r to +r
        t = -math.pi / 2 + math.pi * k / n_end
        pts.append((HALF + r * math.cos(t), r * math.sin(t)))
    pts += [(HALF - 2 * HALF * j / m, r) for j in range(1, m)]
    for k in range(n_end + 1):                  # near end
        t = math.pi / 2 + math.pi * k / n_end
        pts.append((-HALF + r * math.cos(t), r * math.sin(t)))
    pts += [(-HALF + 2 * HALF * j / m, -r) for j in range(1, m)]
    return pts


def z_at(pts):
    return [z + 0.15 for z in lm.rel_ground(fp, [O.P(a, w, 0)[:2] for a, w in pts])]


def band(name, r0, r1, mat, lift=0.0):
    """A draped band between two stadium rings (r1 > r0), closed with a skirt to below the ground."""
    inner, outer = stadium(r0), stadium(r1)
    zi, zo = z_at(inner), z_at(outer)
    n = len(inner)
    zb = min(lm.rel_ground(fp, [O.P(a, w, 0)[:2] for a, w in outer], low=True)) - 1.0
    verts = [(a, w, z + lift) for (a, w), z in zip(inner, zi)] + [(a, w, z + lift) for (a, w), z in zip(outer, zo)] + \
            [(a, w, zb) for a, w in outer] + [(a, w, zb) for a, w in inner]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]                                   # top
    faces += [(n + i, n + (i + 1) % n, 2 * n + (i + 1) % n, 2 * n + i) for i in range(n)]                  # outer skirt
    faces += [(3 * n + i, 3 * n + (i + 1) % n, (i + 1) % n, i) for i in range(n)]                         # inner skirt
    faces += [(2 * n + i, 2 * n + (i + 1) % n, 3 * n + (i + 1) % n, 3 * n + i) for i in range(n)]         # bottom
    O.mesh(name, verts, faces, mat)
    return zb


lowest = band("track", R_OUT - TRACK_W, R_OUT, TRACK)
band("lane_inner", R_OUT - TRACK_W - 0.15, R_OUT - TRACK_W, LINE, 0.02)
band("lane_outer", R_OUT, R_OUT + 0.15, LINE, 0.02)
# the infield: draped rings in to the centre line, then a strip down the middle
rings = [R_OUT - TRACK_W - 0.15, 36.0, 30.0, 24.0, 18.0, 12.0, 6.0, 2.0]
for k, (r1, r0) in enumerate(zip(rings, rings[1:])):
    lowest = min(lowest, band(f"field_{k}", r0, r1, FIELD))
for j, a0 in enumerate(np.arange(-HALF - 2.0, HALF + 2.0, 6.0)):   # the centre strip, in 6 m pieces
    a1 = min(a0 + 6.05, HALF + 2.0)
    mid = [(a0, -2.05), (a1, -2.05), (a1, 2.05), (a0, 2.05)]
    O.hexa(f"field_mid_{j:02d}", [(a, w, lowest) for a, w in mid], [(a, w, z) for (a, w), z in zip(mid, z_at(mid))], FIELD)

# Pines on the slopes round the oval [S3], every ~21 m on a ring 8-12 m outside the track
pts = stadium(R_OUT + 10.0, 10, step=1e9)
n = 0
for k in range(0, len(pts)):
    (a0, w0), (a1, w1) = pts[k], pts[(k + 1) % len(pts)]
    L = math.hypot(a1 - a0, w1 - w0)
    for t in np.arange(0.0, L, 21.0):
        a, w = a0 + (a1 - a0) * t / L, w0 + (w1 - w0) * t / L
        x, y, _ = O.P(a + rng.uniform(-2, 2), w + rng.uniform(-2, 2), 0.0)
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{n:02d}", PINES[n], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        n += 1

hx, hy, _ = O.P(0.0, -(R_OUT - 3.0), 0.0)
lm.human_reference(coll, hx, hy)
print("TREES", n)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
