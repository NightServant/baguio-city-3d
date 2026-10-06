"""session-road: the Session Road corridor at 1:1 (owner 2026-10-06: real size, with its junctions): both one-way
carriageways and the planted median between them, the four cross streets at their junctions (Mabini, Assumption,
Felipe Calderon, Father Carlu) with kerb radii, zebra crossings and lane dashes, sidewalks out to the building
fronts, awnings along them, and median trees (ready-made CC0 Kenney) and twin-arm lamp posts.
Every surface lies on the map's terrain, vertex by vertex on a 4 m grid, from model/data/landmarks/session-road/
streets.json (landmark_osm.py streets: widths measured from OSM). Dimensions: model/landmarks/session-road.md.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/session_road.py"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "session-road"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
ST = json.loads((lm.ROOT / "model" / "data" / "landmarks" / SLUG / "streets.json").read_text())
rng = np.random.default_rng(1909)             # seeded; Baguio's charter year


def asphalt():
    """Asphalt grain with darker patches (4 m tile); the markings are geometry, so junctions stay clean."""
    Y, X, grain = lm._grid()
    patch = 1 + 0.05 * np.sin(X * 6.3 + 1.7) * np.sin(Y * 4.1 + 0.4)
    return np.array([0.25, 0.25, 0.26]) * (patch[..., None] * (1 + 0.07 * grain))


ROAD = lm.textured("MAT_session_road", lm.pattern_image("TEX_session_road", asphalt()), srgb(62, 62, 64), 0.9)
PAVER = lm.textured("MAT_session_paver", lm.pattern_image("TEX_session_paver", lm.wall_blocks((0.66, 0.64, 0.60))), srgb(168, 163, 153), 0.9)
PAINT = lm.material("MAT_session_paint", srgb(232, 232, 226), 0.6)
SHRUB = lm.material("MAT_session_shrub", srgb(70, 110, 58), 0.9)          # [S3] planted median
LAMP = lm.material("MAT_session_lamp", srgb(70, 74, 78), 0.6)
GLOW = lm.material("MAT_session_glow", srgb(250, 236, 196), 0.4)
AWNINGS = [lm.material("MAT_session_awning_blue", srgb(52, 86, 132), 0.5),    # [S2] blue and galvanized
           lm.material("MAT_session_awning_steel", srgb(170, 172, 176), 0.4)]
TREES = [lm.asset_mesh("broadleaf", 4.5, {"leafs": (70, 112, 58), "woodBark": (100, 78, 58)}),   # [S3] small rounded trees
         lm.asset_mesh("oak", 4.2, {"leafs": (78, 118, 60), "woodBark": (100, 78, 58)})]
lowest = 0.0


def surface(name, m, lift, mat, sheet=False, tile=None):
    """A triangle mesh {"v": [[x, y]], "f": [[i, j, k]]} laid on the map's terrain, each vertex `lift` m above it.
    Its border gets a skirt down to 1 m under the lowest ground; a `sheet` (awnings) gets none (the material is
    double-sided, so it reads from the street too)."""
    global lowest
    if not m["f"]:
        return None
    xy = [tuple(v) for v in m["v"]]
    g = lm.rel_ground(fp, xy)
    bm = bmesh.new()
    top = [bm.verts.new((x, y, z + lift)) for (x, y), z in zip(xy, g)]
    for f in m["f"]:
        try:
            bm.faces.new([top[i] for i in f])
        except ValueError:                    # a duplicate triangle from two grid cells
            pass
    bm.edges.ensure_lookup_table()
    border = [e for e in bm.edges if len(e.link_faces) == 1]
    if sheet:
        border = []
    else:
        zb = min(lm.rel_ground(fp, xy, low=True)) - 1.0
        lowest = min(lowest, zb)
        low = {}
        for e in border:
            for v in e.verts:
                low.setdefault(v, bm.verts.new((v.co.x, v.co.y, zb)))
    for e in border:
        lp = e.link_loops[0]
        a, b = lp.vert, lp.link_loop_next.vert
        bm.faces.new((b, a, low[a], low[b]))  # outward: to the right of the face's own edge direction
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if tile:
        lm._face_uvs(ob, tile)
    return ob


def marks(name, rects, lift):
    """Painted bars (4 corners each) on the asphalt: each corner `lift` m above its own ground."""
    pts = [tuple(p) for r in rects for p in r]
    g = lm.rel_ground(fp, pts)
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x, y, z + lift) for (x, y), z in zip(pts, g)], [], [tuple(range(4 * i + 3, 4 * i - 1, -1)) for i in range(len(rects))])   # CCW from above
    me.materials.append(PAINT)
    coll.objects.link(bpy.data.objects.new(name, me))


# Ground surfaces: asphalt 0.3 m over the terrain (as the city's road tiles), kerbs 0.15 m up to the sidewalks, the planter
# 0.43 m above the asphalt (ESTIMATEs)
surface("asphalt", ST["asphalt"], 0.3, ROAD, tile=4.0)        # the city road tiles' lift (build_roads.py)
surface("sidewalk", ST["sidewalk"], 0.45, PAVER, tile=1.0)
surface("median", ST["median"], 0.73, SHRUB)
marks("crossings", ST["crossings"], 0.35)     # [S1] OSM footway=crossing: 0.5 m bars, 3 m long, 0.5 m apart
marks("dashes", ST["dashes"], 0.35)           # lane dividers, 3 m dash per 8 m (ESTIMATE)
for k, a in enumerate(ST["awnings"]):         # [S2] corrugated awnings 3.0 m over the sidewalk on the building fronts
    surface(f"awning_{k:02d}", a, 3.0, AWNINGS[a["colour"]], sheet=True)

# Median: rounded trees and twin-arm lamp posts [S3], alternating every 12 m
for k, site in enumerate(ST["median_points"]):
    x, y = site["xy"]
    z = lm.rel_ground(fp, [(x, y)])[0] + 0.73
    if site["kind"] == "tree":
        lm.place(coll, f"tree_{k:02d}", TREES[(k // 2) % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.9, 1.1))
        continue
    ux, uy = site["u"]
    L = lm.Shapes(coll, math.degrees(math.atan2(ux, uy)))   # a runs across the road, toward each carriageway
    L.box(f"lamp_pole_{k:02d}", -0.08, 0.08, -0.08, 0.08, z - 0.6, z + 7.0, LAMP)     # 7 m pole (ESTIMATE, S3)
    L.box(f"lamp_arm_{k:02d}", -1.7, 1.7, -0.04, 0.04, z + 6.75, z + 6.85, LAMP)       # an arm over each carriageway
    for s in (-1, 1):
        L.box(f"lamp_head_{k:02d}_{s}", s * 1.75 - 0.3, s * 1.75 + 0.3, -0.12, 0.12, z + 6.6, z + 6.78, GLOW)

lm.human_reference(coll, *ST["median_points"][0]["xy"])
lm.detail(coll, fp, roofs=AWNINGS)   # shared sub-detail pass (lm_common.detail)
print("STREETS", {k: ST[k] for k in ("lane_m", "median_m", "kerb_m", "sidewalk_band_m")})
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
