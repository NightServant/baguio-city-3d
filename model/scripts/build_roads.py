# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2", "mapbox-earcut==1.0.3"]
# ///
"""The city's roads as 3D tiles for the web map (owner 2026-10-06: "implement 3d models for the roads"), at 1:1:
- every drivable OSM way (and pedestrian streets) in M1's extract, lanes x LANE_M wide (the lane width measured on
  Session Road, landmark_osm.py streets) or a class default, joined so junctions are clean;
- laid on the map's own terrain (AWS Terrarium z14, bilinear), stretched by EXAG like everything else, LIFT_M above it
  on a CELL_M grid, with a skirt from every edge; bridges span straight between their ends, tunnels are left out;
- dashed centre lines on two-way main roads and lane dividers on multi-lane one-ways, kept clear of junctions;
- left out inside landmarks that model their own streets (their `road_exclusion`, else `exclusion`), except parks built
  by landmark_osm.py park, whose lawns leave the drives to these tiles;
- street furniture and markings (owner 2026-10-06: "traffic markings, signs, and lights"): solid edge lines, stop lines
  on the right-hand approach to every junction (the Philippines drives on the right), zebra stripes at OSM's marked
  and uncontrolled crossings, traffic signals at OSM's traffic_signals nodes, street lights at OSM's street lamps and
  every 32 m along the main roads, and signs at OSM's stop, give_way and traffic_sign nodes, coloured by their PH code
  (model/data/osm/road-nodes.json, Overpass 2026-10-06);
- tiles from z15, split while over CAP_VERTICES; near zoom only (zoomed out, the basemap's lines read the same).
Run: uv run model/scripts/build_roads.py"""
import hashlib
import json
import math
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

from build_massing import EXAG, Ground, slippy, tile_bounds, write_glb
from common import DATA, LANDMARKS, LM_DATA, LOCAL_TM, OSM, PADDED, ROOT
from landmark_osm import areas, grid_mesh
from pack_landmark import GLTFPACK

LANE_M = 3.1          # measured on Session Road (3.13 m, landmark_osm.py streets)
DEFAULT_LANES = {"motorway": 4, "trunk": 2, "primary": 2, "secondary": 2, "tertiary": 2, "unclassified": 2,
                 "residential": 2, "living_street": 2, "pedestrian": 2, "service": 1, "track": 1}   # ESTIMATEs
MIN_WIDTH = {"service": 3.5, "track": 3.0, "pedestrian": 4.0, "residential": 5.0, "living_street": 4.5}
MARKED = {"motorway", "trunk", "primary", "secondary", "tertiary"}
LIFT_M, SKIRT_M, CELL_M, CAP_VERTICES = 0.3, 1.2, 10.0, 9000   # vertices bound a tile's bytes
PUBLIC = ROOT / "public" / "models" / "roads"
WORK = DATA / "roads"


def lin(r, g, b):
    f = lambda c: ((c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4) * 255
    return (round(f(r)), round(f(g)), round(f(b)), 255)


ASPHALT, CONCRETE, PAINT = lin(66, 66, 68), lin(150, 150, 146), lin(232, 232, 226)
POLE, LAMP, HEAD = lin(112, 114, 118), lin(252, 240, 200), lin(36, 38, 40)
SIGNALS = (lin(228, 40, 36), lin(244, 170, 30), lin(40, 196, 90))
SIGN = {"R": (lin(238, 238, 234), lin(204, 32, 36)), "W": (lin(246, 200, 40), lin(30, 30, 30)), "HM": (lin(246, 200, 40), lin(30, 30, 30)),
        "G": (lin(24, 120, 72), lin(238, 238, 234)), "stop": (lin(204, 32, 36), lin(238, 238, 234)), "give_way": (lin(238, 238, 234), lin(204, 32, 36))}
LAMP_EVERY_M, LAMP_H, SIGNAL_H, SIGN_H = 32.0, 7.0, 4.5, 2.2   # ESTIMATEs (Session Road's lamps are 7 m)


def load():
    """Drivable ways in the model frame: (id, tags, LineString, half width, lanes, oneway, concrete)."""
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    ways, ends = [], {}
    for el in json.loads(OSM.read_text())["elements"]:
        t, g = el.get("tags", {}), el.get("geometry") or []
        kind = t.get("highway", "").removesuffix("_link")
        if el["type"] != "way" or kind not in DEFAULT_LANES or len(g) < 2 or t.get("tunnel") in ("yes", "building_passage") or t.get("area") == "yes":
            continue
        try:
            lanes = int(str(t.get("lanes", "")).split(";")[0])
        except ValueError:
            lanes = DEFAULT_LANES[kind]
        width = max(lanes * LANE_M, MIN_WIDTH.get(kind, 3.0))
        xy = np.column_stack(fwd.transform([p["lon"] for p in g], [p["lat"] for p in g]))
        ways.append((f"way/{el['id']}", t, LineString(xy), width / 2, lanes, t.get("oneway") == "yes",
                     t.get("surface") in ("concrete", "paving_stones", "concrete:plates")))
        for p in (g[0], g[-1]):
            k = (round(p["lon"], 7), round(p["lat"], 7))
            ends[k] = ends.get(k, 0) + 1
    junctions = [fwd.transform(*k) for k, n in ends.items() if n >= 2]
    return fwd, sorted(ways, key=lambda w: w[0]), junctions


def load_nodes(fwd):
    """OSM road points (model/data/osm/road-nodes.json): crossings, lamps, signals and signs, in the model frame."""
    out = {"crossing": [], "street_lamp": [], "traffic_signals": [], "sign": []}
    for e in json.loads((DATA / "osm" / "road-nodes.json").read_text())["elements"]:
        t = e.get("tags", {})
        xy = fwd.transform(e["lon"], e["lat"])
        h = t.get("highway")
        if h == "crossing" and t.get("crossing") not in ("unmarked", "no"):
            out["crossing"].append(xy)
        elif h in ("street_lamp", "traffic_signals"):
            out[h].append(xy)
        elif h in ("stop", "give_way"):
            out["sign"].append((xy, h))
        elif "traffic_sign" in t:
            code = t["traffic_sign"].removeprefix("PH:").split(";")[0]
            out["sign"].append((xy, "HM" if code.startswith("HM") else code[:1] if code[:1] in "RWG" else "R"))
    return out


def keep_out(fwd):
    """Landmark areas the road tiles stay out of (see the module docstring)."""
    polys = []
    for slug, e in json.loads(LANDMARKS.read_text()).items():
        if (LM_DATA / slug / "park.json").exists():
            continue
        ring = e.get("road_exclusion") or e.get("exclusion")
        if ring:
            polys.append(Polygon([fwd.transform(*p) for p in ring]))
    return unary_union(polys)


def dashes(ln, half, lanes, oneway, near_junction):
    """Lane markings as thin rectangles: a dashed centre line (two-way) or lane dividers (one-way), 3 m per 8 m."""
    offs = [0.0] if not oneway else [-half + k * 2 * half / lanes for k in range(1, lanes)]
    out = []
    for o in offs:
        path = ln.offset_curve(o) if o else ln
        if path.is_empty or path.geom_type != "LineString":
            continue
        for s in np.arange(2.0, path.length - 3.0, 8.0):
            p0, p1 = path.interpolate(s), path.interpolate(s + 3.0)
            if near_junction(((p0.x + p1.x) / 2, (p0.y + p1.y) / 2)):
                continue
            d = np.array((p1.x - p0.x, p1.y - p0.y))
            d /= max(np.linalg.norm(d), 1e-9)
            n = np.array((-d[1], d[0])) * 0.06
            out.append([(p0.x - n[0], p0.y - n[1]), (p1.x - n[0], p1.y - n[1]), (p1.x + n[0], p1.y + n[1]), (p0.x + n[0], p0.y + n[1])])   # CCW
    return out


def solid(pos, col, tri, c, d, along, across, z0, z1, colour):
    """A box centred on c (local x, y), its `along` half-length on unit direction d, `across` half-width, z0 to z1."""
    n = np.array((-d[1], d[0]))
    k = len(pos)
    for z in (z0, z1):
        for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            q = np.asarray(c) + d * along * a + n * across * b
            pos.append((float(q[0]), float(q[1]), float(z)))
    col.extend([colour] * 8)
    tri.extend([[k + i for i in f] for f in ((0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5),
                                              (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7))])


def build():
    fwd, ways, junctions = load()
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    ground = Ground(1)
    out_of = keep_out(fwd)
    polys = [w[2].buffer(w[3], quad_segs=3, cap_style="round") for w in ways]
    tree, jtree = STRtree(polys), STRtree([shapely.Point(p) for p in junctions])
    near_junction = lambda p: len(jtree.query(shapely.Point(p), predicate="dwithin", distance=12.0)) > 0
    nodes = load_nodes(fwd)
    ltree = STRtree([w[2] for w in ways])
    lamp_tree = STRtree([shapely.Point(p) for p in nodes["street_lamp"]]) if nodes["street_lamp"] else None

    def along(i, q):
        """Way i's unit direction and its point nearest q, and q's signed offset (left +) from it."""
        ln = ways[i][2]
        s_ = ln.project(shapely.Point(q))
        a, b = ln.interpolate(max(0.0, s_ - 1.0)), ln.interpolate(min(ln.length, s_ + 1.0))
        d = np.array((b.x - a.x, b.y - a.y))
        d /= max(np.linalg.norm(d), 1e-9)
        c = ln.interpolate(s_)
        return d, np.array((c.x, c.y)), float(np.dot(np.subtract(q, (c.x, c.y)), (-d[1], d[0])))
    bridges = {i for i, w in enumerate(ways) if w[1].get("bridge") in ("yes", "viaduct")}
    (x0, y1), (x1, y0) = slippy(PADDED[0], PADDED[3], 15), slippy(PADDED[2], PADDED[1], 15)   # the map's box (its terrain)
    (px0, py0), (px1, py1) = fwd.transform(PADDED[0], PADDED[1]), fwd.transform(PADDED[2], PADDED[3])
    padded = box(px0, py0, px1, py1)
    print(f"roads: {len(ways):,} ways, {len(bridges)} bridges, {len(junctions):,} junctions; z15 tiles x {x0}-{x1}, y {y0}-{y1}")

    def heights(vx, vy):
        lng, lat = inv.transform(np.atleast_1d(vx), np.atleast_1d(vy))
        return ground(np.asarray(lng), np.asarray(lat)) * EXAG

    def tile(z, x, y):
        """One tile's mesh, or its four children's when it holds more than CAP_VERTICES."""
        tw, ts, te, tn = tile_bounds(x, y, z)
        (bx0, by0), (bx1, by1) = fwd.transform(tw, ts), fwd.transform(te, tn)
        cell = box(bx0, by0, bx1, by1).intersection(padded)
        if cell.is_empty:
            return []
        idx = [int(i) for i in tree.query(cell, predicate="intersects")]
        if not idx:
            return []
        ax, ay = fwd.transform((tw + te) / 2, (ts + tn) / 2)
        deck = areas(unary_union([polys[i] for i in idx if i in bridges]).intersection(cell)) if any(i in bridges for i in idx) else Polygon()
        asphalt = areas(unary_union([polys[i] for i in idx if i not in bridges and not ways[i][6]]).intersection(cell).difference(out_of).difference(deck))
        concrete = areas(unary_union([polys[i] for i in idx if i not in bridges and ways[i][6]]).intersection(cell).difference(out_of)
                         .difference(deck).difference(asphalt))
        pos, col, tri = [], [], []

        def add(mesh, z_of, colour, skirt):
            if not mesh["f"]:
                return
            v = np.asarray(mesh["v"], float)
            zt = z_of(v[:, 0] + ax, v[:, 1] + ay) + LIFT_M
            k = len(pos)
            pos.extend((float(a), float(b), float(c)) for (a, b), c in zip(v, zt))
            col.extend([colour] * len(v))
            tri.extend([k + i for i in f] for f in mesh["f"])
            edges = {}
            for f in mesh["f"]:
                for a, b in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])):
                    edges[(a, b)] = edges.get((a, b), 0) + 1
            for (a, b) in edges:
                if (b, a) not in edges:                # a border edge: skirt down from it, facing out
                    m = len(pos)
                    pos.extend([(v[a][0], v[a][1], zt[a] - skirt), (v[b][0], v[b][1], zt[b] - skirt)])
                    col.extend([colour] * 2)
                    tri.extend([[k + b, k + a, m], [k + b, m, m + 1]])

        local = lambda g: shapely.transform(g, lambda c: c - np.array([ax, ay]))
        for surface, colour in ((asphalt, ASPHALT), (concrete, CONCRETE)):
            add(grid_mesh(local(surface), CELL_M), heights, colour, SKIRT_M)
        for i in idx:                               # bridges: straight between their ends, a 0.8 m deck
            if i not in bridges:
                continue
            ln = ways[i][2]
            piece = areas(polys[i].intersection(cell).difference(out_of))
            if piece.is_empty:
                continue
            g0, g1 = float(heights(*ln.coords[0])[0]), float(heights(*ln.coords[-1])[0])
            z_of = lambda vx, vy, ln=ln, g0=g0, g1=g1: np.array([g0 + (g1 - g0) * ln.project(shapely.Point(a, b), normalized=True) for a, b in zip(vx, vy)])
            add(grid_mesh(local(piece), CELL_M), z_of, ASPHALT, 0.8)
        for i in idx:                               # markings on main roads, clear of junctions and landmarks
            wy = ways[i]
            kind = wy[1].get("highway", "").removesuffix("_link")
            if kind not in MARKED or i in bridges or wy[4] < 2:
                continue
            for q in dashes(wy[2], wy[3], wy[4], wy[5], near_junction):
                c = shapely.Point(np.mean(q, axis=0))
                if not cell.contains(c) or out_of.contains(c):
                    continue
                qa = np.asarray(q)
                zt = heights(qa[:, 0], qa[:, 1]) + LIFT_M + 0.05
                k = len(pos)
                pos.extend((a - ax, b - ay, c_) for (a, b), c_ in zip(qa, zt))
                col.extend([PAINT] * 4)
                tri.extend([[k, k + 1, k + 2], [k, k + 2, k + 3]])
        def gz(q):
            return float(heights(q[0], q[1])[0]) + LIFT_M

        def put(c, d, al, ac, z0, z1, colour):          # c in the model frame
            solid(pos, col, tri, np.subtract(c, (ax, ay)), d, al, ac, z0, z1, colour)

        def mark_rect(c, d, al, ac):                    # paint: a quad, each corner 4 cm over the road at its own ground
            n = np.array((-d[1], d[0]))
            qs = [np.asarray(c) + d * al * a + n * ac * b for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            zs = heights(np.array([q[0] for q in qs]), np.array([q[1] for q in qs])) + LIFT_M + 0.04
            k = len(pos)
            pos.extend((float(q[0] - ax), float(q[1] - ay), float(zz)) for q, zz in zip(qs, zs))
            col.extend([PAINT] * 4)
            tri.extend([[k, k + 1, k + 2], [k, k + 2, k + 3]])

        for i in idx:                                   # edge lines and stop lines on the main roads
            wy = ways[i]
            if wy[1].get("highway", "").removesuffix("_link") not in MARKED or i in bridges:
                continue
            ln, half = wy[2], wy[3]
            for t_ in np.arange(4.0, ln.length - 4.0, 8.0):
                d, c, _ = along(i, ln.interpolate(t_).coords[0])
                if near_junction(c):
                    continue
                for side in (-1, 1):
                    q = c + np.array((-d[1], d[0])) * side * (half - 0.3)
                    if cell.contains(shapely.Point(q)) and not out_of.contains(shapely.Point(q)):
                        mark_rect(q, d, 3.9, 0.06)
            for end, sgn in ((ln.length, -1), (0.0, 1)):    # 7 m back from a junction end, across the right-hand half
                pt = ln.interpolate(end)
                if not near_junction((pt.x, pt.y)) or ln.length < 20 or (wy[5] and sgn > 0):
                    continue
                d, c, _ = along(i, ln.interpolate(end + sgn * 7.0).coords[0])
                n = np.array((-d[1], d[0]))
                lo, hi = (-half + 0.3, half - 0.3) if wy[5] else ((-half + 0.3, 0.0) if sgn < 0 else (0.0, half - 0.3))
                q = c + n * (lo + hi) / 2
                if cell.contains(shapely.Point(q)) and not out_of.contains(shapely.Point(q)):
                    mark_rect(q, d, 0.2, (hi - lo) / 2)
        for q in nodes["crossing"]:                     # zebra stripes across the road, along the traffic
            if not cell.contains(shapely.Point(q)) or out_of.contains(shapely.Point(q)):
                continue
            j = int(ltree.nearest(shapely.Point(q)))
            if ways[j][2].distance(shapely.Point(q)) > 3.0:
                continue
            d, c, _ = along(j, q)
            n = np.array((-d[1], d[0]))
            for o in np.arange(-ways[j][3] + 0.6, ways[j][3] - 0.3, 1.0):
                mark_rect(c + n * o, d, 1.5, 0.25)
        for q in nodes["traffic_signals"]:              # a signal pole at either kerb, its head over the road
            if not cell.contains(shapely.Point(q)) or out_of.contains(shapely.Point(q)):
                continue
            j = int(ltree.nearest(shapely.Point(q)))
            d, c, _ = along(j, q)
            n = np.array((-d[1], d[0]))
            for side in (-1, 1):
                base = c + n * side * (ways[j][3] + 0.8) - d * side * 6.0
                zg = gz(base) - LIFT_M
                put(base, d, 0.1, 0.1, zg - 0.5, zg + SIGNAL_H, POLE)
                arm = base - n * side * 1.6
                put(arm, n, 1.6, 0.06, zg + SIGNAL_H - 0.12, zg + SIGNAL_H, POLE)
                head = base - n * side * 3.0
                put(head, d, 0.22, 0.2, zg + SIGNAL_H - 1.1, zg + SIGNAL_H, HEAD)
                for k, colour in enumerate(SIGNALS):
                    put(head, d, 0.26, 0.1, zg + SIGNAL_H - 0.36 - 0.33 * k, zg + SIGNAL_H - 0.14 - 0.33 * k, colour)
        for q, kind in nodes["sign"]:                   # a sign at the road's right edge, facing the traffic
            if not cell.contains(shapely.Point(q)) or out_of.contains(shapely.Point(q)):
                continue
            j = int(ltree.nearest(shapely.Point(q)))
            d, c, off = along(j, q)
            n = np.array((-d[1], d[0]))
            base = np.asarray(q) if abs(off) > ways[j][3] + 0.3 else c - n * (ways[j][3] + 0.6)
            zg = gz(base) - LIFT_M
            face, rim = SIGN.get(kind, SIGN["R"])
            put(base, d, 0.04, 0.04, zg - 0.3, zg + SIGN_H, POLE)
            w_ = 0.6 if kind != "G" else 1.0
            put(base + d * 0.06, d, 0.03, w_ / 2 + 0.05, zg + SIGN_H - 0.05, zg + SIGN_H + w_ + 0.05, rim)
            put(base + d * 0.09, d, 0.03, w_ / 2, zg + SIGN_H, zg + SIGN_H + w_, face)

        def lamp(base, inward):                        # a 7 m pole, an arm over the road, a warm head
            zg = gz(base) - LIFT_M
            put(base, inward, 0.08, 0.08, zg - 0.5, zg + LAMP_H, POLE)
            put(base + inward * 0.9, inward, 0.9, 0.04, zg + LAMP_H - 0.1, zg + LAMP_H, POLE)
            put(base + inward * 1.8, inward, 0.3, 0.13, zg + LAMP_H - 0.2, zg + LAMP_H - 0.05, LAMP)

        for q in nodes["street_lamp"]:                  # OSM's lamps, arm toward the nearest road
            if not cell.contains(shapely.Point(q)) or out_of.contains(shapely.Point(q)):
                continue
            j = int(ltree.nearest(shapely.Point(q)))
            d, c, off = along(j, q)
            n = np.array((-d[1], d[0]))
            base = np.asarray(q) if abs(off) > ways[j][3] + 0.3 else c + n * (ways[j][3] + 0.6) * (1 if off >= 0 else -1)
            lamp(base, -n * np.sign(np.dot(base - c, n) or 1.0))
        for i in idx:                                   # and every 32 m along the main roads, sides alternating
            wy = ways[i]
            if wy[1].get("highway", "").removesuffix("_link") not in MARKED or i in bridges:
                continue
            for k, t_ in enumerate(np.arange(LAMP_EVERY_M / 2, wy[2].length, LAMP_EVERY_M)):
                d, c, _ = along(i, wy[2].interpolate(t_).coords[0])
                side = 1 if k % 2 == 0 else -1
                n = np.array((-d[1], d[0])) * side
                base = c + n * (wy[3] + 0.6)
                pb = shapely.Point(base)
                if (not cell.contains(pb) or out_of.contains(pb) or near_junction(base)
                        or (lamp_tree is not None and len(lamp_tree.query(pb, predicate="dwithin", distance=15.0)))):
                    continue
                lamp(base, -n)
        if len(pos) > CAP_VERTICES and z < 18:
            return [t for cx in (2 * x, 2 * x + 1) for cy in (2 * y, 2 * y + 1) for t in tile(z + 1, cx, cy)]
        if not tri:
            return []
        raw = WORK / f"{z}-{x}-{y}.glb"
        count = write_glb(raw, pos, col, [i for q in tri for i in q])
        return [(f"{z}-{x}-{y}", raw, count, [(tw + te) / 2, (ts + tn) / 2], [round(v, 6) for v in (tw, ts, te, tn)])]

    WORK.mkdir(parents=True, exist_ok=True)
    for old in WORK.glob("*.glb"):
        old.unlink()
    jobs = []
    with ThreadPoolExecutor(8) as pool:
        for res in pool.map(lambda xy: tile(15, *xy), [(x, y) for x in range(min(x0, x1), max(x0, x1) + 1) for y in range(min(y0, y1), max(y0, y1) + 1)]):
            jobs += res
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob("*.glb"):
        old.unlink()

    def pack(job):
        tid, raw, tris, anchor, bbox = job
        packed = raw.with_suffix(".packed.glb")
        subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw), "-o", str(packed), "-cc"], check=True, capture_output=True)
        data = packed.read_bytes()
        name = f"{tid}.{hashlib.sha256(data).hexdigest()[:8]}.glb"
        (PUBLIC / name).write_bytes(data)
        return {"id": tid, "anchor": anchor, "bbox": bbox, "url": f"/models/roads/{name}", "bytes": len(data), "triangles": tris}

    with ThreadPoolExecutor(8) as pool:
        tiles = sorted(pool.map(pack, jobs), key=lambda t: t["id"])
    (PUBLIC / "index.json").write_text(json.dumps({"nearZoom": 15, "laneM": LANE_M, "exaggeration": EXAG, "tiles": tiles}, indent=1) + "\n")
    sizes = np.array([t["bytes"] for t in tiles])
    print(f"road tiles {len(tiles)}, bytes p50 {np.percentile(sizes, 50):,.0f} p95 {np.percentile(sizes, 95):,.0f} max {sizes.max():,}, "
          f"total {sizes.sum():,}; triangles {sum(t['triangles'] for t in tiles):,}")


if __name__ == "__main__":
    build()
