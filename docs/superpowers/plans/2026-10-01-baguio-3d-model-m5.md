# Baguio 3D Model, M5: Building Massing Tiles and Render Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the city's buildings on the web map as streamed massing tiles: about 120k OSM footprints with inferred heights and the spec's roof palette, sitting on the app's own terrain, within the budgets. Also give Blender roads and pine cover for renders.

**Architecture:** One `uv run` Python builder reads M1's OSM extract (Overpass JSON, see the M1 deviation in the ledger) and does everything else:
- Infers each building's height (spec §6 heuristic, seeded by OSM id).
- Samples AWS Terrarium (the map's own DEM) for bases.
- Drops buildings inside landmark exclusion rings (contract C3).
- Extrudes walls and flat or gable roofs with vertex colours.
- Groups buildings into slippy tiles in two levels of detail, writes plain GLBs, compresses them with gltfpack, and publishes them content-hashed with an `index.json`.

The app's `ModelLayer` (M3) gains tile streaming: tiles intersecting the view load after the first `idle`, near detail at zoom ≥ 15 and far detail below. Each tile draws with its own projection matrix. Roads and pines are render-only Blender work.

**Tech Stack:** Python 3.13 via `uv run` (`numpy==2.3.3`, `pyproj==3.8.0`, `shapely==2.1.2`, `mapbox-earcut==1.0.3`, `pillow==11.3.0`; all verified to install, and earcut's output winds CCW, 1 Oct 2026), gltfpack (M3's pinned version), three 0.186, Playwright.

**Spec:** spec §1 (roofs are the visual signature; hillside pitched corrugated metal in red, green, blue, teal; CBD flat concrete), §6 (height heuristic, terrain interaction, "plausible massing, not survey data"), §8 (seeded, deterministic), §9; owner answer 2 (building blocks go on the web, 1 Oct 2026); contract C2 (tile coordinates, Terrarium bases), C3, C5, C6.

## Global Constraints

- M3's Global Constraints (app code rules, no new npm dependencies, Supabase rules).
- **Budgets (C6):** each tile file ≤ 100 KiB; everything loaded for the default camera ≤ 1 MiB; ≤ 500k triangles and ≤ 100 draw calls for the 3D layer at the default view.
- **Truth (C9):** inferred heights are plausible massing, never survey data. Any copy mentioning them says so (M8 adds the line to `/about#sources`).
- **Determinism (C7):** the builder is seeded only by OSM ids; two runs give identical tile hashes.
- **Every landmark needs an exclusion ring before tiles are built.** M3 and M4 fill 5; Task 0 fills the other 17.
- **Roof palette (owner decision, 2026-10-02):** "Citywide roof palette have variety of colors", with an aerial reference image of hillside Baguio. Map roofs follow the city's real mix, green included; the site's no-green rule covers UI, not map content. Weights below are ESTIMATEs read from that reference.

## File map

| File | Responsibility |
|---|---|
| `model/scripts/build_massing.py` | the whole builder: OSM → heights → bases → exclusion → meshes → tiles → GLB → gltfpack → publish |
| `public/models/buildings/index.json`, `public/models/buildings/<lod>-<z>-<x>-<y>.<hash8>.glb` | what the app loads |
| `components/map/layers/ModelLayer.ts` | add tile streaming next to landmarks |
| `tests/unit/model-budgets.test.ts` | add tile checks |
| `tests/e2e/buildings.spec.ts` | default-view bytes, triangles, no page errors |
| `model/blender/context_roads.py`, `model/blender/context_pines.py` | render-only roads and pine scatter |

---

### Task 0: Exclusion rings for the 17 remaining landmarks

**Files:** Create `model/landmarks/<slug>.md` (scope section only for now; M6 completes each sheet). Modify `model/landmarks.json` via `landmark_osm.py`.

- [ ] **Step 1:** For each slug whose `exclusion` is `null` in `model/landmarks.json`:
  1. Run `uv run model/scripts/landmark_osm.py candidates <slug>`.
  2. Decide the scope (one sentence: the structures M6 will model) and write it in a new `model/landmarks/<slug>.md` under a `## Scope` heading, with the OSM ids and why.
  3. Run `uv run model/scripts/landmark_osm.py footprint <slug> <ids>`.
  4. Set the registry `scope`.

  Space Overpass calls at least 30 s apart. A slug with no usable OSM polygon (a sculpture, say `lions-head-kennon-road`) gets a hand-drawn ring: write `footprint.json` and the registry fields by hand, at the size the sheet's sources give, and say so in the sheet.
- [ ] **Step 2:** Check: `python3 -c "import json; r=json.load(open('model/landmarks.json')); m=[s for s,e in r.items() if not e['exclusion']]; print(m); assert not m"` prints `[]`.
- [ ] **Step 3: Commit** the sheets and the registry: "Set the footprint and exclusion ring for every landmark" plus the trailer.

### Task 1: The massing builder

**Files:** Create `model/scripts/build_massing.py`.

**Interfaces:**
- Consumes: `common.OSM, PADDED, LOCAL_TM, LANDMARKS, DATA, ROOT`; `model/landmarks.json` `exclusion` rings (all non-null); `data/geojson/landmarks.geojson` (the `session-road` coordinate is the CBD reference point); M3's `GLTFPACK` pin (import it from `pack_landmark`).
- Produces: `public/models/buildings/index.json` = `{"zoom": int, "skirtM": float, "tiles": [{"id": "z-x-y", "anchor": [lng, lat], "bbox": [w, s, e, n], "near": {"url", "bytes", "triangles"}, "far": {"url", "bytes", "triangles"}}]}`. Tile GLBs: one mesh, one primitive, `POSITION` (float32, glTF +Y up, metres relative to the anchor, Y = metres above sea level), `COLOR_0` (normalized uint8 RGBA, linear), uint32 indices, one material (white base colour, roughness 0.9). After gltfpack the attributes are quantized and meshopt-compressed.

- [ ] **Step 1: Write `model/scripts/build_massing.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2", "mapbox-earcut==1.0.3", "pillow==11.3.0"]
# ///
"""M5: OSM building footprints -> streamed massing tiles for the web map (contract C2, C3).

  uv run model/scripts/build_massing.py measure          # Task 2: skirt and tile-size numbers
  uv run model/scripts/build_massing.py build            # Task 3: all tiles + index.json

Heights are plausible massing from the spec §6 heuristic, never survey data. Seeded only by OSM ids."""
import hashlib
import json
import math
import subprocess
import sys
import zlib
from concurrent.futures import ThreadPoolExecutor

import mapbox_earcut
import numpy as np
import shapely
from PIL import Image
from pyproj import Transformer
from shapely.geometry import shape
from shapely.strtree import STRtree

from common import DATA, LANDMARKS, LOCAL_TM, OSM, ROOT
from pack_landmark import GLTFPACK

ZOOM = 15            # set in Task 2 from the measurements; z15 tiles are about 1.2 km across here
SKIRT_M = 3.0        # set in Task 2: buried wall depth below the lowest corner
STOREY_M = 3.2       # spec §6
ROOF_PITCH = math.radians(18)
FAR_MIN_AREA = 60.0  # far LOD drops smaller buildings
PUBLIC = ROOT / "public" / "models" / "buildings"
WORK = DATA / "massing"
TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
COMMERCIAL = {"commercial", "retail", "hotel", "office", "apartments", "hospital", "school", "university",
              "college", "public", "civic", "government", "church", "cathedral", "dormitory"}


def srgb(r, g, b):
    """sRGB 0-255 -> linear 0-255 (glTF vertex colours are linear)."""
    f = lambda c: ((c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4) * 255
    return (round(f(r)), round(f(g)), round(f(b)), 255)


# ESTIMATE weights read from the owner's aerial reference (2026-10-02): red/rust dominant, then blue,
# green, teal, white/grey sheet, some orange.
ROOFS_PITCHED = [(srgb(150, 58, 42), 32), (srgb(176, 64, 48), 10), (srgb(52, 86, 132), 15), (srgb(58, 108, 74), 13),
                 (srgb(44, 120, 118), 10), (srgb(200, 200, 196), 12), (srgb(196, 112, 52), 8)]
ROOF_FLAT = srgb(140, 140, 135)
WALLS = [srgb(214, 204, 182), srgb(196, 196, 190), srgb(224, 214, 170), srgb(232, 228, 220)]


def pick(weighted, key):
    total = sum(w for _, w in weighted)
    r = zlib.crc32(key.encode()) % total
    for item, w in weighted:
        if r < w:
            return item
        r -= w


def height_m(tags, area, dist_cbd, oid):
    for k in ("height",):
        try:
            return float(str(tags[k]).lower().replace("m", "").strip())
        except (KeyError, ValueError):
            pass
    try:
        return max(1.0, float(tags["building:levels"])) * STOREY_M
    except (KeyError, ValueError):
        pass
    levels = 3.0 if tags.get("building") in COMMERCIAL else 2.5
    levels += 1.0 if dist_cbd < 600 else 0.5 if dist_cbd < 1500 else 0.0
    levels = levels + 1.0 if area > 600 else min(levels, 1.5) if area < 40 else levels
    levels += 0.5 if "name" in tags else 0.0
    levels += (zlib.crc32(oid.encode()) % 5 - 2) * 0.5  # -1..+1 storey, seeded by the OSM id
    return float(min(10, max(1, round(levels)))) * STOREY_M


class Terrarium:
    """The map's own DEM (contract C2), nearest-pixel samples, tiles cached under model/data/terrarium."""

    def __init__(self, z):
        self.z, self.tiles = z, {}

    def _tile(self, x, y):
        if (x, y) not in self.tiles:
            path = DATA / "terrarium" / str(self.z) / f"{x}-{y}.png"
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                subprocess.run(["curl", "-fsSL", "-o", str(path), TERRARIUM.format(z=self.z, x=x, y=y)], check=True)
            a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
            self.tiles[(x, y)] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
        return self.tiles[(x, y)]

    def sample(self, lng, lat):
        n = 2 ** self.z * 256
        px = np.floor((np.asarray(lng) + 180) / 360 * n).astype(np.int64)
        py = np.floor((1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n).astype(np.int64)
        out = np.empty(px.shape)
        for tx, ty in set(zip((px // 256).tolist(), (py // 256).tolist())):
            m = (px // 256 == tx) & (py // 256 == ty)
            out[m] = self._tile(tx, ty)[py[m] % 256, px[m] % 256]
        return out


def slippy(lng, lat, z):
    n = 2 ** z
    return int((lng + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def tile_bounds(x, y, z):
    n = 2 ** z
    lat = lambda yy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))
    return x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)


def load_buildings():
    """OSM building polygons (ways and multipolygon relations) with tags, from M1's Overpass extract."""
    from shapely.geometry import LineString, Polygon
    from shapely.ops import linemerge, polygonize, unary_union
    out = []
    for el in json.loads(OSM.read_text())["elements"]:
        tags = el.get("tags", {})
        if "building" not in tags:
            continue
        if el["type"] == "way":
            g = el.get("geometry") or []
            if len(g) < 4 or g[0] != g[-1]:
                continue
            geom = Polygon([(p["lon"], p["lat"]) for p in g])
        else:
            parts = {"outer": [], "inner": []}
            for m in el.get("members", []):
                if m.get("type") == "way" and m.get("role") in parts and m.get("geometry"):
                    parts[m["role"]].append(LineString([(p["lon"], p["lat"]) for p in m["geometry"]]))
            if not parts["outer"]:
                continue
            geom = unary_union(list(polygonize(linemerge(parts["outer"]))))
            if parts["inner"]:
                geom = geom.difference(unary_union(list(polygonize(linemerge(parts["inner"])))))
        if geom.is_valid and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon"):
            out.append((f"{el['type']}/{el['id']}", tags, geom))
    return sorted(out, key=lambda b: b[0])  # stable order -> deterministic output


def prepare():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    to_tm = lambda g: shapely.transform(g, lambda c: np.column_stack(fwd.transform(c[:, 0], c[:, 1])))
    reg = json.loads(LANDMARKS.read_text())
    missing = [s for s, e in reg.items() if not e["exclusion"]]
    assert not missing, f"landmarks without an exclusion ring (Task 0): {missing}"
    excl = STRtree([to_tm(shapely.Polygon(e["exclusion"])) for e in reg.values()])
    cbd = next(f["geometry"]["coordinates"] for f in json.loads((ROOT / "data/geojson/landmarks.geojson").read_text())["features"]
               if f["properties"]["slug"] == "session-road")
    cbd_tm = shapely.Point(fwd.transform(*cbd))
    kept, dropped = [], 0
    for oid, tags, geom in load_buildings():
        tm = to_tm(geom)
        if not tm.is_valid or tm.area < 4:
            continue
        if len(excl.query(tm, predicate="intersects")):
            dropped += 1
            continue
        kept.append((oid, tags, geom, tm, tm.distance(cbd_tm)))
    print(f"buildings kept {len(kept):,}, dropped by landmark exclusions {dropped:,}")
    return fwd, kept


def building_mesh(oid, tags, tm, base, top_h, dist_cbd, far):
    """Walls (buried SKIRT_M below base) + flat or gable roof. Model-frame metres, (east, north, up)."""
    pos, col, idx = [], [], []
    wall = pick([(c, 1) for c in WALLS], oid + "w")
    top = base + top_h
    rect = tm.minimum_rotated_rectangle
    gable = (not far and dist_cbd >= 600 and top_h < 4 * STOREY_M and tm.area <= 300
             and tm.area / max(rect.area, 1e-9) >= 0.85 and tags.get("roof:shape") != "flat")
    for poly in getattr(tm, "geoms", [tm]):
        for ring in [poly.exterior, *poly.interiors]:
            c = np.asarray(shapely.geometry.polygon.orient(shapely.Polygon(ring), 1.0 if ring is poly.exterior else -1.0).exterior.coords)[:-1]
            for i in range(len(c)):
                (ax, ay), (bx, by) = c[i], c[(i + 1) % len(c)]
                k = len(pos)
                pos += [(ax, ay, base - SKIRT_M), (bx, by, base - SKIRT_M), (bx, by, top), (ax, ay, top)]
                col += [wall] * 4
                idx += [k, k + 1, k + 2, k, k + 2, k + 3]
        if not gable:
            ext = np.asarray(shapely.geometry.polygon.orient(poly, 1.0).exterior.coords)[:-1]
            holes = [np.asarray(h.coords)[:-1] for h in shapely.geometry.polygon.orient(poly, 1.0).interiors]
            verts = np.vstack([ext, *holes]) if holes else ext
            ends = np.cumsum([len(ext)] + [len(h) for h in holes]).astype(np.uint32)
            tri = mapbox_earcut.triangulate_float64(verts, ends).reshape(-1, 3)
            a, b, cc = verts[tri[:, 0]], verts[tri[:, 1]], verts[tri[:, 2]]
            flip = ((b[:, 0] - a[:, 0]) * (cc[:, 1] - a[:, 1]) - (cc[:, 0] - a[:, 0]) * (b[:, 1] - a[:, 1])) < 0
            tri[flip] = tri[flip][:, [0, 2, 1]]  # every roof triangle faces up (CCW from above)
            k = len(pos)
            roof = ROOF_FLAT if dist_cbd < 600 or top_h >= 4 * STOREY_M else pick(ROOFS_PITCHED, oid)
            pos += [(x, y, top) for x, y in verts]
            col += [roof] * len(verts)
            idx += (tri + k).ravel().tolist()
    if gable:
        r = np.asarray(rect.exterior.coords)[:4]
        if np.linalg.norm(r[1] - r[0]) < np.linalg.norm(r[2] - r[1]):
            r = np.roll(r, -1, axis=0)  # r[0]->r[1] is now a long side
        half = np.linalg.norm(r[2] - r[1]) / 2
        ridge_z = top + half * math.tan(ROOF_PITCH)
        m03, m12 = (r[0] + r[3]) / 2, (r[1] + r[2]) / 2
        roof = pick(ROOFS_PITCHED, oid)
        k = len(pos)
        pts = [(*r[0], top), (*r[1], top), (*m12, ridge_z), (*m03, ridge_z), (*r[2], top), (*r[3], top)]
        pos += pts
        col += [roof] * 6
        # two slopes and two gable ends; winding fixed below by facing outward from the rectangle centre
        faces = [(0, 1, 2), (0, 2, 3), (4, 5, 3), (4, 3, 2), (1, 4, 2), (5, 0, 3)]
        centre = np.array([*np.asarray(rect.centroid.coords)[0], top])
        for f in faces:
            p = np.array([pts[i] for i in f])
            nrm = np.cross(p[1] - p[0], p[2] - p[0])
            out = p.mean(0) - centre
            idx += [k + f[0], k + f[2], k + f[1]] if np.dot(nrm, out) < 0 else [k + i for i in f]
    return pos, col, idx


def write_glb(path, pos, col, idx):
    p = np.asarray(pos, np.float32)
    p = np.column_stack([p[:, 0], p[:, 2], -p[:, 1]]).astype(np.float32)  # (east, north, up) -> glTF (east, up, -north)
    c = np.asarray(col, np.uint8)
    i = np.asarray(idx, np.uint32)
    binary = p.tobytes() + c.tobytes() + i.tobytes()
    g = {"asset": {"version": "2.0", "generator": "baguio-city-3d build_massing"}, "scene": 0, "scenes": [{"nodes": [0]}],
         "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1}, "indices": 2, "material": 0}]}],
         "materials": [{"pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.9}}],
         "buffers": [{"byteLength": len(binary)}],
         "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": p.nbytes, "target": 34962},
                         {"buffer": 0, "byteOffset": p.nbytes, "byteLength": c.nbytes, "target": 34962},
                         {"buffer": 0, "byteOffset": p.nbytes + c.nbytes, "byteLength": i.nbytes, "target": 34963}],
         "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(p), "type": "VEC3", "min": p.min(0).tolist(), "max": p.max(0).tolist()},
                       {"bufferView": 1, "componentType": 5121, "normalized": True, "count": len(c), "type": "VEC4"},
                       {"bufferView": 2, "componentType": 5125, "count": len(i), "type": "SCALAR"}]}
    js = json.dumps(g, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    path.write_bytes(b"glTF" + (2).to_bytes(4, "little") + total.to_bytes(4, "little")
                     + len(js).to_bytes(4, "little") + b"JSON" + js + len(binary).to_bytes(4, "little") + b"BIN\0" + binary)
    return len(i) // 3


def bases(fwd, kept, z):
    inv = Transformer.from_crs(LOCAL_TM, "EPSG:4326", always_xy=True)
    dem = Terrarium(z)
    out = []
    for oid, tags, geom, tm, d in kept:
        ext = np.asarray(geom.exterior.coords if geom.geom_type == "Polygon" else geom.geoms[0].exterior.coords)
        out.append(float(dem.sample(ext[:, 0], ext[:, 1]).min()))
    return np.array(out)


def measure():
    fwd, kept = prepare()
    b15, b12 = bases(fwd, kept, 15), bases(fwd, kept, 12)
    gap = np.maximum(0.0, b15 - b12)
    heights = np.array([height_m(t, tm.area, d, o) for o, t, g, tm, d in kept])
    cbd = np.array([d < 600 for *_, d in kept])
    print(f"skirt: z15-vs-z12 base gap p50 {np.percentile(gap, 50):.1f} m, p95 {np.percentile(gap, 95):.1f} m, p99 {np.percentile(gap, 99):.1f} m")
    print(f"heights: CBD median {np.median(heights[cbd]) / STOREY_M:.1f} storeys, elsewhere {np.median(heights[~cbd]) / STOREY_M:.1f}")
    for z in (14, 15):
        counts = {}
        for o, t, g, tm, d in kept:
            c = g.centroid
            counts[slippy(c.x, c.y, z)] = counts.get(slippy(c.x, c.y, z), 0) + 1
        v = np.array(list(counts.values()))
        print(f"z{z}: {len(v)} tiles, buildings per tile p50 {np.percentile(v, 50):.0f}, p95 {np.percentile(v, 95):.0f}, max {v.max()}")


def build():
    fwd, kept = prepare()
    base = bases(fwd, kept, 15)
    tiles = {}
    for (oid, tags, geom, tm, d), b in zip(kept, base):
        c = geom.centroid
        tiles.setdefault(slippy(c.x, c.y, ZOOM), []).append((oid, tags, geom, tm, d, b))
    WORK.joinpath("raw").mkdir(parents=True, exist_ok=True)
    jobs = []
    for (x, y), items in sorted(tiles.items()):
        w, s, e, n = tile_bounds(x, y, ZOOM)
        alng, alat = (w + e) / 2, (s + n) / 2
        ax, ay = fwd.transform(alng, alat)
        for lod in ("near", "far"):
            pos, col, idx = [], [], []
            for oid, tags, geom, tm, d, b in items:
                if lod == "far" and tm.area < FAR_MIN_AREA:
                    continue
                local = shapely.transform(tm, lambda q: q - np.array([ax, ay]))
                p, c, i = building_mesh(oid, tags, local, b, height_m(tags, tm.area, d, oid), d, lod == "far")
                idx += [k + len(pos) for k in i]
                pos += p
                col += c
            if idx:
                raw = WORK / "raw" / f"{lod}-{ZOOM}-{x}-{y}.glb"
                tris = write_glb(raw, pos, col, idx)
                jobs.append((x, y, lod, raw, tris, [alng, alat], [round(v, 6) for v in geom_bbox(items)]))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob("*.glb"):
        old.unlink()

    def pack(job):
        x, y, lod, raw, tris, anchor, bbox = job
        out = raw.with_suffix(".packed.glb")
        subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw), "-o", str(out), "-cc"], check=True, capture_output=True)
        data = out.read_bytes()
        name = f"{lod}-{ZOOM}-{x}-{y}.{hashlib.sha256(data).hexdigest()[:8]}.glb"
        (PUBLIC / name).write_bytes(data)
        return x, y, lod, {"url": f"/models/buildings/{name}", "bytes": len(data), "triangles": tris}, anchor, bbox

    index = {}
    with ThreadPoolExecutor(8) as pool:
        for x, y, lod, entry, anchor, bbox in pool.map(pack, jobs):
            t = index.setdefault(f"{ZOOM}-{x}-{y}", {"id": f"{ZOOM}-{x}-{y}", "anchor": anchor, "bbox": bbox})
            t[lod] = entry
    doc = {"zoom": ZOOM, "skirtM": SKIRT_M, "tiles": [index[k] for k in sorted(index)]}
    (PUBLIC / "index.json").write_text(json.dumps(doc, indent=1) + "\n")
    sizes = np.array([t[l]["bytes"] for t in doc["tiles"] for l in ("near", "far") if l in t])
    print(f"tiles {len(doc['tiles'])}, files {len(sizes)}, bytes p50 {np.percentile(sizes, 50):,.0f} p95 {np.percentile(sizes, 95):,.0f} max {sizes.max():,}")


def geom_bbox(items):
    b = shapely.total_bounds([g for _, _, g, *_ in items])
    return b.tolist()


if __name__ == "__main__":
    {"measure": measure, "build": build}[sys.argv[1]]()
```

- [ ] **Step 2: Smoke run.** Run `uv run model/scripts/build_massing.py measure`.
  - Expected: `buildings kept …` (about 120k, minus the exclusions), a skirt line, a heights line, and z14/z15 tile lines. The first run downloads Terrarium tiles into `model/data/terrarium/` (tens of MB).
  - Gate: the CBD median is 3 to 5 storeys and elsewhere 2 to 3 (spec §6 defaults). If not, adjust only the heuristic's constants, record the before and after in the ledger, and rerun.
- [ ] **Step 3: Commit** the script: "Add the building massing builder for the 3D map" plus the trailer.

### Task 2: Choose the tile size and skirt from measurements

- [ ] **Step 1:** From Task 1's `measure` output, set `SKIRT_M = max(3.0, ceil(p99 × 2) / 2)` (p99 of the z15-vs-z12 gap, rounded up to 0.5 m). Buried wall is invisible, so err deep.
- [ ] **Step 2:** Build at `ZOOM = 15`: `uv run model/scripts/build_massing.py build`. Note the printed p95 and max file size.
  - If the p95 is ≤ 100 KiB and the max is ≤ 100 KiB, keep z15.
  - If the max is over, find the offending tiles in `index.json` and raise `FAR_MIN_AREA` (far) or simplify near tiles in the densest areas.
  - Try z14 only if z15's p50 is under 20 KiB, which would mean too many tiny requests: rebuild with `ZOOM = 14` and take it if every file is ≤ 100 KiB.
  - Record both runs' numbers in the ledger.
- [ ] **Step 3: Determinism.** Copy `index.json`, rebuild, and diff: `IDENTICAL`.
- [ ] **Step 4:** Extend `tests/unit/model-budgets.test.ts`:

```ts
it("every building tile in the index exists, fits 100 KiB, and nothing else is shipped", () => {
  const D = "public/models/buildings";
  if (!existsSync(`${D}/index.json`)) return;
  const { tiles } = JSON.parse(readFileSync(`${D}/index.json`, "utf8")) as { tiles: Record<string, { url: string }>[] };
  const urls = tiles.flatMap((t) => ["near", "far"].filter((l) => t[l]).map((l) => t[l].url));
  for (const url of urls) expect(readFileSync(`public${url}`).length, url).toBeLessThanOrEqual(100 * KiB);
  const listed = new Set(urls.map((u) => u.split("/").pop()));
  expect(readdirSync(D).filter((f) => f.endsWith(".glb") && !listed.has(f)), "orphan tiles").toEqual([]);
});
```

Run `npm test`: all pass.
- [ ] **Step 5: Commit** the script constants, the test, `public/models/buildings/` (index and GLBs): "Publish the city's building massing tiles" plus the trailer. The commit is large (hundreds of files). That's expected under contract C4.

### Task 3: Stream tiles in the model layer

**Files:** Modify `components/map/layers/ModelLayer.ts`.

**Interfaces:** Consumes `/models/buildings/index.json` (Task 1 shape) and M3's `modelMatrix`, `whenFirstIdle`, `loadKit`. Produces nothing new for later milestones except the behaviour.

- [ ] **Step 1: Add tile streaming.** In `ModelLayer.ts`:

  (a) Add the tile types and index loader next to the landmark ones:

```ts
const TILE_INDEX_URL = "/models/buildings/index.json";
interface TileFile { url: string; bytes: number; triangles: number }
interface TileEntry { id: string; anchor: [number, number]; bbox: [number, number, number, number]; near?: TileFile; far?: TileFile }
let tileIndex: Promise<TileEntry[]> | null = null;
const loadTileIndex = () =>
  (tileIndex ??= fetch(TILE_INDEX_URL)
    .then((r) => (r.ok ? r.json() : { tiles: [] }))
    .then((j: { tiles: TileEntry[] }) => j.tiles)
    .catch(() => []));
```

  (b) Generalise `Shown` to hold an anchor instead of a landmark entry, so the render loop draws both kinds: `interface Shown { lng: number; lat: number; altitudeM: number; rotationDeg: number; onGround: boolean; scene: Scene }`.
  - Landmarks set `onGround: true`: the altitude is `queryTerrainElevation + altitudeM × k`, as in M3.
  - Tiles set `onGround: false` and `altitudeM: 0`: their Y is metres above sea level, so the anchor sits at altitude 0 and Z scaling does the rest (contract C2).
  - In `render`, compute `ground` only when `onGround`.

  (c) In `update()`, after the landmark loop:

```ts
      const tiles = await loadTileIndex();
      if (cancelled || isTornDown(map)) return;
      const b = map.getBounds();
      const lod: "near" | "far" = map.getZoom() >= NEAR_ZOOM ? "near" : "far";
      const visible = new Set<string>();
      for (const t of tiles) {
        const [w, s, e, n] = t.bbox;
        if (e < b.getWest() || w > b.getEast() || n < b.getSouth() || s > b.getNorth()) continue;
        const file = t[lod] ?? t.far ?? t.near;
        if (!file) continue;
        visible.add(t.id);
        void wantTile(t, file);
      }
      for (const id of [...shown.keys()]) if (id.startsWith("tile:") && !visible.has(id.slice(5).split("@")[0])) shown.delete(id);
```

  (d) Add `wantTile`, mirroring `want`: key `tile:<id>@<url>`; on load, delete any other `tile:<id>@…` entry (an LOD switch), traverse the scene setting `(o as Mesh).material.flatShading = true` and `.needsUpdate = true` on meshes (tiles carry no normals), and use the same two lights.

  ponytail: no eviction of cached tile objects. Session memory grows with panning; add an LRU on `models` if M7's device test shows memory pressure.
- [ ] **Step 2:** Run `npx tsc --noEmit`, `npx eslint components/map` (no new errors) and `npm test`.
- [ ] **Step 3: Commit**: "Stream the city's building massing onto the map by view" plus the trailer.

### Task 4: Measure the default view on the real page

**Files:** Create `tests/e2e/buildings.spec.ts`.

- [ ] **Step 1: Write the spec**

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type TileFile = { url: string; triangles: number };
const index = JSON.parse(readFileSync("public/models/buildings/index.json", "utf8")) as { tiles: Record<string, TileFile>[] };
const triangles = new Map(index.tiles.flatMap((t) => ["near", "far"].filter((l) => t[l]).map((l) => [t[l].url, t[l].triangles] as const)));

test("the default view loads its buildings within 1 MiB and 500k triangles, with no page errors", async ({ page }) => {
  const errors: string[] = [];
  const got = new Map<string, number>();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/models/buildings/") && path.endsWith(".glb")) got.set(path, (await r.body()).length);
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/map");
  let last = -1;
  await expect.poll(() => { const n = got.size; const settled = n > 0 && n === last; last = n; return settled; }, { timeout: 60_000, intervals: [3_000] }).toBe(true);
  const bytes = [...got.values()].reduce((a, b) => a + b, 0);
  const tris = [...got.keys()].reduce((a, u) => a + (triangles.get(u) ?? 0), 0);
  console.log(`default view: ${got.size} tiles, ${bytes} bytes, ${tris} triangles`);
  expect(bytes).toBeLessThanOrEqual(1024 * 1024);
  expect(tris).toBeLessThanOrEqual(500_000);
  expect(got.size, "draw calls (one per tile)").toBeLessThanOrEqual(100);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m5-default-view.png" });
});
```

- [ ] **Step 2:** Run `npm run test:e2e -- buildings`. Expected: 1 passed, and a printed line with the numbers. If it's over budget, go back to Task 2's levers (`FAR_MIN_AREA`, tile size). Never raise the budget.
- [ ] **Step 3: Look.** Read `test-results/m5-default-view.png`.
  - The city reads as a field of coloured roofs on the slopes (spec §1). The CBD is flat-roofed.
  - No buildings float above or sink under the slopes.
  - No massing sits on top of the cathedral or other shipped landmarks.

  Also open `/map?dest=burnham-park` and `/map?dest=session-road` in the same spec style and look. Record the review in the ledger.
- [ ] **Step 4:** Run the full `npm run test:e2e`, all green. Commit the spec: "Check the building massing against the default-view budget on the real page" plus the trailer.

### Task 5: Render context in Blender (render-only, never shipped)

**Files:** Create `model/blender/context_roads.py`, `model/blender/context_pines.py`, and a `uv run` exporter `model/scripts/context_data.py`.

- [ ] **Step 1:** `context_data.py` writes `model/data/context/roads.npz` and `buildings.npz` (polylines in the model frame) for Blender:
  - Roads: the `highway` ways in M1's Overpass extract (`model/data/osm/baguio-padded.json`, `geometry` arrays), as model-frame polylines with their `highway` class.
  - Buildings: footprints, used as the pine exclusion mask.
- [ ] **Step 2:** `context_roads.py` (headless) builds one mesh per highway class in `20_ROADS`:
  - Width by class (spec §6: motorway/trunk 12 m, primary 9 m, secondary 7–9 m, residential 5–6 m, service/track 3 m).
  - Each vertex is draped on `TERRAIN_LOD0` with `terrain_sample.terrain_z` + 0.3 m.
  - Gate: no vertex more than 1 m above or below the terrain (printed max deviation).
- [ ] **Step 3:** `context_pines.py` (headless) scatters instanced pine proxies (a cone on a cylinder, 30–35 m, spec §7: *Pinus kesiya*) into `50_VEGETATION`:
  - Use Geometry Nodes on `TERRAIN_LOD1`: `GeometryNodeDistributePointsOnFaces` (density weighted by slope and by elevation above 1,200 m), minus points within 8 m of a building or road, then `GeometryNodeInstanceOnPoints` and `GeometryNodeRealizeInstances` (research §5 has the verified sockets).
  - Seeded.
  - Gate: an instance count is printed and stable across two runs.
- [ ] **Step 4:** Rerun M2's `cameras.py` into `model/data/renders/m5/`, then read and review the renders: the roads follow the contours, and the pines are on ridges and steep ground and thin among houses (spec §1, §7). Commit the three scripts: "Add render-only roads and pine cover to the Blender model" plus the trailer.

### Task 6: Sign-off

- [ ] Append `## Phase 9, M5 (date)` to the ledger with:
  - the heuristic medians;
  - `SKIRT_M` and its p99;
  - the tile zoom, the size p50/p95/max, and the hashes check;
  - the e2e default-view bytes, triangles and tile count;
  - the review notes.

  Commit with the trailer. Report to the owner.

## If a gate fails

Stop and report; never loosen a budget.
- **Buildings float on slopes at the default zoom:** raise `SKIRT_M` (buried wall is free) and rebuild.
- **Default view over 1 MiB:** raise `FAR_MIN_AREA`, or switch the far LOD to flat roofs only (it already is) and drop buildings under 100 m². Measure again.
- **Massing over a landmark:** its exclusion ring is too small. Fix the ring (procedure B) and rebuild.
- **Hash differs between runs:** an unordered iteration leaked into the output. `load_buildings` sorts by id, and tiles are sorted. Find the other one.
