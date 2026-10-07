# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2", "mapbox-earcut==1.0.3"]
# ///
"""The city's roads as 3D tiles for the web map (owner 2026-10-06: "implement 3d models for the roads"), at 1:1:
- every drivable OSM way (and pedestrian streets) in M1's extract, lanes x LANE_M wide (the lane width measured on
  Session Road, landmark_osm.py streets) or a class default, joined so junctions are clean;
- laid on the map's own terrain (AWS Terrarium z14, bilinear), stretched by EXAG like everything else, LIFT_M above it
  on a CELL_M grid, with a skirt from every edge; bridges span straight between their ends, tunnels are left out;
- centre lines on two-way main roads (double solid yellow on bends, broken white on straights, DPWH) and broken white lane
  dividers on multi-lane one-ways, kept clear of junctions; the carriageways take a CC0 asphalt scan in the app;
- left out inside landmarks that model their own streets (their `road_exclusion`, else `exclusion`), except parks built
  by landmark_osm.py park, whose lawns leave the drives to these tiles;
- street furniture and markings (owner 2026-10-06: "traffic markings, signs, and lights"): solid edge lines, stop lines
  on the right-hand approach to every junction (the Philippines drives on the right), zebra stripes at OSM's marked
  and uncontrolled crossings, traffic signals at OSM's traffic_signals nodes, street lights at OSM's street lamps and
  every 32 m along the main roads, and signs at OSM's stop, give_way and traffic_sign nodes, coloured by their PH code
  (model/data/osm/road-nodes.json, Overpass 2026-10-06);
- walkways (owner 2026-10-07: "add sidewalks/pathways"): OSM's sidewalks, footways, pedestrian streets and paths as
  paving 0.12 m above the asphalt (trails in earth or gravel by their surface), never over a carriageway or inside a
  landmark; its 1,471 stairways stepped, a riser per 0.17 m of real climb; and its retaining walls (stone, 2.7 m) and
  walls (1.8 m, stone or render), coursed in blocks (model/data/osm/landscape.json, Overpass 2026-10-07);
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


ASPHALT, CONCRETE, PAINT, YELLOW = lin(66, 66, 68), lin(150, 150, 146), lin(232, 232, 226), lin(242, 186, 32)
POLE, LAMP, HEAD = lin(112, 114, 118), lin(252, 240, 200), lin(36, 38, 40)
SIGNALS = (lin(228, 40, 36), lin(244, 170, 30), lin(40, 196, 90))
SIGN = {"R": (lin(238, 238, 234), lin(204, 32, 36)), "W": (lin(246, 200, 40), lin(30, 30, 30)), "HM": (lin(246, 200, 40), lin(30, 30, 30)),
        "G": (lin(24, 120, 72), lin(238, 238, 234)), "stop": (lin(204, 32, 36), lin(238, 238, 234)), "give_way": (lin(238, 238, 234), lin(204, 32, 36))}
LAMP_EVERY_M, LAMP_H, SIGNAL_H, SIGN_H = 32.0, 7.0, 4.5, 2.2   # ESTIMATEs (Session Road's lamps are 7 m)
# Walkways (ESTIMATEs): width by kind; colour by surface (never ASPHALT or CONCRETE, which show the satellite photograph)
WALK_W = {"sidewalk": 2.0, "footway": 1.8, "pedestrian": 5.0, "cycleway": 2.0, "path": 1.2, "bridleway": 1.5, "steps": 1.8}
PAVING, SETTS, EARTH, GRAVEL, STEP_STONE = lin(188, 184, 174), lin(176, 160, 144), lin(140, 116, 88), lin(164, 156, 142), lin(170, 166, 156)
WALK_LIFT, STEP_RISE_M = LIFT_M + 0.12, 0.17
WALLS = {"retaining_wall": (2.7, 0.4), "wall": (1.8, 0.25)}                       # height, thickness (ESTIMATEs)
STONE = (lin(150, 143, 130), lin(132, 126, 115), lin(162, 155, 141))             # coursed blocks, three tones
RENDER = (lin(214, 208, 196), lin(204, 198, 186), lin(220, 214, 202))


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


def load_walks(fwd):
    """OSM walkways in the model frame: (kind, LineString, half width, colour); crossings are the zebras."""
    out = []
    for el in json.loads(OSM.read_text())["elements"]:
        t, g = el.get("tags", {}), el.get("geometry") or []
        h = t.get("highway", "")
        if el["type"] != "way" or len(g) < 2 or h not in WALK_W or t.get("footway") == "crossing" or t.get("tunnel") == "yes":
            continue
        kind = "sidewalk" if t.get("footway") == "sidewalk" else h
        surf = t.get("surface", "")
        colour = (EARTH if surf in ("ground", "dirt", "earth", "mud", "grass", "unpaved") or (h == "path" and not surf) else
                  GRAVEL if surf in ("gravel", "fine_gravel", "compacted", "pebblestone") else
                  SETTS if surf in ("paving_stones", "sett", "cobblestone") else STEP_STONE if h == "steps" else PAVING)
        xy = np.column_stack(fwd.transform([p["lon"] for p in g], [p["lat"] for p in g]))
        out.append((kind, LineString(xy), WALK_W[kind] / 2, colour))
    return out


def load_walls(fwd):
    """OSM retaining walls and walls in the model frame: (LineString, height, half thickness, palette)."""
    out = []
    for el in json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]:
        t, g = el.get("tags", {}), el.get("geometry") or []
        if el["type"] != "way" or t.get("barrier") not in WALLS or len(g) < 2:
            continue
        h, th = WALLS[t["barrier"]]
        try:
            h = float(str(t.get("height", "")).removesuffix(" m")) or h
        except ValueError:
            pass
        stone = t["barrier"] == "retaining_wall" or t.get("material") in ("stone", "rock", "brick")
        xy = np.column_stack(fwd.transform([p["lon"] for p in g], [p["lat"] for p in g]))
        out.append((LineString(xy), min(h, 8.0), th / 2, STONE if stone else RENDER))
    return out


def modelled_streets():
    """The streets landmarks model with their own sidewalks (landmark_osm.py streets: Session Road), asphalt and sidewalks
    grown 0.5 m, in the model frame: OSM's walkways stay out of them, so the two pavements never overlap (owner
    2026-10-07: "the awkward texture/build of the sidewalk in Session Road")."""
    out = []
    for slug in json.loads(LANDMARKS.read_text()):
        f = LM_DATA / slug / "streets.json"
        if not f.exists():
            continue
        st = json.loads(f.read_text())
        ox, oy = json.loads((LM_DATA / slug / "footprint.json").read_text())["anchor_tm"]
        for key in ("asphalt", "sidewalk", "median"):
            v = np.asarray(st[key]["v"], float) + (ox, oy)
            out += [Polygon(v[t]).buffer(0.5) for t in st[key]["f"]]
    return [unary_union(out)] if out else []


def keep_out(fwd, surfaces=False):
    """Landmark areas the road tiles stay out of (see the module docstring). surfaces=True: the areas their asphalt stays
    out of, which leaves out the landmarks that model a street (streets.json: Session Road). The tiles' asphalt runs on
    under those, identical in the app (same scan, colour and world-anchored texture), so the street and the city's roads
    meet with no cut or gap; their markings and furniture still stay out (owner 2026-10-07, upper Session Road)."""
    polys = []
    for slug, e in json.loads(LANDMARKS.read_text()).items():
        if (LM_DATA / slug / "park.json").exists() or (surfaces and (LM_DATA / slug / "streets.json").exists()):
            continue
        ring = e.get("road_exclusion") or e.get("exclusion")
        if ring:
            polys.append(Polygon([fwd.transform(*p) for p in ring]))
    return unary_union(polys)


def dashes(ln, half, lanes, oneway, near_junction):
    """Lane markings as (quad, colour) on the DPWH pattern (2012 manual, as summarised by philkotse.com and
    autodeal.com.ph, read 2026-10-07: double solid yellow = no overtaking, broken white = lanes or overtaking allowed):
    one-way roads get broken white lane dividers, 3 m per 8 m; two-way roads a broken white centre line on straights
    and a double solid yellow one where the road bends more than 12 degrees within 25 m (ESTIMATE: no overtaking on
    Baguio's curves)."""
    def quad(path, s0, s1, o, w):
        p0, p1 = path.interpolate(s0), path.interpolate(s1)
        d = np.array((p1.x - p0.x, p1.y - p0.y))
        d /= max(np.linalg.norm(d), 1e-9)
        n = np.array((-d[1], d[0]))
        a, b = np.array((p0.x, p0.y)) + n * o, np.array((p1.x, p1.y)) + n * o
        h = n * w / 2
        return [tuple(a - h), tuple(b - h), tuple(b + h), tuple(a + h)]   # CCW

    def heading(path, t):
        a, b = path.interpolate(max(0.0, t - 1.0)), path.interpolate(min(path.length, t + 1.0))
        return math.atan2(b.y - a.y, b.x - a.x)

    out = []
    if oneway:
        for o in [-half + k * 2 * half / lanes for k in range(1, lanes)]:
            path = ln.offset_curve(o)
            if path.is_empty or path.geom_type != "LineString":
                continue
            for t in np.arange(2.0, path.length - 3.0, 8.0):
                if not near_junction(path.interpolate(t + 1.5).coords[0]):
                    out.append((quad(path, t, t + 3.0, 0.0, 0.12), PAINT))
        return out
    for t in np.arange(2.0, ln.length - 2.0, 4.0):
        if near_junction(ln.interpolate(t + 2.0).coords[0]):
            continue
        turn = abs((heading(ln, min(ln.length, t + 14.0)) - heading(ln, max(0.0, t - 10.0)) + math.pi) % (2 * math.pi) - math.pi)
        if math.degrees(turn) > 12.0:
            out += [(quad(ln, t, t + 4.0, o, 0.1), YELLOW) for o in (-0.12, 0.12)]
        elif int(t // 4) % 2 == 0:
            out.append((quad(ln, t, t + 3.0, 0.0, 0.12), PAINT))
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
    out_of, surface_out = keep_out(fwd), keep_out(fwd, surfaces=True)
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
    walks, walls = load_walks(fwd), load_walls(fwd)
    walk_polys = [w[1].buffer(w[2], quad_segs=2, cap_style="flat") for w in walks]
    wtree, walltree = STRtree(walk_polys), STRtree([w[0] for w in walls])
    every_ring = unary_union([Polygon([fwd.transform(*q) for q in e["exclusion"]]) for e in json.loads(LANDMARKS.read_text()).values()]
                             + modelled_streets())
    print(f"roads: {len(ways):,} ways, {len(bridges)} bridges, {len(junctions):,} junctions; {len(walks):,} walkways, "
          f"{len(walls):,} walls; z15 tiles x {x0}-{x1}, y {y0}-{y1}")

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
        widx = [int(i) for i in wtree.query(cell, predicate="intersects")]
        lidx = [int(i) for i in walltree.query(cell, predicate="intersects")]
        if not idx and not widx and not lidx:
            return []
        ax, ay = fwd.transform((tw + te) / 2, (ts + tn) / 2)
        deck = areas(unary_union([polys[i] for i in idx if i in bridges]).intersection(cell)) if any(i in bridges for i in idx) else Polygon()
        asphalt = areas(unary_union([polys[i] for i in idx if i not in bridges and not ways[i][6]]).intersection(cell).difference(surface_out).difference(deck))
        concrete = areas(unary_union([polys[i] for i in idx if i not in bridges and ways[i][6]]).intersection(cell).difference(surface_out)
                         .difference(deck).difference(asphalt))
        pos, col, tri = [], [], []

        carriage = []                                   # (triangles [n, 3, 2] local, z [n, 3]): the paint sits on these

        def add(mesh, z_of, colour, skirt, lift=LIFT_M, road=False):
            if not mesh["f"]:
                return
            v = np.asarray(mesh["v"], float)
            zt = z_of(v[:, 0] + ax, v[:, 1] + ay) + lift
            if road:
                f_ = np.asarray(mesh["f"])
                carriage.append((v[f_], zt[f_]))
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

        def put(c, d, al, ac, z0, z1, colour):          # c in the model frame
            solid(pos, col, tri, np.subtract(c, (ax, ay)), d, al, ac, z0, z1, colour)

        def on_road(px, py):
            """The carriageway mesh's height under local points (barycentric in its triangles), NaN off it. The paint follows
            this piecewise-flat surface, not the smooth ground, so a dash never sinks under the asphalt between grid points
            (owner 2026-10-07: "Road markings are not fully rendered")."""
            out = np.full(len(px), np.nan)
            for T, Z in carriage:
                a, b, c = T[:, 0], T[:, 1], T[:, 2]
                v0, v1 = b - a, c - a
                den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
                ok = np.abs(den) > 1e-9
                for k_ in np.nonzero(np.isnan(out))[0]:
                    q = np.array((px[k_], py[k_])) - a
                    u = (q[:, 0] * v1[:, 1] - v1[:, 0] * q[:, 1]) / np.where(ok, den, 1)
                    w = (v0[:, 0] * q[:, 1] - q[:, 0] * v0[:, 1]) / np.where(ok, den, 1)
                    hit = np.nonzero(ok & (u >= -1e-6) & (w >= -1e-6) & (u + w <= 1 + 1e-6))[0]
                    if len(hit):
                        j = hit[0]
                        out[k_] = Z[j, 0] + u[j] * (Z[j, 1] - Z[j, 0]) + w[j] * (Z[j, 2] - Z[j, 0])
            return out

        def paint(q, colour, piece=1.5):
            """A painted quad [a0, a1, b1, b0] (model frame) as a strip of pieces up to `piece` m long, each vertex 4 cm over the
            higher of the carriageway mesh and the ground under it."""
            q = np.asarray(q, float)
            L = float(np.linalg.norm(q[1] - q[0]))
            n_ = max(1, int(math.ceil(L / piece)))
            t = np.linspace(0, 1, n_ + 1)[:, None]
            left, right = q[0] + (q[1] - q[0]) * t, q[3] + (q[2] - q[3]) * t
            ring = np.vstack([left, right])
            lx, ly = ring[:, 0] - ax, ring[:, 1] - ay
            zs = np.fmax(on_road(lx, ly), heights(ring[:, 0], ring[:, 1]) + LIFT_M) + 0.04
            k = len(pos)
            pos.extend((float(x), float(y), float(z)) for x, y, z in zip(lx, ly, zs))
            col.extend([colour] * len(ring))
            m = n_ + 1
            for i in range(n_):                              # CCW from above, as the quads were
                tri.extend([[k + i, k + i + 1, k + m + i + 1], [k + i, k + m + i + 1, k + m + i]])

        def stairs(ln, half, colour):
            """Steps up a stairway's line: flat treads, a riser at each, sides to below the ground (no gaps on slopes)."""
            ts = np.linspace(0, ln.length, max(2, int(ln.length / 2.0) + 1))
            pts = np.array([ln.interpolate(t_).coords[0] for t_ in ts])
            zs = heights(pts[:, 0], pts[:, 1])
            climb = abs(zs[-1] - zs[0]) / EXAG                                   # true metres
            n = max(1, int(round(climb / STEP_RISE_M)))
            for k in range(n):
                s0, s1 = ln.length * k / n, ln.length * (k + 1) / n
                p0, p1 = ln.interpolate(s0), ln.interpolate(s1)
                d = np.array((p1.x - p0.x, p1.y - p0.y))
                L = float(np.linalg.norm(d))
                if L < 0.05:
                    continue
                z_lo = float(np.interp(s0, ts, zs)) if zs[-1] >= zs[0] else float(np.interp(s1, ts, zs))
                z_t = float(np.interp((s0 + s1) / 2, ts, zs)) + WALK_LIFT
                put(((p0.x + p1.x) / 2, (p0.y + p1.y) / 2), d / L, L / 2 + 0.02, half, min(z_lo, z_t) - 0.8, z_t, colour)
        for surface, colour in ((asphalt, ASPHALT), (concrete, CONCRETE)):
            add(grid_mesh(local(surface), CELL_M), heights, colour, SKIRT_M, road=True)
        # walkways by colour, off the carriageways and out of every landmark (parks included: they draw their own walks)
        roads_here = unary_union([asphalt, concrete, deck])
        groups = {}
        for i in widx:
            if walks[i][0] != "steps":
                groups.setdefault(walks[i][3], []).append(walk_polys[i])
        taken = roads_here
        for colour in (PAVING, SETTS, STEP_STONE, GRAVEL, EARTH):     # paving first: it wins where a trail meets it
            if colour not in groups:
                continue
            g = areas(unary_union(groups[colour]).intersection(cell).difference(every_ring).difference(taken, grid_size=0.01))
            if g.is_empty:
                continue
            taken = areas(taken.union(g, grid_size=0.01))
            add(grid_mesh(local(g), CELL_M), heights, colour, 0.7, WALK_LIFT if colour != EARTH else LIFT_M + 0.06)
        for i in widx:                               # stairways: a tread and a riser per STEP_RISE_M of real climb
            kind, ln, half, colour = walks[i]
            if kind != "steps":
                continue
            piece = ln.intersection(cell)
            for part in getattr(piece, "geoms", [piece]):
                if part.geom_type != "LineString" or part.length < 1.0 or every_ring.contains(part.centroid):
                    continue
                stairs(part, half, colour)
        for i in lidx:                               # walls: blocks of 2.4 m, three stone (or render) tones, coursed
            ln, h, half, palette = walls[i]
            piece = ln.intersection(cell)
            for part in getattr(piece, "geoms", [piece]):
                if part.geom_type != "LineString" or every_ring.contains(part.centroid):
                    continue
                for k, t_ in enumerate(np.arange(0.0, part.length, 2.4)):
                    a, b = part.interpolate(t_), part.interpolate(min(part.length, t_ + 2.4))
                    d = np.array((b.x - a.x, b.y - a.y))
                    L = float(np.linalg.norm(d))
                    if L < 0.2:
                        continue
                    c = np.array(((a.x + b.x) / 2, (a.y + b.y) / 2))
                    zg = float(min(heights(np.array([a.x, b.x]), np.array([a.y, b.y]))))
                    put(c, d / L, L / 2, half, zg - 1.2, zg + h, palette[k % 3])
                    if h > 1.6:                       # a coping course on top
                        put(c, d / L, L / 2, half + 0.06, zg + h - 0.15, zg + h, palette[(k + 1) % 3])
        for i in idx:                               # bridges: straight between their ends, a 0.8 m deck
            if i not in bridges:
                continue
            ln = ways[i][2]
            piece = areas(polys[i].intersection(cell).difference(surface_out))
            if piece.is_empty:
                continue
            g0, g1 = float(heights(*ln.coords[0])[0]), float(heights(*ln.coords[-1])[0])
            z_of = lambda vx, vy, ln=ln, g0=g0, g1=g1: np.array([g0 + (g1 - g0) * ln.project(shapely.Point(a, b), normalized=True) for a, b in zip(vx, vy)])
            add(grid_mesh(local(piece), CELL_M), z_of, ASPHALT, 0.8, road=True)
        for i in idx:                               # markings on main roads, clear of junctions and landmarks
            wy = ways[i]
            kind = wy[1].get("highway", "").removesuffix("_link")
            if kind not in MARKED or i in bridges or wy[4] < 2:
                continue
            for q, colour in dashes(wy[2], wy[3], wy[4], wy[5], near_junction):
                c = shapely.Point(np.mean(q, axis=0))
                if not cell.contains(c) or out_of.contains(c):
                    continue
                paint(q, colour)
        def gz(q):
            return float(heights(q[0], q[1])[0]) + LIFT_M

        def mark_rect(c, d, al, ac):                    # a white bar on the road (edge, stop and zebra lines)
            n = np.array((-d[1], d[0]))
            paint([tuple(np.asarray(c) + d * al * a + n * ac * b) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))], PAINT)

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
