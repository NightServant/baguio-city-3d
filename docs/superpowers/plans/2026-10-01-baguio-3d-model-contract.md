# Baguio 3D Model: Phase 9 Architecture Contract (M2–M8)

Every milestone plan (`2026-10-01-baguio-3d-model-m2.md` … `-m8.md`) implements against this contract. If a plan and this contract disagree, the contract wins. If the contract is wrong, change it here first with a dated ruling, then the plans.

**Sources:** spec `docs/baguio-3d-model-plan.md` (incl. the 24 Sep and 1 Oct 2026 addenda), Phase 9 in `docs/superpowers/plans/2026-09-24-baguio-3d-site-overhaul.md`, M1 plan `docs/superpowers/plans/2026-10-01-baguio-3d-model-m1.md`, and the research notes in `docs/superpowers/research/2026-10-01-*.md` (facts verified 1 Oct 2026).

---

## C1. Coordinate frame (amends spec §4 and §11)

Blender authors in a **local transverse Mercator centred on `BAGUIO_CENTER`**:

```
+proj=tmerc +lat_0=16.4023 +lon_0=120.596 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs
```

Why not UTM 51N (the spec's choice): measured 1 Oct 2026 with pyproj, UTM 51N's grid north is rotated **−0.679°** from true north at Baguio (scale 1.000415). That puts a point 1 km from its anchor about 12 m off, which breaks the spec's own ≤1 m round-trip invariant (§11) for anything placed by lng/lat at runtime. The local TM has convergence within **±0.038°** and scale **≤1.000003** across the padded bounds, its origin is `BAGUIO_CENTER` (so the spec's "origin shift" is the projection itself), and +Y is true north at the centre. Round trip lng/lat → TM → lng/lat measured at 0.0 m.

- 1 Blender unit = 1 metre. +X east, +Y north, +Z up.
- Z in Blender is **metres above sea level** of the DEM in use. M2's terrain is Copernicus GLO-30 (EGM2008).
- Python data scripts use the same proj string through `pyproj`. It lives once, in `model/scripts/common.py` as `LOCAL_TM`. Blender never projects: its bundled Python 3.11 has numpy 1.26 but no pyproj, rasterio, scipy or PIL (verified). `uv run` scripts write projected east/north/height arrays as `.npy`/`.npz` under `model/data/`, and Blender scripts load those with numpy. DEM posts are not square in metres (about 29.6 × 30.7 m at this latitude), so arrays carry per-post coordinates, not a spacing.

## C2. Two kinds of web asset

**Landmarks** — one GLB per destination slug.
- Authored at true metric scale. Origin at the footprint centroid **on the ground**: Z=0 is the terrain height at the centroid. Geometry below Z=0 (foundations, plinths, retaining walls) extends down to the lowest terrain under the footprint plus 1 m, so the model never floats on a slope.
- +Y north in Blender; the glTF exporter's `export_yup=True` maps Blender (east, north, up) to glTF (east, up, −north) (verified).
- **Textures (amended 2 Oct, M3):** tiles or atlases ≤ 512 × 512, exported as WebP. The landmark's byte budget governs how many, not a fixed count. The cathedral ships three generated 256 px pattern tiles in 7.4 KB. Originally: one baked base-colour atlas per landmark, ≤ 512 × 512, exported as WebP (`export_image_format='WEBP'`, quality via `export_image_quality`; `export_jpeg_quality` is ignored). Flat-coloured parts use vertex colours or untextured materials. Measured: two 1K ambientCG materials export at 3.3 MB as JPEG q80 and 300 KB as WebP q80, and 22.5 KB as WebP at 256 px. So full-resolution PBR sets never ship. Normal or roughness maps only if M7 shows they fit. M7 decides whether KTX2 replaces WebP.
- Runtime placement (amended 1 Oct, M3): anchor = the footprint centroid (`anchor` in `model/landmarks.json`, published in `public/models/landmarks/index.json`), not the destination pin, which can be tens of metres off the building. Altitude = `map.queryTerrainElevation(lngLat)` (already exaggerated) + `altitude_m × exaggeration`. Scale = `meterInMercatorCoordinateUnits()` on X and Y, and that × `exaggeration` on Z, where `exaggeration = map.getTerrain()?.exaggeration` read at render time, never hardcoded (owner answer 1, 1 Oct 2026). Heading = `rotation_deg`, degrees clockwise from north about up. It is **0 by construction**: footprints are authored in place in the model frame, whose +Y is true north within 0.04° (C1).
- The app renders from `public/models/landmarks/index.json`. The `landmarks` table mirrors it for API consumers (`mesh_url`, `mesh_scale = 1`, `rotation_deg = 0`, `altitude_m = 0` unless a model deliberately sits above ground). Both are generated from `model/out/landmarks-manifest.json`, so they can't drift.

**Building massing tiles** — streamed by viewport.
- Coordinates: tile-local metres east/north of the tile's anchor (its centre lng/lat), computed through `LOCAL_TM` minus the anchor's TM coordinates. Within a tile, TM axes match true east/north to 0.04°.
- Z is **absolute metres above sea level on the app's own Terrarium surface** (the DEM the map renders), not Copernicus. A building's base = the minimum Terrarium z15 elevation at its footprint vertices minus a skirt (size set by M5 from measurement), so it meets the rendered slope with no gap.
- Runtime placement: anchor at `MercatorCoordinate.fromLngLat(anchor, 0)`, same X/Y/Z scaling as landmarks. Z × exaggeration lines the tile up with the exaggerated terrain because both are scaled sea-level heights.

Why the two use different terrain sources: landmarks are single points and the spec's binding rule (§3a) queries the live surface at render time. Thousands of building bases can't be queried per frame, so they're baked from the same DEM the map renders.

## C3. Landmarks and buildings never overlap

- `model/landmarks.json` (committed, created in M3, Task 1, for **all 22** slugs) holds per slug: `tier`, `scope` (one line), `exclusion` (a lng/lat ring around everything the landmark mesh depicts), `rotation_deg`.
- M5's tile builder drops every OSM building whose footprint intersects any `exclusion` ring. Landmark meshes carry their own buildings.
- So no destination is ever empty on the map: **a landmark's GLB loads when its destination sheet opens, or when it is inside the viewport at zoom ≥ 15.** At zoom < 15 a landmark footprint is a few pixels (13 m/px at z13.5, 16.4°N), so its unfilled exclusion area doesn't read.

## C4. Files and URLs

| What | Where | Committed |
|---|---|---|
| Blender scripts (`bpy`) | `model/blender/<step>.py`, run headless: `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python <file>` (reproducible from a clean factory state; no MCP traffic). The live instance (MCP) only opens the saved `.blend` to inspect it, or renders when headless GPU rendering is unavailable | yes |
| Python data scripts | `model/scripts/*.py`, run with `uv run` (PEP 723 pins) | yes |
| Source downloads, derived rasters | `model/data/` | no (gitignored, M1) |
| The working `.blend` | `model/data/blend/baguio.blend` | no: rebuilt from scripts |
| Uncompressed exports | `model/data/out/<name>.raw.glb`, the exporter's output before gltfpack. Blender can't re-import meshopt GLBs (verified RuntimeError), so this is the copy to re-open | no |
| Landmark GLBs | `public/models/landmarks/<slug>.<hash8>.glb` | yes |
| Building tiles | `public/models/buildings/<tileId>.<hash8>.glb` | yes |
| Tile index | `public/models/buildings/index.json` (tile id, anchor, bbox, url, bytes, triangles) | yes |
| Landmark registry and research sheets | `model/landmarks.json` (all 22: tier, scope, OSM ids, anchor, exclusion, status), `model/landmarks/<slug>.md` | yes |
| Landmark index (what the app loads) | `public/models/landmarks/index.json` | yes |
| Landmark manifest | `model/out/landmarks-manifest.json` (slug, mesh_url, rotation_deg, altitude_m, triangles, bytes, sha256), the input to the DB migration | yes |

- `<hash8>` = the first 8 hex chars of the GLB's sha256, so every URL is immutable. A changed landmark gets a new URL, and the DB row changes with it through a migration (rows are data; ledger-tracked).
- Cache: `next.config.ts` serves `/models/:path*` with `Cache-Control: public, max-age=31536000, immutable`, except `index.json`, which gets `max-age=300`.
- ponytail: GLBs are committed to `public/`. If regenerations bloat git history, move them to Vercel Blob behind the same URL scheme.

## C5. One runtime layer

- One MapLibre custom layer, id `model-3d`, file `components/map/layers/ModelLayer.ts`, renders both landmarks and building tiles with one three.js renderer sharing MapLibre's GL context (`renderingMode: "3d"`, so it depth-tests against terrain).
- Each model (and, from M5, each tile) is drawn with its own projection matrix = MapLibre's `modelViewProjectionMatrix` × the model matrix, multiplied in JS doubles (`lib/map/modelTransform.ts`). A float32 GPU matrix can't hold a Mercator offset to the metre, so the offset never goes into an object matrix.
- Installed from a `MapLayers` hook so it remounts on every `styleGeneration` (spec addendum 24 Sep, item 2). It never caches an altitude across a style swap.
- **three.js, its loaders and any model file load only after the map's first `idle`, or 10 s after the model layer first mounts, whichever comes first** (amended 2 Oct, M3: on a 6 KB/s link idle took 55 s alone and over 120 s under load, so a visitor who keeps panning might never see a model). Nothing 3D on the first load of `/map` (1 Oct budget). This replaces the spec's "only when the first destination sheet opens" (§9), which predates building tiles.
- Decoders: meshopt (`EXT_meshopt_compression`). KTX2/Basis only if M7 measures that it pays for its transcoder. The CSP gains exactly what these need (`'wasm-unsafe-eval'` in `script-src`; `worker-src` already has `blob:`).

## C6. Budgets (from the 1 Oct addendum, unchanged)

0 bytes of 3D on `/map` first load · runtime ≤ 180 KiB · tile ≤ 100 KiB · default view ≤ 1 MiB · landmark ≤ 150 KiB with textures (tier-1 geometry ≤ 60 KiB) · session ≤ 6 MiB · ≥ 30 fps on a Galaxy A51-class phone, starting knobs ≤ 500k triangles and ≤ 100 draw calls. All sizes compressed, over the wire.

A unit test (M3 creates it, every later milestone keeps it green) reads `public/models/**` and fails on any per-file budget breach.

## C7. Determinism

Every generator is seeded. Re-running a milestone's scripts on the same inputs produces byte-identical GLBs (same sha256, same `<hash8>`). Each export task checks it by running twice.

## C8. Tooling rules

- `bpy` code is verified against the live Blender 4.5.2 (`bpy_api_lookup`, `describe_node_type`) before it's written into a plan or script. After every Blender step: a headless gate script (structure) and a render or `get_viewport_screenshot` read back as an image (appearance).
- Python: `uv run`, pinned. Never `pip install` globally.
- gltfpack through `npx`, version pinned in the script that calls it.
- Blender facts verified on 4.5.2 are in `docs/superpowers/research/2026-10-01-blender-api-facts.md`. Highlights: export with `export_format='GLB'`, `export_apply=True`, and Realize Instances before export, or Geometry Nodes output is dropped. An unknown `collection=` name writes an empty GLB and still returns FINISHED, so every export asserts the triangle count. Drape onto terrain with `GeometryNodeRaycast` (matches `Object.ray_cast` to 0.0007 m), not Sample Nearest Surface (off by up to 1,486 m). Render engines are `BLENDER_EEVEE_NEXT`, `CYCLES` and `BLENDER_WORKBENCH`. The MapLibre camera recipe (vertical FOV 0.6435011 rad, distance = 1.5 × viewport height × metres per pixel) is in §9 there. The add-on is 1.8 / protocol 13 (spec §4.0's 1.7 / 9 is stale).
- Poly Haven must be switched on per scene (`scene.blendermcp_use_polyhaven = True`) at the start of every Blender session; it resets in a new file.
- Overpass/OSM requests send a non-personal user agent (`baguio-city-3d/1.0`); curl's default gets HTTP 406.

## C9. Truth and attribution

- Inferred building heights are plausible massing, never survey data (spec §6). Any copy that mentions them says so.
- Landmark dimensions come from the cited research sheets; estimates stay labelled ESTIMATE in `model/landmarks.json`.
- Attribution already on the map covers OSM ("© OpenStreetMap contributors") and Terrarium ("Mapzen / Tilezen, AWS Open Data"). If any shipped file derives from Copernicus data, `/about#sources` adds the Copernicus notice from `model/sources.json` in the same commit.

## C10. Milestone order and hand-offs

| M | Consumes | Produces for later milestones |
|---|---|---|
| M2 terrain | M1 `model/data/dem/copernicus-glo30-baguio.tif` | `TERRAIN_LOD0/1/2` in the `.blend`; `model/blender/build_terrain.py`; terrain sampling helper for landmark foundations |
| M3 cathedral slice | M2 terrain; research sheets | `model/landmarks.json` (all 22), the modeling procedure, `model/blender/export_landmark.py`, `model/scripts/pack_landmark.py`, the manifest, `ModelLayer.ts` (landmarks), the DB migration pattern, the budget test, e2e for a landmark |
| M4 tier-1 | M3's procedure | 4 more landmarks |
| M5 context | M1 OSM extract, `model/landmarks.json` exclusions, Terrarium | building tiles + `index.json`, tile streaming in `ModelLayer.ts`; roads and pine scatter for renders only |
| M6 remaining 17 | M3's procedure | 17 landmarks |
| M7 optimization | everything shipped | budgets met and enforced, texture format decision, device fps measurement |
| M8 hardening | everything | full e2e, lazy-load gate, failure and context-loss handling, docs |
