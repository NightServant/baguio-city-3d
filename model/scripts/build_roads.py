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
- left out inside landmarks' `exclusion` rings, except parks built by landmark_osm.py park, whose lawns leave the drives
  to these tiles, and Session Road (landmark_osm.py streets), whose street, sidewalks and median are these tiles' own
  (owner 2026-10-08: "Session Road landmark overlaps with the City-Wide Road Mode");
- street furniture and markings (owner 2026-10-06: "traffic markings, signs, and lights"): solid edge lines, stop lines
  on the right-hand approach to every junction (the Philippines drives on the right), zebra stripes at OSM's marked
  and uncontrolled crossings, traffic signals at OSM's traffic_signals nodes, street lights at OSM's street lamps and
  every 32 m along the main roads, and signs at OSM's stop, give_way and traffic_sign nodes, coloured by their PH code
  (model/data/osm/road-nodes.json, Overpass 2026-10-06);
- sidewalks city-wide (owner 2026-10-08: "rebuild the sidewalks city-wide ... richer textures, higher width (width same
  with the session road), add people, implement staircases connected to sidewalks"; SIDEWALK_M and below), after the
  owner's walk video up Session Road to SM Baguio (model/flora.json S5), with a concrete kerb, tactile pads at the
  crossings, and people (sites for build_flora.py);
- centre islands (owner 2026-10-08: "the center island for roads (dividers that contains street lamps and trees from the
  map source data)"): the strips between divided roads' carriageways, kerbed and planted, with OSM's lamps and trees on
  them and, where it maps none, a twin-arm lamp and a tree in turn every 12 m and shrubs between (MEDIAN_REACH_M);
- walkways (owner 2026-10-07: "add sidewalks/pathways"): OSM's footways, pedestrian streets and paths as paving 0.15 m
  above the asphalt (trails in earth or gravel by their surface), never over a carriageway or inside a landmark; its
  1,471 stairways stepped at an even rise from the paving at one end to the paving at the other, so each meets its
  sidewalk flush; and its retaining walls (stone, 2.7 m) and walls (1.8 m, stone or render), coursed in blocks
  (model/data/osm/landscape.json, Overpass 2026-10-07);
- tiles from z15, split while over CAP_VERTICES; near zoom only (zoomed out, the basemap's lines read the same).
Writes public/models/roads/ and model/data/roads/sites.npz (people, median trees and shrubs, and the paved areas, for
build_flora.py: run it after this). Run: uv run model/scripts/build_roads.py"""
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
from shapely.ops import substring, unary_union
from shapely.strtree import STRtree

from build_massing import EXAG, Ground, load_buildings, slippy, tile_bounds, write_glb
from common import DATA, LANDMARKS, LM_DATA, LOCAL_TM, OSM, PADDED, ROOT
from landmark_osm import areas, grid_mesh
from pack_landmark import GLTFPACK

LANE_M = 3.1          # measured on Session Road (3.13 m, landmark_osm.py streets)
DEFAULT_LANES = {"motorway": 4, "trunk": 2, "primary": 2, "secondary": 2, "tertiary": 2, "unclassified": 2,
                 "residential": 2, "living_street": 2, "pedestrian": 2, "service": 1, "track": 1}   # ESTIMATEs
MIN_WIDTH = {"service": 3.5, "track": 3.0, "pedestrian": 4.0, "residential": 5.0, "living_street": 4.5}
MARKED = {"motorway", "trunk", "primary", "secondary", "tertiary"}
LIFT_M, SKIRT_M, CELL_M, CAP_VERTICES = 0.3, 1.2, 10.0, 9000   # vertices bound a tile's bytes
TOL_M = 0.3                                                       # outlines simplified (below what the map can show)
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
# Sidewalks (owner 2026-10-08): SIDEWALK_M from the kerb (Session Road's kerb to building line, model/landmarks/session-
# road.md), cut back to the building fronts, on each side of a street where a building stands within BUILT_M of that
# sidewalk's outer edge (forest and open roadsides keep the photograph). Paving by road class after the walk video (S5,
# model/flora.json): hexagonal pavers on trunk and primary roads, red brick on secondary and tertiary, concrete on the rest;
# a concrete kerb KERB_W wide, KERB_H over the asphalt. People a square metre by paving (S5: crowds on Session Road). The
# chunking, BUILT_M, kerb and densities are ESTIMATEs.
SIDEWALK_M, BUILT_M, CHUNK_M, KERB_W, KERB_H = 5.57, 6.0, 25.0, 0.3, 0.15
SIDE_KINDS = {"trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street"}
HEX, BRICK, CONC, KERB, TACTILE = lin(178, 170, 156), lin(156, 92, 72), lin(176, 174, 166), lin(204, 202, 196), lin(214, 170, 48)
SIDE_PAVING = {"trunk": HEX, "primary": HEX, "secondary": BRICK, "tertiary": BRICK}           # else CONC
WALK_W = {"sidewalk": SIDEWALK_M, "footway": 1.8, "pedestrian": 5.0, "cycleway": 2.0, "path": 1.2, "bridleway": 1.5, "steps": 1.8}
PAVING, SETTS, EARTH, GRAVEL, STEP_STONE = lin(188, 184, 174), lin(176, 160, 144), lin(140, 116, 88), lin(164, 156, 142), lin(170, 166, 156)
PEOPLE_PER_M2 = {HEX: 1 / 30, BRICK: 1 / 60, CONC: 1 / 250, PAVING: 1 / 150, SETTS: 1 / 150}
WALK_LIFT, STEP_RISE_M, MAX_GOING_M = LIFT_M + KERB_H, 0.17, 0.5   # a tread at most 0.5 m deep where OSM gives no count
# Centre islands (owner 2026-10-08): the space the one-way carriageways' union closes over within 2 x MEDIAN_REACH_M, off
# every carriageway, building and landmark, kept where long and thin; a concrete kerb ring, planted inside where at least
# PLANTED_M wide, MEDIAN_LIFT over the asphalt. Trees (median_m tall) and shrubs go to build_flora.py; lamps are drawn here.
MEDIAN_REACH_M, MEDIAN_LIFT, PLANTED_M, MEDIAN_KERB_M = 8.0, 0.2, 1.0, 0.25
PLANTER = lin(84, 104, 60)

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
    """OSM walkways in the model frame: (kind, LineString, half width, colour, steps a metre or None); crossings are the
    zebras. Steps a metre: a stairway's OSM `step_count` over its length."""
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
        ln = LineString(xy)
        try:
            per_m = int(t["step_count"]) / ln.length if h == "steps" and ln.length > 0 else None
        except (KeyError, ValueError):
            per_m = None
        out.append((kind, ln, WALK_W[kind] / 2, colour, per_m))
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


def keep_out(fwd, parks=False):
    """Landmark rings the road tiles stay out of: every landmark's `exclusion` but Session Road's (landmark_osm.py streets:
    its street is these tiles' own, owner 2026-10-08) and, unless `parks`, the parks built by landmark_osm.py park (their
    lawns leave the drives to these tiles; their own walks keep the city's walkways out)."""
    polys = []
    for slug, e in json.loads(LANDMARKS.read_text()).items():
        if (LM_DATA / slug / "streets.json").exists() or (not parks and (LM_DATA / slug / "park.json").exists()):
            continue
        polys.append(Polygon([fwd.transform(*p) for p in e["exclusion"]]))
    return unary_union(polys)


def frame_at(ln, q):
    """The unit direction of line ln at its point nearest q, that point, and q's signed offset (left +) from it."""
    s_ = ln.project(shapely.Point(q))
    a, b = ln.interpolate(max(0.0, s_ - 1.0)), ln.interpolate(min(ln.length, s_ + 1.0))
    d = np.array((b.x - a.x, b.y - a.y))
    d /= max(np.linalg.norm(d), 1e-9)
    c = ln.interpolate(s_)
    return d, np.array((c.x, c.y)), float(np.dot(np.subtract(q, (c.x, c.y)), (-d[1], d[0])))


def sidewalk_bands(ways, bridges, blds, btree):
    """Each street's sidewalk bands as (polygon, paving): per CHUNK_M of its centreline and side, from the carriageway's
    edge out SIDEWALK_M, kept where a building stands within BUILT_M beyond it on that side."""
    out = []
    for i, (_, t, ln, half, *_r) in enumerate(ways):
        kind = t.get("highway", "").removesuffix("_link")
        if kind not in SIDE_KINDS or i in bridges:
            continue
        for a in np.arange(0.0, ln.length, CHUNK_M):
            piece = substring(ln, a, min(ln.length, a + CHUNK_M))
            if piece.length < 0.5:
                continue
            road = piece.buffer(half, cap_style="flat")
            for side in (1, -1):
                reach = piece.buffer(side * (half + SIDEWALK_M + BUILT_M), single_sided=True).difference(road)
                if not len(btree.query(reach, predicate="intersects")):
                    continue
                band = areas(piece.buffer(side * (half + SIDEWALK_M), single_sided=True).buffer(0).difference(road))
                if band.area > 1.0:
                    out.append((band, SIDE_PAVING.get(kind, CONC)))
    return out


def find_medians(ways, polys, blds, btree, out_of):
    """Centre islands: the space the one-way carriageways' union closes over within 2 x MEDIAN_REACH_M, off every
    carriageway, kept where it holds no building and no landmark and is long and thin (half its perimeter over 20 m and
    over 8 x its area's square root): a junction's filled corner is a triangle, a city block holds buildings."""
    one = unary_union([polys[i] for i, w in enumerate(ways) if w[5]])
    gap = one.buffer(MEDIAN_REACH_M, join_style="mitre").buffer(-MEDIAN_REACH_M, join_style="mitre").difference(unary_union(polys))
    out = []
    for g in getattr(gap, "geoms", [gap]):
        if g.geom_type != "Polygon" or g.area < 15 or out_of.contains(g.representative_point()):
            continue
        hit = [blds[i] for i in btree.query(g, predicate="intersects")]
        if hit and unary_union(hit).intersection(g).area > 0.05 * g.area:
            continue
        g = g.difference(unary_union(hit)) if hit else g
        if g.length / 2 > 20 and (g.length / 2) ** 2 / g.area > 8:
            out.append(g)
    return out


def median_sites(meds, ways, tree, lamps, trees):
    """Lamps (x, y, ux, uy, arm half-length: u across the road), trees and shrubs on the islands: OSM's street lamps and
    trees on them, and on the planted ones (PLANTED_M), a twin-arm lamp and a tree in turn every 12 m along the island's
    middle, shrubs every 3 m between (as Session Road's, session-road.md S3), where OSM maps none near."""
    L, T, S = [], [], []
    lamp_t, tree_t = STRtree([shapely.Point(q) for q in lamps]), STRtree([shapely.Point(q) for q in trees])
    for m in meds:
        width = 2 * m.area / m.length
        arm = min(width / 2 + 1.5, 5.0)
        grown = m.buffer(0.5)
        border = [int(j) for j in tree.query(m, predicate="dwithin", distance=0.5) if ways[int(j)][5]]
        if not border:
            continue
        lam = []
        for k in lamp_t.query(grown, predicate="contains"):
            q = lamps[int(k)]
            j = min(border, key=lambda j: ways[j][2].distance(shapely.Point(q)))
            d, _, _ = frame_at(ways[j][2], q)
            lam.append((np.asarray(q, float), np.array((-d[1], d[0]))))
        tre = [np.asarray(trees[int(k)], float) for k in tree_t.query(grown, predicate="contains")]
        shr = []
        if width >= PLANTED_M:
            near = lambda q, pts, r: any(math.hypot(q[0] - p[0], q[1] - p[1]) < r for p in pts)
            for j in sorted(border, key=lambda j: -ways[j][2].intersection(m.buffer(2 * MEDIAN_REACH_M)).length):
                ln, half = ways[j][2], ways[j][3]
                for k, t_ in enumerate(np.arange(1.5, ln.length, 3.0)):
                    d, c, _ = frame_at(ln, ln.interpolate(t_).coords[0])
                    n = np.array((-d[1], d[0]))
                    for side in (1, -1):
                        hit = LineString([c + n * side * (half - 0.2), c + n * side * (half + 2 * MEDIAN_REACH_M + 1)]).intersection(m)
                        parts = [h for h in getattr(hit, "geoms", [hit]) if h.geom_type == "LineString" and h.length > 0.2]
                        if not parts:
                            continue
                        q = np.array(min(parts, key=lambda h: h.distance(shapely.Point(c))).interpolate(0.5, normalized=True).coords[0])
                        lamps_q = [p for p, _ in lam]
                        if k % 4 == 0 and (k // 4) % 2 and not near(q, lamps_q, 16.0) and not near(q, tre, 3.0):
                            lam.append((q, n * side))
                        elif k % 4 == 0 and not near(q, tre + lamps_q, 6.0):
                            tre.append(q)
                        elif not near(q, shr + tre + lamps_q, 2.4):
                            shr.append(q)
        L += [(*q, *u, arm) for q, u in lam]
        T += [tuple(q) for q in tre]
        S += [tuple(q) for q in shr]
    return L, T, S


def simp(g):
    """g's outline simplified by TOL_M, valid (a sliver can simplify into a bowtie)."""
    return shapely.make_valid(g.simplify(TOL_M))


def cut(g, cell, *holes):
    """g within cell, less each of `holes` (the last snapped to 1 cm, as the pieces are unioned on that grid), polygonal
    after every step: GEOS can leave a stray line where a cut grazes an edge, and a snapped overlay refuses mixed input."""
    g = areas(areas(simp(areas(g))).intersection(cell))
    for k, h in enumerate(holes):
        g = areas(g.difference(h, grid_size=0.01) if k == len(holes) - 1 else g.difference(h))
    return g


def scatter(g, density, rng):
    """Random points over polygon(s) g, `density` a square metre on average."""
    tris = [t for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" for t in shapely.constrained_delaunay_triangles(p).geoms]
    if not tris:
        return np.empty((0, 2))
    T = np.array([t.exterior.coords[:3] for t in tris])
    e1, e2 = T[:, 1] - T[:, 0], T[:, 2] - T[:, 0]
    A = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) / 2
    n = rng.poisson(A.sum() * density)
    k = rng.choice(len(T), n, p=A / A.sum())
    u, v = rng.random(n), rng.random(n)
    flip = u + v > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    return T[k, 0] + (T[k, 1] - T[k, 0]) * u[:, None] + (T[k, 2] - T[k, 0]) * v[:, None]


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
    out_of, every_ring = areas(keep_out(fwd)), areas(keep_out(fwd, parks=True))
    polys = [w[2].buffer(w[3], quad_segs=3, cap_style="round") for w in ways]
    tree, jtree = STRtree(polys), STRtree([shapely.Point(p) for p in junctions])
    near_junction = lambda p: len(jtree.query(shapely.Point(p), predicate="dwithin", distance=12.0)) > 0
    nodes = load_nodes(fwd)
    ltree = STRtree([w[2] for w in ways])
    along = lambda i, q: frame_at(ways[i][2], q)
    bridges = {i for i, w in enumerate(ways) if w[1].get("bridge") in ("yes", "viaduct")}
    to_tm = lambda g: shapely.transform(g, lambda c: np.column_stack(fwd.transform(c[:, 0], c[:, 1])))
    blds = [to_tm(g) for _, _, g in load_buildings()]
    btree = STRtree(blds)
    bands = sidewalk_bands(ways, bridges, blds, btree)
    btree_s = STRtree([b for b, _ in bands])
    meds = find_medians(ways, polys, blds, btree, out_of)
    mtree = STRtree(meds)
    land = json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]
    osm_trees = [fwd.transform(e["lon"], e["lat"]) for e in land if e["type"] == "node" and e.get("tags", {}).get("natural") == "tree"]
    m_lamps, m_trees, m_shrubs = median_sites(meds, ways, tree, nodes["street_lamp"], osm_trees)
    on_median = unary_union(meds).buffer(0.5)
    nodes["street_lamp"] = [q for q in nodes["street_lamp"] if not on_median.contains(shapely.Point(q))]   # drawn twin-armed
    every_lamp = nodes["street_lamp"] + [q[:2] for q in m_lamps]
    lamp_tree = STRtree([shapely.Point(p) for p in every_lamp]) if every_lamp else None
    people = []                                          # model frame (x, y), from every finished tile
    (x0, y1), (x1, y0) = slippy(PADDED[0], PADDED[3], 15), slippy(PADDED[2], PADDED[1], 15)   # the map's box (its terrain)
    (px0, py0), (px1, py1) = fwd.transform(PADDED[0], PADDED[1]), fwd.transform(PADDED[2], PADDED[3])
    padded = box(px0, py0, px1, py1)
    walks, walls = load_walks(fwd), load_walls(fwd)
    walk_polys = [w[1].buffer(w[2], quad_segs=2, cap_style="flat") for w in walks]
    wtree, walltree = STRtree(walk_polys), STRtree([w[0] for w in walls])
    print(f"roads: {len(ways):,} ways, {len(bridges)} bridges, {len(junctions):,} junctions; {len(walks):,} walkways, "
          f"{len(walls):,} walls; {len(bands):,} sidewalk bands ({sum(b.area for b, _ in bands) / 1e6:.2f} km2 before cuts); "
          f"{len(meds)} centre islands ({sum(m.area for m in meds):,.0f} m2), {len(m_lamps)} lamps, {len(m_trees)} trees, "
          f"{len(m_shrubs)} shrubs on them; z15 tiles x {x0}-{x1}, y {y0}-{y1}")

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
        sidx = [int(i) for i in btree_s.query(cell, predicate="intersects")]
        midx = [int(i) for i in mtree.query(cell, predicate="intersects")]
        if not idx and not widx and not lidx and not sidx and not midx:
            return []
        ax, ay = fwd.transform((tw + te) / 2, (ts + tn) / 2)
        # outlines simplified before the cut to the tile, so its edges stay exact and neighbours meet without a crack
        deck = areas(simp(unary_union([polys[i] for i in idx if i in bridges])).intersection(cell)) if any(i in bridges for i in idx) else Polygon()
        asphalt = areas(simp(unary_union([polys[i] for i in idx if i not in bridges and not ways[i][6]])).intersection(cell).difference(out_of).difference(deck))
        concrete = areas(simp(unary_union([polys[i] for i in idx if i not in bridges and ways[i][6]])).intersection(cell).difference(out_of)
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
        mesh = lambda g: grid_mesh(local(g), CELL_M, tol=0, origin=(ax, ay))   # g already simplified, cut to the tile

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

        def stairs(ln, half, colour, per_m):
            """Steps along a stairway's line at an even rise, from the paving height over the ground at one end (WALK_LIFT)
            to the same at the other, so each end meets its sidewalk or walk flush (owner 2026-10-08: "staircases connected
            to sidewalks"); sides to below the ground (no gaps on slopes). The treads: OSM's step_count where mapped (519 of
            the 1,471, the Pilgrim's Stairs' 105 among them), else one per STEP_RISE_M of the terrain's climb, at most
            MAX_GOING_M deep (the map's z14 terrain, about 9 m a pixel, smooths a stair's slope away)."""
            ts = np.linspace(0, ln.length, max(2, int(ln.length / 2.0) + 1))
            pts = np.array([ln.interpolate(t_).coords[0] for t_ in ts])
            zs = heights(pts[:, 0], pts[:, 1])
            za, zb = zs[0] + WALK_LIFT, zs[-1] + WALK_LIFT
            n = (int(round(per_m * ln.length)) if per_m else
                 max(int(round(abs(zb - za) / EXAG / STEP_RISE_M)), int(math.ceil(ln.length / MAX_GOING_M))))
            n = min(max(1, n), int(ln.length / 0.2) + 1)
            for k in range(n):
                s0, s1 = ln.length * k / n, ln.length * (k + 1) / n
                p0, p1 = ln.interpolate(s0), ln.interpolate(s1)
                d = np.array((p1.x - p0.x, p1.y - p0.y))
                L = float(np.linalg.norm(d))
                if L < 0.05:
                    continue
                top = za + (zb - za) * (k + (1 if zb >= za else 0)) / n         # the higher edge of the tread
                low = float(min(np.interp(s0, ts, zs), np.interp(s1, ts, zs)))
                put(((p0.x + p1.x) / 2, (p0.y + p1.y) / 2), d / L, L / 2 + 0.02, half, min(low, top) - 0.8, top, colour)

        for surface, colour in ((asphalt, ASPHALT), (concrete, CONCRETE)):
            add(mesh(surface), heights, colour, SKIRT_M, road=True)
        roads_here = areas(unary_union([asphalt, concrete, deck]))
        # centre islands: a concrete kerb ring, planted inside (soil 5 cm under the kerb)
        med = areas(simp(unary_union([meds[i] for i in midx])).intersection(cell)) if midx else Polygon()
        if not med.is_empty:
            inner = areas(med.buffer(-MEDIAN_KERB_M, join_style="mitre"))
            add(mesh(areas(med.difference(inner))), heights, KERB, 0.6, LIFT_M + MEDIAN_LIFT)
            add(mesh(inner), heights, PLANTER, 0.3, LIFT_M + MEDIAN_LIFT - 0.05)
        # sidewalks: paving by road class (hexagonal pavers win where bands meet), cut back to the building fronts, a kerb
        # strip along the carriageway
        taken = areas(unary_union([roads_here, med]))
        fronts = areas(unary_union([blds[i] for i in btree.query(cell, predicate="intersects")]).buffer(0))
        paved_by = {}
        for colour in (HEX, BRICK, CONC):
            g = [bands[i][0] for i in sidx if bands[i][1] == colour]
            if not g:
                continue
            g = cut(unary_union(g), cell, every_ring, fronts, taken)
            if g.is_empty:
                continue
            taken = areas(taken.union(g, grid_size=0.01))
            paved_by[colour] = g
        walked = unary_union(list(paved_by.values())) if paved_by else Polygon()
        kerb = areas(walked.intersection(roads_here.buffer(KERB_W, join_style="mitre"))) if paved_by else Polygon()
        for colour, g in paved_by.items():
            paved_by[colour] = areas(g.difference(kerb))
            add(mesh(paved_by[colour]), heights, colour, 0.7, WALK_LIFT)
        add(mesh(kerb), heights, KERB, 0.7, WALK_LIFT)
        # walkways by colour, off the carriageways and sidewalks and out of every landmark (parks included: they draw their
        # own walks)
        groups = {}
        for i in widx:
            if walks[i][0] != "steps":
                groups.setdefault(walks[i][3], []).append(walk_polys[i])
        for colour in (PAVING, SETTS, STEP_STONE, GRAVEL, EARTH):     # paving first: it wins where a trail meets it
            if colour not in groups:
                continue
            g = cut(unary_union(groups[colour]), cell, every_ring, fronts, taken)
            if g.is_empty:
                continue
            taken = areas(taken.union(g, grid_size=0.01))
            paved_by[colour] = g
            add(mesh(g), heights, colour, 0.7, WALK_LIFT if colour != EARTH else LIFT_M + 0.06)
        for i in widx:                               # stairways, from the edge of the paving they meet
            kind, ln, half, colour, per_m = walks[i]
            if kind != "steps":
                continue
            piece = ln.intersection(cell).difference(taken)
            for part in getattr(piece, "geoms", [piece]):
                if part.geom_type != "LineString" or part.length < 1.0 or every_ring.contains(part.centroid):
                    continue
                stairs(part, half, colour, per_m)
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
            piece = areas(simp(polys[i]).intersection(cell).difference(out_of))
            if piece.is_empty:
                continue
            g0, g1 = float(heights(*ln.coords[0])[0]), float(heights(*ln.coords[-1])[0])
            z_of = lambda vx, vy, ln=ln, g0=g0, g1=g1: np.array([g0 + (g1 - g0) * ln.project(shapely.Point(a, b), normalized=True) for a, b in zip(vx, vy)])
            add(mesh(piece), z_of, ASPHALT, 0.8, road=True)
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
            for side in (-1, 1):                        # a yellow tactile pad on the sidewalk at each end (S5, 0:30)
                pad = c + n * side * (ways[j][3] + KERB_W + 0.45)
                if walked.contains(shapely.Point(pad)):
                    zp = gz(pad) - LIFT_M + WALK_LIFT
                    put(pad, d, 0.6, 0.3, zp - 0.03, zp + 0.012, TACTILE)
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
        for x_, y_, ux, uy, arm in m_lamps:             # the islands' lamps: a pole, an arm over each carriageway
            if not cell.contains(shapely.Point(x_, y_)):
                continue
            u = np.array((ux, uy))
            zg = gz((x_, y_)) - LIFT_M + MEDIAN_LIFT
            put((x_, y_), u, 0.08, 0.08, zg - 0.6, zg + LAMP_H, POLE)
            put((x_, y_), u, arm, 0.04, zg + LAMP_H - 0.1, zg + LAMP_H, POLE)
            for sgn in (-1, 1):
                put(np.array((x_, y_)) + u * sgn * (arm - 0.3), u, 0.3, 0.13, zg + LAMP_H - 0.2, zg + LAMP_H - 0.05, LAMP)
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
                if (not cell.contains(pb) or out_of.contains(pb) or near_junction(base) or on_median.contains(pb)
                        or (lamp_tree is not None and len(lamp_tree.query(pb, predicate="dwithin", distance=15.0)))):
                    continue
                lamp(base, -n)
        if len(pos) > CAP_VERTICES and z < 18:
            return [t for cx in (2 * x, 2 * x + 1) for cy in (2 * y, 2 * y + 1) for t in tile(z + 1, cx, cy)]
        if not tri:
            return []
        rng = np.random.default_rng(int(hashlib.sha256(f"people-{z}-{x}-{y}".encode()).hexdigest()[:8], 16))
        for colour, g in paved_by.items():                  # people on this finished tile's sidewalks and paved walks
            if colour in PEOPLE_PER_M2:
                people.extend(map(tuple, scatter(g, PEOPLE_PER_M2[colour], rng)))
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
    ll = lambda pts: np.column_stack(inv.transform(*np.asarray(pts, float).reshape(-1, 2).T)) if len(pts) else np.empty((0, 2))
    paved = shapely.transform(shapely.GeometryCollection([b for b, _ in bands] + meds), lambda c: np.column_stack(inv.transform(c[:, 0], c[:, 1])))
    np.savez_compressed(WORK / "sites.npz", person=ll(people), median_tree=ll(m_trees), median_shrub=ll(m_shrubs),
                        person_lift=WALK_LIFT, median_lift=LIFT_M + MEDIAN_LIFT - 0.05,
                        paved=np.frombuffer(shapely.to_wkb(paved), np.uint8))
    print(f"sites: {len(people):,} people, {len(m_trees)} median trees, {len(m_shrubs)} median shrubs -> {WORK / 'sites.npz'}")
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
        return {"id": tid, "anchor": [round(v, 9) for v in anchor], "bbox": bbox, "url": f"/models/roads/{name}", "bytes": len(data), "triangles": tris}

    with ThreadPoolExecutor(8) as pool:
        tiles = sorted(pool.map(pack, jobs), key=lambda t: t["id"])
    # what the app reads (ModelLayer.ts TileEntry), compact: every visit fetches it (C6 session bytes)
    shipped = [{k: t[k] for k in ("id", "anchor", "bbox", "url")} for t in tiles]
    (PUBLIC / "index.json").write_text(json.dumps({"nearZoom": 15, "laneM": LANE_M, "exaggeration": EXAG, "tiles": shipped}, separators=(",", ":")) + "\n")
    sizes = np.array([t["bytes"] for t in tiles])
    print(f"road tiles {len(tiles)}, bytes p50 {np.percentile(sizes, 50):,.0f} p95 {np.percentile(sizes, 95):,.0f} max {sizes.max():,}, "
          f"total {sizes.sum():,}; triangles {sum(t['triangles'] for t in tiles):,}")


if __name__ == "__main__":
    build()
