# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pillow==11.3.0", "shapely==2.1.2"]
# ///
"""Land cover for the 3D trees, shrubs and rocks (build_flora.py): ESA WorldCover 2021 (10 m, fetch_worldcover.py) on a
2x grid (about 4.6 m), overridden by OSM's own areas (landscape.json): woods and forests, grassland, scrub, farmland and
orchards (not over WorldCover's built-up land: OSM's woods are drawn coarse), lawns (gardens, pitches, playgrounds,
grass, cemeteries) and bare rock, scree and cliffs. The map's ground itself is satellite imagery (owner 2026-10-07).
Writes model/data/landcover/classes.npz. Run: uv run model/scripts/build_landcover.py"""
import json
import math

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import LineString, MultiPolygon, Polygon
from shapely.ops import linemerge, polygonize, unary_union

from common import DATA

NONE, FOREST, GRASS, LAWN, SCRUB, CROP, ROCK, WATER = range(8)
WORLDCOVER = {10: FOREST, 20: SCRUB, 30: GRASS, 40: CROP, 50: NONE, 60: ROCK, 70: ROCK, 80: WATER, 90: GRASS, 95: FOREST, 100: GRASS}
# OSM areas, applied in this order (a later class overrides an earlier one where they overlap)
OSM_CLASSES = [
    (FOREST, {"landuse": {"forest"}, "natural": {"wood"}}),
    (GRASS, {"natural": {"grassland", "heath"}, "landuse": {"meadow", "greenfield"}}),
    (SCRUB, {"natural": {"scrub", "shrubbery"}}),
    (CROP, {"landuse": {"farmland", "orchard", "allotments", "plant_nursery"}}),
    (LAWN, {"leisure": {"garden", "pitch", "playground", "golf_course"},
            "landuse": {"grass", "village_green", "recreation_ground", "cemetery", "flowerbed"}}),
    (ROCK, {"natural": {"bare_rock", "scree", "rock", "stone"}}),
]
CLIFF_M = 6.0                    # a cliff line drawn this wide in rock
CLASSES = DATA / "landcover" / "classes.npz"
LAT0 = 16.4                      # the city's latitude (metres a degree of longitude)


def osm_areas():
    """[(class, shapely geometry in lon/lat)] from landscape.json, in OSM_CLASSES order, plus cliffs as lines."""
    els = json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]
    out, cliffs = {c: [] for c, _ in OSM_CLASSES}, []
    for el in els:
        t = el.get("tags", {})
        if t.get("natural") == "cliff" and el["type"] == "way":
            cliffs.append(LineString([(p["lon"], p["lat"]) for p in el["geometry"]]))
            continue
        cls = next((c for c, rule in reversed(OSM_CLASSES) if any(t.get(k) in v for k, v in rule.items())), None)
        if cls is None:
            continue
        g = polygon(el)
        if g is not None:
            out[cls].append(g)
    return out, cliffs


def polygon(el):
    """A closed way or a multipolygon relation (outer and inner members stitched) as a shapely geometry, else None."""
    if el["type"] == "way":
        g = el.get("geometry") or []
        if len(g) < 4 or (g[0]["lon"], g[0]["lat"]) != (g[-1]["lon"], g[-1]["lat"]):
            return None
        p = Polygon([(q["lon"], q["lat"]) for q in g])
    elif el["type"] == "relation":
        parts = {"outer": [], "inner": []}
        for m in el.get("members", []):
            if m.get("type") == "way" and m.get("role", "outer") in parts and m.get("geometry"):
                parts[m.get("role") or "outer"].append(LineString([(q["lon"], q["lat"]) for q in m["geometry"]]))
        if not parts["outer"]:
            return None
        p = unary_union(list(polygonize(linemerge(parts["outer"]))))
        if parts["inner"]:
            p = p.difference(unary_union(list(polygonize(linemerge(parts["inner"])))))
    else:
        return None
    p = p.buffer(0) if not p.is_valid else p
    return p if not p.is_empty and isinstance(p, (Polygon, MultiPolygon)) else None


def classes():
    """WorldCover on a 2x grid, overridden by OSM's areas; saved with its grid for build_flora.py."""
    wc = np.load(DATA / "landcover" / "worldcover.npz")
    lut = np.zeros(256, np.uint8)
    for k, v in WORLDCOVER.items():
        lut[k] = v
    cls = np.repeat(np.repeat(lut[wc["classes"]], 2, 0), 2, 1)
    west, north, dx, dy = float(wc["west"]), float(wc["north"]), float(wc["dx"]) / 2, float(wc["dy"]) / 2
    px = lambda xy: [((x - west) / dx, (north - y) / dy) for x, y in xy]
    areas, cliffs = osm_areas()
    h, w = cls.shape
    for c, _ in OSM_CLASSES:
        mask = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(mask)
        for g in areas[c]:
            for p in getattr(g, "geoms", [g]):
                d.polygon(px(p.exterior.coords), fill=1)
                for hole in p.interiors:
                    d.polygon(px(hole.coords), fill=0)
        if c == ROCK:
            for ln in cliffs:
                d.line(px(ln.coords), fill=1, width=max(1, round(CLIFF_M / (dx * 111_320 * math.cos(math.radians(LAT0))))))
        m = np.asarray(mask, bool) & (cls != WATER)
        if c not in (LAWN, ROCK):        # OSM's woods and farms are coarse: they never cover WorldCover's buildings
            m &= cls != NONE
        cls[m] = c
        print(f"OSM class {c}: {len(areas[c])} areas, {m.mean():.2%} of the grid")
    CLASSES.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CLASSES, classes=cls, west=west, north=north, dx=dx, dy=dy)
    vals, counts = np.unique(cls, return_counts=True)
    print("classes:", {int(v): f"{n / cls.size:.1%}" for v, n in zip(vals, counts)})


if __name__ == "__main__":
    classes()
