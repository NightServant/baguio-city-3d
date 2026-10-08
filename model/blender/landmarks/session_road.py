"""session-road: what the city's road tiles don't draw on Session Road: the shops' awnings over the sidewalks and the
traffic. Its street, sidewalks, planted median, markings, lamps and trees are the road tiles' (build_roads.py), as on
every other street (owner 2026-10-08: "Session Road landmark overlaps with the City-Wide Road Mode ... Remove the
landmark roads and sidewalks"). The awnings lie on the map's terrain, vertex by vertex, from model/data/landmarks/
session-road/streets.json (landmark_osm.py streets: widths measured from OSM). Dimensions: model/landmarks/session-road.md.
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


AWNINGS = [lm.material("MAT_session_awning_blue", srgb(52, 86, 132), 0.5),    # [S2] blue and galvanized
           lm.material("MAT_session_awning_steel", srgb(170, 172, 176), 0.4)]


def sheet(name, m, lift, mat):
    """A triangle mesh {"v": [[x, y]], "f": [[i, j, k]]} laid on the map's terrain, each vertex `lift` m above it (the
    material is double-sided, so it reads from the street too)."""
    xy = [tuple(v) for v in m["v"]]
    g = lm.rel_ground(fp, xy)
    bm = bmesh.new()
    top = [bm.verts.new((x, y, z + lift)) for (x, y), z in zip(xy, g)]
    for f in m["f"]:
        try:
            bm.faces.new([top[i] for i in f])
        except ValueError:                    # a duplicate triangle from two grid cells
            pass
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    coll.objects.link(bpy.data.objects.new(name, me))


for k, a in enumerate(ST["awnings"]):         # [S2] corrugated awnings 3.0 m over the ground on the building fronts
    if a["f"]:
        sheet(f"awning_{k:02d}", a, 3.0, AWNINGS[a["colour"]])

# Traffic (owner 2026-10-07: make the road lively): jeepneys in their liveries and white taxis, in the lanes, heading with
# the traffic (the Philippines drives on the right). Vertex-coloured, one mesh per vehicle kind, so gltfpack instances
# them. Sizes are ESTIMATEs: a jeepney 6.1 x 1.9 x 2.0 m, a car 4.4 x 1.8 x 1.45 m.
VEHICLE_MAT = lm.flora_material()                     # the vertex-colour material the trees use


def vehicle(name, boxes, wheels, r):
    """A mesh from boxes (x0, x1, y0, y1, z0, z1, rgb) in the vehicle's frame (x forward, y left, z up) and wheels."""
    me = bpy.data.meshes.get(name)
    if me:
        return me
    bm = bmesh.new()
    col = []
    for x0, x1, y0, y1, z0, z1, rgb in boxes:
        res = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=__import__("mathutils").Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)), verts=res["verts"])
        bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), verts=res["verts"])
        col += [rgb] * len(res["verts"])
    for x, y in wheels:
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=r, radius2=r, depth=0.24)
        rot = __import__("mathutils").Matrix.Rotation(math.pi / 2, 4, "X")
        bmesh.ops.transform(bm, matrix=rot, verts=res["verts"])
        bmesh.ops.translate(bm, vec=(x, y, r), verts=res["verts"])
        col += [(28, 28, 30)] * len(res["verts"])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    lin = np.array([lm.srgb(*c) for c in col], np.float32)
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", np.column_stack([lin, np.ones(len(lin), np.float32)]).ravel())
    me.materials.append(VEHICLE_MAT)
    return me


GLASS, CHROME, ROOF = (40, 48, 58), (196, 200, 204), (214, 216, 218)
JEEPNEYS = [vehicle(f"VEH_jeepney_{i}", [(-3.0, 1.2, -0.95, 0.95, 0.55, 1.75, c), (-3.02, 1.22, -0.97, 0.97, 1.22, 1.6, GLASS),
                                         (-3.1, 1.3, -1.0, 1.0, 1.75, 1.95, ROOF), (1.2, 2.9, -0.85, 0.85, 0.55, 1.35, c),
                                         (1.2, 1.4, -0.8, 0.8, 1.35, 1.75, GLASS), (2.9, 3.05, -0.92, 0.92, 0.42, 0.78, CHROME)],
                    [(-2.0, 0.85), (-2.0, -0.85), (1.95, 0.85), (1.95, -0.85)], 0.38)
            for i, c in enumerate(((196, 32, 44), (34, 92, 172), (238, 196, 40)))]   # red, blue, yellow
CARS = [vehicle(f"VEH_car_{i}", [(-2.2, 2.2, -0.88, 0.88, 0.3, 0.95, c), (-1.1, 0.9, -0.8, 0.8, 0.95, 1.4, GLASS),
                                 (-1.0, 0.8, -0.78, 0.78, 1.4, 1.46, c)], [(-1.4, 0.8), (-1.4, -0.8), (1.4, 0.8), (1.4, -0.8)], 0.32)
        for i, c in enumerate(((242, 242, 238), (170, 172, 176)))]      # white taxis, silver cars
lane_off = [ST["median_m"] / 2 + ST["lane_m"] * (k + 0.5) for k in range(2)]
for k, site in enumerate(ST["median_points"]):
    if rng.random() < 0.45:
        continue
    ux, uy = site["u"]
    side = 1 if rng.random() < 0.5 else -1
    off = lane_off[int(rng.random() < 0.5)]
    x, y = site["xy"][0] + ux * side * off, site["xy"][1] + uy * side * off
    tx, ty = (-uy, ux) if side > 0 else (uy, -ux)          # the carriageway is on the right of the heading
    z = lm.rel_ground(fp, [(x, y)])[0] + 0.3
    mesh = JEEPNEYS[k % 3] if rng.random() < 0.55 else CARS[k % 2]
    lm.place(coll, f"vehicle_{k:02d}", mesh, x, y, z, math.degrees(math.atan2(tx, ty)) - 90.0)

lm.human_reference(coll, *ST["median_points"][0]["xy"])
lm.detail(coll, fp, roofs=AWNINGS)   # shared sub-detail pass (lm_common.detail)
print("STREETS", {k: ST[k] for k in ("lane_m", "median_m", "kerb_m", "sidewalk_band_m")})
lm.report(SLUG, coll, 0.0)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
