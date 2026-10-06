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
    geom = areas(geom.simplify(0.2))                  # 0.2 m: below what the map can show, and far fewer vertices
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
    print(f"{slug}: pair {sep:.2f} m apart -> lanes {lane} m, kerb {kerb:.2f} m from the axis, building line {np.median(hits):.2f} m "
          f"(n={len(hits)}) -> sidewalk {band} m; {len(ways)} other carriageway(s) {sorted({(w['name'], w['lanes']) for w in out['ways']})}; "
          f"asphalt {asphalt.area:,.0f} m2, sidewalk {sidewalk.area:,.0f} m2, median {median.area:,.0f} m2; {len(bars)} zebra bars, "
          f"{len(dashes)} dashes, {len(sites)} median sites, {len(awnings)} awnings")


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
    elif cmd == "footprint-line":
        footprint_line(slug, float(rest[0]), float(rest[1]), rest[2:])
    else:
        footprint(slug, rest)
