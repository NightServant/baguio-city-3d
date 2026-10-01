# Baguio 3D Model, M1: Source Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the two source datasets for the Blender model on disk, clipped to the map's padded bounds, with their provenance recorded and every M1 gate passing from one command.

**Architecture:** Three small Python scripts under `model/scripts/` share one module (`common.py`) for the area, paths and the source ledger. `fetch_dem.py` downloads the Copernicus GLO-30 tile and clips it. `fetch_osm.py` downloads a dated Geofabrik Philippines extract and clips it with osmium. `check_m1.py` runs the gates. Downloads live in a gitignored `model/data/`. The committed `model/sources.json` records the URL, date, size, checksum, licence and attribution of each download.

**Tech Stack:** Python 3.13 via `uv run` with PEP 723 inline dependencies (`rasterio==1.5.2`, which bundles GDAL 3.12.2), `osmium-tool` 1.19 from Homebrew, `curl`.

**Spec:** `docs/baguio-3d-model-plan.md` (§2 sources and OSM counts, §3(c) elevation audit, §5 terrain checks, the 24 September and 1 October addenda). The milestone and its gate are in Phase 9 of `docs/superpowers/plans/2026-09-24-baguio-3d-site-overhaul.md`:

> M1 | Data: Copernicus GLO-30 DEM for the padded bounds; Geofabrik Philippines OSM extract clipped to the bounds | DEM agrees with the app's Terrarium DEM at the 15 trusted anchors (±35 m); OSM building count within 1% of 120,751.

## Measured while writing this plan (2026-10-01)

These are facts, not assumptions. The tasks rely on them.

| What | Result |
|---|---|
| Copernicus tile `Copernicus_DSM_COG_10_N16_00_E120_00_DEM.tif` on the public S3 bucket `copernicus-dem-30m` | HTTP 200, no key, 32,368,281 bytes, last modified 2022-05-09. EPSG:4326, 3600 × 3600 posts, 1 arc-second, float32, no nodata. It covers N16 to N17 and E120 to E121, so one tile holds all of the padded bounds |
| `rasterio` 1.5.2 through `uv run --python 3.13` | Works; reports GDAL 3.12.2. Reads the tile straight from S3 |
| Copernicus vs the app's Terrarium heights at all 22 destinations | Max difference **10.1 m** (`la-trinidad-strawberry-farms`, +10.1). Mean −2.4 m, mean absolute 5.2 m. `data/geojson/landmarks.geojson` `elevation_m` holds Terrarium z15 samples since overhaul Task 4 |
| Copernicus at the Mines View ridge `120.628, 16.417` | 1,537.9 m (spec §5 expects about 1,530) |
| Geofabrik `philippines-latest.osm.pbf` with curl | **Redirect loop** (301 to itself, with or without a browser user agent). Dated files work: `philippines-260930.osm.pbf` is HTTP 200, 608,069,215 bytes, md5 `e8fa39b6bbf92e02908c3be522f4b087`. The listing at `philippines.html` links the recent dated dailies |
| Local tools | `uv`, `curl`, `brew` present. **No** GDAL, osmium, or numpy installed globally. Homebrew `osmium-tool` 1.19.1 has a bottle (deps: boost, lz4) |
| Disk | 21 GiB free. M1 writes about 650 MB |
| Copernicus licence | Free for the public. Notice for adapted data: "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved". The AWS registry also asks for "Copernicus Digital Elevation Model (DEM) was accessed on DATE from https://registry.opendata.aws/copernicus-dem". Vertical datum EGM2008 (EPSG:3855) |

**One deliberate tightening of the gate:** the spec checks 15 "trusted" anchors. That list came from comparing the old database values with the DEM. Since Task 4, all 22 `elevation_m` values are Terrarium samples, so M1 checks all 22 at the same ±35 m. That covers every anchor the spec names, and the planning measurement shows all 22 pass with a wide margin.

## Global Constraints

- **Area.** Exact bounds = `BAGUIO_BOUNDS` in `lib/constants.ts`: `[120.5, 16.3, 120.7, 16.5]`. Padded bounds = exact ± `0.03`, the default `pad` of `expandBounds()` in `components/map/MapView.tsx`, which is the camera's `maxBounds`. `check_m1.py` fails if either drifts.
- **Truth rule.** Every threshold traces to the spec or to this plan's measurements. Never loosen a gate to make it pass. If a gate fails, stop and report the numbers (see "If a gate fails").
- **Data stays out of git.** `model/data/` is gitignored. Commit only scripts and `model/sources.json`.
- **Python only through `uv run`**, pinned in each script's PEP 723 block. Never `pip install` globally. The only system install is `brew install osmium-tool`.
- **No web app changes in M1.** Nothing under `app/`, `components/`, `lib/`, `public/`, `stores/`, `prisma/` or `supabase/` changes.
- **No Blender in M1.** Blender work starts at M2. Every Blender step is then written against the live `bpy` API (spec §4.0).
- **Branch:** `feat/3d-model`, created from `main`. Merge to `main` only when the owner says so.
- **Commit messages** are plain sentences (match `git log`) and end with the attribution trailer the harness supplies: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Ledger:** append M1's results to `docs/superpowers/plans/2026-09-24-ledger.md` (append-only).

## File map

| File | Responsibility |
|---|---|
| `.gitignore` | add `/model/data/` |
| `model/scripts/common.py` | area constants, paths, osmium bbox format, file hashing, `sources.json` load/save |
| `model/scripts/fetch_dem.py` | download the Copernicus tile, record its source, clip to padded bounds |
| `model/scripts/fetch_osm.py` | download the dated Geofabrik extract, verify md5, record its source, clip to padded bounds |
| `model/scripts/check_m1.py` | all M1 gates; `dem`, `osm` or `all` |
| `model/sources.json` | committed provenance for every download (written by the fetch scripts) |
| `model/data/raw/…` | gitignored downloads |
| `model/data/dem/copernicus-glo30-baguio.tif` | gitignored DEM clip (M2's input) |
| `model/data/osm/baguio-padded.osm.pbf` | gitignored OSM clip (M5's input) |

**Out of scope for M1, and why:** reprojecting the DEM to UTM 51N (spec §5 step 2) belongs to M2. The format depends on how Blender imports the terrain, and that has to be decided against the live `bpy` API. Exporting OSM layers to GeoJSON (spec §12 Phase 1) belongs to M5, when roads and buildings first consume them.

---

### Task 0: Branch

- [ ] **Step 1: Switch to the branch this plan was committed on**

```bash
git switch feat/3d-model
git log --oneline -1
```

Expected: `Switched to branch 'feat/3d-model'`; the top commit adds this plan. The branch was cut from `main` at `caa285a`.

---

### Task 1: The DEM, its source record, and the DEM gates

**Files:**
- Modify: `.gitignore`
- Create: `model/scripts/common.py`, `model/scripts/check_m1.py`, `model/scripts/fetch_dem.py`
- Generated and committed: `model/sources.json`

**Interfaces:**
- Produces, in `common.py`: `ROOT: Path`, `DATA: Path`, `SOURCES: Path`, `EXACT: tuple[float, float, float, float]`, `PAD: float`, `PADDED: tuple[float, float, float, float]` (all as `(minLng, minLat, maxLng, maxLat)`), `DEM: Path`, `OSM: Path`, `bbox_arg(b) -> str` (osmium `--bbox` form, e.g. `"120.47,16.27,120.73,16.53"`), `file_hash(path, algo: str) -> str` (hex digest, `algo` is `"sha256"` or `"md5"`), `load_sources() -> dict`, `save_sources(sources: dict) -> None`.
- Produces, in `check_m1.py`: `check(ok: bool, name: str, detail: str) -> None` (prints PASS/FAIL and counts failures), `check_constants()`, `check_source(key: str, algo: str)`, `check_dem()`, a `__main__` that takes `dem|osm|all`.
- Produces the `sources.json` key `"copernicus-glo30"` with fields `url, file, retrieved, bytes, sha256, vertical_datum, licence, attribution, access_note`.

- [ ] **Step 1: Ignore the data directory**

Append to `.gitignore`:

```gitignore

# 3D model source data (downloads and derived rasters; provenance is in model/sources.json)
/model/data/
```

- [ ] **Step 2: Write `model/scripts/common.py`**

```python
"""Shared by the model's data scripts: the area, file locations, and the source ledger."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "model" / "data"
SOURCES = ROOT / "model" / "sources.json"

# (minLng, minLat, maxLng, maxLat). Must equal BAGUIO_BOUNDS in lib/constants.ts; check_m1.py enforces it.
EXACT = (120.5, 16.3, 120.7, 16.5)
# Must equal expandBounds()'s default pad in components/map/MapView.tsx (the camera's maxBounds).
PAD = 0.03
PADDED = tuple(round(v, 6) for v in (EXACT[0] - PAD, EXACT[1] - PAD, EXACT[2] + PAD, EXACT[3] + PAD))

DEM = DATA / "dem" / "copernicus-glo30-baguio.tif"
OSM = DATA / "osm" / "baguio-padded.osm.pbf"


def bbox_arg(b):
    """osmium's --bbox form: minLng,minLat,maxLng,maxLat."""
    return ",".join(f"{v:g}" for v in b)


def file_hash(path, algo):
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_sources():
    return json.loads(SOURCES.read_text()) if SOURCES.exists() else {}


def save_sources(sources):
    SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")
```

- [ ] **Step 3: Write the gates first, `model/scripts/check_m1.py`**

```python
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

from common import DEM, EXACT, PAD, PADDED, ROOT, file_hash, load_sources

PIXEL = 1 / 3600                                  # GLO-30 post spacing below 50° latitude
ANCHOR_TOLERANCE_M = 35                           # Phase 9 M1 gate
MINES_RIDGE = (120.628, 16.417)                   # spec §5 registration check
MINES_RIDGE_M, MINES_RIDGE_TOLERANCE_M = 1530, 25

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


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    check_constants()
    if what in ("dem", "all"):
        check_dem()
    print("\nM1 gates pass" if not failures else f"\n{failures} check(s) failed")
    sys.exit(1 if failures else 0)
```

- [ ] **Step 4: Run the gates and watch them fail**

Run: `uv run model/scripts/check_m1.py dem`
Expected: two PASS lines for the constants, then `FAIL  copernicus-glo30 recorded in model/sources.json: missing; run its fetch script` and `FAIL  DEM clip exists: …`, ending `2 check(s) failed`, exit code 1. The first run downloads rasterio and numpy wheels into uv's cache.

- [ ] **Step 5: Write `model/scripts/fetch_dem.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["rasterio==1.5.2"]
# ///
"""M1: fetch the Copernicus GLO-30 tile that covers Baguio and clip it to the padded map bounds.

Output: model/data/dem/copernicus-glo30-baguio.tif, EPSG:4326, EGM2008 heights in metres,
1 arc-second posts. Run: uv run model/scripts/fetch_dem.py"""
import datetime
import math
import os
import subprocess

import rasterio
from rasterio.windows import Window, from_bounds

from common import DATA, DEM, PADDED, ROOT, file_hash, load_sources, save_sources

# One 1°x1° tile (N16-17, E120-121) holds all of PADDED.
TILE = "Copernicus_DSM_COG_10_N16_00_E120_00_DEM"
URL = f"https://copernicus-dem-30m.s3.amazonaws.com/{TILE}/{TILE}.tif"
RAW = DATA / "raw" / f"{TILE}.tif"
LICENCE = ("https://dataspace.copernicus.eu/explore-data/data-collections/"
           "copernicus-contributing-missions/collections-description/COP-DEM")
ATTRIBUTION = ("produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH "
               "2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved")


def download():
    RAW.parent.mkdir(parents=True, exist_ok=True)
    part = RAW.with_suffix(".part")
    subprocess.run(["curl", "-fSL", "--retry", "3", "-o", str(part), URL], check=True)
    os.replace(part, RAW)
    today = datetime.date.today().isoformat()
    sources = load_sources()
    sources["copernicus-glo30"] = {
        "url": URL,
        "file": str(RAW.relative_to(ROOT)),
        "retrieved": today,
        "bytes": RAW.stat().st_size,
        "sha256": file_hash(RAW, "sha256"),
        "vertical_datum": "EGM2008 (EPSG:3855)",
        "licence": LICENCE,
        "attribution": ATTRIBUTION,
        "access_note": f"Copernicus Digital Elevation Model (DEM) was accessed on {today} "
                       "from https://registry.opendata.aws/copernicus-dem",
    }
    save_sources(sources)


def clip():
    with rasterio.open(RAW) as src:
        w = from_bounds(*PADDED, transform=src.transform)
        # Snap outward to whole posts so the clip always covers PADDED.
        c0, r0 = math.floor(w.col_off), math.floor(w.row_off)
        c1, r1 = math.ceil(w.col_off + w.width), math.ceil(w.row_off + w.height)
        win = Window(c0, r0, c1 - c0, r1 - r0)
        data = src.read(1, window=win)
        profile = dict(driver="GTiff", dtype="float32", count=1, width=c1 - c0, height=r1 - r0,
                       crs=src.crs, transform=src.window_transform(win), compress="deflate", predictor=3)
    DEM.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(DEM, "w", **profile) as dst:
        dst.write(data, 1)
    print(f"wrote {DEM.relative_to(ROOT)}: {c1 - c0}x{r1 - r0} posts, "
          f"{float(data.min()):.1f} to {float(data.max()):.1f} m")


if __name__ == "__main__":
    if not RAW.exists():
        download()
    clip()
```

- [ ] **Step 6: Fetch and clip**

Run: `uv run model/scripts/fetch_dem.py`
Expected: curl progress for about 32 MB, then `wrote model/data/dem/copernicus-glo30-baguio.tif: 937x937 posts, … m` (936 or 937 on each side, depending on post alignment). `model/sources.json` now exists with a `copernicus-glo30` entry: `bytes` 32368281 and today's date.

- [ ] **Step 7: Run the gates and watch them pass**

Run: `uv run model/scripts/check_m1.py dem`
Expected: every line PASS. The 22 anchor lines show differences within about ±11 m (planning measurement: max 10.1 m). INFO reports a mean near −2.4 m. The ridge line reads about 1,538 m. Last line `M1 gates pass`, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add .gitignore model/scripts/common.py model/scripts/check_m1.py model/scripts/fetch_dem.py model/sources.json
git commit -m "$(cat <<'EOF'
Fetch the Copernicus terrain for the 3D model and gate it against the app's heights

The GLO-30 tile is clipped to the map's padded bounds; all 22 destinations
agree with the app's Terrarium heights within the spec's 35 m.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The OSM extract, its source record, and the OSM gates

**Files:**
- Create: `model/scripts/fetch_osm.py`
- Modify: `model/scripts/check_m1.py` (imports, constants, two helpers, `check_osm()`, `__main__`)
- Generated and committed: `model/sources.json` (adds `"osm-philippines"`)

**Interfaces:**
- Consumes from Task 1: `common.DATA, OSM, PADDED, EXACT, ROOT, bbox_arg, file_hash, load_sources, save_sources`. From `check_m1.py`: `check`, `check_source`.
- Produces the `sources.json` key `"osm-philippines"` with fields `url, file, retrieved, bytes, md5, osm_data_until, licence, attribution`.
- Produces in `check_m1.py`: `osmium(*args) -> str` (stdout), `count(pbf, *filters) -> int` (matching ways + relations), `check_osm()`.

- [ ] **Step 1: Install osmium-tool**

Run: `brew install osmium-tool && osmium --version`
Expected: first line `osmium version 1.19.1` (or a later 1.19.x).

- [ ] **Step 2: Add the OSM gates to `model/scripts/check_m1.py`**

Replace the import block's last two lines:

```python
import numpy as np
import rasterio

from common import DEM, EXACT, PAD, PADDED, ROOT, file_hash, load_sources
```

with:

```python
import subprocess
import tempfile

import numpy as np
import rasterio

from common import DEM, EXACT, OSM, PAD, PADDED, ROOT, bbox_arg, file_hash, load_sources
```

Add after the `MINES_RIDGE_M, …` line:

```python
OSM_BUILDINGS, OSM_TOLERANCE = 120_751, 0.01      # Overpass count for EXACT, 2026-09-22 (spec §2)
OSM_HIGHWAYS = 16_799                             # same survey; reported, not gated
```

Add before `if __name__ == "__main__":`:

```python
def osmium(*args):
    return subprocess.run(["osmium", *args], check=True, capture_output=True, text=True).stdout


def count(pbf, *filters):
    """Ways + relations matching the filters. --omit-referenced keeps untagged member ways out of the count."""
    with tempfile.TemporaryDirectory() as t:
        out = f"{t}/filtered.osm.pbf"
        osmium("tags-filter", "--omit-referenced", "-o", out, str(pbf), *filters)
        c = json.loads(osmium("fileinfo", "--extended", "--json", out))["data"]["count"]
        return c["ways"] + c["relations"]


def check_osm():
    check_source("osm-philippines", "md5")
    if not OSM.exists():
        return check(False, "OSM extract exists", f"{OSM.relative_to(ROOT)} missing; run fetch_osm.py")
    # The 120,751 survey used the exact bounds, so count inside EXACT, not PADDED.
    with tempfile.TemporaryDirectory() as t:
        exact = f"{t}/exact.osm.pbf"
        osmium("extract", "--bbox", bbox_arg(EXACT), "--strategy", "complete_ways", "-o", exact, str(OSM))
        buildings = count(exact, "w/building", "r/building")
        highways = count(exact, "w/highway")
    off = (buildings - OSM_BUILDINGS) / OSM_BUILDINGS
    check(abs(off) <= OSM_TOLERANCE, "OSM buildings in the model bounds",
          f"{buildings:,} vs {OSM_BUILDINGS:,} on 2026-09-22 ({off:+.2%})")
    print(f"INFO  OSM highway ways in the model bounds: {highways:,} (2026-09-22: {OSM_HIGHWAYS:,})")
```

Replace the `__main__` block with:

```python
if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    check_constants()
    if what in ("dem", "all"):
        check_dem()
    if what in ("osm", "all"):
        check_osm()
    print("\nM1 gates pass" if not failures else f"\n{failures} check(s) failed")
    sys.exit(1 if failures else 0)
```

- [ ] **Step 3: Run the OSM gates and watch them fail**

Run: `uv run model/scripts/check_m1.py osm`
Expected: the constants PASS, then `FAIL  osm-philippines recorded in model/sources.json: …` and `FAIL  OSM extract exists: …`, exit code 1.

- [ ] **Step 4: Write `model/scripts/fetch_osm.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""M1: fetch a dated Geofabrik Philippines extract and clip it to the padded map bounds.

Output: model/data/osm/baguio-padded.osm.pbf. Needs osmium-tool (brew install osmium-tool).
Run: uv run model/scripts/fetch_osm.py

Geofabrik's "-latest" URL redirect-loops for curl (measured 2026-10-01), so the first run pins
the newest dated daily file and later runs reuse the one recorded in model/sources.json."""
import datetime
import json
import os
import re
import subprocess

from common import DATA, OSM, PADDED, ROOT, bbox_arg, file_hash, load_sources, save_sources

BASE = "https://download.geofabrik.de/asia/"


def fetch_text(url):
    return subprocess.run(["curl", "-fsSL", url], check=True, capture_output=True, text=True).stdout


def newest_dated():
    return max(re.findall(r"philippines-\d{6}\.osm\.pbf", fetch_text(BASE + "philippines.html")))


def download(url, raw):
    raw.parent.mkdir(parents=True, exist_ok=True)
    part = raw.with_suffix(".part")
    subprocess.run(["curl", "-fSL", "--retry", "3", "-C", "-", "-o", str(part), url], check=True)
    expected = fetch_text(url + ".md5").split()[0]
    actual = file_hash(part, "md5")
    if actual != expected:
        part.unlink()
        raise SystemExit(f"md5 mismatch for {url}: got {actual}, Geofabrik says {expected}")
    os.replace(part, raw)
    header = json.loads(subprocess.run(["osmium", "fileinfo", "--json", str(raw)],
                                       check=True, capture_output=True, text=True).stdout)["header"]
    sources = load_sources()
    sources["osm-philippines"] = {
        "url": url,
        "file": str(raw.relative_to(ROOT)),
        "retrieved": datetime.date.today().isoformat(),
        "bytes": raw.stat().st_size,
        "md5": actual,
        "osm_data_until": header.get("option", {}).get("osmosis_replication_timestamp", ""),
        "licence": "Open Database License 1.0, https://www.openstreetmap.org/copyright",
        "attribution": "© OpenStreetMap contributors",
    }
    save_sources(sources)


def main():
    entry = load_sources().get("osm-philippines")
    url = entry["url"] if entry else BASE + newest_dated()
    raw = DATA / "raw" / url.rsplit("/", 1)[1]
    if not raw.exists():
        download(url, raw)
    OSM.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["osmium", "extract", "--bbox", bbox_arg(PADDED), "--strategy", "complete_ways",
                    "--overwrite", "-o", str(OSM), str(raw)], check=True)
    print(f"wrote {OSM.relative_to(ROOT)} ({OSM.stat().st_size / 1e6:.1f} MB) from {raw.name}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Fetch and clip**

Run: `uv run model/scripts/fetch_osm.py`
Expected: curl progress for about 600 MB (several minutes; an interrupted run resumes from the `.part` file). Then `wrote model/data/osm/baguio-padded.osm.pbf (… MB) from philippines-YYMMDD.osm.pbf`. `model/sources.json` gains an `osm-philippines` entry with a non-empty `osm_data_until`. If that field is empty, check the header key with `osmium fileinfo --json <raw>` and report it. Don't guess another key.

- [ ] **Step 6: Run the OSM gates and watch them pass**

Run: `uv run model/scripts/check_m1.py osm`
Expected: `PASS  OSM buildings in the model bounds: N vs 120,751 on 2026-09-22 (±x.xx%)` with |x| ≤ 1, an INFO line for highways near 16,799, and `M1 gates pass`.

- [ ] **Step 7: Commit**

```bash
git add model/scripts/check_m1.py model/scripts/fetch_osm.py model/sources.json
git commit -m "$(cat <<'EOF'
Fetch the OpenStreetMap extract for the 3D model and gate its building count

A dated Geofabrik Philippines file is clipped to the map's padded bounds;
the building count inside the model bounds is within 1% of the spec's survey.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: M1 sign-off

**Files:**
- Modify: `docs/superpowers/plans/2026-09-24-ledger.md` (append)

**Interfaces:**
- Consumes: `uv run model/scripts/check_m1.py` from Tasks 1 and 2.
- Produces: the ledger's M1 section, which M2 and M3 read for carry-forward items.

- [ ] **Step 1: Run every gate from a clean shell**

Run: `uv run model/scripts/check_m1.py`
Expected: every line PASS, `M1 gates pass`, exit code 0. Save the full output for Step 2.

- [ ] **Step 2: Append the M1 record to the ledger**

Append to `docs/superpowers/plans/2026-09-24-ledger.md`, filling the numbers from Step 1's output and `model/sources.json`. Copy them; don't round or restate from memory.

```markdown

## Phase 9, M1: source data (YYYY-MM-DD)

**Gates** (`uv run model/scripts/check_m1.py`, all PASS):
- Copernicus GLO-30 vs Terrarium at all 22 destinations: max |difference| … m (gate 35 m), mean … m.
- Mines View ridge at 120.628, 16.417: … m (expected about 1,530 m, gate ±25 m).
- DEM clip: …x… posts, EPSG:4326, … to … m.
- OSM buildings inside the model bounds: … vs 120,751 on 2026-09-22 (…%). Highway ways: … (16,799 then).

**Sources** (`model/sources.json`): Copernicus tile retrieved …, sha256 …; Geofabrik `philippines-…osm.pbf`, OSM data until …, md5 ….

**Carry forward:**
- M2: the DEM is EGM2008 and reads about … m (mean) against the app's Terrarium surface. Landmarks don't depend on it (they are placed at runtime with `queryTerrainElevation`). Building bases authored on this DEM will carry that offset, so M2 decides whether to shift by the mean.
- M3: anything shipped that derives from the DEM (building bases) needs the Copernicus notice on `/about#sources`: "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved". OSM-derived massing is covered by the map's existing "© OpenStreetMap contributors".
- Disk: `model/data/raw/` holds about 640 MB. The Philippines PBF (about 608 MB) can be deleted once M5 has exported its layers; `fetch_osm.py` re-downloads the same dated file if needed.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-09-24-ledger.md
git commit -m "$(cat <<'EOF'
Record the 3D model's M1 gate results in the ledger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Report to the owner.** Give the gate summary and the branch name. Merge to `main` or push only on the owner's word.

---

## If a gate fails

Stop. Don't change a threshold, the bounds, or the anchor list. Report the failing lines, then:

- **Constants:** `lib/constants.ts` or `MapView.tsx` changed since this plan. Update `EXACT` or `PAD` in `common.py` only if the owner confirms the app's bounds really changed.
- **An anchor over 35 m:** first check that the destination's coordinate in `landmarks.geojson` hasn't moved (`git log -p data/geojson/landmarks.geojson`). Then sample Terrarium afresh with `scripts/baguio-dem-probe.py` (`elevation(lng, lat, z=15)`) to rule out a stale `elevation_m`.
- **Ridge outside ±25 m:** suspect a half-post registration shift in the clip. Compare `rasterio` samples of the raw tile and the clip at the ridge. They must be identical.
- **OSM buildings outside 1%:** OSM grows daily and the survey is from 2026-09-22. Re-count the same bounds on Overpass for today, in a real browser (spec §2: curl gets HTTP 406). Use Playwright on Brave. If Overpass agrees with the new number, the data moved, not the method: report both numbers and let the owner set the new baseline.

## Before M2 (not part of M1)

M2 runs in a session with Blender 4.5.2 open and the MCP add-on at protocol 13 (`get_addon_status` reports `up_to_date: true`, as verified 2026-10-01). Poly Haven is a per-scene setting (`scene.blendermcp_use_polyhaven`) and resets in a new file, so the M2 setup script turns it on first. The M2 plan is written at M2 kickoff against the live `bpy` API.
