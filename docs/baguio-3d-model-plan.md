# Baguio City 3D Model — Blender Production & Web Integration Spec

> **Status:** planning only. Nothing built, nothing in the web app modified.
> **Audience:** a future Claude Code session that will execute this.

---

## Context

`/Users/gabe/Next-JS/baguio-city-3d` is a shipped Next.js 16 app: a MapLibre GL 5.24 map of Baguio with 22 destinations, 6 jeepney routes, 30 venues, 17 historical events, backed by PostGIS on Supabase. It renders real terrain today (AWS Terrarium DEM, exaggeration 1.35) but has **zero custom 3D geometry**.

The app already contains a **dormant 3D seam**, built but never filled:

| Artifact | State | File |
|---|---|---|
| `landmarks` table (`mesh_url`, `mesh_scale`, `rotation_deg`, `altitude_m`) | exists, **0 rows** | `prisma/schema.prisma:71-82` |
| `addLandmarkModel(map, landmark, coord)` | **empty function body** | `components/map/layers/LandmarkLayer.ts:26-34` |
| `landmark-extrusions` fill-extrusion layer | mounted, source permanently empty | `LandmarkLayer.ts:44-53` |
| `/api/geo/destinations/[slug]` returns `landmark` | wired, always `null` | `app/api/geo/destinations/[slug]/route.ts:45-54` |
| Call site on destination select | wired | `components/panels/DestinationSheet.tsx:38-46` |

All 22 features in `data/geojson/landmarks.geojson` carry `"meshUrl": null`, so the seeder's `if (p.meshUrl)` gate at `prisma/seed.ts:72` never fires. **The plumbing is finished and waiting for assets.** This project produces those assets.

**Goal:** a Blender-authored 3D model of Baguio that becomes the app's visual/geographic foundation — terrain, landmark meshes, building massing, vegetation — exported as web-deliverable glTF and wired through the existing seam.

**Locked decisions (user, this session):**
1. **Extent:** full app bounds `[120.5, 16.3] → [120.7, 16.5]`
2. **Integration:** install **three.js**, render glTF via MapLibre `CustomLayerInterface`
3. **Fidelity:** **photoreal / reference-accurate**

---

## 1. Research findings — aerial reference (VERIFIED)

**Source:** *"AMAZING Aerial View of Baguio in 2026! | Baguio City & La Trinidad | Drone Tour 2026"* — The Art of Tour, uploaded 2026-03-06, 3:34. Inspected via 48 extracted frames.

> ⚠️ The audio transcript is **unusable** — Whisper hallucinated Khmer text on a music-only track. All findings below come from **burned-in English captions and visual frame analysis only**. Nothing was inferred from audio.

### Terrain & landform (verified)
- Baguio sits on **ridges and steep valleys**, not a plateau. Slopes frequently exceed what looks like 30°.
- Development **climbs slope faces continuously** — no flat datum anywhere in the urban core.
- **La Trinidad (north) is a genuine flat valley floor** — sharply different from Baguio's relief. Visible agricultural grid.
- Kennon Road approach (south) descends into **low, hot, flat foothills** with broadleaf vegetation — a completely different biome from the pine highlands.
- Frequent **cloud/fog banks below ridge level** and strong atmospheric haze with depth — critical to the city's read.

### Urban density & massing (verified)
- **Extreme hillside density.** Houses packed with near-zero setback, stacked vertically up slopes.
- Typical residential: **2–4 storeys**, rectangular, flat or shallow-gable.
- CBD core (Session Road / Burnham): denser, **4–8 storeys**, some larger slabs.
- **Roofs are the dominant visual signature** — corrugated metal in saturated red, green, blue, teal. From the air, Baguio reads as *a field of colored roofs*, not as walls or facades. **This is the single most important material observation for photoreal work.**
- Building footprints are irregular, small, and non-orthogonal to each other.

### Vegetation (verified)
- **Pine (Pinus kesiya) on ridges and slopes**, heavily interleaved with buildings — not separated into parks.
- Dense pine canopy survives on steeper/protected ground; cleared on buildable slopes.
- Mixed broadleaf at lower elevations and in valleys.
- Camp John Hay / Good Shepherd area: mature pine stands with structures embedded inside them.

### Landmarks identified on screen (verified by caption)
| Landmark | Visual character |
|---|---|
| **Baguio Cathedral** | Twin spires, rose/cream, hilltop, forecourt plaza. Caption: built 1936 |
| **SM City Baguio** | Large mall, distinctive green/white banding, helical parking ramp, roundabout |
| **Burnham Park** | Lagoon + green rectangle inside dense CBD |
| **Session Road** | Commercial spine climbing a ridge |
| **Good Shepherd Convent** | Low buildings in mature pine, ridge-edge |
| **La Trinidad Strawberry Farm** | Caption: *"approximately 80 hectares of agriculture land"* — flat, greenhouse rows |
| **Benguet State University** | Campus with oval/track, valley floor |
| **Bell Church** (pagoda forms, La Trinidad approach) | Chinese temple roofline |
| **Ambiong, La Trinidad** | Hilltop terraced plantation, greenhouse clusters |
| **Itogon** | NE, caption: *"mining city"*, deep hazy valleys |

### Street-level reference — INSPECTED (VERIFIED)

Three locations captured via Playwright/Brave + CDP screenshot. *(The supplied URL resolves to **Burnham Park**.)*

**A. Burnham Park plaza** — user photosphere, Junior Salaysay, Aug 2019, dusk:
- Patterned paving: curved decorative concrete bands with brick and cobble insets — **not plain asphalt**
- Tiered carved stone monument with chain-and-post barrier
- Stone/concrete gate piers with pyramidal caps at the park boundary
- Mature pine + broadleaf, tall and dark; ~4–6 storey lit buildings across the road

**B. Harrison Rd, CBD (near Baguio City Market)** — Google SV car, ©2026:
- **Continuous corrugated-metal awnings** projecting over the sidewalk on steel posts — blue/galvanized. The covered walkway is the defining CBD street element
- Open-front *ukay-ukay* retail, goods hung at the frontage line
- Sidewalk **narrow (~1.5–2 m)** and partly occupied by stalls; concrete kerb ~150–200 mm
- Carriageway ~7–9 m, painted lane arrows, yellow edge line
- Traffic-signal mast, dense signage, yellow fire hydrant, green construction netting on a building under work
- Buildings 3–5 storeys, concrete, **flat roofs** here (unlike the metal-roof residential fabric)

**C. Lower Brookside, Aurora Hill (hillside residential)** — Google SV car, Jul 2024. **This is the most representative street type in the model area:**
- **Carriageway ~5–6 m**, two-way, dashed centerline — confirms the 5 m residential ASSUMPTION in §6
- **No continuous sidewalk**; low kerb one side, CHB (concrete hollow block) boundary wall the other
- **Retaining walls are everywhere** — stone and concrete, tiered; houses are cut into the slope rather than sitting on it
- **Dense overhead cabling** — multiple sagging spans, leaning poles with transformers roughly every 25–30 m. Visually dominant at street level and currently absent from the plan's asset list
- Houses 2–3 storeys, CHB + painted render (green, cream), **corrugated metal roofs, rust-red and green**, deep overhangs, laundry on balconies
- Palms and shrubs at street level; pine only on the distant ridge
- Distant hillside shows exactly the dense colored-roof texture seen from the drone — **the aerial and street-level references agree**

---

## 2. Additional references (verified reachable unless noted)

| Source | URL | Contributes | Status |
|---|---|---|---|
| **Geofabrik PH extract** | `download.geofabrik.de/asia/philippines.html` | OSM roads/buildings/landuse. `philippines-latest.osm.pbf` **578 MB**, updated daily; also `.shp.zip` 1.3 GB, `.gpkg.zip` 1.4 GB | ✅ verified |
| **Copernicus DEM GLO-30** | `dataspace.copernicus.eu` | **Recommended primary DEM.** 30 m, EPSG:4326 horizontal / **EGM2008 (EPSG:3855) vertical**, abs. vertical <4 m LE90, free licence | ✅ verified |
| **OpenTopography SRTM GL1** | `portal.opentopography.org` | Fallback DEM, 30 m, EPSG:4326 / EGM96 (EPSG:5773). GeoTIFF export by bbox | ✅ verified |
| **Overpass API** | `overpass-api.de/api/interpreter` | Targeted building/road pulls by bbox | ✅ **works from inside a real browser** (`curl` from the sandbox gets HTTP 406; Brave via Playwright succeeds). Rate-limits to 429/504 — space queries ~20–30 s apart |
| **BlenderGIS** | `github.com/domlysz/BlenderGIS` | DEM/SHP/GeoJSON/OSM import, Delaunay terrain, georef management | ⚠️ **298 open issues; #1048 crash on Blender 4.2, #1058 error on 5.2.** Local Blender is **4.5.2 LTS** — treat as unproven |
| **Blender Geometry Nodes manual** | `docs.blender.org` | Instance on Points, Distribute Points on Faces, Curve to Mesh, Scatter on Surface | ✅ verified |
| **MapLibre `CustomLayerInterface`** | `maplibre.org/maplibre-gl-js/docs` | `render({gl, modelViewProjectionMatrix})`, `onAdd`, `prerender`, `renderingMode: "3d"` shares depth buffer | ✅ verified |
| **MapLibre `MercatorCoordinate`** | same | `fromLngLat(lngLat, altitude)`, `meterInMercatorCoordinateUnits()` — the georeferencing math | ✅ verified |
| **meshoptimizer / gltfpack** | `github.com/zeux/meshoptimizer` | LOD chains, quantization, `EXT_meshopt_compression` ≈1–1.2 B/triangle indices, **2–4× vertex** | ✅ verified |
| **KHR_draco_mesh_compression** | Khronos glTF repo | Alternative geometry compression; **reorders/changes vertex count**, needs fallback data | ✅ verified (spec only, no benchmarks published there) |
| **Baguio geographic baseline** | Wikipedia | Elevation **910–1,667 m**, mean 1,465 m; area **57.51 km²**; pop 368,426 @ 6,406/km²; **129 barangays**; Köppen **Cwb** | ✅ verified |
| **Pinus kesiya** | Wikipedia | **30–35 m** tall, straight cylindrical trunk, 3 needles/fascicle 12–20 cm, thick fissured dark bark | ✅ verified |
| **Burnham Park spec** | Wikipedia | **32.84 ha**; designed by **Daniel Burnham, 1905**, established **1925**; Burnham Lake avg depth **3.04 m**, ~34,000 m³; **12 clusters**; **~2,600 trees / 72 species** | ✅ verified |
| **Mapillary API** | `mapillary.com/developer/api-documentation` | Street-level imagery alternative. Needs **OAuth access token**; `/images?bbox=` capped at **0.01° square**; thumbs at 256/512/1024/2048 px | ⚠️ usable but **token required from user** |
| **Google Photorealistic 3D Tiles** | `developers.google.com/maps/documentation/tile` | OGC 3D Tiles; renderable via three.js/CesiumJS | ⚠️ **Philippines coverage unconfirmed** (coverage doc 404s). Proprietary + paid API key, and licensing almost certainly forbids baking into Blender assets. **Treat as a runtime alternative, not a source for this model** |
| **Philippine Geoportal (NAMRIA)** | `geoportal.gov.ph` | ✅ **The authoritative national GIS portal — and it works.** Hosts **CLUP** (Comprehensive Land Use Plan = zoning), **DRRM** (hazard/landslide — directly relevant to Baguio's slopes), **GP in 3D**, Lot Plotter | ✅ verified live |
| **NAMRIA GP_Basemap tiles** | `basemapserver.geoportal.gov.ph/tiles/v2/GP_Basemap/{z}/{x}/{y}.png` | Official government XYZ basemap, **keyless**. Discovered by capturing the CLUP app's network traffic | ⚠️ **maxzoom = 14 (MEASURED:** z12/13/14 serve, z15/16/19 404 for Baguio). Usable as an authoritative reference overlay at the app's default z13.5, useless when zoomed in |
| **AWS Terrarium DEM (the app's own)** | `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | ✅ **Reachable and decoded.** Sampled at z15 across all 22 destinations. Decode: `(R·256 + G + B/256) − 32768` | ✅ verified — produced the §3(c) audit |
| **`baguio-dem-probe.py`** *(written this session)* | next to this plan, `~/.claude/plans/` | Pure-stdlib Terrarium sampler: minimal PNG decoder + slippy-tile math + point/grid elevation query. **No PIL/numpy needed** (none installed) | ✅ working — reuse it for the Phase 2 and §13 coordinate sweeps |

### OSM coverage for the model bounds — MEASURED (VERIFIED)

Live Overpass counts for `16.3,120.5,16.5,120.7`, run through Brave on 2026-09-22:

| Query | Count | Share |
|---|---|---|
| **Buildings total** (`way` 120,138 + `relation` 613) | **120,751** | 100% |
| Buildings with **`building:levels`** | **861** | **0.71 %** |
| Buildings with **`height`** | **107** | **0.09 %** |
| Buildings with **`name`** | **1,514** | 1.25 % |
| **Highway ways** | **16,799** | — |
| `natural=wood` areas | **198** | vegetation mask |
| `landuse=forest` areas | **35** | vegetation mask |

**These numbers drive the building strategy:**
1. **Footprint coverage is excellent** — 120 k footprints means geometry is a solved input, not something to invent.
2. **Height coverage is effectively nil — 99.3 % of footprints carry no height or storey data.** Any plan that extrudes OSM `height`/`building:levels` tags would produce ~120,000 flat slabs and ~968 correct buildings. **Height must come from a heuristic, not from OSM.**
3. **Vegetation masks are thin** — 233 wood/forest polygons for a city whose defining feature is pine cover. The scatter system cannot rely on OSM landuse alone; it must be driven primarily by **slope + elevation + building-exclusion**, with OSM polygons as a weak bonus weight.

### Dead / unreachable sources — MEASURED 2026-09-22

Do not waste time re-trying these; all failed from a real browser, not just the sandbox:

| Source | Failure |
|---|---|
| `philgis.org` | `ERR_CONNECTION_CLOSED` — site appears down |
| `namria.gov.ph` | navigation error (both HTTPS and HTTP) |
| `baguio.gov.ph` | **`ERR_CERT_COMMON_NAME_INVALID`** — broken TLS certificate |
| `data.gov.ph` | not reached |

**Use `geoportal.gov.ph` instead** — it is the same agency (NAMRIA) and is actually up.

**Still to source:** Baguio CLUP zoning polygons (the Geoportal CLUP app exists but did not expose a service endpoint within a 15 s network capture — needs deeper interaction), NAMRIA topographic sheets, historical photos for the American-era layer, Mapillary token if street-level bulk capture is wanted.

---

## 3. Baguio geographic & modeling requirements

### Hard numbers the model must honor
| Parameter | Value | Source |
|---|---|---|
| Model bounds | `120.5, 16.3 → 120.7, 16.5` | `lib/constants.ts:9-11` `BAGUIO_BOUNDS` |
| Padded camera bounds | `[[120.47, 16.27], [120.73, 16.53]]` | `MapView.tsx:57-65`, pad 0.03° |
| Real-world span | ≈ **21.3 km E–W × 22.2 km N–S** | 0.2° lng at 16.4°N ≈ 21.3 km; 0.2° lat ≈ 22.2 km |
| Elevation range (city) | **910 – 1,667 m** | Wikipedia |
| Destination elevations in DB | **1,400 – 1,540 m** | `data/geojson/landmarks.geojson` |
| Scene origin (recommended) | `[120.596, 16.4023]` = `BAGUIO_CENTER` | `lib/constants.ts:6` |
| Default camera | zoom 13.5, **pitch 60°**, bearing −20° | `DEFAULT_CAMERA` |
| Terrain exaggeration | **1.35** | `MapView.tsx:154`, `/api/geo/terrain` |

### ⚠️ Two datum problems that must be solved before any mesh is placed

**(a) Terrain exaggeration — ✅ RESOLVED BY MEASUREMENT (live app, 2026-09-22).**

Surveyed the running app at `localhost:3000/map` by reaching the MapLibre instance through the React fiber and calling `map.queryTerrainElevation()` at all 22 destinations. Runtime state confirmed: `terrain.exaggeration = **1.35**`, DEM `terrarium` / tileSize 256 / maxzoom 15, camera `[120.596, 16.4023] z13.5 pitch60 bearing−20`, maxBounds `[120.47, 16.27, 120.73, 16.53]`.

**`queryTerrainElevation()` returns elevation × exaggeration** — i.e. the *rendered* surface, not true elevation:

| Destination | Raw DEM (z15) | App reports | app ÷ 1.35 |
|---|---|---|---|
| `burnham-park` | 1442 | **1944.8** | 1441 |
| `good-shepherd-convent` | 1550 | **2096.0** | 1553 |
| `session-road` | 1449 | **1975.8** | 1464 |
| `camp-john-hay` | 1503 | **2000.5** | 1482 |
| `bencab-museum` | 979 | **1369.5** | 1014 |

Dividing by 1.35 reproduces the raw DEM to within a few metres. (Residual spread is DEM zoom — the survey ran at z11.65, the probe at z15.) The giveaway: the app reports up to **2,096 m** for a city whose true maximum is **1,667 m**.

**Therefore — the binding rule for mesh placement:**
> **Do not compute altitude from `elevation_m`, and do not hardcode 1.35.** At render time call `map.queryTerrainElevation([lng, lat])` and pass that directly as the altitude to `MercatorCoordinate.fromLngLat(lngLat, altitude)`, then offset by `landmarks.altitude_m × exaggeration`.

This is correct **and** self-maintaining: it survives any future change to the exaggeration constant, needs no duplicated magic number, and sidesteps the unreliable `elevation_m` column entirely. It resolves (a) and (b) together.

⚠️ One caveat: `queryTerrainElevation` only returns values for **currently loaded DEM tiles** and its precision varies with zoom. Query it on `style.load`/`idle`, and re-query if a mesh is placed before terrain tiles arrive — otherwise it returns `null` or a coarse value.

**(b) `altitude_m` has no defined datum.** `landmarks.altitude_m` is `DOUBLE PRECISION NOT NULL` with no documentation. Meanwhile Terrarium DEM is **sea-level metres**, and `destinations.elevation_m` separately holds 1400–1540. The spec must declare: **`altitude_m` = metres above the DEM surface at that lng/lat (i.e. a local offset, normally 0), not above sea level.** This keeps meshes glued to terrain regardless of DEM version.

**(c) ⚠️ `destinations.elevation_m` IS NOT RELIABLE — MEASURED.** Every one of the 22 destinations was sampled against the live Terrarium DEM at z15 (the app's own DEM source, decoded with `(R·256 + G + B/256) − 32768`):

| Metric | Result |
|---|---|
| Destinations audited | **22** |
| Mean absolute error vs DEM | **53 m** |
| Worst error | **441 m** (`bencab-museum`: DB 1420 m, DEM **979 m**) |
| Off by >50 m | **7 / 22** |
| Within ~35 m | 15 / 22 |

Worst offenders: `bencab-museum` −441, `lions-head-kennon-road` −112, `philippine-military-academy` −111, `la-trinidad-strawberry-farms` −68, `wright-park` −67, `diplomat-hotel-ruins` +58, `the-mansion` −54.

**Diagnosis:** the seed values cluster tightly in 1400–1540 m, but real terrain across the bounds spans **910–1,667 m**. Places genuinely outside that band were given in-band numbers. Verified for BenCab: a ±500 m DEM grid around its coordinate peaks at **1,336 m** and reads **979 m** at the point itself — the coordinate is correct (Asin Road, Tuba, genuinely ~1,000 m); **the elevation value is simply wrong.**

**Consequences — these are binding:**
1. **Never position a landmark mesh using `destinations.elevation_m`.** Sample the DEM. Using the DB value would float BenCab Museum 441 m in the air.
2. This **empirically justifies §3(b)**: altitude must be DEM-relative, not absolute.
3. ~~A coordinate-accuracy issue for `mines-view-park`~~ — **CORRECTED.** An earlier draft claimed the destination coordinate was ~340 m off. That was my error: I had compared against `CAMERA_PRESETS["mines-view"]` in `lib/constants.ts` (`120.6305, 16.4145`), **not** the destination record. The actual destination sits at `120.628, 16.4201` and reads **1523 m vs DB 1540 m (−17 m)** — fine. The *camera preset* does frame a point ~340 m from the destination and ~100 m lower, which is a minor framing observation, not a data error. **Destination coordinates show no proven positional error; only `elevation_m` is unreliable.**
4. **Opportunity:** this modeling work can correct `elevation_m` for all 22 rows as a byproduct — a real improvement to the existing app, at near-zero extra cost.

Also note: **Copernicus GLO-30 is EGM2008, SRTM is EGM96, Terrarium is its own** — mixing them introduces metre-scale vertical error. Pick one vertical datum for authoring and document it.

---

## 4. Blender architecture

**Blender 4.5.2 LTS** (verified installed, driven live via `mcp-for-blender` addon v1.7, protocol 9).

### 4.0 Execution model — Claude Code drives Blender directly

**This is not a hand-modeling project.** The `blender` MCP server is installed and connected, so the build session operates Blender programmatically. That changes how every phase below is executed and validated.

**Verified working now** (addon v1.7 capability list, confirmed live):

| Tool | Role in this project |
|---|---|
| `execute_blender_code` | **The workhorse.** Arbitrary `bpy` Python — DEM import, GeoNodes construction, collection setup, transforms, export. Every phase is a script, not a click-path |
| `get_scene_info` / `get_object_info` | Assert what actually exists after each step |
| `get_viewport_screenshot` | **Closes the visual loop** — the model can look at its own work and compare against the drone frames in §1 |
| `bpy_api_lookup` | Resolve correct API for 4.5 instead of guessing from training data — matters, since `bpy` breaks between versions |
| `describe_node_type` | Correct socket names when building GeoNodes/shader graphs programmatically |
| `export_scene` | glTF export for §10 *(present as an MCP tool; not in the addon's advertised capability list — verify before relying on it, fall back to `bpy.ops.export_scene.gltf` via `execute_blender_code`)* |

**Asset libraries — status after enabling (2026-09-22):**

| Provider | Status | Note |
|---|---|---|
| **Poly Haven** | ✅ **ENABLED & VERIFIED** | Set `scene.blendermcp_use_polyhaven = True`. Confirms *"enabled and ready to use"*. **No key, CC0.** |
| Hyper3D Rodin | ❌ off | Enable message claims checkbox-only, but once enabled it reports *"API key is not given"*. **It does need a key** — reverted to off rather than leave a dead switch on |
| Sketchfab | ❌ off | Requires API key |
| Poly Pizza | ❌ off | Requires free key from `poly.pizza/settings/api` |
| Hunyuan3D | ❌ off | Mode is `LOCAL_API` → expects a local server at `localhost:8081`; nothing running |

Addon property names (for scripted toggling): `blendermcp_use_polyhaven`, `blendermcp_use_hyper3d`, `blendermcp_use_sketchfab`, `blendermcp_use_polypizza`, `blendermcp_use_hunyuan3d`.

**Second keyless provider: ambientCG — ADDED & VERIFIED (not an MCP built-in).**

The MCP addon ships only one keyless provider. **ambientCG** is a second, wired in manually:

- **Public JSON API, no key, no account:** `https://ambientcg.com/api/v2/full_json?type=Material&id=<AssetID>&include=downloadData`
- **Downloads are plain unauthenticated URLs:** `https://ambientcg.com/get?file=<AssetID>_1K-JPG.zip`
- **Licence: CC0.**
- ⚠️ Query gotcha: `q=CorrugatedSteel` returns **0**; use `id=CorrugatedSteel005` or lowercase `q=corrugated`.

**Catalogue relevance (measured across 2,000 materials):** 15 `CorrugatedSteel`, 157 `Metal`, 61 `Concrete`, 46 `Asphalt`, 93 `Rock`, 31 `RoofingTiles`, 120 `Bricks`. That covers every §1 surface — metal roofs, CHB/concrete walls, asphalt carriageways, rock retaining walls.

**Already installed and asset-marked:**

| Material | Serves |
|---|---|
| `ACG_CorrugatedSteel005` | hillside metal roofs (§1C) |
| `ACG_CorrugatedSteel009` | roof colour variation |
| `ACG_Concrete034` | CHB walls, retaining walls (§1C) |
| `ACG_Asphalt031` | carriageways (§1B/C) |

Textures at `~/Documents/Blender/Assets/ambientCG/` (21 MB, 1K JPG). Materials built with **Base Color + Roughness + Normal** and written to `~/Documents/Blender/Assets/baguio_cc0_materials.blend` — inside the registered *User Library*, so they appear in the Asset Browser. Verified by applying one to a cube and screenshotting: corrugation ribbing renders correctly.

**Two keyless providers is the ceiling.** Sketchfab and Poly Pizza need keys; Hyper3D reports *"API key is not given"* once enabled; Hunyuan3D expects a local server at `localhost:8081`.

**Poly Haven covers the photoreal material target — VERIFIED.** A search for corrugated roofing returned **268 matching CC0 textures ≥2 m**, in a dedicated `Metal/Sheet & Corrugated/Corrugated Iron` category. These map directly onto the roof palette §1 observed from the air:

| Asset ID | Matches |
|---|---|
| `box_profile_metal_sheet` | **red** box-profile roofing, 16K, painted + weathered, `surface_use=roof` |
| `factory_wall` | **green** corrugated, painted, 8K |
| `corrugated_iron_02` | galvanized/silver, `surface_use=roof`, 16K, ribs + rivets |
| `rusty_painted_metal` | weathered **red** with flaking paint, 2.2 m, 16K |
| `rusty_corrugated_iron` | heavy orange-brown oxidation, 16K |

Red, green and galvanized — the exact three that dominate the drone frames. **The roof palette no longer has to be hand-authored.**

⚠️ Mind `min_size_m` when searching: a texture covers a fixed real-world area, so a 0.5 m sample tiled across a roof reads as an obvious repeat. Filter `min_size_m=2` for roofs, walls and ground.

> Hyper3D/Hunyuan (AI mesh generation) remain unavailable keyless. If a key is ever added, they're worth evaluating for **tier-2 landmarks** — generate then retopologise — but not for the tier-1 heroes where silhouette accuracy carries the scene.

**Consequences for how phases run:**
- Each phase is a **reproducible script**, not a manual session. Re-runnable, diffable, reviewable.
- Every phase gains a **built-in validation step**: `execute_blender_code` → `get_scene_info` (structural assert) → `get_viewport_screenshot` (visual assert).
- The §13 validation criteria stop being aspirational and become **executable checks**.
- Scripts must obey the MCP server's own standing guidance: look shader nodes up **by type, never by name** (names localise); never hardcode enum identifiers (they shift between versions); read `scene.render.engine` rather than assuming it.

### Collection structure (mirrors export targets)
```
BAGUIO_MASTER
├── 00_REFERENCE      # DEM planes, OSM imports, drone stills — never exported
├── 10_TERRAIN
│   ├── TERRAIN_LOD0/1/2
├── 20_ROADS          # curve-based, from OSM
├── 30_BUILDINGS
│   ├── BLD_PROCEDURAL    # GeoNodes-extruded OSM footprints
│   └── BLD_HERO          # hand-modeled, near the 22 destinations
├── 40_LANDMARKS      # one collection per landmark slug — THE EXPORT UNIT
│   ├── LM_baguio-cathedral
│   ├── LM_burnham-park
│   └── …
├── 50_VEGETATION     # GeoNodes scatter systems
├── 60_MATERIALS      # shared library
└── 90_EXPORT         # flattened, decimated, export-ready copies
```

**Rule:** `40_LANDMARKS/LM_<slug>` collection names **must exactly match `destinations.slug`** (`burnham-park`, `baguio-cathedral`, …, 22 values listed in `data/geojson/landmarks.geojson`). This makes export → DB row mapping mechanical rather than manual.

### Scene setup
- **Unit system:** Metric, **1 Blender unit = 1 metre**. Non-negotiable — `meterInMercatorCoordinateUnits()` assumes metres.
- **Scene origin = `BAGUIO_CENTER` `[120.596, 16.4023]`**, projected. Local ENU metres from there.
- **Clip end ≥ 30,000** (22 km scene diagonal).
- **+Y = geographic north, +Z = up.** glTF is **+Y up / −Z forward**, so the exporter's axis conversion (`+Y up`) must be ON and documented once.

### Which technique for which element

| Element | Technique | Why |
|---|---|---|
| Terrain | **Procedural** (DEM displacement) | Deterministic from data; hand-modeling 22 km of relief is absurd |
| Roads | **Procedural** (GeoNodes curve-to-mesh from OSM) | Geometry is data; profile is a single reusable spec |
| Bulk buildings | **Procedural** (GeoNodes extrude footprints) | Thousands of them; individuality doesn't pay |
| Roofs | **Procedural + modular** variants | The key visual signature — needs a controlled palette, not randomness |
| 22 landmarks | **Hand-modeled** | These are the app's actual content. Cathedral spires, SM's helical ramp, Burnham's lagoon cannot be procedural |
| Vegetation | **Procedural scatter** over **modular** pine assets | 3–4 hand-made pine variants, instanced thousands of times |
| Street furniture | **Modular** | Poles, railings, kerbs — small kit, reused |

---

## 5. Terrain strategy

1. **Acquire** Copernicus GLO-30 GeoTIFF for `[120.47, 16.27, 120.73, 16.53]` (padded bounds, so the horizon isn't cut at camera edge). ~30 m post spacing → roughly **790 × 820 samples** across the box.
2. **Reproject** to a local metric CRS (UTM 51N, EPSG:32651) for authoring; keep the 4326 bbox as the authoritative georeference.
3. **Generate mesh** — either BlenderGIS import, or (safer, given the 4.5 compatibility risk) a plain grid + **Displace modifier** driven by the DEM as a 16-bit image texture. The manual path has no addon dependency and is fully scriptable via `bpy`.
4. **Resolution tiers:**
   - `TERRAIN_LOD0` — full 30 m grid, ~650 k faces, authoring + hero renders
   - `TERRAIN_LOD1` — decimated ~50%, web primary
   - `TERRAIN_LOD2` — ~85% decimated, distant shell
5. **Do NOT ship terrain to the web app as geometry in v1.** The app already renders DEM terrain natively from Terrarium tiles. Blender terrain is the **authoring substrate** — it exists so landmarks sit correctly and so renders look right. Shipping a second terrain would fight MapLibre's own. *(Revisit only if the app later drops Terrarium.)*

**⚠️ Verification — do NOT validate terrain against `elevation_m`.** That criterion was in an earlier draft of this plan and is **invalid**: §3(c) proves the DB column is unreliable (mean 53 m error, worst 441 m), so a correct DEM would "fail" it.

Validate instead against values that are independently known:
- **Range check:** terrain across the bounds must span ≈**910 – 1,667 m** (Wikipedia, verified). Measured DEM samples already agree — Kennon Road low point **937 m**, Good Shepherd ridge **1,550 m**.
- **Spot-check the well-attested ones only** — `burnham-park` (DEM 1442 vs DB 1445, **−3 m**), `camp-john-hay` (+3), `botanical-garden` (−4), `igorot-stone-kingdom` (−4). These 15 agree closely and are safe anchors.
- **Registration check:** the ridge NW of Mines View must appear at `120.628, 16.417` reading ≈1,530 m. If the DEM is shifted, this peak moves.

---

## 6. Road / building / landmark strategy

### Roads
- Source: **16,799 OSM highway ways** (measured) within bounds, from the Geofabrik PH extract.
- Import as **curves**, not meshes. Width by `highway` class via a GeoNodes switch: motorway/trunk 12 m, primary 9 m, **secondary/CBD 7–9 m (VERIFIED: Harrison Rd)**, **residential 5–6 m (VERIFIED: Lower Brookside)**, service/track 3 m.
- **Sidewalks are not continuous.** Do not model a uniform footway. CBD gets a narrow (~1.5–2 m) walk under awnings; hillside residential gets a kerb only. (VERIFIED, §1C.)
- **Curve to Mesh** with a flat profile, then **shrinkwrap onto terrain** with a small +Z offset to avoid z-fighting.
- Baguio's roads are **contour-following and steeply graded** — the shrinkwrap must follow terrain, never be flattened.
- The app already renders 6 jeepney routes as 2D lines (`TransitLayer.ts`); Blender roads are **visual context**, not a replacement for that data.

### Buildings
Source: **120,751 OSM footprints** (measured). Geometry is a solved input. **Height is not** — only 0.71 % have `building:levels`, 0.09 % have `height`.

**Height heuristic (the core of this phase).** Apply in priority order:
1. `height` tag → use directly *(107 buildings)*
2. `building:levels × 3.2 m` → *(861 buildings)*
3. **Otherwise infer**, using signals that actually exist:
   - **footprint area** — small irregular footprints are the 2–3 storey hillside houses verified in §1C
   - **distance to CBD centroid** — taller toward Session/Harrison
   - **`building=` value** (`commercial`/`retail`/`hotel` vs `house`/`residential`)
   - **OSM `name` present** *(1,514 buildings)* — a named building is more likely civic/commercial and taller
4. Defaults from the verified references: **residential 2–3 storeys ≈ 7–10 m** (§1C), **CBD 3–5 storeys ≈ 10–16 m** (§1B).

⚠️ The inferred 99.3 % must be treated as **plausible massing, not survey data.** Document it as such — the model must never imply per-building accuracy it doesn't have.

**Roof treatment** (highest-value visual work, per §1):
- **Hillside residential → pitched corrugated metal**, rust-red / green / blue / teal, deep overhangs (VERIFIED aerial + §1C)
- **CBD → predominantly flat** concrete roofs with rooftop clutter (VERIFIED §1B) — *not* the metal-roof palette
- Weighted, seeded colour assignment — not uniform random.

**Terrain interaction is not optional.** Baguio buildings are **cut into slopes behind retaining walls** (VERIFIED §1C). Each footprint must sample terrain at its corners, sit at the **minimum** corner elevation, and extend its base downslope to meet ground — otherwise every building on a hillside floats at one corner.

**Street furniture that the references prove matters:** utility poles with transformers **every 25–30 m** plus sagging overhead cable spans (VERIFIED §1C), and **CBD awning structures** (VERIFIED §1B). Both are visually dominant at street level and cheap as instanced modular assets. Give them their own `55_STREETFURNITURE` collection rather than omitting them.

### Landmarks (the actual deliverable)
- **22 hand-modeled**, one per `destinations.slug`.
- Priority tier 1 (highest app visibility — these have camera presets pointed at them, `constants.ts:29-60`): `burnham-park`, `session-road`, `mines-view-park`, `camp-john-hay`, plus `baguio-cathedral` (strongest silhouette in the aerial footage).
- **`burnham-park` has a real published spec** (VERIFIED): **32.84 ha**, Daniel Burnham's 1905 City Beautiful plan, established 1925. Burnham Lake sits at the centre, avg depth **3.04 m** (~34,000 m³). **12 clusters** — Rose Garden (+ Burnham bust), Athletic Bowl, Children's Playground, Orchidarium, Melvin Jones Grandstand, Igorot Park, Japanese Peace Tower, Skating Rink, etc. **~2,600 trees across 72 species.** This is enough to model it to plan rather than by eye — do this one properly; it is the app's most-referenced destination.
- Modeling budget: **5k–25k triangles each** before decimation.
- Each must be **modeled at true world scale in metres**, origin at the **footprint centroid**, base at **Z=0** (ground plane), +Y facing north. Then `rotation_deg` in the DB expresses the building's true heading, and `mesh_scale` stays 1.0.

---

## 7. Vegetation strategy

- **Hero species: *Pinus kesiya*** (Benguet pine) — verified 30–35 m tall, straight cylindrical trunk, 3 needles/fascicle 12–20 cm, thick dark fissured bark.
- Build **3–4 pine variants** (young/mature/wind-shaped/dead) + 2–3 broadleaf variants for low elevations.
- Each at **3 LODs**: full mesh → reduced → **camera-facing billboard** (the vast majority of instances).
- **Scatter via GeoNodes `Distribute Points on Faces`** over terrain, weighted by:
  - **slope** (steeper = denser — matches the verified pattern that pine survives where building doesn't)
  - **elevation** (pine above ~1,200 m; broadleaf below)
  - **OSM landuse mask** (`forest`, `park`) and an **exclusion mask** around building footprints and roads
- Honor the verified observation that pine is **interleaved with buildings**, not segregated — the exclusion mask should thin, not clear.
- Density target: derive from drone frames, **not invented**. Phase 6 must sample actual canopy coverage percentage from the footage.

---

## 8. Procedural / Geometry Nodes strategy

| Node group | Input | Output | Notes |
|---|---|---|---|
| `GN_TerrainFromDEM` | grid + DEM image | displaced terrain | Or Displace modifier — simpler, addon-free |
| `GN_RoadFromCurve` | OSM curve + `highway` attr | ribbon mesh, shrinkwrapped | Width via attribute switch |
| `GN_BuildingExtrude` | footprint mesh + `height` attr | massing + roof | Handles the bulk |
| `GN_RoofVariant` | building top face | roof geometry + material idx | Seeded, not random |
| `GN_ScatterVegetation` | terrain + masks | instanced trees | Slope/elevation/landuse weighted |
| `GN_LODSwitch` | any mesh + camera dist | LOD selection | Authoring preview only — **web LOD is handled by the exporter, not GeoNodes** |

**Everything must be seeded and deterministic.** A re-run must produce byte-identical output or the exported assets stop matching the DB rows that reference them.

---

## 9. LOD & optimization strategy

Photoreal + web is the central tension of this project. Budgets:

| Asset class | Source budget | Web budget (post-gltfpack) | Method |
|---|---|---|---|
| Landmark (hero, tier 1) | 25 k tris | **≤ 60 KB** | Manual retopo + meshopt |
| Landmark (tier 2) | 10 k tris | ≤ 30 KB | Decimate + meshopt |
| Building cluster tile | 200 k tris | ≤ 150 KB | Aggressive decimate, merged by district |
| Tree billboard | 2 tris | shared atlas | Single instanced draw |
| Terrain (if ever shipped) | 650 k | ≤ 500 KB/tile | Not in v1 |

**Pipeline:** Blender → glTF (`+Y up`) → **`gltfpack`** with `EXT_meshopt_compression`.
- meshopt gives **2–4× on vertex data**, ~1–1.2 bytes/triangle on indices (verified).
- **Prefer meshopt over Draco**: Draco *"may change the order and number of vertices"* and requires generating fallback uncompressed data (verified from the Khronos spec) — meshopt is simpler and decodes faster.
- **Textures → KTX2/Basis.** Photoreal roofs mean texture bytes will dominate geometry bytes; this is where the budget actually goes.
- **Total initial 3D payload target: ≤ 2 MB**, loaded lazily — the app must stay usable on a phone in a mountain city with imperfect connectivity.

**Load strategy:** the existing seam is already lazy — `addLandmarkModel` fires only when a user opens a destination sheet (`DestinationSheet.tsx:38-46`). **Keep that.** Do not bulk-load 22 meshes on map init.

---

## 10. Blender → web application pipeline

### What the app needs from the model
Exactly four things, all already modeled in the schema:
1. `mesh_url` — a fetchable glTF/GLB URL
2. `mesh_scale` — should be **1.0** if authored at true metric scale
3. `rotation_deg` — heading, **axis and sign must be declared** (recommend: degrees clockwise from north, applied about +Z/up)
4. `altitude_m` — per §3(b), **metres above DEM surface**, normally 0

### Export contract
```
public/models/landmarks/<slug>.glb        # one per destination slug
public/models/landmarks/<slug>-lod1.glb   # optional
```
`mesh_url` = `/models/landmarks/<slug>.glb`. Note `public/` currently holds only 5 SVGs and `next.config.ts` is empty — a models directory and appropriate cache headers are **app-side work, out of scope here**.

### Rendering path (three.js, per locked decision)
1. `npm i three` — **new dependency, currently absent** (verified: no `three`/`threebox`/deck.gl in `package.json`).
2. Implement the empty body of `addLandmarkModel` (`LandmarkLayer.ts:32-33`) as a MapLibre **`CustomLayerInterface`** with `renderingMode: "3d"` so it shares the map depth buffer and occludes correctly against terrain.
3. Georeference per the verified MapLibre API:
   - `MercatorCoordinate.fromLngLat([lng, lat], altitude)` → model position
   - `.meterInMercatorCoordinateUnits()` → metres-to-mercator scale factor
   - compose with `rotation_deg` about up-axis
   - `render({gl, modelViewProjectionMatrix})` → multiply into the three.js camera matrix
4. **Call `map.triggerRepaint()`** after load. ⚠️ Note the session's existing bug fix: repainting while a stylesheet is in flight throws in MapLibre's `useProgram` (`MapView.tsx` `styleInFlightRef`, commit `6d7d2e1`). The new layer must respect the same guard.

### Division of responsibility
| Stays in Blender | Belongs to the web app |
|---|---|
| Mesh authoring, UVs, bakes | Fetching, caching, disposal |
| LOD generation, decimation | LOD *selection* at runtime |
| Material → PBR texture bake | Lighting/atmosphere matching |
| True-scale metric geometry | Mercator transform, camera |
| Slug-keyed collection naming | DB rows, `mesh_url` wiring |

**Blender never learns about the web app.** It emits files and a manifest; the app consumes them.

### Export manifest
Export must also emit `landmarks-manifest.json` — `slug`, `mesh_url`, `mesh_scale`, `rotation_deg`, `altitude_m`, triangle count, byte size — so seeding the `landmarks` table is a scripted step, not hand-typed. This is what makes `prisma/seed.ts:72`'s `if (p.meshUrl)` gate finally fire.

---

## 11. Data & coordinate strategy

| Layer | CRS / units |
|---|---|
| Source DEM | EPSG:4326 + **EGM2008** (Copernicus) |
| Blender authoring | **EPSG:32651 (UTM 51N)**, metres, local origin at `BAGUIO_CENTER` |
| Export metadata | **EPSG:4326** lng/lat, matching the DB |
| Database | `geometry(Point, 4326)` — verified across all tables |
| API output | 4326, **quantized to 5 dp** (`lib/geo/serialize.ts:12`, ≈1.1 m) |
| Runtime render | Web Mercator via `MercatorCoordinate` |

**Round-trip invariant:** `lng/lat (4326) → UTM 51N metres → Blender local → export → 4326` must return the original within **≤ 1 m** — tighter than the API's own 5 dp (1.1 m) quantization, so the pipeline never becomes the dominant error source.

**Origin-shift discipline:** Blender loses float precision far from origin. All authoring is local-metres around `BAGUIO_CENTER`; the shift is applied **once**, recorded in the manifest, and never hardcoded in two places.

---

## 12. Development phases

> **Every Blender phase below runs through the MCP** (§4.0): author with `execute_blender_code`, assert structure with `get_scene_info`, assert appearance with `get_viewport_screenshot`. The "Tools" column names the *technique*; the *mechanism* is always the MCP.

| # | Phase | Objectives | Inputs | Outputs | Tools | Validation |
|---|---|---|---|---|---|---|
| **0** | ~~Unblock + street-level research~~ | ✅ **COMPLETE** — Playwright on Brave; 3 street locations captured; OSM counts measured | — | §1 street findings, §2 coverage table | — | ✅ done 2026-09-22. Remaining: PhilGIS/NAMRIA sourcing only |
| **1** | **Geographic data** | Acquire DEM + OSM extract | Bounds, Copernicus, Geofabrik | `baguio-dem.tif`, `baguio-osm.pbf`, clipped GeoJSON | GDAL, osmium | DEM covers padded bounds; elevations match 910–1,667 m |
| **2** | **Terrain** | DEM → mesh, 3 LODs | Phase 1 DEM | `TERRAIN_LOD0/1/2` | Blender Displace (BlenderGIS optional) | Range spans ≈910–1,667 m; the 15 trusted anchors in §3(c) agree within ~35 m; Mines View ridge lands at `120.628, 16.417` ≈1,530 m. **Not** validated against `elevation_m` |
| **3** | **Roads** | OSM curves → shrinkwrapped ribbons | OSM, terrain | `20_ROADS` | GeoNodes curve-to-mesh | Roads follow contours; no floating/buried segments |
| **4** | **Buildings** | Procedural massing from 120,751 footprints + inferred heights + roof palette + poles/awnings | OSM footprints, terrain | `BLD_PROCEDURAL`, `55_STREETFURNITURE` | `GN_BuildingExtrude`, `GN_RoofVariant`, `GN_HeightHeuristic` | Roof colour distribution matches drone frames; **no building floats on a slope**; CBD reads flat-roofed, hillside reads metal-roofed |
| **5** | **Landmarks** | 22 hand-modeled, slug-named | Drone frames, street view, refs | `40_LANDMARKS/LM_<slug>` | Manual modeling | All 22 slugs present; true scale; origin at centroid, base Z=0 |
| **6** | **Vegetation** | Pine/broadleaf scatter | Terrain, landuse masks | `50_VEGETATION` | `GN_ScatterVegetation` | Canopy % sampled from footage, not invented |
| **7** | **Optimization** | Decimate, bake, atlas | All geometry | LOD chains, baked textures | Decimate, bake, KTX2 | Per-asset budgets in §9 met |
| **8** | **Web-export prep** | glTF + manifest | Optimized assets | `<slug>.glb`, `landmarks-manifest.json` | glTF exporter, `gltfpack` | Total ≤2 MB; every GLB loads in a standalone viewer |
| **9** | **Integration requirements** | Spec the app-side work (do not implement) | Manifest, seam analysis | Integration doc: `three` dep, `addLandmarkModel` body, seed changes | — | Every field maps to an existing column |
| **10** | **Validation** | Full round-trip proof | Everything | Validation report | §13 | All §13 gates pass |

---

## 13. Validation strategy

**Geographic**
- Round-trip coordinate test ≤ 1 m error (§11).
- Landmark positions match `landmarks.geojson` coordinates within 5 dp.
- ~~Elevation spot-checks against DB `elevation_m`~~ → **replaced**: spot-check against the **DEM** using only the 15 trusted anchors from §3(c). The DB column is not ground truth.
- **Coordinate sanity sweep:** for each of the 22, sample a ±500 m DEM grid. If the stated `elevation_m` appears nowhere in that window, flag the row — either the coordinate or the elevation is wrong, and §3(c) shows both failure modes occur.

**Visual — now automatable via the Blender MCP (§4.0)**
- Set Blender cameras to match the five app `CAMERA_PRESETS` (`constants.ts:29-60`) via `execute_blender_code`, then `get_viewport_screenshot` and compare side-by-side against the drone frames from §1. This is a **closed loop the build session can run itself**, not a manual review step.
- Roof colour histogram vs drone frames.
- After every structural change: `get_scene_info` to assert objects exist, `get_viewport_screenshot` to assert it looks right. Per the MCP server's own guidance, never assume a step worked — check both.

**Technical**
- Every GLB opens in a standalone glTF viewer.
- Triangle/byte budgets per §9.
- Scale check: place a 1.8 m human reference next to each landmark.

**Integration (spec-level only — no app changes)**
- Confirm every manifest field maps to an existing `landmarks` column.
- Confirm `mesh_url` paths would resolve under `public/`.
- Confirm terrain exaggeration decision (§3a) is applied consistently in one place.

---

## 14. Risks & open questions

| Risk | Severity | Note |
|---|---|---|
| **Photoreal vs web budget** | **High** | The locked decision is photoreal; the app must stay usable on mobile. Textures, not geometry, will blow the budget. Mitigate with KTX2 + aggressive lazy loading. Revisit if 2 MB proves impossible. |
| ~~Terrain exaggeration 1.35~~ | — | ✅ **RESOLVED** (§3a). Measured on the live app: `queryTerrainElevation()` returns exaggerated values. Query terrain at render time instead of computing altitude — no magic number, no float/sink. |
| ~~`altitude_m` datum undefined~~ | **Low** | Largely resolved with (a): `altitude_m` becomes a small offset above the queried surface, applied × exaggeration. Still worth documenting in the column comment. |
| **`destinations.elevation_m` is unreliable** | **High** | ✅ **MEASURED** (§3c): mean 53 m error vs DEM, worst **441 m**, 7/22 off by >50 m. Placing meshes by this column would float BenCab Museum 441 m. Use the DEM. |
| ~~Destination coordinates carry positional error~~ | — | ❌ **WITHDRAWN — my error.** The 340 m figure compared a *camera preset* to the DEM, not the destination record. Destination coordinates are sound; only `elevation_m` is unreliable. |
| **~~OSM building coverage unknown~~ → RESOLVED, replaced by:** **no height data** | **High** | ✅ 120,751 footprints exist. ❌ **99.3 % have no height/levels.** Bulk buildings are viable geometrically but **all height is inferred** — must be labelled plausible massing, never survey data. |
| **120 k buildings is a large procedural load** | **High** | New, from the measurement. Blender must handle 120 k footprints via GeoNodes instancing, and the web can never receive them individually — aggregation into district tiles is mandatory. |
| **Vegetation masks are thin** | **Medium** | Only 233 OSM wood/forest polygons for the defining pine city. Scatter must lean on slope/elevation, not landuse tags. |
| **~~Street view never inspected~~** | — | ✅ **RESOLVED.** Three locations verified; road widths, roof types, retaining walls, awnings, and pole spacing are now measured rather than assumed. |
| **BlenderGIS on Blender 4.5** | **Medium** | Documented crashes on 4.2/5.2. Fallback: scripted `bpy` + Displace via `execute_blender_code` — **no addon dependency at all**, which the MCP execution model (§4.0) makes the natural default anyway. |
| ~~Asset libraries disabled~~ | — | ✅ **RESOLVED for materials.** Poly Haven enabled and verified (§4.0) — 268 CC0 corrugated-roof textures covering the red/green/galvanized palette. Mesh-generation providers remain key-gated, which only affects optional tier-2 landmark generation. |
| **`bpy` API drift on 4.5** | **Medium** | Training data predates parts of 4.5. Mitigate with `bpy_api_lookup` / `describe_node_type` before writing graph code, and never hardcode enum identifiers. |
| **three.js is a new dependency** | **Medium** | Adds bundle weight to an app currently free of 3D libs. Locked by user decision. |
| **Repaint-during-style-swap crash** | **Medium** | Known MapLibre bug already hit in this project (`6d7d2e1`). New custom layer must respect `styleInFlightRef`. |
| **22 hand-modeled landmarks is real labor** | **Medium** | Largest time sink. Tier the work; ship tier 1 first. |
| **Supabase project is PAUSED** | **Medium** | ⚠️ Measured 2026-09-22: project `<project-ref>` reports `status: INACTIVE` (free tier auto-pauses when idle), so `/api/geo/*` returns **500** and the pooler rejects `<app-role>` with *"tenant/user not found"*. Terrain/basemap still render — they're third-party. **Restore the project before any phase that seeds `landmarks` rows.** |
| **Drone footage is one flight, one season, one time of day** | **Low** | Fine for massing/colour; insufficient for lighting studies. |

**Open questions for the user**
1. Terrain exaggeration: scale meshes by 1.35, or drop exaggeration for the 3D layer?
2. Should bulk buildings ship to the web at all, or are the 22 landmarks the only web-delivered geometry in v1?
3. Is a 2 MB initial 3D payload acceptable, or should it be tighter?
4. La Trinidad is inside the bounds but outside Baguio city limits and holds no destinations — model it as context geometry only?

---

## 15. Recommended next steps

1. ✅ ~~Unblock the browser~~ — **done.** Playwright now runs on Brave 153:
   ```
   npx @playwright/mcp@latest --browser chromium --executable-path "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
   ```
   Two gotchas for the next session: `browser_take_screenshot` **times out on animated WebGL pages** (the Street View canvas never goes "stable") — use `browser_run_code_unsafe` + CDP `Page.captureScreenshot` + a blob download instead. And the built-in Claude browser pane **cannot render WebGL at all** (hidden document, rAF paused) — use Playwright for anything canvas-based.
2. ✅ ~~Street-level inspection~~ / ~~OSM coverage~~ — **done**, see §1 and §2.
3. ✅ ~~Resolve the datum questions~~ — **all three answered by measurement** (§3a/b/c). Placement rule: query terrain at render time; never use `elevation_m`; never hardcode 1.35.
4. **Correct the 22 `elevation_m` values** using `baguio-dem-probe.py` (§3c found errors up to **441 m**). Cheap, and it hands the existing app a corrected dataset — the clearest standalone win available here.
5. ✅ ~~Enable Poly Haven~~ — **done and verified** (§4.0). Roof/wall/ground materials now come from CC0 assets rather than hand-authoring. Named asset IDs are in §4.0.
6. **Restore the paused Supabase project** (`<project-ref>`, currently `INACTIVE`) before any phase that seeds `landmarks` rows.
7. **Prove the loop on one asset before scaling:** script `baguio-cathedral` end-to-end through the MCP — `execute_blender_code` to build → `get_scene_info` to assert → `get_viewport_screenshot` to compare against the §1 drone frame → export → manifest. If that loop holds for one landmark, it holds for 22.
4. **Decide the height-inference model** (§6) now that OSM tags are known to be useless for 99.3 % of buildings. This is the single largest determinant of whether the city reads correctly.
5. **Acquire DEM + OSM extract** (Phase 1) — both are large downloads, start early.
6. **Model `baguio-cathedral` first** as a vertical slice: hand-model → export → manifest → verify it would place correctly. Proves the entire pipeline end-to-end on one asset before committing to 22.

---

## Appendix — verified app constants

```
BAGUIO_CENTER      [120.596, 16.4023]         lib/constants.ts:6
BAGUIO_BOUNDS      [120.5, 16.3, 120.7, 16.5] lib/constants.ts:9-11
DEFAULT_CAMERA     z13.5 pitch60 bearing-20   lib/constants.ts:21-26
DEM                Terrarium, tileSize 256, maxzoom 15, exaggeration 1.35
SRID               4326 everywhere; output quantized to 5 dp
Basemap            OpenFreeMap Liberty / Esri World Imagery (satellite)
Seeded data        22 destinations · 0 landmarks · 6 routes · 31 stops
                   30 venues · 7 districts · 4 eras · 17 events · 0 media
CAMERA_PRESETS     burnham-park · session-road · mines-view
                   camp-john-hay · kennon-road
```

---

## Addendum, 24 September 2026

Changes since this spec was written. The execution order now lives in Phase 9 of `docs/superpowers/plans/2026-09-24-baguio-3d-site-overhaul.md`.

1. **§5 range check is wrong for the model bounds.** 910 to 1,667 m is the range inside Baguio's city limits. A z13 Terrarium survey of exactly `[120.5, 16.3, 120.7, 16.5]` reads **153 to 2,230 m**, because the bounds take in lowland valleys and ground above 2,000 m. Validate terrain against the 15 trusted anchors in §3(c) instead, and apply the 910 to 1,667 m check only to samples inside the city limits.
2. **Terrain is removed during every basemap swap.** Since commit `3f58ad5`, `MapView` calls `map.setTerrain(null)` before `setStyle({ diff: false })`, which stopped a render-loop crash that blanked the satellite view. In that window `queryTerrainElevation()` returns `null`, and `setStyle` removes custom layers. The landmark layer from §10 must be installed from a `MapLayers` hook (remounted on each `styleGeneration`), query terrain on its first render after `style.load`, and never cache an altitude across a swap. This extends §10 step 4.
3. **The basemap is re-dyed and hill-shaded** (`components/map/basemapTheme.ts`). §13's visual review must cover both the weave basemap and satellite.
4. **§15 step 4 (correct `elevation_m`) moved into the site overhaul** as its Task 4, ahead of any landmark work.
5. **three.js has two users:** the homepage wireframe, which moves to the Problem section and loads only as that section nears (overhaul Task 24), and the landmark layer from §10. Both load it lazily; the landmark layer only when the first destination sheet opens (§9).
