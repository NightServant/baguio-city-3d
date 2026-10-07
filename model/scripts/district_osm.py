# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2", "mapbox-earcut==1.0.3"]
# ///
"""Districts of detailed buildings, from OSM (owner 2026-10-07): Session Road's buildings, "the colorful apartments,
fine-dining and fast food restaurants", and "3d models of current hotels in Baguio City". Writes, per model slug,
model/data/landmarks/<slug>/footprint.json and district.json, and a map-only registry entry whose exclusion is every
modelled building's footprint shrunk by 0.5 m (`exclusion_parts`), so the massing drops exactly those buildings.
- street <slug> "<name>" <half_m> <parts>: every building whose centroid is within half_m of the named street, split
  along the street into <parts> models (slug-1, slug-2, ...; 0: about 20 buildings each); signs for the shops, restaurants, cafes, banks and
  hotels mapped in or beside each building (landscape.json);
- hotels: every OSM tourism=hotel or resort in the city's bounds (its own outline when it is a building, else the
  building it stands in or beside), not already inside a landmark; grouped by z15 tile into hotels-<x>-<y> models (a tile of over 20 by its z16 tiles).
Heights: OSM's height or building:levels x 3.2 m, else an ESTIMATE from the footprint (see the sheets).
Run: uv run model/scripts/district_osm.py street session-road-buildings "Session Road" 70 0
     uv run model/scripts/district_osm.py hotels"""
import hashlib
import json
import math
import sys

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from build_massing import load_buildings, slippy
from common import DATA, EXACT, LANDMARKS, LM_DATA, LOCAL_TM, OSM

STOREY_M = 3.2
SIGN_KINDS = ("fast_food", "restaurant", "cafe", "bank", "pharmacy", "bar", "ice_cream", "food_court", "hotel")
# Sign colours, background and lettering (sRGB): a few chains' house colours, else by kind. ESTIMATEs, not brand assets:
# plain lettering only, no logos.
BRANDS = {"Jollibee": ((214, 32, 46), (255, 255, 255)), "McDonald": ((206, 30, 36), (255, 198, 40)),
          "KFC": ((200, 20, 40), (255, 255, 255)), "Starbucks": ((0, 112, 74), (255, 255, 255)),
          "7-Eleven": ((250, 250, 248), (0, 128, 74)), "Pizza Hut": ((196, 22, 40), (255, 255, 255)),
          "Mercury Drug": ((250, 250, 248), (204, 24, 36)), "Greenwich": ((0, 120, 60), (255, 222, 60)),
          "Chowking": ((204, 36, 30), (255, 255, 255)), "Mang Inasal": ((0, 104, 56), (255, 214, 0)),
          "Red Ribbon": ((190, 22, 42), (255, 255, 255)), "Goldilocks": ((250, 210, 50), (150, 20, 30)),
          "Max's": ((180, 26, 36), (255, 255, 255)), "Dairy Queen": ((210, 30, 40), (255, 255, 255)),
          "Tokyo Tokyo": ((200, 30, 40), (255, 255, 255)), "Mister Donut": ((240, 120, 30), (255, 255, 255)),
          "Yellow Cab": ((250, 206, 20), (30, 30, 30)), "Bonchon": ((30, 30, 30), (255, 255, 255)),
          "BDO": ((0, 48, 135), (255, 255, 255)), "BPI": ((160, 20, 40), (255, 255, 255)), "PNB": ((0, 50, 120), (255, 255, 255)),
          "Metrobank": ((0, 70, 150), (255, 255, 255)), "Watsons": ((0, 150, 160), (255, 255, 255)),
          "Dunkin": ((240, 100, 30), (255, 255, 255)), "Army Navy": ((70, 80, 50), (255, 255, 255))}
KIND_COLOURS = {"fast_food": ((220, 50, 40), (255, 240, 200)), "restaurant": ((92, 34, 30), (246, 226, 190)),
                "cafe": ((70, 46, 34), (240, 224, 200)), "bank": ((20, 50, 100), (255, 255, 255)),
                "pharmacy": ((0, 120, 80), (255, 255, 255)), "bar": ((24, 24, 28), (255, 90, 160)),
                "ice_cream": ((240, 150, 190), (255, 255, 255)), "food_court": ((230, 120, 30), (255, 255, 255)),
                "hotel": ((248, 246, 240), (24, 40, 90)), "shop": ((248, 246, 240), (30, 30, 30))}
PAINT = [(236, 232, 222), (232, 220, 190), (230, 160, 130), (160, 208, 180), (150, 188, 222), (242, 212, 120),
         (196, 112, 82), (190, 170, 212), (172, 192, 142), (242, 190, 150), (186, 186, 182), (96, 160, 160)]   # ESTIMATEs


def h8(s):
    return int(hashlib.sha256(s.encode()).hexdigest()[:8], 16)


def display(name):
    for b in BRANDS:
        if name.lower().startswith(b.lower()):
            return b if b != "McDonald" else "McDonald's"
    return name


def colours(name, kind):
    for b, c in BRANDS.items():
        if name.lower().startswith(b.lower()):
            return c
    return KIND_COLOURS.get(kind, KIND_COLOURS["shop"])


def pois(fwd):
    """Named shops, eateries, banks and hotels in the model frame: (Point, name, kind)."""
    out = []
    for el in json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]:
        t = el.get("tags", {})
        name = t.get("name")
        kind = t.get("amenity") if t.get("amenity") in SIGN_KINDS else "hotel" if t.get("tourism") in ("hotel", "motel") else "shop" if "shop" in t else None
        if not name or not kind:
            continue
        if el["type"] == "node":
            p = Point(fwd.transform(el["lon"], el["lat"]))
        else:
            g = el.get("geometry") or [q for m in el.get("members", []) for q in (m.get("geometry") or [])]
            if not g:
                continue
            p = Point(fwd.transform(np.mean([q["lon"] for q in g]), np.mean([q["lat"] for q in g])))
        out.append((p, name, kind, f"{el['type']}/{el['id']}"))
    return out


def height(tags, area, oid, lo, hi):
    """Metres: OSM's height, else its levels x STOREY_M, else lo..hi storeys by footprint size and a hash (ESTIMATE)."""
    try:
        return float(str(tags.get("height", "")).removesuffix("m").strip()), "osm height"
    except ValueError:
        pass
    try:
        return int(float(tags["building:levels"])) * STOREY_M, "osm levels"
    except (KeyError, ValueError):
        pass
    k = min(1.0, math.log10(max(area, 50) / 50) / 1.6)          # 50 m2 -> 0, 2,000 m2 -> 1
    levels = round(lo + (hi - lo) * (0.7 * k + 0.3 * (h8(oid) % 100) / 100))
    return levels * STOREY_M, "estimate"


def facing(ring, target, tol=8.0):
    """Edge indices of a CCW ring that face `target` (a geometry): outward normal toward it, within tol m of the
    ring's nearest edge."""
    edges = []
    for i in range(len(ring)):
        a, b = np.array(ring[i]), np.array(ring[(i + 1) % len(ring)])
        d = b - a
        L = np.linalg.norm(d)
        if L < 2.0:
            continue
        m = (a + b) / 2
        n = np.array((d[1], -d[0])) / L
        q = target.interpolate(target.project(Point(m)))
        v = np.array((q.x, q.y)) - m
        dist = np.linalg.norm(v)
        edges.append((i, dist, float(np.dot(n, v / max(dist, 1e-9))), L))
    if not edges:
        return []
    near = min(e[1] for e in edges)
    return [i for i, dist, dot, L in edges if dot > 0.45 and dist < near + tol]


def write(slug, scope, blds, fwd, inv, sheet):
    shape = unary_union([b["geom"] for b in blds])
    c = shape.centroid
    alng, alat = inv.transform(c.x, c.y)
    rnd = lambda pts: [[round(x - c.x, 2), round(y - c.y, 2)] for x, y in pts]
    out = []
    for b in blds:
        g = orient(b["geom"].simplify(0.25), 1.0)
        ring = list(g.exterior.coords)[:-1]
        rec = {k: v for k, v in b.items() if k not in ("geom", "target")}
        rec["ring"] = rnd(ring)
        rec["front"] = facing(rec["ring"], shapely.transform(b["target"], lambda q: q - np.array([c.x, c.y]))) if b.get("target") is not None else []
        out.append(rec)
    d = LM_DATA / slug
    d.mkdir(parents=True, exist_ok=True)
    (d / "footprint.json").write_text(json.dumps({"slug": slug, "anchor_lnglat": [alng, alat], "anchor_tm": [c.x, c.y],
                                                  "rings": [r["ring"] for r in out], "area_m2": shape.area}) + "\n")
    (d / "district.json").write_text(json.dumps({"slug": slug, "buildings": out}, indent=1) + "\n")
    parts = []
    for b in blds:
        g = b["geom"].buffer(-0.5)
        for p in getattr(g, "geoms", [g]):
            if not p.is_empty and p.geom_type == "Polygon":
                parts.append([[round(v, 6) for v in inv.transform(x, y)] for x, y in p.exterior.coords])
    reg = json.loads(LANDMARKS.read_text())
    reg[slug] = {"tier": 1, "scope": scope, "osm_ids": [b["id"] for b in blds], "exclusion": [], "exclusion_parts": parts,
                 "anchor": [round(alng, 6), round(alat, 6)], "sheet": sheet, "status": "map-only", "district": True}
    LANDMARKS.write_text(json.dumps(reg, indent=2) + "\n")
    print(f"{slug}: {len(blds)} buildings, {sum(len(b.get('signs', [])) for b in out)} signs, anchor {alng:.6f},{alat:.6f}")


def taken(fwd):
    """Every landmark's footprint (its exclusion), so districts never re-model a landmark's buildings."""
    gs = []
    for e in json.loads(LANDMARKS.read_text()).values():
        if e.get("district"):
            continue
        if e.get("exclusion"):
            gs.append(Polygon([fwd.transform(*q) for q in e["exclusion"]]))
    return unary_union(gs)


def assign_signs(blds, fwd, kinds):
    """Each named POI to the building it stands in, or the nearest within 8 m; at most 4 signs a building."""
    from shapely.strtree import STRtree
    tree = STRtree([b["geom"] for b in blds])
    for p, name, kind, pid in pois(fwd):
        if kind not in kinds:
            continue
        i = tree.nearest(p)
        if blds[i]["geom"].distance(p) > 8.0:
            continue
        signs = blds[i].setdefault("signs", [])
        if len(signs) < 4 and all(s["text"] != display(name) for s in signs):
            bg, fg = colours(name, kind)
            signs.append({"text": display(name), "kind": kind, "bg": bg, "fg": fg, "osm": pid})
    for b in blds:
        b.setdefault("signs", [])
        b["signs"].sort(key=lambda s: (SIGN_KINDS + ("shop",)).index(s["kind"]))   # eateries first on the frontage


def street(slug, name, half_m, nparts):
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    lines = [LineString([fwd.transform(p["lon"], p["lat"]) for p in el["geometry"]]) for el in json.loads(OSM.read_text())["elements"]
             if el["type"] == "way" and el.get("tags", {}).get("name") == name and el.get("tags", {}).get("highway")]
    axis = unary_union(lines)
    other = taken(fwd)
    blds = []
    for oid, tags, g in load_buildings():
        tm = shapely.transform(g, lambda q: np.column_stack(fwd.transform(q[:, 0], q[:, 1])))
        if tm.geom_type != "Polygon" or tm.area < 12 or axis.distance(tm.centroid) > half_m or other.contains(tm.centroid):
            continue
        h, src = height(tags, tm.area, oid, 3, 7)                     # S3 of session-road.md: 4 to 8 storeys
        kind = "apartment" if tags.get("building") in ("apartments", "residential", "house") else "commercial"
        blds.append({"id": oid, "geom": tm, "target": axis, "height": round(h, 1), "height_source": src,
                     "levels": max(1, round(h / STOREY_M)), "kind": kind, "paint": h8(oid) % len(PAINT),
                     "shopfront": True, "tags": {k: tags[k] for k in ("building", "name") if k in tags}})
    assign_signs(blds, fwd, SIGN_KINDS + ("shop",))
    for b in blds:                                                     # upper floors: flats over the shops (S3)
        if b["kind"] == "commercial" and h8(b["id"] + "flats") % 100 < 55:
            b["kind"] = "apartment"
    # split along the street: by the centroid's position along the longest centreline; 0 parts: about 20 buildings each
    main = max(lines, key=lambda ln: ln.length)
    blds.sort(key=lambda b: main.project(b["geom"].centroid))
    nparts = nparts or max(1, math.ceil(len(blds) / 20))
    drop(lambda s: s.startswith(f"{slug}-"))
    for k, chunk in enumerate(np.array_split(np.arange(len(blds)), nparts)):
        write(f"{slug}-{k + 1}", f"{name}'s buildings, part {k + 1} of {nparts}: colourful facades, shopfronts with the tenants' "
              "signs, balconies and rooftop water tanks", [blds[i] for i in chunk], fwd, inv, f"model/landmarks/{slug}.md")


def drop(match):
    """Remove the registry entries a regeneration replaces (pack_landmark.py --prune then drops their GLBs)."""
    reg = json.loads(LANDMARKS.read_text())
    LANDMARKS.write_text(json.dumps({k: v for k, v in reg.items() if not match(k)}, indent=2) + "\n")


def hotels():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    from shapely.strtree import STRtree
    allb = [(oid, tags, shapely.transform(g, lambda q: np.column_stack(fwd.transform(q[:, 0], q[:, 1])))) for oid, tags, g in load_buildings()]
    allb = [b for b in allb if b[2].geom_type == "Polygon" and b[2].is_valid]
    btree = STRtree([b[2] for b in allb])
    roads = [LineString([fwd.transform(p["lon"], p["lat"]) for p in el["geometry"]]) for el in json.loads(OSM.read_text())["elements"]
             if el["type"] == "way" and el.get("tags", {}).get("highway") in ("primary", "secondary", "tertiary", "residential",
                                                                              "unclassified", "trunk", "service", "living_street")]
    rtree = STRtree(roads)
    other = unary_union([taken(fwd)] + [Polygon([fwd.transform(*q) for q in pt]) for e in json.loads(LANDMARKS.read_text()).values()
                                         if e.get("district") and not str(e.get("sheet", "")).endswith("hotels.md") for pt in e.get("exclusion_parts", [])])
    box_ = shapely.box(*[v for xy in (fwd.transform(EXACT[0], EXACT[1]), fwd.transform(EXACT[2], EXACT[3])) for v in xy])
    seen, groups = set(), {}
    for el in json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]:
        t = el.get("tags", {})
        if t.get("tourism") not in ("hotel", "resort") or not t.get("name"):
            continue
        if el["type"] == "node":
            p = Point(fwd.transform(el["lon"], el["lat"]))
            cand = [int(i) for i in btree.query(p.buffer(15.0))]
            cand = sorted(cand, key=lambda i: allb[i][2].distance(p))[:1]
        else:
            g = el.get("geometry") or []
            if len(g) < 4:
                continue
            area = Polygon([fwd.transform(q["lon"], q["lat"]) for q in g])
            if not area.is_valid:
                area = area.buffer(0)
            p = area.centroid
            cand = [int(i) for i in btree.query(area, predicate="intersects") if allb[int(i)][2].intersection(area).area > 0.5 * allb[int(i)][2].area]
        if not box_.contains(p):
            continue
        for i in cand:
            oid, tags, g = allb[i]
            if oid in seen or other.contains(g.centroid):
                continue
            seen.add(oid)
            h, src = height(tags, g.area, oid, 3, 7)
            near = [roads[int(j)] for j in rtree.query(g.buffer(40.0))]
            target = min(near, key=lambda ln: ln.distance(g)) if near else None
            stars = t.get("stars", "")
            b = {"id": oid, "geom": g, "target": target, "height": round(h, 1), "height_source": src, "levels": max(1, round(h / STOREY_M)),
                 "kind": "hotel", "paint": h8(oid) % len(PAINT), "shopfront": False, "hotel": t["name"], "stars": stars,
                 "tags": {k: tags[k] for k in ("building", "name") if k in tags},
                 "signs": [{"text": t["name"], "kind": "hotel", "bg": KIND_COLOURS["hotel"][0], "fg": KIND_COLOURS["hotel"][1], "osm": f"{el['type']}/{el['id']}"}]}
            lng, lat = inv.transform(g.centroid.x, g.centroid.y)
            groups.setdefault(slippy(lng, lat, 15), []).append(b)
    drop(lambda s: s.startswith("hotels-"))
    for (x, y), blds in list(groups.items()):          # a crowded tile (the city centre) splits into its z16 tiles (budget)
        if len(blds) > 20:
            del groups[(x, y)]
            for b in blds:
                lng, lat = inv.transform(b["geom"].centroid.x, b["geom"].centroid.y)
                groups.setdefault(slippy(lng, lat, 16), []).append(b)
    for (x, y), blds in sorted(groups.items()):
        write(f"hotels-{x}-{y}", f"The hotels in z15 tile {x}/{y}: {', '.join(sorted({b['hotel'] for b in blds}))}", blds, fwd, inv,
              "model/landmarks/hotels.md")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "street":
        street(sys.argv[2], sys.argv[3], float(sys.argv[4]), int(sys.argv[5]))
    elif cmd == "hotels":
        hotels()
