# Baguio 3D Model, M2: Terrain Authoring Mesh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Blender terrain the rest of the model sits on: Copernicus heights as a metric mesh in the model's frame, three LODs, the spec's collection tree, six camera views matching the app, and a height-sampling helper, all checked by gates.

**Architecture:** A `uv run` script projects every DEM post into the model frame (contract C1) and writes plain numpy arrays. A headless Blender script builds the mesh from those arrays and saves the working `.blend`. A second headless script adds cameras and renders the six views. A third runs the gates. Blender never projects anything, and the live Blender instance is only used to look at the result.

**Tech Stack:** Python 3.13 via `uv run` (`rasterio==1.5.2`, `pyproj==3.8.0`), Blender 4.5.2 LTS headless (`/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python …`; its Python 3.11 has numpy 1.26.4).

**Spec:** `docs/baguio-3d-model-plan.md` §4, §5, §11, §13; contract `docs/superpowers/plans/2026-10-01-baguio-3d-model-contract.md` (C1, C4, C7, C8); verified Blender facts `docs/superpowers/research/2026-10-01-blender-api-facts.md` (§3 grid mesh, §4 Decimate, §6 ray casting, §9 cameras). Phase 9 gate for M2: the anchors within 35 m; the Mines View ridge at `120.628, 16.417` ≈ 1,530 m.

## Measured while writing this plan (2026-10-01, headless Blender 4.5.2)

| What | Result |
|---|---|
| Grid mesh from numpy via `foreach_set` (`co`, `vertex_index`, `loop_start`), 937 × 937 | 877,969 vertices, 876,096 quads, **0.19 s**. `loop_total` is read-only; setting it silently does nothing |
| Decimate COLLAPSE with `use_collapse_triangulate=True`, applied with `new_from_object` | ratio 0.5 → **876,096** triangles (≈ 5 s); 0.15 → **262,828** (≈ 8 s). Deterministic across processes |
| LOD0 triangle count | 1,752,192 for 937 × 937. Spec §5's "~650k faces" is stale |
| Height sampling | `Object.ray_cast` and a world-space `BVHTree.FromPolygons` agree to 0.0007 m; 1,000 samples in about 2 ms |
| MapLibre camera (5.24.0) | vertical FOV 0.6435011 rad; distance = 1.5 × viewport height × metres per pixel; Blender `rotation_euler = (pitch, 0, −bearing)` |
| Posts in metres | about 29.6 m east-west × 30.7 m north-south at 16.4°N, so arrays carry per-post coordinates |
| `.blend` with three LODs | 54.6 MB compressed |
| pyproj via uv | 3.8.0 |

Not yet measured: the real clip's shape (M1 hasn't run). M1 expects 936 or 937 posts a side; every count below is computed from the actual shape at run time.

## Global Constraints

- Everything in the M1 plan's Global Constraints still applies: truth rule, data stays out of git, `uv run` only, no web app changes, branch `feat/3d-model`, commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, ledger append.
- **Frame:** contract C1. `LOCAL_TM` is defined once, in `model/scripts/common.py`.
- **Blender runs headless for builds** (contract C4 as amended below). No script in this milestone writes to the shared live instance. Opening the saved `.blend` there for a look is optional and read-only.
- **Arrays:** row 0 = the south edge, column 0 = the west edge, float32 (the ulp at 13 km is about 1 mm).
- **No exaggeration in the authoring mesh.** Z is true metres above sea level (EGM2008). The runtime applies exaggeration (contract C2).

**Contract C4 (amended 1 Oct 2026):** Blender scripts run headless with `Blender -b --factory-startup --python <file>`; the live instance opens the saved `.blend` only to inspect it. Why: headless runs are reproducible from a clean factory state, verified for every API used here, and cost no MCP traffic.

## File map

| File | Responsibility |
|---|---|
| `model/scripts/common.py` | add `LOCAL_TM`, `TERRAIN`, `BLEND`, `RENDERS` |
| `model/scripts/terrain_grid.py` | DEM → `E.npy`, `N.npy`, `Z.npy`, `anchors.json`, `grid.json` |
| `model/blender/build_terrain.py` | collection tree, `TERRAIN_LOD0/1/2`, units, neutral material; saves the `.blend`; writes `build.json` (counts, hashes) |
| `model/blender/terrain_sample.py` | `terrain_z(points)` for later milestones (landmark foundations) |
| `model/blender/cameras.py` | the six app views as cameras; Workbench renders to `model/data/renders/m2/` |
| `model/blender/check_terrain.py` | M2 gates; exits 1 on failure |

---

### Task 1: Project the DEM for Blender

**Files:**
- Modify: `model/scripts/common.py`
- Create: `model/scripts/terrain_grid.py`

**Interfaces:**
- Consumes (M1): `common.DEM, ROOT, file_hash`; `data/geojson/landmarks.geojson` (`slug`, `elevation_m`, coordinates).
- Produces: `common.LOCAL_TM: str`, `common.TERRAIN: Path` (`model/data/terrain`), `common.BLEND: Path` (`model/data/blend/baguio.blend`), `common.RENDERS: Path` (`model/data/renders`). Files: `TERRAIN/E.npy`, `N.npy`, `Z.npy` (float32, rows × cols, row 0 south); `TERRAIN/anchors.json` = `{"anchors": [{"slug", "e", "n", "terrarium_m"}…], "ridge": {"e", "n", "expected_m": 1530}, "views": [{"name", "e", "n", "zoom", "pitch", "bearing"}…]}`; `TERRAIN/grid.json` = `{"rows", "cols", "dem_sha256", "local_tm", "z_min", "z_max"}`.

- [ ] **Step 1: Add the frame and paths to `model/scripts/common.py`**

Append:

```python

# Contract C1: the model frame. Local transverse Mercator centred on BAGUIO_CENTER
# (lib/constants.ts). +X east, +Y true north at the centre, metres.
LOCAL_TM = "+proj=tmerc +lat_0=16.4023 +lon_0=120.596 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs"
TERRAIN = DATA / "terrain"
BLEND = DATA / "blend" / "baguio.blend"
RENDERS = DATA / "renders"
```

- [ ] **Step 2: Write `model/scripts/terrain_grid.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["rasterio==1.5.2", "pyproj==3.8.0"]
# ///
"""M2: project every DEM post into the model frame (contract C1) for Blender.

Writes model/data/terrain/{E,N,Z}.npy (float32, rows x cols, row 0 = south edge, col 0 = west edge),
anchors.json and grid.json. Run: uv run model/scripts/terrain_grid.py"""
import json

import numpy as np
import rasterio
from pyproj import Transformer

from common import DEM, LOCAL_TM, ROOT, TERRAIN, file_hash

RIDGE = (120.628, 16.417)  # spec §5 registration check
# lib/constants.ts DEFAULT_CAMERA and CAMERA_PRESETS (center, zoom, pitch, bearing)
VIEWS = {
    "default": ((120.596, 16.4023), 13.5, 60, -20),
    "burnham-park": ((120.5936, 16.4116), 15.5, 55, -25),
    "session-road": ((120.5967, 16.4118), 16, 60, 30),
    "mines-view": ((120.6305, 16.4145), 15, 65, -60),
    "camp-john-hay": ((120.6187, 16.3956), 14.5, 55, 15),
    "kennon-road": ((120.605, 16.365), 13, 70, -10),
}


def main():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    with rasterio.open(DEM) as d:
        z = d.read(1).astype(np.float64)
        rows, cols = z.shape
        # Post centres. M1 wrote an area-convention transform, so centres are at +0.5.
        cc, rr = np.meshgrid(np.arange(cols) + 0.5, np.arange(rows) + 0.5)
        t = d.transform
        lng = t.c + cc * t.a + rr * t.b
        lat = t.f + cc * t.d + rr * t.e
    e, n = fwd.transform(lng, lat)
    # Rasters are north-first; Blender's grid wants row 0 = south.
    TERRAIN.mkdir(parents=True, exist_ok=True)
    for name, arr in (("E", e), ("N", n), ("Z", z)):
        np.save(TERRAIN / f"{name}.npy", np.ascontiguousarray(arr[::-1], dtype=np.float32))

    # Round trip, contract C1 / spec §11 invariant: <= 1 m (expected ~0).
    lng2, lat2 = fwd.transform(e, n, direction="INVERSE")
    err = np.hypot((lng2 - lng) * 106_800, (lat2 - lat) * 110_700).max()
    assert err <= 1.0, f"round trip error {err:.3f} m"

    features = json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]
    anchors = []
    for f in features:
        (ae, an) = fwd.transform(*f["geometry"]["coordinates"])
        anchors.append({"slug": f["properties"]["slug"], "e": ae, "n": an, "terrarium_m": f["properties"]["elevation_m"]})
    re_, rn = fwd.transform(*RIDGE)
    views = []
    for name, ((vlng, vlat), zoom, pitch, bearing) in VIEWS.items():
        ve, vn = fwd.transform(vlng, vlat)
        views.append({"name": name, "e": ve, "n": vn, "lat": vlat, "zoom": zoom, "pitch": pitch, "bearing": bearing})
    (TERRAIN / "anchors.json").write_text(json.dumps(
        {"anchors": anchors, "ridge": {"e": re_, "n": rn, "expected_m": 1530}, "views": views}, indent=2) + "\n")
    (TERRAIN / "grid.json").write_text(json.dumps({
        "rows": rows, "cols": cols, "dem_sha256": file_hash(DEM, "sha256"), "local_tm": LOCAL_TM,
        "z_min": float(z.min()), "z_max": float(z.max()), "round_trip_max_m": float(err)}, indent=2) + "\n")
    print(f"wrote {TERRAIN.relative_to(ROOT)}: {rows}x{cols} posts, z {z.min():.1f} to {z.max():.1f} m, "
          f"E {e.min():.0f}..{e.max():.0f}, N {n.min():.0f}..{n.max():.0f}, round trip {err:.2e} m")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run it**

Run: `uv run model/scripts/terrain_grid.py`
Expected: `wrote model/data/terrain: 937x937 posts, z … m, E about −14450..14450, N about −14400..14400, round trip ~1e-09 m`. The `E` and `N` extents are roughly ±0.13° in metres. The script fails loudly if the round trip exceeds 1 m.

- [ ] **Step 4: Commit**

```bash
git add model/scripts/common.py model/scripts/terrain_grid.py
git commit -m "$(cat <<'EOF'
Project the terrain posts into the model's local frame

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Build the terrain and its gates

**Files:**
- Create: `model/blender/build_terrain.py`, `model/blender/terrain_sample.py`, `model/blender/check_terrain.py`

**Interfaces:**
- Consumes: Task 1's `TERRAIN/{E,N,Z}.npy`, `anchors.json`, `grid.json`.
- Produces: `model/data/blend/baguio.blend` with collections `BAGUIO_MASTER` › `00_REFERENCE`, `10_TERRAIN`, `20_ROADS`, `30_BUILDINGS` › (`BLD_PROCEDURAL`, `BLD_HERO`), `40_LANDMARKS`, `50_VEGETATION`, `55_STREETFURNITURE`, `60_MATERIALS`, `90_EXPORT`; objects `TERRAIN_LOD0` (visible), `TERRAIN_LOD1`, `TERRAIN_LOD2` (hidden in viewport and render); material `MAT_TERRAIN_NEUTRAL`. `TERRAIN/build.json` = `{"triangles": {"LOD0", "LOD1", "LOD2"}, "sha256": {"LOD0", "LOD1", "LOD2"}}` (sha256 of each mesh's float32 vertex coordinates). In `terrain_sample.py`: `terrain_z(points: list[tuple[float, float]], obj_name: str = "TERRAIN_LOD0") -> list[float | None]`, model-frame metres in, sea-level metres out.

- [ ] **Step 1: Write `model/blender/terrain_sample.py`**

```python
"""Terrain height at model-frame (east, north) points, for later milestones (contract C2 foundations).

Use inside Blender: exec this file, or import it after adding model/blender to sys.path.
Ray casts straight down onto the evaluated mesh; 1,000 points take about 2 ms (measured)."""
import bpy
from mathutils import Vector


def terrain_z(points, obj_name="TERRAIN_LOD0", top=5000.0, reach=10000.0):
    ob = bpy.data.objects[obj_name]
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ob.matrix_world.inverted()
    down = (inv.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
    out = []
    for x, y in points:
        ok, loc, _nrm, _idx = ob.ray_cast(inv @ Vector((x, y, top)), down, distance=reach, depsgraph=dg)
        out.append((ob.matrix_world @ loc).z if ok else None)
    return out
```

- [ ] **Step 2: Write `model/blender/build_terrain.py`**

```python
"""M2: build the terrain authoring mesh and the collection tree; save model/data/blend/baguio.blend.

Run headless from the repo root:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/build_terrain.py
Starts from factory settings every time, so a rerun replaces rather than duplicates."""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "model" / "data" / "terrain"
BLEND = ROOT / "model" / "data" / "blend" / "baguio.blend"
TREE = ["00_REFERENCE", "10_TERRAIN", "20_ROADS", ("30_BUILDINGS", ["BLD_PROCEDURAL", "BLD_HERO"]),
        "40_LANDMARKS", "50_VEGETATION", "55_STREETFURNITURE", "60_MATERIALS", "90_EXPORT"]
LODS = {"TERRAIN_LOD1": 0.5, "TERRAIN_LOD2": 0.15}


def clear_factory_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def make_tree(scene):
    master = bpy.data.collections.new("BAGUIO_MASTER")
    scene.collection.children.link(master)
    made = {}
    for item in TREE:
        name, kids = (item, []) if isinstance(item, str) else item
        c = bpy.data.collections.new(name)
        master.children.link(c)
        made[name] = c
        for kid in kids:
            k = bpy.data.collections.new(kid)
            c.children.link(k)
            made[kid] = k
    return made


def grid_mesh_from_xyz(name, X, Y, Z, collection):
    """Verified on 4.5.2 (research §3b). Row 0 = south, col 0 = west; quads wind CCW from +Z."""
    rows, cols = Z.shape
    co = np.empty((rows, cols, 3), np.float32)
    co[..., 0], co[..., 1], co[..., 2] = X, Y, Z
    idx = np.arange(rows * cols, dtype=np.int32).reshape(rows, cols)
    quad = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1)
    nq = (rows - 1) * (cols - 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(rows * cols)
    me.loops.add(nq * 4)
    me.polygons.add(nq)
    me.vertices.foreach_set("co", co.ravel())
    me.loops.foreach_set("vertex_index", quad)
    me.polygons.foreach_set("loop_start", np.arange(0, nq * 4, 4, dtype=np.int32))
    me.update(calc_edges=True)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def decimated_copy(src, name, ratio, collection):
    """Research §4b method B: evaluate a Decimate modifier and copy the result; src stays intact."""
    md = src.modifiers.new("Decimate", "DECIMATE")
    md.decimate_type = "COLLAPSE"
    md.ratio = ratio
    md.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(src.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    src.modifiers.remove(md)
    me.name = name
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    return ob


def triangles(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def vertex_sha256(ob):
    co = np.empty(len(ob.data.vertices) * 3, np.float32)
    ob.data.vertices.foreach_get("co", co)
    return hashlib.sha256(co.tobytes()).hexdigest()


def neutral_material():
    mat = bpy.data.materials.new("MAT_TERRAIN_NEUTRAL")
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")  # by type, never by name
    bsdf.inputs["Base Color"].default_value = (0.42, 0.40, 0.37, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def main():
    scene = bpy.context.scene
    clear_factory_scene()
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    for scr in bpy.data.screens:
        for area in scr.areas:
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.clip_start, space.clip_end = 1.0, 100_000.0
    cols = make_tree(scene)

    E, N, Z = (np.load(TERRAIN / f"{k}.npy") for k in ("E", "N", "Z"))
    lod0 = grid_mesh_from_xyz("TERRAIN_LOD0", E, N, Z, cols["10_TERRAIN"])
    lod0.data.materials.append(neutral_material())
    objs = {"LOD0": lod0}
    for name, ratio in LODS.items():
        ob = decimated_copy(lod0, name, ratio, cols["10_TERRAIN"])
        ob.hide_viewport = ob.hide_render = True
        objs[name.split("_")[1]] = ob

    report = {"triangles": {k: triangles(o) for k, o in objs.items()},
              "sha256": {k: vertex_sha256(o) for k, o in objs.items()}}
    (TERRAIN / "build.json").write_text(json.dumps(report, indent=2) + "\n")
    BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), compress=True)
    print("BUILD", json.dumps(report["triangles"]))


main()
```

- [ ] **Step 3: Write `model/blender/check_terrain.py`**

```python
"""M2 gates, run headless on the saved .blend:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/check_terrain.py
Prints PASS/FAIL lines; exits 1 if any check fails."""
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "model" / "data" / "terrain"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

ANCHOR_TOLERANCE_M = 35          # Phase 9 M2 gate
RIDGE_TOLERANCE_M = 25
failures = 0


def check(ok, name, detail):
    global failures
    failures += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


grid = json.loads((TERRAIN / "grid.json").read_text())
ref = json.loads((TERRAIN / "anchors.json").read_text())
build = json.loads((TERRAIN / "build.json").read_text())

want0 = 2 * (grid["rows"] - 1) * (grid["cols"] - 1)
tris = build["triangles"]
check(tris["LOD0"] == want0, "LOD0 triangles", f"{tris['LOD0']:,} (expected {want0:,})")
check(abs(tris["LOD1"] - want0 * 0.5) <= 2, "LOD1 triangles", f"{tris['LOD1']:,} (expected {want0 * 0.5:,.0f})")
check(abs(tris["LOD2"] - want0 * 0.15) <= 2, "LOD2 triangles", f"{tris['LOD2']:,} (expected {want0 * 0.15:,.0f})")

names = {c.name for c in bpy.data.collections}
need = {"BAGUIO_MASTER", "00_REFERENCE", "10_TERRAIN", "20_ROADS", "30_BUILDINGS", "BLD_PROCEDURAL", "BLD_HERO",
        "40_LANDMARKS", "50_VEGETATION", "55_STREETFURNITURE", "60_MATERIALS", "90_EXPORT"}
check(need <= names, "collection tree", f"missing {sorted(need - names)}" if need - names else "complete")

zs = terrain_z([(a["e"], a["n"]) for a in ref["anchors"]])
worst = 0.0
for a, z in zip(ref["anchors"], zs):
    d = None if z is None else z - a["terrarium_m"]
    worst = max(worst, abs(d)) if d is not None else worst
    check(d is not None and abs(d) <= ANCHOR_TOLERANCE_M, f"anchor {a['slug']}",
          "no hit" if d is None else f"mesh {z:.1f} m vs Terrarium {a['terrarium_m']} m ({d:+.1f})")
print(f"INFO  worst anchor difference {worst:.1f} m")
rz = terrain_z([(ref["ridge"]["e"], ref["ridge"]["n"])])[0]
check(rz is not None and abs(rz - ref["ridge"]["expected_m"]) <= RIDGE_TOLERANCE_M,
      "Mines View ridge registration", f"{rz} m, expected about {ref['ridge']['expected_m']}")

print("\nM2 gates pass" if not failures else f"\n{failures} check(s) failed")
sys.exit(1 if failures else 0)
```

- [ ] **Step 4: Run the gates before building and watch them fail**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/check_terrain.py`
Expected: a Python error that `build.json` doesn't exist, and a non-zero exit. The gate script refuses to run without a build.

- [ ] **Step 5: Build**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/build_terrain.py`
Expected, within about 30 s: `BUILD {"LOD0": 1752192, "LOD1": 876096, "LOD2": 262828}` for a 937 × 937 clip, and `model/data/blend/baguio.blend` of about 55 MB.

- [ ] **Step 6: Run the gates**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/check_terrain.py`
Expected: every line PASS. The anchors stay within about ±11 m (M1 measured Copernicus vs Terrarium max 10.1 m; mesh triangles can shift a value by a few metres on slopes). The ridge reads about 1,538 m. Last line `M2 gates pass`.

- [ ] **Step 7: Determinism (contract C7)**

Run:
```bash
cp model/data/terrain/build.json /tmp/m2-build-1.json
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/build_terrain.py
diff /tmp/m2-build-1.json model/data/terrain/build.json && echo IDENTICAL
```
Expected: `IDENTICAL`. If the hashes differ, stop and report. Don't drop the check.

- [ ] **Step 8: Commit**

```bash
git add model/blender/build_terrain.py model/blender/terrain_sample.py model/blender/check_terrain.py
git commit -m "$(cat <<'EOF'
Build the 3D model's terrain mesh in three levels of detail, with gates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The app's six views as cameras, rendered for review

**Files:**
- Create: `model/blender/cameras.py`

**Interfaces:**
- Consumes: the `.blend`, `TERRAIN/anchors.json` `views`, `terrain_sample.terrain_z`.
- Produces: cameras `CAM_<name>` in `00_REFERENCE` (saved into the `.blend`); PNGs `model/data/renders/m2/<name>.png`. Later milestones reuse the cameras for visual review.

- [ ] **Step 1: Write `model/blender/cameras.py`**

```python
"""M2: one Blender camera per app view (DEFAULT_CAMERA + CAMERA_PRESETS), placed like MapLibre 5.24's
camera (research §9b), and a Workbench render of each for owner review.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/cameras.py
The render is unexaggerated; the app shows terrain at 1.35x, so expect flatter relief than on screen."""
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

FOV = 0.6435011087932844      # MapLibre default vertical FOV
W, H = 1440, 900              # placeholder viewport; position scales linearly with H
OUT = ROOT / "model" / "data" / "renders" / "m2"


def main():
    scene = bpy.context.scene
    views = json.loads((ROOT / "model" / "data" / "terrain" / "anchors.json").read_text())["views"]
    ref = bpy.data.collections["00_REFERENCE"]
    for ob in [o for o in ref.objects if o.name.startswith("CAM_")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError as e:  # dynamic enum (MCP guidance): report the accepted identifiers
        raise SystemExit(f"Workbench unavailable: {e}")
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
    OUT.mkdir(parents=True, exist_ok=True)
    for v in views:
        p, b = math.radians(v["pitch"]), math.radians(v["bearing"])
        mpp = 2 * math.pi * 6371008.8 * math.cos(math.radians(v["lat"])) / (512 * 2 ** v["zoom"])
        d = 1.5 * H * mpp
        cz = terrain_z([(v["e"], v["n"])])[0] or 0.0
        cd = bpy.data.cameras.new(f"CAM_{v['name']}")
        cd.type, cd.sensor_fit, cd.lens_unit, cd.angle = "PERSP", "VERTICAL", "FOV", FOV
        cd.clip_start, cd.clip_end = 10.0, 100_000.0
        co = bpy.data.objects.new(f"CAM_{v['name']}", cd)
        ref.objects.link(co)
        co.location = (v["e"] - d * math.sin(p) * math.sin(b), v["n"] - d * math.sin(p) * math.cos(b), cz + d * math.cos(p))
        co.rotation_mode, co.rotation_euler = "XYZ", (p, 0.0, -b)
        scene.camera = co
        scene.render.filepath = str(OUT / f"{v['name']}.png")
        bpy.ops.render.render(write_still=True)
        print(f"RENDER {v['name']}: camera at {tuple(round(c) for c in co.location)}")
    bpy.ops.wm.save_mainfile()


main()
```

- [ ] **Step 2: Render**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/cameras.py`
Expected: six `RENDER <name>: camera at (…)` lines. The DEFAULT camera sits near `(2589, −7112, ~5800)` (research §9c: dE 2588.7, dN −7112.4, dUp 4369.9 above the centre's height). There are six PNGs in `model/data/renders/m2/`.
If headless rendering fails on the GPU backend, open the `.blend` in the live Blender through the MCP (`bpy.ops.wm.open_mainfile(filepath=…)`), run the same file's text with `execute_blender_code`, and record that headless rendering is unavailable in the ledger.

- [ ] **Step 3: Look at the renders.** Read each PNG (the Read tool shows images). Check, and record what you see in the ledger: the Burnham view looks down on a basin in the city centre; the Mines View view looks across a deep valley to the east; the Kennon view looks north up a steep, narrow valley. These are the spec §1 landforms. If a view looks mirrored or rotated, the frame or the camera aim is wrong: stop and report.

- [ ] **Step 4: Commit**

```bash
git add model/blender/cameras.py
git commit -m "$(cat <<'EOF'
Add the app's six camera views to the 3D model for visual review

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: M2 sign-off

- [ ] **Step 1:** Rerun `uv run model/scripts/check_m1.py`, then the Task 2 build and gates from a clean shell. All PASS.
- [ ] **Step 2:** Append to `docs/superpowers/plans/2026-09-24-ledger.md` a `## Phase 9, M2: terrain (date)` section with the gate output (anchor worst case, ridge, triangle counts, build hashes), the render notes from Task 3, the C4 amendment, and the stale spec facts this milestone confirmed (§5 "~650k faces" is 1.75 M triangles; §4.0 add-on 1.7/9 is now 1.8/13). Commit with the trailer.
- [ ] **Step 3:** Report to the owner. Merge or push only on their word.

## If a gate fails

Stop and report; never loosen a threshold.
- **Anchor over 35 m while M1's anchor gate passed:** the mesh and the DEM disagree, so the projection or the row flip is wrong. Compare `Z.npy` at the anchor's nearest post with M1's rasterio sample.
- **Ridge off:** check that `anchors.json` ridge E/N project back to `120.628, 16.417`.
- **Triangle counts off by more than 2:** `use_collapse_triangulate` isn't set, or the clip shape changed. `grid.json` says which.
- **Non-deterministic hashes:** report both `build.json` files. Decimate was measured deterministic, so a difference means an input changed.
