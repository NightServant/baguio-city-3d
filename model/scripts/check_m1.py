# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["rasterio==1.5.2"]
# ///
"""M1 gates. Run: uv run model/scripts/check_m1.py [dem|osm|all]   (default: all)

Exits 1 if any check fails. Thresholds come from docs/baguio-3d-model-plan.md and
docs/superpowers/plans/2026-10-01-baguio-3d-model-m1.md; never loosen one to pass."""
import json
import re
import sys

import numpy as np
import rasterio

from common import DEM, EXACT, OSM, PAD, PADDED, ROOT, file_hash, load_sources

PIXEL = 1 / 3600                                  # GLO-30 post spacing below 50° latitude
ANCHOR_TOLERANCE_M = 35                           # Phase 9 M1 gate
MINES_RIDGE = (120.628, 16.417)                   # spec §5 registration check
MINES_RIDGE_M, MINES_RIDGE_TOLERANCE_M = 1530, 25
OSM_BUILDINGS, OSM_TOLERANCE = 120_751, 0.01      # Overpass count for EXACT, 2026-09-22 (spec §2)
OSM_HIGHWAYS = 16_799                             # same survey; reported, not gated

failures = 0


def check(ok, name, detail):
    global failures
    failures += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


def check_constants():
    ts = (ROOT / "lib" / "constants.ts").read_text()
    m = re.search(r"BAGUIO_BOUNDS[^=]*=\s*\[([^\]]+)\]", ts)
    bounds = tuple(float(v) for v in m.group(1).split(",") if v.strip())
    check(bounds == EXACT, "bounds match lib/constants.ts", str(bounds))
    view = (ROOT / "components" / "map" / "MapView.tsx").read_text()
    pad = float(re.search(r"pad = ([0-9.]+)", view).group(1))
    check(pad == PAD, "pad matches MapView expandBounds()", str(pad))


def check_source(key, algo):
    entry = load_sources().get(key)
    if not entry:
        return check(False, f"{key} recorded in model/sources.json", "missing; run its fetch script")
    path = ROOT / entry["file"]
    if not path.exists():
        return check(False, f"{key} download present", f"{entry['file']} missing; run its fetch script")
    check(file_hash(path, algo) == entry[algo], f"{key} {algo} matches model/sources.json", entry["file"])


def check_dem():
    check_source("copernicus-glo30", "sha256")
    if not DEM.exists():
        return check(False, "DEM clip exists", f"{DEM.relative_to(ROOT)} missing; run fetch_dem.py")
    features = json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]
    with rasterio.open(DEM) as d:
        check(d.crs.to_epsg() == 4326, "DEM CRS is EPSG:4326", str(d.crs))
        check(all(abs(r - PIXEL) < 1e-9 for r in d.res), "DEM posts are 1 arc-second", str(d.res))
        b = d.bounds  # (left, bottom, right, top), same order as PADDED
        covers = b.left <= PADDED[0] and b.bottom <= PADDED[1] and b.right >= PADDED[2] and b.top >= PADDED[3]
        tight = all(abs(x - y) < PIXEL for x, y in zip(b, PADDED))
        check(covers and tight, "DEM covers the padded bounds, within one post", str(tuple(round(v, 5) for v in b)))
        z = d.read(1)
        check(bool(np.isfinite(z).all()) and float(z.min()) > -50, "DEM has no voids",
              f"min {float(z.min()):.1f} m, max {float(z.max()):.1f} m")
        cop = [float(v[0]) for v in d.sample([tuple(f["geometry"]["coordinates"]) for f in features])]
        ridge = float(next(d.sample([MINES_RIDGE]))[0])
    diffs = []
    for f, c in zip(features, cop):
        t = f["properties"]["elevation_m"]
        diffs.append(c - t)
        check(abs(c - t) <= ANCHOR_TOLERANCE_M, f"anchor {f['properties']['slug']}",
              f"Copernicus {c:.1f} m vs Terrarium {t} m ({c - t:+.1f})")
    print(f"INFO  mean Copernicus minus Terrarium: {sum(diffs) / len(diffs):+.1f} m over {len(diffs)} anchors")
    check(abs(ridge - MINES_RIDGE_M) <= MINES_RIDGE_TOLERANCE_M, "Mines View ridge registration",
          f"{ridge:.1f} m at {MINES_RIDGE}, expected about {MINES_RIDGE_M}")


def in_exact(el):
    """Overpass's bbox semantics for ways and relations, approximated by their bounds: footprints are small."""
    b = el.get("bounds")
    w, s, e, n = EXACT
    return bool(b) and b["minlon"] <= e and b["maxlon"] >= w and b["minlat"] <= n and b["maxlat"] >= s


def check_osm():
    check_source("osm-overpass", "md5")
    if not OSM.exists():
        return check(False, "OSM extract exists", f"{OSM.relative_to(ROOT)} missing; run fetch_osm.py")
    els = json.loads(OSM.read_text())["elements"]
    check(all(el.get("geometry") or el.get("members") for el in els), "every element carries geometry", f"{len(els):,} elements")
    buildings = sum(1 for el in els if "building" in el.get("tags", {}) and in_exact(el))
    highways = sum(1 for el in els if el["type"] == "way" and "highway" in el.get("tags", {}) and in_exact(el))
    off = (buildings - OSM_BUILDINGS) / OSM_BUILDINGS
    check(abs(off) <= OSM_TOLERANCE, "OSM buildings in the model bounds",
          f"{buildings:,} vs {OSM_BUILDINGS:,} on 2026-09-22 ({off:+.2%})")
    print(f"INFO  OSM highway ways in the model bounds: {highways:,} (2026-09-22: {OSM_HIGHWAYS:,})")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    check_constants()
    if what in ("dem", "all"):
        check_dem()
    if what in ("osm", "all"):
        check_osm()
    print("\nM1 gates pass" if not failures else f"\n{failures} check(s) failed")
    sys.exit(1 if failures else 0)
