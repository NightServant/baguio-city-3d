# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2"]
# ///
"""Landmark procedure step B.

  uv run model/scripts/landmark_osm.py candidates <slug>       # OSM features within 250 m of the destination
  uv run model/scripts/landmark_osm.py footprint <slug> <id>…  # ids like way/123 or relation/456
  uv run model/scripts/landmark_osm.py footprint-line <slug> <radius_m> <half_width_m> <id>…   # streets
  uv run model/scripts/landmark_osm.py parts <slug>            # OSM Simple 3D Buildings parts round the footprint
  uv run model/scripts/landmark_osm.py buildings <slug>        # every OSM building inside the footprint (complexes)
  uv run model/scripts/landmark_osm.py streets <slug>          # a street at 1:1: carriageways, junctions, sidewalks, crossings
  uv run model/scripts/landmark_osm.py park <slug> <way/id> <S:N,W:E> [stand=<id>]   # one box of a park, at 1:1
  uv run model/scripts/landmark_osm.py insets <slug> [dir=ux,uy] [tol=m] <m>…   # terrace tiers: the largest ring shrunk by each
                                                               # distance, or (dir=) cut back that far on the downhill side

Overpass needs a non-personal user agent (curl's default gets HTTP 406). Responses are cached in
model/data/landmarks/<slug>/osm.json, so re-runs don't hit the API."""
import json
import math
import random
import subprocess
import sys

import numpy as np

from pyproj import Transformer
from shapely import box, constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, mapping
from shapely.ops import linemerge, orient, polygonize, unary_union

from common import LANDMARKS, LM_DATA, LOCAL_TM, ROOT

UA = "baguio-city-3d/1.0"
RADIUS_M = 250
BUFFER_M = 5  # exclusion = footprint grown by 5 m, so massing never touches the landmark


def destination(slug):
    """Where to search: the registry's osm_center (the real OSM feature, cited) when the destination pin is off
    (many tier-2 pins are 0.2-5 km from their feature, 2026-10-05), else the pin."""
    centre = json.loads(LANDMARKS.read_text())[slug].get("osm_center")
    if centre:
        return centre["lnglat"]
    for f in json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]:
        if f["properties"]["slug"] == slug:
            return f["geometry"]["coordinates"]
    raise SystemExit(f"unknown slug {slug}")


def osm(slug):
    cache = LM_DATA / slug / "osm.json"
    if cache.exists():
        return json.loads(cache.read_text())
    lng, lat = destination(slug)
    q = f"[out:json][timeout:60];(way(around:{RADIUS_M},{lat},{lng})[~\"^(building|leisure|amenity|tourism|historic|landuse|natural|man_made|highway)$\"~\".\"];relation(around:{RADIUS_M},{lat},{lng})[~\"^(building|leisure|amenity|tourism|historic|landuse)$\"~\".\"];);out geom;"  # not "out geom tags": tags verbosity drops relation members
    out = subprocess.run(["curl", "-fsS", "--retry", "4", "--retry-all-errors", "--retry-delay", "30", "-A", UA, "--data-urlencode", f"data={q}",
                          "https://overpass-api.de/api/interpreter"], check=True, capture_output=True, text=True).stdout
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(out)
    return json.loads(out)


def polygons(el, fwd):
    """Closed rings of a way or a multipolygon relation's outer members, in model-frame metres."""
    if el["type"] == "way":
        ring = el.get("geometry", [])
        return [Polygon([fwd.transform(p["lon"], p["lat"]) for p in ring])] if len(ring) >= 4 and ring[0] == ring[-1] else []
    # outer rings are often split across several open member ways (Baguio Botanical Garden: six), so stitch them
    lines = [LineString([fwd.transform(p["lon"], p["lat"]) for p in m["geometry"]])
             for m in el.get("members", []) if m.get("role") == "outer" and len(m.get("geometry", [])) >= 2]
    return list(polygonize(linemerge(lines))) if lines else []


def candidates(slug):
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    for el in osm(slug)["elements"]:
        polys = polygons(el, fwd)
        area = sum(p.area for p in polys)
        t = el.get("tags", {})
        keys = {k: t[k] for k in ("name", "building", "building:levels", "height", "leisure", "amenity", "tourism", "historic") if k in t}
        print(f"{el['type']}/{el['id']}\tarea {area:,.0f} m2\t{json.dumps(keys, ensure_ascii=False)}")


def footprint(slug, ids):
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    els = {f"{e['type']}/{e['id']}": e for e in osm(slug)["elements"]}
    missing = [i for i in ids if i not in els]
    if missing:
        raise SystemExit(f"not in the cached candidates: {missing}")
    shape = unary_union([p for i in ids for p in polygons(els[i], fwd)])
    c = shape.centroid
    parts = list(getattr(shape, "geoms", [shape]))
    rings = [[[x - c.x, y - c.y] for x, y in orient(p, 1.0).exterior.coords[:-1]] for p in parts]
    alng, alat = inv.transform(c.x, c.y)
    out = LM_DATA / slug / "footprint.json"
    out.write_text(json.dumps({"slug": slug, "anchor_lnglat": [alng, alat], "anchor_tm": [c.x, c.y],
                               "rings": rings, "area_m2": shape.area}, indent=2) + "\n")
    hull = shape.buffer(BUFFER_M).convex_hull if len(parts) > 1 else shape.buffer(BUFFER_M)
    ring = [[round(v, 5) for v in inv.transform(x, y)] for x, y in hull.exterior.coords]
    reg = json.loads(LANDMARKS.read_text())
    reg[slug].update({"osm_ids": ids, "exclusion": ring, "anchor": [round(alng, 6), round(alat, 6)]})
    LANDMARKS.write_text(json.dumps(reg, indent=2) + "\n")
    print(f"{slug}: {len(parts)} part(s), {shape.area:,.0f} m2, anchor {alng:.6f},{alat:.6f}; exclusion {len(ring)} points")


def footprint_line(slug, radius, half_width, ids):
    """Streets: centrelines clipped to `radius` m around the destination, buffered by `half_width` m. The
    exclusion ring is that corridor only (no extra buffer), so frontage buildings stay in the massing."""
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    els = {f"{e['type']}/{e['id']}": e for e in osm(slug)["elements"]}
    pin = Point(fwd.transform(*destination(slug))).buffer(radius)
    lines = []
    for i in ids:
        el = els[i]
        line = LineString([fwd.transform(p["lon"], p["lat"]) for p in el["geometry"]]).intersection(pin)
        for part in getattr(line, "geoms", [line]):
            if part.length > 5:
                lines.append((i, el.get("tags", {}), part))
    corridor = unary_union([ln.buffer(half_width, cap_style="flat") for _, _, ln in lines])
    c = corridor.centroid
    parts = list(getattr(corridor, "geoms", [corridor]))
    rings = [[[x - c.x, y - c.y] for x, y in orient(p, 1.0).exterior.coords[:-1]] for p in parts]
    alng, alat = inv.transform(c.x, c.y)
    out = LM_DATA / slug / "footprint.json"
    out.write_text(json.dumps({"slug": slug, "anchor_lnglat": [alng, alat], "anchor_tm": [c.x, c.y], "rings": rings,
                               "area_m2": corridor.area, "lines": [{"id": i, "lanes": t.get("lanes"), "oneway": t.get("oneway"),
                               "points": [[x - c.x, y - c.y] for x, y in ln.coords]} for i, t, ln in lines]}, indent=2) + "\n")
    hull = corridor if len(parts) == 1 else corridor.convex_hull
    ring = [[round(v, 5) for v in inv.transform(x, y)] for x, y in hull.exterior.coords]
    reg = json.loads(LANDMARKS.read_text())
    reg[slug].update({"osm_ids": ids, "exclusion": ring, "anchor": [round(alng, 6), round(alat, 6)]})
    LANDMARKS.write_text(json.dumps(reg, indent=2) + "\n")
    print(f"{slug}: {len(lines)} centreline part(s), {sum(ln.length for _, _, ln in lines):,.0f} m, corridor {corridor.area:,.0f} m2")


def parts(slug, radius=150):
    """Simple 3D Buildings: every building:part within `radius` m of the anchor, with its min_height/height (m above
    the ground) and colours, as local-metre rings (outer first, then holes) in model/data/landmarks/<slug>/parts.json.
    Some landmarks are mapped in 3D in OSM (the Diplomat Hotel: 90+ parts), so the model can follow them."""
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    fp = json.loads((LM_DATA / slug / "footprint.json").read_text())
    (alng, alat), (ax, ay) = fp["anchor_lnglat"], fp["anchor_tm"]
    cache = LM_DATA / slug / "parts-osm.json"
    if not cache.exists():
        q = f'[out:json][timeout:90];nwr(around:{radius},{alat},{alng})["building:part"];out geom;'
        cache.write_text(subprocess.run(["curl", "-fsS", "--retry", "4", "--retry-all-errors", "--retry-delay", "30", "-A", UA,
                                         "--data-urlencode", f"data={q}", "https://overpass-api.de/api/interpreter"],
                                        check=True, capture_output=True, text=True).stdout)
    out = []
    num = lambda v: float(str(v).split()[0].rstrip("m")) if v not in (None, "") else None
    for el in json.loads(cache.read_text())["elements"]:
        t = el.get("tags", {})
        if el["type"] == "way":
            shapes = polygons(el, fwd)
        else:
            line = lambda role: [LineString([fwd.transform(p["lon"], p["lat"]) for p in m["geometry"]])
                                 for m in el.get("members", []) if m.get("role") == role and len(m.get("geometry", [])) >= 2]
            outer, inner = line("outer"), line("inner")
            holes = unary_union(list(polygonize(linemerge(inner)))) if inner else None
            shapes = [o.difference(holes) if holes is not None else o for o in polygonize(linemerge(outer))] if outer else []
        for shp in shapes:
            for poly in getattr(shp, "geoms", [shp]):
                if poly.area < 0.05:
                    continue
                poly = orient(poly.simplify(0.02), 1.0)   # 2 cm: drops the collinear points member-way splits leave
                rings = [[[round(x - ax, 3), round(y - ay, 3)] for x, y in r.coords[:-1]] for r in [poly.exterior, *poly.interiors]]
                out.append({"id": f"{el['type']}/{el['id']}", "desc": t.get("description") or t.get("building:part"),
                            "min": num(t.get("min_height")) or 0.0, "max": num(t.get("height")), "roof": t.get("roof:shape"),
                            "colour": t.get("building:colour"), "roof_colour": t.get("roof:colour"), "rings": rings})
    (LM_DATA / slug / "parts.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"{slug}: {len(out)} part polygon(s) from {cache.name}")


def buildings(slug):
    """Every OSM building whose centre lies inside the footprint, with its levels/height and names, as local-metre
    rings in model/data/landmarks/<slug>/buildings.json. For landmarks that are a complex of buildings (a market,
    a campus): the exclusion ring removes them from the massing, so the landmark model must carry them."""
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    fp = json.loads((LM_DATA / slug / "footprint.json").read_text())
    ax, ay = fp["anchor_tm"]
    area = unary_union([Polygon([(ax + x, ay + y) for x, y in r]) for r in fp["rings"]])
    num = lambda v: float(str(v).split()[0].rstrip("m")) if v not in (None, "") else None
    out = []
    for el in osm(slug)["elements"]:
        t = el.get("tags", {})
        if "building" not in t:
            continue
        for poly in polygons(el, fwd):
            if poly.area < 4 or not area.contains(poly.representative_point()):
                continue
            poly = orient(poly.simplify(0.05), 1.0)
            out.append({"id": f"{el['type']}/{el['id']}", "name": t.get("name"), "building": t["building"],
                        "levels": num(t.get("building:levels")), "height": num(t.get("height")), "roof": t.get("roof:shape"),
                        "ring": [[round(x - ax, 2), round(y - ay, 2)] for x, y in poly.exterior.coords[:-1]]})
    (LM_DATA / slug / "buildings.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"{slug}: {len(out)} building(s) inside the footprint, {sum(Polygon(b['ring']).area for b in out):,.0f} m2")


MEDIAN_M = 1.0        # ESTIMATE: the planted median's width (owner's reference photo, session-road.md S3)
REACH_M = 35.0        # cross streets kept this far from the main street, so its junctions are whole
CELL_M = 6.0          # ground surfaces are cut on this grid, so every triangle can follow the terrain (the DEM is ~9 m)


def grid_mesh(geom, cell=CELL_M):
    """Triangles of `geom` cut on a `cell` grid (shared vertices, CCW), so a drape over them follows the terrain."""
    verts, index, faces = [], {}, []

    def vid(x, y):
        k = (round(x, 3), round(y, 3))
        if k not in index:
            index[k] = len(verts)
            verts.append(list(k))
        return index[k]

    if geom.is_empty:
        return {"v": [], "f": []}
    geom = areas(geom.simplify(0.3))                  # 0.3 m: below what the map can show, and far fewer vertices
    if geom.is_empty:                                 # a sliver that simplified away
        return {"v": [], "f": []}
    x0, y0, x1, y1 = geom.bounds
    for gx in np.arange(math.floor(x0 / cell) * cell, x1, cell):
        for gy in np.arange(math.floor(y0 / cell) * cell, y1, cell):
            piece = geom.intersection(box(gx, gy, gx + cell, gy + cell))
            for poly in getattr(piece, "geoms", [piece]):
                if poly.geom_type != "Polygon" or poly.area < 1e-3:
                    continue
                for tri in constrained_delaunay_triangles(poly).geoms:
                    a, b, c = tri.exterior.coords[:3]
                    turn = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
                    if abs(turn) > 1e-6:
                        faces.append([vid(*a), vid(*b), vid(*c)] if turn > 0 else [vid(*a), vid(*c), vid(*b)])
    return {"v": verts, "f": faces}


def areas(g):
    """The polygonal part of an overlay result (drops stray lines and points)."""
    return unary_union([p for p in getattr(g, "geoms", [g]) if p.geom_type in ("Polygon", "MultiPolygon") and p.area > 1e-3])


def rect(p0, p1, half):
    """A thin rectangle from p0 to p1, `half` m either side."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    nx, ny = -dy / n * half, dx / n * half
    return [[round(p0[0] + nx, 3), round(p0[1] + ny, 3)], [round(p1[0] + nx, 3), round(p1[1] + ny, 3)],
            [round(p1[0] - nx, 3), round(p1[1] - ny, 3)], [round(p0[0] - nx, 3), round(p0[1] - ny, 3)]]


def streets(slug):
    """A street at 1:1 from OSM (owner 2026-10-06: real size, with its junctions), in the model frame, to
    model/data/landmarks/<slug>/streets.json. Widths come from the map data:
    - the main road is the pair of one-way centrelines: its axis is their midline, a MEDIAN_M median on it, and
      lanes of (median separation - MEDIAN_M) / lanes each, which every other carriageway uses too;
    - asphalt: the main road plus every road meeting it, kept REACH_M from it (min 3.5 m wide), joined, with 2 m
      kerb radii at the junction corners;
    - sidewalk: from the kerb out to the median building line (rays from the centrelines), cut back to the fronts;
    - crossings: zebra bars on OSM footway=crossing lines; dashes: lane dividers, clear of junctions and crossings;
    - median_points: tree and lamp sites on the median, alternating every 12 m; awnings: 1.8 m strips along about
      70% of the building fronts (seeded), over the sidewalk."""
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    fp = json.loads((LM_DATA / slug / "footprint.json").read_text())
    ax, ay = fp["anchor_tm"]
    loc = lambda geom: [tuple(np.subtract(fwd.transform(p["lon"], p["lat"]), (ax, ay))) for p in geom]
    main_ids = {ln["id"] for ln in fp["lines"]}
    main = unary_union([LineString(ln["points"]) for ln in fp["lines"]])
    region = Point(0, 0).buffer(max(Point(0, 0).distance(Point(p)) for ln in fp["lines"] for p in ln["points"]) + 1.0)
    reach = main.buffer(REACH_M).intersection(region)
    pair = sorted(fp["lines"], key=lambda ln: -LineString(ln["points"]).length)[:2]
    A, B = LineString(pair[0]["points"]), LineString(pair[1]["points"])
    mids = [(p, B.interpolate(B.project(p))) for p in (A.interpolate(t) for t in np.arange(0.0, A.length + 1e-6, 3.0))]
    axis = LineString([((p.x + q.x) / 2, (p.y + q.y) / 2) for p, q in mids if p.distance(q) < 15])
    sep = float(np.median([p.distance(q) for p, q in mids if p.distance(q) < 15]))
    main_lanes = int(pair[0]["lanes"] or 2)
    lane = round((sep - MEDIAN_M) / main_lanes, 2)            # sep = one carriageway + the median
    kerb = MEDIAN_M / 2 + main_lanes * lane
    els = osm(slug)["elements"]
    roads, walks, crossings, blds = [], [], [], []
    for el in els:
        t = el.get("tags", {})
        if el["type"] != "way":
            continue
        if "building" in t and len(el["geometry"]) > 3:
            poly = Polygon(loc(el["geometry"]))
            if poly.is_valid and poly.distance(main) < 40:
                blds.append(poly)
        elif t.get("highway") in ("primary", "secondary", "tertiary", "residential", "unclassified", "living_street"):
            ln = LineString(loc(el["geometry"]))
            if f"way/{el['id']}" in main_ids or ln.distance(main) < 10:
                lanes = int(str(t.get("lanes", "2" if t.get("oneway") != "yes" else "1")).split(";")[0])
                roads.append((f"way/{el['id']}", t, ln, max(lanes * lane, 3.5) / 2, lanes))
        elif t.get("footway") == "sidewalk" and LineString(loc(el["geometry"])).distance(main) < 15:
            walks.append(LineString(loc(el["geometry"])))
        elif t.get("footway") == "crossing" and LineString(loc(el["geometry"])).distance(main) < REACH_M:
            crossings.append(LineString(loc(el["geometry"])))
    buildings = unary_union(blds)
    hits = []                                         # the building line, by rays out from the pair's centrelines
    for L, O in ((A, B), (B, A)):
        for t in np.arange(5.0, L.length - 5.0, 5.0):
            p = L.interpolate(t)
            o = O.interpolate(O.project(p))
            d = np.subtract((p.x, p.y), (o.x, o.y))
            d = d / np.linalg.norm(d)
            hit = LineString([(p.x, p.y), (p.x + d[0] * 25, p.y + d[1] * 25)]).intersection(buildings)
            if not hit.is_empty:
                hits.append(p.distance(hit) + sep / 2)
    band = round(float(np.median(hits)) - kerb, 2)
    pair_ids = {pair[0]["id"], pair[1]["id"]}
    ways = [(i, ln.buffer(h, quad_segs=4, cap_style="round", join_style="mitre").intersection(reach if i not in main_ids else region), t, ln, h, n)
            for i, t, ln, h, n in roads if i not in pair_ids]
    road = axis.buffer(kerb, cap_style="flat").intersection(region)
    median = axis.buffer(MEDIAN_M / 2, cap_style="flat").intersection(region).difference(unary_union([w for _, w, *_ in ways]))
    raw = unary_union([road] + [w for _, w, *_ in ways])
    asphalt = areas(raw.buffer(2.0, quad_segs=3).buffer(-2.0, quad_segs=3).intersection(reach).difference(median))   # kerb radii
    sidewalk = areas(asphalt.buffer(band, join_style="mitre").difference(asphalt).difference(median).difference(buildings).intersection(reach))
    # The cross streets belong to the city road tiles (build_roads.py): the model keeps Session Road's own carriageways
    # and each junction mouth to 3 m past its kerb (the kerb radii), and the city roads run on from there between these
    # sidewalks (owner 2026-10-06: the city roads' join to Session Road).
    own = unary_union([road] + [w for i, w, *_ in ways if i in main_ids]).buffer(3.0)
    asphalt = areas(asphalt.intersection(own))
    sites = []
    for k, t in enumerate(np.arange(6.0, axis.length - 6.0, 12.0)):
        c, c1 = axis.interpolate(t), axis.interpolate(t + 1.0)
        if median.contains(c):
            n = np.array((-(c1.y - c.y), c1.x - c.x)) / c.distance(c1)
            sites.append({"xy": [round(c.x, 3), round(c.y, 3)], "u": [round(n[0], 4), round(n[1], 4)], "kind": "tree" if k % 2 == 0 else "lamp"})
    bars = []
    for c in crossings:
        for t in np.arange(0.5, c.length - 0.25, 1.0):
            p0, p1 = c.interpolate(t - 0.25), c.interpolate(t + 0.25)
            if asphalt.contains(c.interpolate(t)):
                bars.append(rect((p0.x, p0.y), (p1.x, p1.y), 1.5))
    zebra = unary_union([c.buffer(2.5) for c in crossings]) if crossings else Polygon()
    lines = [(axis.offset_curve(sd * (MEDIAN_M / 2 + lane * k)), road) for sd in (-1, 1) for k in range(1, main_lanes)]
    for i, w, t, ln, h, n in ways:
        offs = [0.0] if t.get("oneway") != "yes" and n >= 2 else [-h + k * 2 * h / n for k in range(1, n)]
        lines += [(ln.offset_curve(o) if o else ln, w) for o in offs]
    junctions = unary_union([road.intersection(w) for _, w, *_ in ways] + [w.intersection(v) for _, w, *_ in ways for _, v, *_ in ways if w is not v])
    dashes = []
    for path, own in lines:
        for t in np.arange(1.0, path.length - 3.0, 8.0):
            p0, p1 = path.interpolate(t), path.interpolate(t + 3.0)
            c = Point((p0.x + p1.x) / 2, (p0.y + p1.y) / 2)
            if own.contains(c) and asphalt.contains(c) and not junctions.contains(c) and not zebra.contains(c) and asphalt.boundary.distance(c) > 0.3:
                dashes.append(rect((p0.x, p0.y), (p1.x, p1.y), 0.06))
    rng, taken, awnings = random.Random(1909), Polygon(), []
    for b in sorted(blds, key=lambda b: (round(b.centroid.x, 1), round(b.centroid.y, 1))):
        strip = areas(areas(b.buffer(1.8, join_style="mitre").difference(b).intersection(sidewalk)).difference(taken, grid_size=0.001))
        if strip.area > 3.0 and rng.random() < 0.7:
            taken = taken.union(strip, grid_size=0.001)
            awnings.append({"colour": rng.randrange(2), **grid_mesh(strip, 12.0)})
    out = {"lane_m": lane, "median_m": MEDIAN_M, "kerb_m": kerb, "sidewalk_band_m": band, "pair_separation_m": round(sep, 2),
           "asphalt": grid_mesh(asphalt), "sidewalk": grid_mesh(sidewalk, 9.0), "median": grid_mesh(median, 9.0), "crossings": bars,
           "dashes": dashes, "median_points": sites, "awnings": awnings,
           "ways": [{"id": i, "name": t.get("name"), "lanes": n, "oneway": t.get("oneway")} for i, _, t, _, _, n in ways]}
    (LM_DATA / slug / "streets.json").write_text(json.dumps(out) + "\n")
    # The modelled street (asphalt, median, sidewalks) as the city road tiles' exclusion (build_roads.py), so they don't
    # overlap it; the massing keeps the narrower `exclusion`, so the frontage buildings stay.
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    street = unary_union([asphalt, median, sidewalk]).buffer(-0.2)   # 0.2 m under: the city roads tuck in, no gap
    street = max(getattr(street, "geoms", [street]), key=lambda g: g.area)
    reg = json.loads(LANDMARKS.read_text())
    reg[slug]["road_exclusion"] = [[round(v, 6) for v in inv.transform(x + ax, y + ay)] for x, y in orient(street.simplify(0.3), 1.0).exterior.coords]
    LANDMARKS.write_text(json.dumps(reg, indent=2) + "\n")
    print(f"{slug}: pair {sep:.2f} m apart -> lanes {lane} m, kerb {kerb:.2f} m from the axis, building line {np.median(hits):.2f} m "
          f"(n={len(hits)}) -> sidewalk {band} m; {len(ways)} other carriageway(s) {sorted({(w['name'], w['lanes']) for w in out['ways']})}; "
          f"asphalt {asphalt.area:,.0f} m2, sidewalk {sidewalk.area:,.0f} m2, median {median.area:,.0f} m2; {len(bars)} zebra bars, "
          f"{len(dashes)} dashes, {len(sites)} median sites, {len(awnings)} awnings")


def insets(slug, args):
    """Terrace tiers that step back up a building, as local-metre rings in model/data/landmarks/<slug>/insets.json: the
    footprint's largest ring shrunk by each distance (mitred), or, given dir=ux,uy (the uphill direction), cut back by
    that distance on the downhill side only (the ring intersected with itself shifted uphill), so the uphill facade
    stays whole. Simplified at tol= m (default 0.3); the largest piece."""
    from shapely.affinity import translate
    fp = json.loads((LM_DATA / slug / "footprint.json").read_text())
    base = max((Polygon(r) for r in fp["rings"]), key=lambda q: q.area)
    u = next(([float(v) for v in a[4:].split(",")] for a in args if a.startswith("dir=")), None)
    tol = next((float(a[4:]) for a in args if a.startswith("tol=")), 0.3)
    out = {}
    for d in (a for a in args if "=" not in a):
        g = base.intersection(translate(base, u[0] * float(d), u[1] * float(d))) if u else base.buffer(-float(d), join_style="mitre")
        g = max(getattr(g.simplify(tol), "geoms", [g.simplify(tol)]), key=lambda q: q.area)
        out[d] = [[round(x, 2), round(y, 2)] for x, y in orient(g, 1.0).exterior.coords[:-1]]
        print(f"{slug}: tier {d} m -> {g.area:,.0f} m2, {len(out[d])} points")
    (LM_DATA / slug / "insets.json").write_text(json.dumps(out) + "\n")

PARK_CLASSES = {   # ground cover, highest priority first: each class is cut out of every class after it
    "pool": lambda t: t.get("leisure") == "swimming_pool" and "building" not in t,
    "track": lambda t: t.get("leisure") == "track",
    "pitch": lambda t: t.get("leisure") == "pitch" and "building" not in t,
    "playground": lambda t: t.get("leisure") == "playground",
    "plaza": lambda t: t.get("amenity") in ("parking", "marketplace") or t.get("highway") == "pedestrian" or t.get("place") == "square",
    "garden": lambda t: t.get("leisure") == "garden" or t.get("landuse") == "flowerbed",
    "wood": lambda t: t.get("natural") == "wood" or t.get("landuse") == "forest",
}
PATH_HALF = {"footway": 1.6, "path": 1.2, "cycleway": 1.6, "steps": 1.4, "pedestrian": 3.0, "service": 2.8, "unclassified": 3.2,
             "residential": 3.0, "living_street": 2.8}   # ESTIMATE half-widths: Burnham's walks are about 3 m wide


def park(slug, pid, split, *opts):
    """One part of a whole park at 1:1 from OSM (owner 2026-10-06: "the complete 3d-model of Burnham Park"), in the
    slug's frame, to model/data/landmarks/<slug>/park.json. The park polygon is cut to a box of latitudes and longitudes
    ("S:N,W:E", blank = open); a slug with a footprint keeps its anchor (a destination's pin), a new one is anchored at
    its box's centroid. stand=<id>: an open football field (100 x 64 m, ESTIMATE) in front of that grandstand, on the
    side with more open lawn (Burnham's Melvin Jones field, which OSM leaves unmapped).
    Walkways shorter than 40 m are left out (the basemap draws them), drives are cut from the lawn but left to the
    basemap, and every class is simplified at 0.4 m, to fit the tier-1 geometry budget.
    - ground: disjoint meshes per class (PARK_CLASSES, then walkways/drives buffered by PATH_HALF as "paved"/"road",
      then lawn for the rest), cut on an 8 m grid;
    - buildings (with holes: the skating rink is a ring), pitches and tracks (for markings), hedges, fences and walls,
      points (rentals, memorials, fountains, toilets, stalls, the rink), and the lake;
    - trees: wood on a jittered 12 m grid, lawn trees lining the walkways every 10 m, lone shade trees on the open lawn
      (18 m grid, 60%) and ornamentals in the gardens (12 m grid, 50%), seeded; species come from the park mix (model/flora.json)."""
    from shapely.affinity import translate
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    src = LM_DATA / "burnham-park" / "area-osm.json" if not (LM_DATA / slug / "area-osm.json").exists() else LM_DATA / slug / "area-osm.json"
    els = json.loads(src.read_text())["elements"]
    kind, num = pid.split("/")
    P = polygons(next(e for e in els if e["type"] == kind and e["id"] == int(num)), fwd)[0]
    x0, y0, x1, y1 = P.bounds
    mid = inv.transform((x0 + x1) / 2, (y0 + y1) / 2)
    (s_, n_), (w_, e_) = (tuple(v.split(":")) for v in split.split(","))     # "S:N,W:E" in degrees; blank = open
    ya = fwd.transform(mid[0], float(s_))[1] if s_ else y0 - 1
    yb = fwd.transform(mid[0], float(n_))[1] if n_ else y1 + 1
    xa = fwd.transform(float(w_), mid[1])[0] if w_ else x0 - 1
    xb = fwd.transform(float(e_), mid[1])[0] if e_ else x1 + 1
    half = box(xa, ya, xb, yb)
    stand = next((o[6:] for o in opts if o.startswith("stand=")), None)
    region = max(getattr(P.intersection(half), "geoms", [P.intersection(half)]), key=lambda g: g.area)
    fpp = LM_DATA / slug / "footprint.json"
    reg = json.loads(LANDMARKS.read_text())
    if fpp.exists():
        fp = json.loads(fpp.read_text())
        ax, ay = fp["anchor_tm"]
    else:
        c = region.centroid
        ax, ay = c.x, c.y
        fp = {"slug": slug, "anchor_lnglat": list(inv.transform(ax, ay)), "anchor_tm": [ax, ay]}
        reg[slug]["anchor"] = [round(v, 6) for v in inv.transform(ax, ay)]
    loc = lambda g: translate(g, -ax, -ay)
    R = loc(region)

    def polys(el):
        if el["type"] == "way":
            return polygons(el, fwd)
        outer = unary_union(polygons(el, fwd))
        inner = [LineString([fwd.transform(p["lon"], p["lat"]) for p in m["geometry"]]) for m in el.get("members", [])
                 if m.get("role") == "inner" and len(m.get("geometry", [])) >= 2]
        holes = unary_union(list(polygonize(linemerge(inner)))) if inner else Polygon()
        g = outer.difference(holes)
        return list(getattr(g, "geoms", [g]))

    ground = {k: [] for k in PARK_CLASSES}
    paths, roads, buildings, pitches, tracks, lines, points, lake = [], [], [], [], [], [], [], None
    for el in els:
        t = el.get("tags", {})
        if not t or (el["type"] == kind and el["id"] == int(num)):
            continue
        if el["type"] == "node":
            k = (t.get("amenity") if t.get("amenity") in ("bicycle_rental", "fountain", "toilets", "fast_food", "restaurant", "bench") else
                 "memorial" if t.get("historic") in ("memorial", "monument") else "rink" if t.get("leisure") == "pitch" else
                 "lamp" if t.get("highway") == "street_lamp" else "tree" if t.get("natural") == "tree" else None)
            q = Point(np.subtract(fwd.transform(el["lon"], el["lat"]), (ax, ay)))
            if k and R.contains(q):
                points.append({"kind": k, "name": t.get("name"), "xy": [round(q.x, 2), round(q.y, 2)]})
            continue
        if el["type"] == "way" and t.get("highway") in PATH_HALF and t.get("area") != "yes":
            ln = loc(LineString([fwd.transform(p["lon"], p["lat"]) for p in el["geometry"]]))
            if ln.intersects(R) and (ln.length >= 40 or t["highway"] not in ("footway", "path", "steps", "cycleway")):
                (roads if t["highway"] in ("service", "unclassified", "residential", "living_street") else paths).append(ln.buffer(PATH_HALF[t["highway"]], cap_style="flat"))
            continue
        if el["type"] == "way" and t.get("barrier") in ("hedge", "fence", "wall", "handrail"):
            ln = loc(LineString([fwd.transform(p["lon"], p["lat"]) for p in el["geometry"]])).intersection(R)
            for part_ in getattr(ln, "geoms", [ln]):
                if part_.geom_type == "LineString" and part_.length > 1:
                    lines.append({"kind": t["barrier"], "pts": [[round(x, 2), round(y, 2)] for x, y in part_.coords]})
            continue
        for g in polys(el):
            g = loc(g)
            if not g.is_valid or g.is_empty or not g.intersects(R):
                continue
            g = g.intersection(R)
            if g.area < 1:
                continue
            if t.get("natural") == "water" and (lake is None or g.area > lake.area):
                lake = g
                continue
            if "building" in t:
                for b in getattr(g, "geoms", [g]):
                    if b.geom_type == "Polygon":
                        num_ = lambda v: float(str(v).split()[0].rstrip("m")) if v not in (None, "") else None
                        buildings.append({"id": f"{el['type']}/{el['id']}", "kind": t["building"], "name": t.get("name"), "levels": num_(t.get("building:levels")),
                                          "height": num_(t.get("height")), "leisure": t.get("leisure"),
                                          "ring": [[round(x, 2), round(y, 2)] for x, y in orient(b.simplify(0.2), 1.0).exterior.coords[:-1]],
                                          "holes": [[[round(x, 2), round(y, 2)] for x, y in h.coords[:-1]] for h in orient(b.simplify(0.2), 1.0).interiors]})
                if t.get("leisure") != "pitch":
                    continue
            for k, test in PARK_CLASSES.items():
                if test(t):
                    ground[k].append(g)
                    if k == "pitch":
                        pitches.append({"sport": t.get("sport"), "ring": [[round(x, 2), round(y, 2)] for x, y in g.minimum_rotated_rectangle.exterior.coords[:-1]]})
                    if k == "track":
                        tracks.append({"sport": t.get("sport"), "ring": [[round(x, 2), round(y, 2)] for x, y in orient(g.simplify(0.3), 1.0).exterior.coords[:-1]]}
                                      if g.geom_type == "Polygon" else {"sport": t.get("sport"), "ring": []})
                    break
    if stand:                                     # the open field in front of the grandstand (Wikipedia: "the open field
        sb = next(b for b in buildings if b["id"] == stand)            # often used for football and the Melvin Jones Grandstand")
        sp = Polygon(sb["ring"])
        rr = list(sp.minimum_rotated_rectangle.exterior.coords)[:4]
        e = max(((np.subtract(rr[i + 1], rr[i]), i) for i in range(3)), key=lambda q: np.linalg.norm(q[0]))[0]
        u = e / np.linalg.norm(e)
        n = np.array((-u[1], u[0]))
        c = np.array(sp.centroid.coords[0])
        depth = sp.area / np.linalg.norm(e)
        busy = unary_union([Polygon(b["ring"]) for b in buildings] + paths + roads + [lake or Polygon()])
        best = None
        for sgn in (1, -1):
            fc = c + n * sgn * (depth / 2 + 6 + 32)
            q = Polygon([tuple(fc + u * a + n * b) for a, b in ((-50, -32), (50, -32), (50, 32), (-50, 32))])
            free = q.intersection(R).difference(busy).area
            if best is None or free > best[0]:
                best = (free, q)
        field = best[1]                           # kept whole: it may cross into the next part, drawn 0.1 m over its lawn
        pitches.append({"sport": "soccer", "ring": [[round(x, 2), round(y, 2)] for x, y in best[1].exterior.coords[:-1]]})
    field = field if stand else Polygon()
    taken = areas((lake or Polygon()).union(unary_union([Polygon(b["ring"]) for b in buildings if b["leisure"] != "pitch"])))
    out = {"region": [[round(x, 2), round(y, 2)] for x, y in orient(R.simplify(0.3), 1.0).exterior.coords[:-1]]}
    meshes = {}
    for k in PARK_CLASSES:
        g = areas(areas(unary_union(ground[k]).simplify(0.6).intersection(R)).difference(taken, grid_size=0.01))
        if k == "pitch" and not field.is_empty:   # the stand's field, whole, with the part's own pitches
            g = areas(g.union(areas(field.difference(taken, grid_size=0.01)), grid_size=0.01))
        meshes[k] = grid_mesh(g, 8.0)
        taken = areas(taken.union(g.intersection(R), grid_size=0.01))
    for k, gs in (("road", roads), ("paved", paths)):
        g = areas(areas(unary_union(gs).simplify(0.6).intersection(R)).difference(taken, grid_size=0.01))
        meshes[k] = grid_mesh(g, 8.0) if k == "paved" else {"v": [], "f": []}   # drives: the basemap draws them
        taken = areas(taken.union(g, grid_size=0.01))
    lawn = areas(R.difference(taken, grid_size=0.01).simplify(0.4))
    meshes["lawn"] = grid_mesh(lawn, 8.0)   # 8 m: a 12 m cell's 17 m diagonal sagged up to ~0.6 m under the map's terrain
    rng, trees = random.Random(1925), []
    wood = unary_union(ground["wood"]).intersection(R)
    gx, gy = np.meshgrid(np.arange(R.bounds[0], R.bounds[2], 12.0), np.arange(R.bounds[1], R.bounds[3], 12.0))
    for x, y in zip(gx.ravel(), gy.ravel()):
        q = Point(x + rng.uniform(-4, 4), y + rng.uniform(-4, 4))
        if wood.contains(q) and not taken.difference(wood).contains(q):
            trees.append({"xy": [round(q.x, 2), round(q.y, 2)], "kind": "pine" if rng.random() < 0.8 else "broad"})
    walks = unary_union(paths)
    edge = walks.buffer(3.5).difference(walks.buffer(2.0))
    for ln in getattr(walks.boundary, "geoms", [walks.boundary]):
        for d in np.arange(0, ln.length, 10.0):
            q = ln.interpolate(d)
            if edge.contains(q) and lawn.contains(q):
                trees.append({"xy": [round(q.x, 2), round(q.y, 2)], "kind": "pine" if rng.random() < 0.55 else "broad"})
    # lone shade trees on the open lawn, off the pitches and walks (owner 2026-10-07: Burnham was "underwhelming")
    open_lawn = lawn.difference(walks.buffer(4.0))
    gx, gy = np.meshgrid(np.arange(R.bounds[0], R.bounds[2], 18.0), np.arange(R.bounds[1], R.bounds[3], 18.0))
    for x, y in zip(gx.ravel(), gy.ravel()):
        q = Point(x + rng.uniform(-6, 6), y + rng.uniform(-6, 6))
        if rng.random() < 0.6 and open_lawn.contains(q):
            trees.append({"xy": [round(q.x, 2), round(q.y, 2)], "kind": "broad"})
    gardens = unary_union(ground["garden"]).intersection(R).difference(walks.buffer(2.5)) if ground["garden"] else None
    if gardens is not None and not gardens.is_empty:                     # ornamental trees in the gardens
        gx, gy = np.meshgrid(np.arange(R.bounds[0], R.bounds[2], 12.0), np.arange(R.bounds[1], R.bounds[3], 12.0))
        for x, y in zip(gx.ravel(), gy.ravel()):
            q = Point(x + rng.uniform(-4, 4), y + rng.uniform(-4, 4))
            if rng.random() < 0.5 and gardens.contains(q):
                trees.append({"xy": [round(q.x, 2), round(q.y, 2)], "kind": "broad"})
    out.update({"lake": [[round(x, 2), round(y, 2)] for x, y in orient(lake.simplify(0.2), 1.0).exterior.coords[:-1]] if lake else None,
                "ground": meshes, "buildings": buildings, "pitches": pitches, "tracks": tracks, "lines": lines, "points": points, "trees": trees})
    (LM_DATA / slug).mkdir(parents=True, exist_ok=True)
    (LM_DATA / slug / "park.json").write_text(json.dumps(out) + "\n")
    fp["rings"] = [out["region"]]
    fp["area_m2"] = R.area
    fpp.write_text(json.dumps(fp, indent=2) + "\n")
    ring = [[round(v, 5) for v in inv.transform(x + ax, y + ay)] for x, y in orient(R.buffer(5.0).simplify(1.0), 1.0).exterior.coords]
    reg[slug]["exclusion"] = ring
    LANDMARKS.write_text(json.dumps(reg, indent=2) + "\n")
    tri = {k: len(m["f"]) for k, m in meshes.items()}
    print(f"{slug} ({split} of {pid}): {R.area:,.0f} m2; ground triangles {tri}; {len(buildings)} buildings, "
          f"{len(pitches)} pitches, {len(tracks)} tracks, {len(lines)} lines, {len(points)} points, {len(trees)} trees; lake {'yes' if lake else 'no'}")

if __name__ == "__main__":
    cmd, slug, *rest = sys.argv[1:]
    if cmd == "candidates":
        candidates(slug)
    elif cmd == "parts":
        parts(slug)
    elif cmd == "buildings":
        buildings(slug)
    elif cmd == "streets":
        streets(slug)
    elif cmd == "insets":
        insets(slug, rest)
    elif cmd == "park":
        park(slug, *rest)
    elif cmd == "footprint-line":
        footprint_line(slug, float(rest[0]), float(rest[1]), rest[2:])
    else:
        footprint(slug, rest)
