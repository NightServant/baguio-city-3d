# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["pyproj==3.8.0", "shapely==2.1.2"]
# ///
"""Landmark procedure step B.

  uv run model/scripts/landmark_osm.py candidates <slug>       # OSM features within 250 m of the destination
  uv run model/scripts/landmark_osm.py footprint <slug> <id>…  # ids like way/123 or relation/456
  uv run model/scripts/landmark_osm.py footprint-line <slug> <radius_m> <half_width_m> <id>…   # streets
  uv run model/scripts/landmark_osm.py parts <slug>            # OSM Simple 3D Buildings parts round the footprint

Overpass needs a non-personal user agent (curl's default gets HTTP 406). Responses are cached in
model/data/landmarks/<slug>/osm.json, so re-runs don't hit the API."""
import json
import subprocess
import sys

from pyproj import Transformer
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


if __name__ == "__main__":
    cmd, slug, *rest = sys.argv[1:]
    if cmd == "candidates":
        candidates(slug)
    elif cmd == "parts":
        parts(slug)
    elif cmd == "footprint-line":
        footprint_line(slug, float(rest[0]), float(rest[1]), rest[2:])
    else:
        footprint(slug, rest)
