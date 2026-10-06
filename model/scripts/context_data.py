# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2"]
# ///
"""M5 Task 5: render-only context for Blender (never shipped), from M1's Overpass extract, in the model frame:
- model/data/context/roads.npz: drivable highway polylines (densified every 3 m: within 1 m of the terrain between vertices) with their class;
- model/data/context/pines.npz: candidate pine sites on a seeded, jittered 30 m grid, at least 8 m from any building
  or road (spec §7: pines thin among houses). Blender keeps them by slope and elevation (context_pines.py).
Run: uv run model/scripts/context_data.py"""
import json

import numpy as np
import shapely
from pyproj import Transformer

from common import DATA, LOCAL_TM, OSM, PADDED

CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "service", "track"]
GRID_M, CLEAR_M = 30.0, 8.0
OUT = DATA / "context"


def main():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    roads, kinds, buildings = [], [], []
    for el in json.loads(OSM.read_text())["elements"]:
        t, g = el.get("tags", {}), el.get("geometry") or []
        if el["type"] != "way" or len(g) < 2:
            continue
        xy = np.column_stack(fwd.transform([p["lon"] for p in g], [p["lat"] for p in g]))
        kind = t.get("highway", "").removesuffix("_link")
        if kind in CLASSES:
            line = shapely.segmentize(shapely.LineString(xy), 3.0)
            roads.append(shapely.get_coordinates(line))
            kinds.append(CLASSES.index(kind))
        elif "building" in t and len(g) >= 4:
            buildings.append(shapely.Polygon(xy))
    OUT.mkdir(parents=True, exist_ok=True)
    lens = np.array([len(r) for r in roads])
    np.savez_compressed(OUT / "roads.npz", xy=np.vstack(roads).astype(np.float32), lens=lens, kinds=np.array(kinds), classes=np.array(CLASSES))
    (x0, y0), (x1, y1) = fwd.transform(PADDED[0], PADDED[1]), fwd.transform(PADDED[2], PADDED[3])
    gx, gy = np.meshgrid(np.arange(x0, x1, GRID_M), np.arange(y0, y1, GRID_M))
    rng = np.random.default_rng(1909)
    pts = np.column_stack([gx.ravel(), gy.ravel()]) + rng.uniform(-GRID_M / 2, GRID_M / 2, (gx.size, 2))
    tree = shapely.STRtree([shapely.LineString(r) for r in roads] + buildings)
    near = np.unique(tree.query(shapely.points(pts), predicate="dwithin", distance=CLEAR_M)[0])
    keep = np.ones(len(pts), bool)
    keep[near] = False
    np.savez_compressed(OUT / "pines.npz", xy=pts[keep].astype(np.float32))
    print(f"roads {len(roads):,} ({int(lens.sum()):,} vertices); pine candidates {int(keep.sum()):,} of {len(pts):,} "
          f"(clear of {len(buildings):,} buildings and the roads by {CLEAR_M:.0f} m)")


if __name__ == "__main__":
    main()
