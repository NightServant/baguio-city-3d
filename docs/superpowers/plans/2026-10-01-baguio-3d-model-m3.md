# Baguio 3D Model, M3: Cathedral Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take one landmark, `baguio-cathedral`, all the way from research to a rendered model on `/map`, and leave behind the pipeline and the procedure the other 21 landmarks reuse (M4, M6).

**Architecture:** A per-landmark research sheet and the OSM footprint feed a Blender script built on a shared helper module. The model is exported headless to a raw GLB, compressed with gltfpack, content-hashed into `public/models/landmarks/`, and listed in `public/models/landmarks/index.json`. The app's new `ModelLayer` reads that index after the map's first `idle`, lazily loads three.js, and draws the model in MapLibre's GL context. It places each model on the live terrain at render time. A generated migration mirrors the same entries into the `landmarks` table for API consumers.

**Tech Stack:** Blender 4.5.2 headless, `uv run` Python 3.13 (`pyproj==3.8.0`, `shapely==2.1.2`), gltfpack via `npx` (version pinned in Task 5), three 0.186 (`GLTFLoader`, `MeshoptDecoder`), MapLibre GL 5.24 `CustomLayerInterface`, vitest, Playwright.

**Spec:** `docs/baguio-3d-model-plan.md` §6, §9, §10, §13; contract `docs/superpowers/plans/2026-10-01-baguio-3d-model-contract.md` (C2–C8; read the amendments dated 1 Oct, which this plan introduces). Phase 9 gate for M3: GLB within budget after gltfpack; base within ±2 m of `queryTerrainElevation` at the pin; survives terrain → satellite → terrain with no page errors; screenshot matches the reference.

## Verified facts this plan relies on (1 Oct 2026)

| Fact | Where verified |
|---|---|
| `CustomLayerInterface`: `{ id, type: "custom", renderingMode?: "2d" \| "3d", render(gl, options), prerender?, onAdd?(map, gl), onRemove?(map, gl) }`; `options` has `modelViewProjectionMatrix`, `projectionMatrix`, `defaultProjectionData.mainMatrix`, `fov`, `nearZ`, `farZ` | `node_modules/maplibre-gl/dist/maplibre-gl.d.ts:4901, 5004, 5077` |
| `three` 0.186 and `@types/three` 0.186 are installed; `three/examples/jsm/loaders/GLTFLoader.js` and `three/examples/jsm/libs/meshopt_decoder.module.js` exist with types | `package.json:34,44`; `ls` |
| `meshopt_decoder.module.js` instantiates WebAssembly, so the CSP needs `'wasm-unsafe-eval'` in `script-src` | `grep -c WebAssembly` = 4 |
| CSP is report-only in `next.config.ts`; `worker-src 'self' blob:` already present; `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com` | `next.config.ts` |
| Today's seam: `LandmarkLayer.ts` exports a no-op `addLandmarkModel` and an empty fill-extrusion layer; `DestinationSheet.tsx:9,41-45` calls `addLandmarkModel`; `MapLayers.tsx:9,15` mounts `useLandmarkLayer` | files |
| `landmarks` table: `id TEXT PK, destination_id TEXT FK, mesh_url, mesh_scale, rotation_deg, altitude_m` (all NOT NULL), indexed on `destination_id`; live destination ids differ from the seed's | `supabase/migrations/20260822122521_init_baguio_postgis_schema.sql:56-68`; Burnham migration comment |
| Detail API reads `landmarks` by `destination_id`, cached under `cacheKey("geo/destinations/detail", { slug })` for `CACHE_TTLS.destinations` = 300 s | `app/api/geo/destinations/[slug]/route.ts:22,46-55`; `lib/constants.ts:69` |
| Both seeders insert a landmark row only when `meshUrl` is set, with scale 1, rotation 0, altitude 0 | `prisma/seed.ts:72-77`; `scripts/generate-supabase-seed.mjs:80-81` |
| `/map?dest=<slug>` eases to zoom 15.5 | `components/map/DeepLink.tsx:64` |
| Satellite toggle's accessible name: "Toggle satellite imagery" | `components/map/MapControls.tsx:96` |
| Blender export helper, GLB triangle count, the `collection=` empty-GLB gotcha, `export_image_quality` | research `2026-10-01-blender-api-facts.md` §1d |
| A float32 GPU matrix can't hold a Mercator offset to 1 m (0.8 × 2⁻²⁴ ≈ 5e-8 ≈ 2 m at the equator's scale), so the large translation must be multiplied into the projection in JS doubles, per model | arithmetic; MapLibre's three.js example does the same |

## Global Constraints

- M1 and M2 Global Constraints apply: truth rule, data out of git, `uv run`, headless Blender (C4 as amended), branch `feat/3d-model`, commit trailer, ledger.
- **This milestone changes the web app.** Next.js 16.2.10: read `node_modules/next/dist/docs/` for anything Next-specific (AGENTS.md). Global Constraints of the overhaul plan apply to app code: copy rules (no em dashes, no `·`, no arrow glyphs), palette, `prefers-reduced-motion`, mobile floor 360 px.
- **No new npm dependencies.** `three` and `@types/three` are already installed.
- **Pre-existing lint:** 28 errors on the base branch (3 in `MapView.tsx`). Add none.
- **Supabase:** before any DB step, check the project is `ACTIVE_HEALTHY`. Apply migrations only after the owner says so in chat, with `supabase db push --linked`. Not the MCP: it stamps the apply time, and the local and live histories drift (memory, 1 Oct 2026).
- **Budgets (C6):** this landmark ≤ 150 KiB with textures, geometry ≤ 60 KiB (tier 1), ≤ 25k source triangles. Raw file size counts (stricter than over-the-wire).

## File map

| File | Responsibility |
|---|---|
| `model/landmarks.json` | registry of all 22 slugs: tier, scope, OSM ids, exclusion ring, sheet path, status |
| `model/landmarks/<slug>.md` | research sheet: scope, sourced dimensions, ESTIMATEs with method, reference images |
| `model/scripts/landmark_osm.py` | `candidates <slug>`: OSM features near the destination; `footprint <slug> <osm-id>…`: footprint in the model frame plus the exclusion ring |
| `model/blender/lm_common.py` | shared modeling helpers: begin, prism, foundation, material, report, context instance |
| `model/blender/landmarks/<slug>.py` | the landmark's own modeling script |
| `model/blender/export_landmark.py` | headless export of `LM_<slug>` to `model/data/out/<slug>.raw.glb` |
| `model/scripts/pack_landmark.py` | gltfpack, budget check, content hash, `public/models/landmarks/`, index and manifest |
| `model/scripts/landmarks_sql.py` | migration from the manifest; geojson `meshUrl` sync |
| `model/out/landmarks-manifest.json` | committed manifest |
| `public/models/landmarks/index.json`, `public/models/landmarks/<slug>.<hash8>.glb` | what the app loads |
| `lib/map/modelTransform.ts` | pure model-matrix math |
| `components/map/layers/ModelLayer.ts` | the `model-3d` custom layer and its hook |
| `components/map/layers/LandmarkLayer.ts` | **deleted** (its seam is replaced) |
| `components/map/MapLayers.tsx`, `components/panels/DestinationSheet.tsx`, `next.config.ts` | wiring, dead-call removal, CSP and cache headers |
| `tests/unit/model-transform.test.ts`, `tests/unit/model-budgets.test.ts`, `tests/e2e/landmark-model.spec.ts` | checks |

---

## The landmark procedure (used by M3, M4 and M6)

Every landmark goes through these five steps. Each step has its own gate, and a landmark ships only when all five pass.

**A. Sheet.** Write `model/landmarks/<slug>.md`:
1. **Scope:** one sentence on what the mesh depicts. Recommend the smallest scope that makes the place recognisable from the default and preset views. Big areas (parks, campuses, streets, farms) get their defining structures, not their whole extent.
2. **Sources:** every dimension, date, colour and material with a URL (Wikipedia, Wikimedia Commons, heritage or official pages).
3. **Estimates:** unpublished heights are marked `ESTIMATE` with their method (storeys × 3.2 m, or a proportion from a photo against a known dimension) and a confidence.
4. **References:** 3 to 6 reference image URLs (prefer Wikimedia Commons), each with its licence and viewpoint.

Gate: every number in the sheet has a URL or an `ESTIMATE` tag.

**B. Footprint.**
1. Run `uv run model/scripts/landmark_osm.py candidates <slug>` and pick the OSM ids that make up the scope.
2. Run `uv run model/scripts/landmark_osm.py footprint <slug> <ids…>`. It writes `model/data/landmarks/<slug>/footprint.json` and the registry's `exclusion` and `osm_ids`.

Gate: the exclusion ring encloses the scope and nothing much else. Check it by eye on the printed area and the OSM candidate list.

**C. Model.**
1. Write `model/blender/landmarks/<slug>.py` on top of `lm_common`, from the sheet's numbers.
2. Run it headless against `model/data/blend/baguio.blend`.
3. Read its renders and iterate against the reference images.

Gates (printed by `lm_common.report`):
- Triangles within the tier budget (tier 1 ≤ 25k, tier 2 ≤ 10k).
- The foundation reaches the lowest terrain under the footprint plus 1 m.
- The lowest point is at or below `−depth`.
- The origin is the footprint centroid on the ground.
- A 1.8 m human reference stands next to it in the renders.

**D. Ship.**
1. Run `export_landmark.py`, then `pack_landmark.py <slug>`.

Gates: the pack script's budget check; the determinism re-run (identical sha256); `npm test` (budget test).

**E. Data and view.**
1. Run `landmarks_sql.py`, which writes the migration and syncs the geojson.
2. After the owner approves, run `supabase db push --linked`.
3. Run the e2e spec for the slug and take a screenshot at its preset or deep-link view.

Gates: e2e green; the screenshot read back and compared with the sheet's references.

---

### Task 1: Registry and research tooling

**Files:**
- Create: `model/landmarks.json`, `model/scripts/landmark_osm.py`
- Modify: `model/scripts/common.py`

**Interfaces:**
- Consumes: `common.ROOT, DATA, LOCAL_TM` (M1, M2); `data/geojson/landmarks.geojson`.
- Produces: `common.LANDMARKS: Path` (`model/landmarks.json`), `common.LM_DATA: Path` (`model/data/landmarks`). Registry entry shape: `{"tier": 1|2, "scope": str, "osm_ids": [str], "exclusion": [[lng, lat], …] | null, "anchor": [lng, lat] | null, "sheet": "model/landmarks/<slug>.md", "status": "planned"|"modeled"|"shipped"}`. `footprint.json` shape: `{"slug", "anchor_lnglat": [lng, lat], "anchor_tm": [e, n], "rings": [[[x, y], …]], "area_m2"}` where `rings` are in metres relative to the anchor (the footprint centroid), outer rings CCW.

- [ ] **Step 1: Add paths to `model/scripts/common.py`**

```python

LANDMARKS = ROOT / "model" / "landmarks.json"
LM_DATA = DATA / "landmarks"
```

- [ ] **Step 2: Create `model/landmarks.json`** with all 22 slugs. Tier 1: `baguio-cathedral`, `burnham-park`, `session-road`, `mines-view-park`, `camp-john-hay`. Every other slug in `data/geojson/landmarks.geojson` is tier 2. Every entry starts as `{"tier": N, "scope": "", "osm_ids": [], "exclusion": null, "anchor": null, "sheet": "model/landmarks/<slug>.md", "status": "planned"}`. Generate it rather than typing it:

```bash
python3 - <<'EOF'
import json
fs = json.load(open("data/geojson/landmarks.geojson"))["features"]
t1 = {"baguio-cathedral", "burnham-park", "session-road", "mines-view-park", "camp-john-hay"}
reg = {f["properties"]["slug"]: {"tier": 1 if f["properties"]["slug"] in t1 else 2, "scope": "", "osm_ids": [],
       "exclusion": None, "anchor": None, "sheet": f"model/landmarks/{f['properties']['slug']}.md", "status": "planned"}
       for f in sorted(fs, key=lambda f: f["properties"]["slug"])}
assert len(reg) == 22
open("model/landmarks.json", "w").write(json.dumps(reg, indent=2) + "\n")
EOF
```

- [ ] **Step 3: Write `model/scripts/landmark_osm.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["pyproj==3.8.0", "shapely==2.1.2"]
# ///
"""Landmark procedure step B.

  uv run model/scripts/landmark_osm.py candidates <slug>       # OSM features within 250 m of the destination
  uv run model/scripts/landmark_osm.py footprint <slug> <id>…  # ids like way/123 or relation/456

Overpass needs a non-personal user agent (curl's default gets HTTP 406). Responses are cached in
model/data/landmarks/<slug>/osm.json, so re-runs don't hit the API."""
import json
import subprocess
import sys

from pyproj import Transformer
from shapely.geometry import Polygon, mapping
from shapely.ops import orient, unary_union

from common import LANDMARKS, LM_DATA, LOCAL_TM, ROOT

UA = "baguio-city-3d/1.0"
RADIUS_M = 250
BUFFER_M = 5  # exclusion = footprint grown by 5 m, so massing never touches the landmark


def destination(slug):
    for f in json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]:
        if f["properties"]["slug"] == slug:
            return f["geometry"]["coordinates"]
    raise SystemExit(f"unknown slug {slug}")


def osm(slug):
    cache = LM_DATA / slug / "osm.json"
    if cache.exists():
        return json.loads(cache.read_text())
    lng, lat = destination(slug)
    q = f"[out:json][timeout:60];(way(around:{RADIUS_M},{lat},{lng})[~\"^(building|leisure|amenity|tourism|historic|landuse|natural|man_made|highway)$\"~\".\"];relation(around:{RADIUS_M},{lat},{lng})[~\"^(building|leisure|amenity|tourism|historic|landuse)$\"~\".\"];);out geom tags;"
    out = subprocess.run(["curl", "-fsS", "-A", UA, "--data-urlencode", f"data={q}",
                          "https://overpass-api.de/api/interpreter"], check=True, capture_output=True, text=True).stdout
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(out)
    return json.loads(out)


def polygons(el, fwd):
    """Closed rings of a way or a multipolygon relation's outer members, in model-frame metres."""
    if el["type"] == "way":
        rings = [el.get("geometry", [])]
    else:
        rings = [m.get("geometry", []) for m in el.get("members", []) if m.get("role") == "outer"]
    out = []
    for ring in rings:
        if len(ring) >= 4 and ring[0] == ring[-1]:
            out.append(Polygon([fwd.transform(p["lon"], p["lat"]) for p in ring]))
    return out


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


if __name__ == "__main__":
    cmd, slug, *rest = sys.argv[1:]
    candidates(slug) if cmd == "candidates" else footprint(slug, rest)
```

- [ ] **Step 4: Smoke-test on the cathedral**

Run: `uv run model/scripts/landmark_osm.py candidates baguio-cathedral`
Expected: a list of `way/…` and `relation/…` lines, one of which is the cathedral building (look for `"amenity": "place_of_worship"` or `"building": "cathedral"` or `"church"`). If Overpass answers 429 or 504, wait 60 s and rerun.

- [ ] **Step 5: Commit** `model/landmarks.json`, `model/scripts/landmark_osm.py`, `model/scripts/common.py` with message "Add the landmark registry and OSM footprint tooling for the 3D model" and the trailer.

---

### Task 2: Shared modeling helpers and the export step

**Files:**
- Create: `model/blender/lm_common.py`, `model/blender/export_landmark.py`

**Interfaces:**
- Consumes: M2's `baguio.blend` (collections `40_LANDMARKS`, `00_REFERENCE`, object `TERRAIN_LOD0`) and `terrain_sample.terrain_z`; Task 1's `footprint.json`.
- Produces, in `lm_common.py`: `begin(slug) -> (collection, footprint: dict)`, `material(name, rgb, roughness=0.8) -> Material`, `prism(coll, name, ring, z0, z1, mat) -> Object` (vertical extrusion of a local-metres ring from z0 to z1, capped), `foundation(coll, footprint, mat) -> float` (returns the depth below Z=0 it built to), `human_reference(coll, x, y) -> Object` (1.8 m, excluded from export), `report(slug, coll, depth) -> dict` (prints the procedure-C gates; raises on budget breach), `context_instance(slug, footprint) -> Object`. `export_landmark.py` writes `model/data/out/<slug>.raw.glb` and prints `EXPORT {json}` with bytes, triangles, sha256.

- [ ] **Step 1: Write `model/blender/lm_common.py`**

```python
"""Shared helpers for landmark modeling scripts (landmark procedure, step C). Blender 4.5.2.

A landmark lives in collection LM_<slug> under 40_LANDMARKS, authored around the local origin:
(0, 0, 0) is the footprint centroid on the ground, +Y is north, 1 unit = 1 m. A collection
instance placed at the anchor in 00_REFERENCE shows it in context for renders."""
import json
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

TIER_TRIANGLES = {1: 25_000, 2: 10_000}


def begin(slug):
    name = f"LM_{slug}"
    old = bpy.data.collections.get(name)
    if old:
        for ob in list(old.all_objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(name)
    bpy.data.collections["40_LANDMARKS"].children.link(coll)
    fp = json.loads((ROOT / "model" / "data" / "landmarks" / slug / "footprint.json").read_text())
    return coll, fp


def material(name, rgb, roughness=0.8):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def prism(coll, name, ring, z0, z1, mat):
    """Vertical extrusion of a CCW ring [[x, y], …] (local metres) from z0 up to z1, capped both ends."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, y, z0)) for x, y in ring]
    top = [bm.verts.new((x, y, z1)) for x, y in ring]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def foundation(coll, fp, mat):
    """Contract C2: geometry below Z=0 reaches the lowest terrain under the footprint plus 1 m."""
    ax, ay = fp["anchor_tm"]
    pts = [(ax + x, ay + y) for ring in fp["rings"] for x, y in ring]
    zs = [z for z in terrain_z(pts + [(ax, ay)]) if z is not None]
    ground, lowest = zs[-1], min(zs)
    depth = (ground - lowest) + 1.0
    for i, ring in enumerate(fp["rings"]):
        prism(coll, f"{coll.name}_foundation_{i}", ring, -depth, 0.0, mat)
    return depth


def human_reference(coll, x, y):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=1.8, location=(x, y, 0.9))
    ob = bpy.context.active_object
    ob.name = f"{coll.name}_HUMAN_REF"
    for c in ob.users_collection:
        c.objects.unlink(ob)
    bpy.data.collections["00_REFERENCE"].objects.link(ob)
    return ob


def report(slug, coll, depth):
    tier = json.loads((ROOT / "model" / "landmarks.json").read_text())[slug]["tier"]
    dg = bpy.context.evaluated_depsgraph_get()
    tris, zmin = 0, float("inf")
    for ob in coll.all_objects:
        if ob.type != "MESH":
            continue
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        zmin = min(zmin, min((ob.matrix_world @ v.co).z for v in me.vertices))
        ob.evaluated_get(dg).to_mesh_clear()
    out = {"slug": slug, "tier": tier, "triangles": tris, "budget": TIER_TRIANGLES[tier], "depth": depth, "z_min": zmin}
    print("REPORT", json.dumps(out))
    assert tris <= TIER_TRIANGLES[tier], f"{slug}: {tris} triangles > {TIER_TRIANGLES[tier]}"
    assert zmin <= -depth + 1e-3, f"{slug}: lowest point {zmin:.2f} doesn't reach the foundation depth {-depth:.2f}"
    return out


def context_instance(slug, fp):
    name = f"CTX_{slug}"
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    inst = bpy.data.objects.new(name, None)
    inst.instance_type = "COLLECTION"
    inst.instance_collection = bpy.data.collections[f"LM_{slug}"]
    ax, ay = fp["anchor_tm"]
    inst.location = (ax, ay, terrain_z([(ax, ay)])[0])
    bpy.data.collections["00_REFERENCE"].objects.link(inst)
    return inst
```

- [ ] **Step 2: Write `model/blender/export_landmark.py`** using the verified helper (research §1d) unchanged, plus a `main()`:

```python
"""Landmark procedure step D: export LM_<slug> to model/data/out/<slug>.raw.glb.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/export_landmark.py -- <slug>"""
import hashlib
import json
import os
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]


def export_landmark_glb(collection_name, out_path, image_format="WEBP", image_quality=80):
    """Verified on Blender 4.5.2 (research §1d)."""
    scene_colls = {c.name for c in bpy.context.scene.collection.children_recursive}
    assert collection_name in scene_colls, f"collection {collection_name!r} is not linked into the scene"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=out_path, check_existing=False, will_save_settings=False,
        export_format="GLB", collection=collection_name,
        use_visible=True, use_renderable=True, use_selection=False,
        export_yup=True, export_apply=True, export_gn_mesh=False,
        export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False,
        export_materials="EXPORT", export_image_format=image_format, export_image_quality=image_quality,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_vertex_color="NONE", export_attributes=False, export_extras=False,
        export_draco_mesh_compression_enable=False, export_use_gltfpack=False,
    )
    assert result == {"FINISHED"}, result
    data = open(out_path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    tris = 0
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            n = j["accessors"][p["indices"]]["count"] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]["count"]
            tris += n // 3
    assert j.get("nodes"), f"empty GLB for {collection_name!r}: no visible objects?"
    return {"bytes": len(data), "triangles": tris, "nodes": len(j["nodes"]), "sha256": hashlib.sha256(data).hexdigest()}


slug = sys.argv[sys.argv.index("--") + 1]
print("EXPORT", json.dumps(export_landmark_glb(f"LM_{slug}", str(ROOT / "model" / "data" / "out" / f"{slug}.raw.glb"))))
```

The human reference sits in `00_REFERENCE`, not in `LM_<slug>`, so the export never includes it.

- [ ] **Step 3: Commit** both files with message "Add the shared landmark modeling helpers and the GLB export step" and the trailer.

---

### Task 3: Model the cathedral (procedure A to C)

**Files:**
- Create: `model/landmarks/baguio-cathedral.md`, `model/blender/landmarks/baguio_cathedral.py`
- Modify: `model/landmarks.json` (via the script)

- [ ] **Step 1: Sheet (procedure A).** Research and write `model/landmarks/baguio-cathedral.md`. Start from spec §1: twin spires, rose/cream walls, a hilltop site with a forecourt plaza, "built 1936" per the drone caption. Find the spire height, nave length and width, roof colour and material, and the stairway from Session Road, with URLs. Mark anything unpublished as `ESTIMATE`.
- [ ] **Step 2: Footprint (procedure B).** Run `uv run model/scripts/landmark_osm.py footprint baguio-cathedral <ids>` with the cathedral building's id (the forecourt only if the sheet's scope includes it). Expected output: `baguio-cathedral: 1 part(s), <area> m2, anchor …; exclusion … points`. The registry entry now has `osm_ids`, `exclusion` and `anchor`. Set its `scope` to the sheet's scope sentence and `status` to `"modeled"` once Step 4 passes.
- [ ] **Step 3: Write `model/blender/landmarks/baguio_cathedral.py`.** Required skeleton (the geometry between the markers is yours, built from the sheet's numbers with `prism` and bmesh, and the spires as pyramids or octagonal prisms with caps):

```python
"""baguio-cathedral: <the sheet's scope sentence>. Dimensions: model/landmarks/baguio-cathedral.md.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_cathedral.py"""
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-cathedral"
coll, fp = lm.begin(SLUG)
walls = lm.material("MAT_cathedral_walls", (0.86, 0.72, 0.68))   # from the sheet's colour notes
roof = lm.material("MAT_cathedral_roof", (0.35, 0.18, 0.16))
depth = lm.foundation(coll, fp, walls)

# --- geometry from the sheet: nave, transept, twin spires, forecourt --------------------------
# every dimension below cites the sheet line it came from
# ---------------------------------------------------------------------------------------------

lm.human_reference(coll, 0.0, -25.0)
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
```

- [ ] **Step 4: Run and iterate.** Run the command in the script's docstring. Expected: a `REPORT {…}` line with triangles ≤ 25,000 and no assertion error. Then render three views for review: run M2's `cameras.py` approach with a camera aimed at `CTX_baguio-cathedral` from the south-west at 45° pitch and 150 m distance, and from the burnham-park and session-road preset cameras. Write the PNGs to `model/data/renders/m3/`. Read each PNG and compare it with the sheet's reference images: silhouette (twin spires), proportions against the human reference, colours. Iterate until it reads as the cathedral. Record what you compared in the sheet's "Review" section.
- [ ] **Step 5: Commit** the sheet, the script and `model/landmarks.json` with message "Model Baguio Cathedral for the 3D map" and the trailer.

---

### Task 4: The app's model layer

**Files:**
- Create: `lib/map/modelTransform.ts`, `tests/unit/model-transform.test.ts`, `components/map/layers/ModelLayer.ts`
- Modify: `components/map/MapLayers.tsx`, `components/panels/DestinationSheet.tsx`, `next.config.ts`
- Delete: `components/map/layers/LandmarkLayer.ts`

**Interfaces:**
- Produces: `modelMatrix(anchor: { x: number; y: number; z: number }, metreScale: number, exaggeration: number, rotationDeg: number): number[]` (column-major 4×4; glTF local metres → MapLibre Mercator world). `useModelLayer(map: MapLibreMap): void`. Index shape consumed: `{ "landmarks": [{ "slug": string, "lng": number, "lat": number, "url": string, "rotationDeg": number, "altitudeM": number }] }` at `/models/landmarks/index.json` (Task 5 writes it). M5 extends `ModelLayer.ts` with tiles.

- [ ] **Step 1: Write the failing test `tests/unit/model-transform.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { modelMatrix } from "@/lib/map/modelTransform";

// Apply a column-major 4x4 to a point.
const apply = (m: number[], [x, y, z]: number[]) => [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
const A = { x: 0.8, y: 0.45, z: 1e-5 };

describe("modelMatrix", () => {
  it("maps glTF east, up and south onto Mercator x, z and y at heading 0", () => {
    const m = modelMatrix(A, 2, 1, 0);
    close(apply(m, [1, 0, 0]), [0.8 + 2, 0.45, 1e-5]); // +X east
    close(apply(m, [0, 1, 0]), [0.8, 0.45, 1e-5 + 2]); // +Y up
    close(apply(m, [0, 0, 1]), [0.8, 0.45 + 2, 1e-5]); // +Z is south in glTF (north is -Z); Mercator y grows south
  });
  it("scales only height by the exaggeration", () => {
    const m = modelMatrix(A, 1, 1.35, 0);
    close(apply(m, [0, 10, 0]), [0.8, 0.45, 1e-5 + 13.5]);
    close(apply(m, [10, 0, 0]), [0.8 + 10, 0.45, 1e-5]);
  });
  it("turns clockwise from north by the heading", () => {
    const m = modelMatrix(A, 1, 1, 90);
    close(apply(m, [0, 0, -1]), [0.8 + 1, 0.45, 1e-5]); // the model's north now points east
  });
});
```

Run: `npm test -- model-transform`. Expected: FAIL, cannot resolve `@/lib/map/modelTransform`.

- [ ] **Step 2: Write `lib/map/modelTransform.ts`**

```ts
// Column-major 4x4 taking a glTF model's local metres (+X east, +Y up, -Z north; contract C2)
// to MapLibre's Mercator world (x east, y south, z up). `anchor` is the MercatorCoordinate of the
// model's origin; `metreScale` is anchor.meterInMercatorCoordinateUnits(); only height is
// multiplied by the terrain exaggeration; `rotationDeg` turns the model clockwise from north.
export function modelMatrix(
  anchor: { x: number; y: number; z: number },
  metreScale: number,
  exaggeration: number,
  rotationDeg: number,
): number[] {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(t) * metreScale;
  const s = Math.sin(t) * metreScale;
  return [c, s, 0, 0, 0, 0, metreScale * exaggeration, 0, -s, c, 0, 0, anchor.x, anchor.y, anchor.z, 1];
}
```

Run: `npm test -- model-transform`. Expected: 3 passed.

- [ ] **Step 3: Write `components/map/layers/ModelLayer.ts`**

```ts
"use client";

// Landmark meshes drawn with three.js inside MapLibre's GL context (contract C5). Nothing 3D
// loads before the map's first idle; a landmark loads when its sheet opens or when it is in view
// at zoom >= 15 (contract C3). Each model is drawn with its own projection matrix, multiplied in
// JS doubles, because a float32 GPU matrix can't hold a Mercator offset to the metre.
import { useEffect } from "react";
import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { modelMatrix } from "@/lib/map/modelTransform";
import { useMapStore } from "@/stores/useMapStore";
import { isTornDown } from "./teardown";

const LAYER_ID = "model-3d";
const INDEX_URL = "/models/landmarks/index.json";
const NEAR_ZOOM = 15;

interface LandmarkEntry { slug: string; lng: number; lat: number; url: string; rotationDeg: number; altitudeM: number }
interface Shown { entry: LandmarkEntry; scene: Scene }

type Kit = { THREE: typeof import("three"); loader: GLTFLoader };
let kit: Promise<Kit> | null = null;
const loadKit = () =>
  (kit ??= Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]).then(([THREE, { GLTFLoader }, { MeshoptDecoder }]) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return { THREE, loader };
  }));

// Session caches survive style swaps (the layer itself is re-added on every styleGeneration).
const models = new Map<string, Promise<Object3D>>();
let index: Promise<LandmarkEntry[]> | null = null;
const loadIndex = () =>
  (index ??= fetch(INDEX_URL)
    .then((r) => (r.ok ? r.json() : { landmarks: [] }))
    .then((j: { landmarks: LandmarkEntry[] }) => j.landmarks)
    .catch(() => []));

const firstIdle = new WeakMap<MapLibreMap, Promise<void>>();
function whenFirstIdle(map: MapLibreMap) {
  let p = firstIdle.get(map);
  if (!p) {
    p = map.loaded() ? Promise.resolve() : new Promise<void>((resolve) => map.once("idle", () => resolve()));
    firstIdle.set(map, p);
  }
  return p;
}

function createLayer(map: MapLibreMap, { THREE }: Kit, shown: Map<string, Shown>): CustomLayerInterface {
  let renderer: WebGLRenderer | null = null;
  const camera: Camera = new THREE.Camera();
  return {
    id: LAYER_ID,
    type: "custom",
    renderingMode: "3d",
    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
    },
    render(_gl, options) {
      if (!renderer || shown.size === 0) return;
      const exaggeration = map.getTerrain()?.exaggeration ?? 1;
      const mvp = new THREE.Matrix4().fromArray(options.modelViewProjectionMatrix as unknown as number[]);
      renderer.resetState();
      for (const { entry, scene } of shown.values()) {
        const ground = map.queryTerrainElevation([entry.lng, entry.lat]);
        if (ground == null) continue; // terrain tiles not in yet; try again next frame
        const anchor = MercatorCoordinate.fromLngLat([entry.lng, entry.lat], ground + entry.altitudeM * exaggeration);
        const local = new THREE.Matrix4().fromArray(
          modelMatrix(anchor, anchor.meterInMercatorCoordinateUnits(), exaggeration, entry.rotationDeg),
        );
        camera.projectionMatrix.copy(mvp).multiply(local);
        renderer.render(scene, camera);
      }
    },
  };
}

export function useModelLayer(map: MapLibreMap) {
  useEffect(() => {
    let cancelled = false;
    let layerAdded = false;
    const shown = new Map<string, Shown>();

    async function want(entry: LandmarkEntry) {
      if (shown.has(entry.slug)) return;
      const k = await loadKit();
      if (cancelled || isTornDown(map)) return;
      let model = models.get(entry.url);
      if (!model) {
        model = k.loader.loadAsync(entry.url).then((g) => g.scene);
        models.set(entry.url, model);
      }
      const obj = await model.catch(() => null);
      if (!obj || cancelled || isTornDown(map)) return;
      const scene = new k.THREE.Scene();
      scene.add(new k.THREE.HemisphereLight(0xffffff, 0x6b6156, 2.2));
      const sun = new k.THREE.DirectionalLight(0xffffff, 1.6);
      sun.position.set(-0.5, 1, 0.3);
      scene.add(sun, obj.clone());
      shown.set(entry.slug, { entry, scene });
      if (!layerAdded) {
        try {
          map.addLayer(createLayer(map, k, shown));
          layerAdded = true;
        } catch {
          return; // style mid-swap; the remount on the next styleGeneration re-adds it
        }
      }
      map.triggerRepaint();
    }

    async function update() {
      const entries = await loadIndex();
      if (cancelled || isTornDown(map)) return;
      const selected = useMapStore.getState().ui.selectedSlug;
      const near = map.getZoom() >= NEAR_ZOOM ? map.getBounds() : null;
      for (const e of entries) {
        if (e.slug === selected || near?.contains([e.lng, e.lat])) void want(e);
      }
    }

    whenFirstIdle(map).then(() => {
      if (cancelled) return;
      void update();
      map.on("moveend", update);
    });
    const unsubscribe = useMapStore.subscribe((s, prev) => {
      if (s.ui.selectedSlug !== prev.ui.selectedSlug) void whenFirstIdle(map).then(update);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (isTornDown(map)) return;
      map.off("moveend", update);
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    };
  }, [map]);
}
```

- [ ] **Step 4: Wire it in, and remove the old seam.**
  - In `components/map/MapLayers.tsx`, replace `import { useLandmarkLayer } from "./layers/LandmarkLayer";` with `import { useModelLayer } from "./layers/ModelLayer";`, and replace `useLandmarkLayer(map);` with `useModelLayer(map);`.
  - In `components/panels/DestinationSheet.tsx`, delete the import on line 9 and the `addLandmarkModel(…)` call with its comment (lines 40-45). The layer now follows `selectedSlug` from the store. Leave `setState({ feature, loading: false, error: false });` in place.
  - Delete `components/map/layers/LandmarkLayer.ts`.
  - Check nothing else imports it: `grep -rn "LandmarkLayer\|addLandmarkModel" app components lib stores tests` prints nothing.
- [ ] **Step 5: CSP and cache headers in `next.config.ts`.**
  - Change the script-src line to `"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com",`. The meshopt decoder compiles WebAssembly.
  - Change `headers()` to return, before the existing entry:

```ts
      { source: "/models/:path*.glb", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/models/:path*/index.json", headers: [{ key: "Cache-Control", value: "public, max-age=300" }] },
```

  - Read `node_modules/next/dist/docs/` on `headers()` path matching first (AGENTS.md). If `:path*.glb` isn't valid there, use the documented regex form.
- [ ] **Step 6: Verify.** Run `npx tsc --noEmit` (clean), `npx eslint components/map lib/map tests/unit` (no new errors), `npm test` (all pass).
- [ ] **Step 7: Commit** with message "Draw landmark models on the map with three.js, loaded after the map is idle" and the trailer.

---

### Task 5: Ship the cathedral (procedure D)

**Files:**
- Create: `model/scripts/pack_landmark.py`, `tests/unit/model-budgets.test.ts`
- Generated and committed: `model/out/landmarks-manifest.json`, `public/models/landmarks/index.json`, `public/models/landmarks/baguio-cathedral.<hash8>.glb`

**Interfaces:**
- Consumes: `model/data/out/<slug>.raw.glb`; `model/landmarks.json` (`tier`, `anchor`).
- Produces: manifest entry `{slug, lng, lat, url, rotationDeg: 0, altitudeM: 0, triangles, bytes, geometryBytes, sha256}`. The index is the same entries without `triangles`, `bytes`, `geometryBytes`, `sha256`. Rotation is 0 by construction: the model frame's +Y is true north within 0.04° (contract C1), and footprints are authored in place.

- [ ] **Step 1: Pin gltfpack.** Run `npm view gltfpack version` and put that exact version in `GLTFPACK` below. Run `npx -y gltfpack@<that version> -h | head -5` to confirm it runs.
- [ ] **Step 2: Write `model/scripts/pack_landmark.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""Landmark procedure step D: compress, budget-check, hash and publish one landmark.
Run: uv run model/scripts/pack_landmark.py <slug>"""
import hashlib
import json
import struct
import subprocess
import sys

from common import DATA, LANDMARKS, ROOT

GLTFPACK = "gltfpack@<pin from Step 1>"
KIB = 1024
BUDGET = {1: (150 * KIB, 60 * KIB), 2: (150 * KIB, None)}  # (whole file, geometry) per tier, contract C6
PUBLIC = ROOT / "public" / "models" / "landmarks"
MANIFEST = ROOT / "model" / "out" / "landmarks-manifest.json"


def glb_stats(data):
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    tris = 0
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            acc = j["accessors"][p["indices"]] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]
            tris += acc["count"] // 3
    image_bytes = sum(j["bufferViews"][im["bufferView"]]["byteLength"] for im in j.get("images", []) if "bufferView" in im)
    return tris, len(data) - image_bytes


def main(slug):
    reg = json.loads(LANDMARKS.read_text())[slug]
    raw = DATA / "out" / f"{slug}.raw.glb"
    packed = DATA / "out" / f"{slug}.packed.glb"
    subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw), "-o", str(packed), "-cc"], check=True)
    data = packed.read_bytes()
    tris, geometry = glb_stats(data)
    whole_cap, geom_cap = BUDGET[reg["tier"]]
    assert len(data) <= whole_cap, f"{slug}: {len(data)} bytes > {whole_cap}"
    assert geom_cap is None or geometry <= geom_cap, f"{slug}: geometry {geometry} bytes > {geom_cap}"
    sha = hashlib.sha256(data).hexdigest()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob(f"{slug}.*.glb"):
        old.unlink()
    name = f"{slug}.{sha[:8]}.glb"
    (PUBLIC / name).write_bytes(data)
    lng, lat = reg["anchor"]
    entry = {"slug": slug, "lng": lng, "lat": lat, "url": f"/models/landmarks/{name}", "rotationDeg": 0, "altitudeM": 0,
             "triangles": tris, "bytes": len(data), "geometryBytes": geometry, "sha256": sha}
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"landmarks": []}
    manifest["landmarks"] = sorted([e for e in manifest["landmarks"] if e["slug"] != slug] + [entry], key=lambda e: e["slug"])
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    keep = ("slug", "lng", "lat", "url", "rotationDeg", "altitudeM")
    (PUBLIC / "index.json").write_text(json.dumps({"landmarks": [{k: e[k] for k in keep} for e in manifest["landmarks"]]}, indent=2) + "\n")
    print(f"PACK {slug}: {len(data):,} bytes (geometry {geometry:,}), {tris:,} triangles, {name}")


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 3: Write the budget test `tests/unit/model-budgets.test.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Contract C6: per-file landmark budgets, measured on the raw file (stricter than over the wire).
const DIR = "public/models/landmarks";
const KiB = 1024;
const glbJson = (b: Buffer) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));

it("every landmark in the index exists, fits its budget, and nothing else is shipped", () => {
  if (!existsSync(`${DIR}/index.json`)) return;
  const { landmarks } = JSON.parse(readFileSync(`${DIR}/index.json`, "utf8")) as { landmarks: { slug: string; url: string }[] };
  const registry = JSON.parse(readFileSync("model/landmarks.json", "utf8")) as Record<string, { tier: number }>;
  for (const { slug, url } of landmarks) {
    const buf = readFileSync(`public${url}`);
    expect(buf.length, `${slug} file`).toBeLessThanOrEqual(150 * KiB);
    const j = glbJson(buf);
    const images = (j.images ?? []).reduce((s: number, im: { bufferView?: number }) =>
      s + (im.bufferView != null ? j.bufferViews[im.bufferView].byteLength : 0), 0);
    if (registry[slug].tier === 1) expect(buf.length - images, `${slug} geometry`).toBeLessThanOrEqual(60 * KiB);
  }
  const listed = new Set(landmarks.map((l) => l.url.split("/").pop()));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".glb"));
  expect(files.filter((f) => !listed.has(f)), "orphan GLBs").toEqual([]);
});
```

- [ ] **Step 4: Export, pack, and check determinism**

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/export_landmark.py -- baguio-cathedral
uv run model/scripts/pack_landmark.py baguio-cathedral
cp public/models/landmarks/index.json /tmp/m3-index-1.json
/Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/export_landmark.py -- baguio-cathedral
uv run model/scripts/pack_landmark.py baguio-cathedral
diff /tmp/m3-index-1.json public/models/landmarks/index.json && echo IDENTICAL
npm test
```

Expected: `EXPORT {…}`, `PACK baguio-cathedral: … bytes (geometry …), … triangles, baguio-cathedral.<hash8>.glb`, `IDENTICAL`, and all tests pass.
- If gltfpack rejects the WebP images, re-export with `image_format="JPEG"` (change the default in `export_landmark.py`), record it in the ledger, and rerun.
- If the file is over budget, reduce textures first (≤ 512 px, contract C2), then triangles. Never raise the budget.
- [ ] **Step 5: Commit** the script, the test, the manifest, the index and the GLB with message "Ship the Baguio Cathedral model to the map" and the trailer.

---

### Task 6: Database row, e2e, and the view (procedure E)

**Files:**
- Create: `model/scripts/landmarks_sql.py`, `tests/e2e/landmark-model.spec.ts`
- Generated and committed: `supabase/migrations/<UTC timestamp>_landmark_meshes.sql`, `data/geojson/landmarks.geojson` (`meshUrl`), `supabase/seed.sql`

- [ ] **Step 1: Write `model/scripts/landmarks_sql.py`**

```python
# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""Landmark procedure step E: mirror the manifest into a migration and the geojson.
Run: uv run model/scripts/landmarks_sql.py   (writes one new migration covering every manifest entry)"""
import datetime
import json

from common import ROOT

MANIFEST = ROOT / "model" / "out" / "landmarks-manifest.json"
GEO = ROOT / "data" / "geojson" / "landmarks.geojson"


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    entries = json.loads(MANIFEST.read_text())["landmarks"]
    stamp = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d%H%M%S")
    lines = ["-- Landmark meshes, generated by model/scripts/landmarks_sql.py from model/out/landmarks-manifest.json.",
             "-- Live destination ids differ from the seed's, so rows are matched by slug. Idempotent.", "DO $$", "DECLARE n integer;", "BEGIN"]
    for e in entries:
        lines += [
            f"  DELETE FROM \"landmarks\" WHERE \"destination_id\" = (SELECT \"id\" FROM \"destinations\" WHERE \"slug\" = {q(e['slug'])});",
            "  INSERT INTO \"landmarks\" (\"id\", \"destination_id\", \"mesh_url\", \"mesh_scale\", \"rotation_deg\", \"altitude_m\")",
            f"  SELECT gen_random_uuid()::text, \"id\", {q(e['url'])}, 1, {e['rotationDeg']}, {e['altitudeM']} FROM \"destinations\" WHERE \"slug\" = {q(e['slug'])};",
            "  GET DIAGNOSTICS n = ROW_COUNT;",
            f"  IF n <> 1 THEN RAISE EXCEPTION 'landmarks: {e['slug']} expected 1 row, inserted %', n; END IF;",
        ]
    lines += ["END", "$$;", ""]
    out = ROOT / "supabase" / "migrations" / f"{stamp}_landmark_meshes.sql"
    out.write_text("\n".join(lines))
    geo = json.loads(GEO.read_text())
    urls = {e["slug"]: e["url"] for e in entries}
    for f in geo["features"]:
        f["properties"]["meshUrl"] = urls.get(f["properties"]["slug"])
    GEO.write_text(json.dumps(geo, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {out.relative_to(ROOT)} ({len(entries)} landmark(s)); synced meshUrl in {GEO.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Generate.** Run `uv run model/scripts/landmarks_sql.py`, then `node scripts/generate-supabase-seed.mjs`. Then `git diff --stat data/geojson/landmarks.geojson` must show only the `meshUrl` line for `baguio-cathedral`. If the geojson's original indentation differs and the whole file shows as changed, match the original `json.dumps` settings in the script instead.
- [ ] **Step 3: Apply to the live DB, after the owner says so in chat.** Check the project is `ACTIVE_HEALTHY` (Supabase MCP `get_project`). Then run `supabase db push --linked` and `supabase migration list --linked` (every row paired). No Redis flush is needed: the detail cache TTL is 300 s.
- [ ] **Step 4: Write `tests/e2e/landmark-model.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("the cathedral's model loads with its sheet and survives a basemap swap", async ({ page }) => {
  const errors: string[] = [];
  const glb: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/models\/landmarks\/baguio-cathedral\.[0-9a-f]{8}\.glb$/.test(r.url())) glb.push(r.url());
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => glb.length, { timeout: 30_000 }).toBeGreaterThan(0);
  const satellite = page.getByRole("button", { name: "Toggle satellite imagery" });
  await satellite.click();
  await page.waitForTimeout(2_000);
  await satellite.click();
  await page.waitForTimeout(2_000);
  expect(glb.length, "the model is fetched once per session").toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m3-cathedral.png" });
});
```

Run: `npm run test:e2e -- landmark-model`. Expected: 1 passed.
- [ ] **Step 5: Look.** Read `test-results/m3-cathedral.png`. The cathedral must stand on the hill, not float or sink, with twin spires upright. Compare it with the sheet's references and the Blender renders. Then run the whole suite: `npm run test:e2e`, all pass (the map-fallback spec included).
- [ ] **Step 6: Commit** the script, the migration, the geojson, the seed and the spec with message "Record the cathedral's model in the database and check it on the map" and the trailer.

---

### Task 7: Contract and ledger

- [ ] **Step 1:** Make sure the contract carries the M3 amendments (1 Oct 2026). Landmarks are anchored at their footprint centroid from `public/models/landmarks/index.json`, not the destination pin. `rotation_deg` is 0 by construction. The runtime renders from the index, and the `landmarks` table mirrors it for API consumers. Each model is drawn with its own projection matrix.
- [ ] **Step 2:** Append `## Phase 9, M3: cathedral slice (date)` to the ledger with: the file size, geometry size and triangle count; the hash; the e2e result; the screenshot review; any gltfpack/WebP outcome; the migration name and whether it was applied. Commit with the trailer. Report to the owner.

## If a gate fails

Stop and report; never loosen a budget.
- **Model floats or sinks on `/map`:** check `index.json`'s `lng`/`lat` against `footprint.json`'s `anchor_lnglat`. Then check that the GLB's origin is the footprint centroid at ground level: export a 1 m cube at the origin and look.
- **Model mirrored or rotated 90°:** `modelTransform` is pinned by its unit test. If the test passes, the export axes are wrong; check `export_yup=True`.
- **Model jitters while panning:** something put the Mercator offset into an object matrix instead of the camera's projection.
- **Page error during the basemap swap:** the layer was added while the style was in flight. `addLayer` must stay inside `try`, and the hook must remount on `styleGeneration` (it does, via `MapLayers`' key).
