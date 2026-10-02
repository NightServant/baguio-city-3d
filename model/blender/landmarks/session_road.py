"""session-road: the Session Road corridor near the destination: both one-way carriageways with lane
markings, the planted median with trees and lamps, sidewalks, and runs of awnings over them.
Dimensions: model/landmarks/session-road.md ([S1] OSM centrelines and lanes; widths and furniture ESTIMATE).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/session_road.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402
from terrain_sample import terrain_z  # noqa: E402

SLUG = "session-road"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
LANE_M, STEP_M, DASH_M = 3.0, 15.0, 12.0     # ESTIMATE lane width; sample spacing; marking repeat


def asphalt():
    """Carriageway, u across (0..1 = full width), v along (one tile = DASH_M): asphalt grain, solid edge
    lines, a dashed centre line between the two lanes [S1 lanes=2]."""
    Y, X, grain = lm._grid()
    base = np.array([0.24, 0.24, 0.25]) * (1 + 0.06 * grain)
    edge = (np.abs(X - 0.035) < 0.012) | (np.abs(X - 0.965) < 0.012)
    dash = (np.abs(X - 0.5) < 0.010) & (Y < 0.5)
    return np.where((edge | dash)[..., None], np.array([0.86, 0.86, 0.84]), base)


ROAD = lm.textured("MAT_session_road", lm.pattern_image("TEX_session_road", asphalt()), srgb(62, 62, 64), 0.9)
PAVER = lm.textured("MAT_session_paver", lm.pattern_image("TEX_session_paver", lm.wall_blocks((0.66, 0.64, 0.60))), srgb(168, 163, 153), 0.9)
CURB = lm.material("MAT_session_curb", srgb(200, 200, 194), 0.8)
SHRUB = lm.material("MAT_session_shrub", srgb(70, 110, 58), 0.9)          # [S3] planted median
TRUNK = lm.material("MAT_session_trunk", srgb(90, 70, 50), 0.9)
CROWN = lm.material("MAT_session_crown", srgb(66, 104, 56), 0.9)
LAMP = lm.material("MAT_session_lamp", srgb(70, 74, 78), 0.6)
AWNINGS = [lm.material("MAT_session_awning_blue", srgb(52, 86, 132), 0.5),    # [S2] blue and galvanized
           lm.material("MAT_session_awning_steel", srgb(170, 172, 176), 0.4)]
S = lm.Shapes(coll, 0.0, {PAVER.name: 1.0})   # bearing 0: a = north (y), w = east (x)
ax, ay = fp["anchor_tm"]
ground = terrain_z([(ax, ay)])[0]
rng = np.random.default_rng(1909)             # seeded; Baguio's charter year (spec addendum, Burnham note)
lowest = 0.0


def resample(points, step):
    out, carry = [points[0]], 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        d = step - carry
        while d <= L:
            out.append((x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L))
            d += step
        carry = L - (d - step)
    if math.dist(out[-1], points[-1]) > step * 0.3:
        out.append(points[-1])
    return out


for k, ln in enumerate(fp["lines"]):
    width = int(ln["lanes"] or 2) * LANE_M
    pts = resample(ln["points"], STEP_M)
    if len(pts) < 2:
        continue
    rel = [(z - ground) if z is not None else 0.0 for z in terrain_z([(ax + x, ay + y) for x, y in pts])]
    lowest = min(lowest, min(rel))
    nrm = []
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        L = math.hypot(x1 - x0, y1 - y0)
        nrm.append((-(y1 - y0) / L, (x1 - x0) / L))       # left of the direction of travel

    def at(i, off, dz):
        x, y = pts[i][0] + nrm[i][0] * off, pts[i][1] + nrm[i][1] * off
        return (y, x, rel[i] + dz)                         # (a, w, z) for bearing 0

    def strip(name, i, o0, o1, z0, z1, mat, uvs=None):
        S.hexa(name, [at(i, o0, z0), at(i + 1, o0, z0), at(i + 1, o1, z0), at(i, o1, z0)],
               [at(i, o0, z1), at(i + 1, o0, z1), at(i + 1, o1, z1), at(i, o1, z1)], mat, uvs=uvs)

    h, along = width / 2, 0.0
    awning_run = AWNINGS[int(rng.integers(2))]
    for i in range(len(pts) - 1):
        seg = math.dist(pts[i], pts[i + 1])
        v0, v1 = along / DASH_M, (along + seg) / DASH_M
        along += seg
        uv = [(0, v0), (0, v1), (1, v1), (1, v0)] * 2      # u across from the right edge, v along
        strip(f"road_{k}_{i:02d}", i, -h, h, -1.0, 0.15, ROAD, uv)
        strip(f"median_{k}_{i:02d}", i, h, h + 0.6, -1.0, 0.4, SHRUB)   # [S3] planted median; each carriageway builds its half (OSM centrelines can be only 6 m apart)
        strip(f"curb_{k}_{i:02d}", i, -h - 0.15, -h, -1.0, 0.3, CURB)
        strip(f"sidewalk_{k}_{i:02d}", i, -h - 2.0, -h - 0.15, -1.0, 0.3, PAVER)         # [S2] 1.5-2 m walks
        if i % 2 == 0:
            awning_run = AWNINGS[int(rng.integers(2))]
        if rng.uniform() < 0.65:                            # [S2] awnings along much, not all, of the frontage
            strip(f"awning_{k}_{i:02d}", i, -h - 2.0, -h - 0.1, 3.2, 3.35, awning_run)
            x, y = pts[i][0] + nrm[i][0] * (-h - 0.3), pts[i][1] + nrm[i][1] * (-h - 0.3)
            S.box(f"awning_post_{k}_{i:02d}", y - 0.06, y + 0.06, x - 0.06, x + 0.06, rel[i] + 0.3, rel[i] + 3.2, LAMP)
        if seg > 5 and i % 2 == 0:                          # [S3] trees in the median, about every 30 m
            x, y = pts[i][0] + nrm[i][0] * (h + 0.4), pts[i][1] + nrm[i][1] * (h + 0.4)
            S.box(f"tree_{k}_{i:02d}_trunk", y - 0.2, y + 0.2, x - 0.2, x + 0.2, rel[i] + 0.4, rel[i] + 3.0, TRUNK)
            S.cone(f"tree_{k}_{i:02d}_low", y, x, 2.6, rel[i] + 4.6, rel[i] + 2.6, CROWN, seg=6)
            S.cone(f"tree_{k}_{i:02d}_high", y, x, 2.6, rel[i] + 4.6, rel[i] + 7.0, CROWN, seg=6)
        elif seg > 5 and i % 4 == 1:                        # lamp posts between the trees
            x, y = pts[i][0] + nrm[i][0] * (h + 0.5), pts[i][1] + nrm[i][1] * (h + 0.5)
            S.box(f"lamp_{k}_{i:02d}", y - 0.08, y + 0.08, x - 0.08, x + 0.08, rel[i] + 0.4, rel[i] + 7.5, LAMP)
            S.box(f"lamp_{k}_{i:02d}_head", y - 0.25, y + 0.25, x - 0.25, x + 0.25, rel[i] + 7.3, rel[i] + 7.6, CURB)

depth = 1.0 - lowest
lm.human_reference(coll, fp["lines"][0]["points"][0][0], fp["lines"][0]["points"][0][1])
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
