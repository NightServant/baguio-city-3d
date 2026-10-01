# Blender 4.5.2 API facts for M2 to M8 (verified 1 Oct 2026)

Every fact below was run, not recalled. Nothing here is "from memory" unless it is marked **UNVERIFIED**.

**Environment.** Blender 4.5.2 LTS (hash `ab25eae04993`), Python 3.11.11, numpy 1.26.4, glTF add-on 4.5.47. Headless command used throughout:

```
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python script.py
```

The shared live instance (MCP for Blender add-on 1.8, protocol 13; the spec says 1.7/9, now stale) was touched read-only. Its operator signatures for `export_scene.gltf`, `import_scene.gltf` and `object.modifier_apply` hash identically to headless (`9d5d7c9abb6dd109` 108 props, `2024d774136392f9` 19 props, `d2c9af7f6a92f6d4` 6 props), so headless results transfer to the live instance. Test scripts live in `/private/tmp/claude-504/-Users-gabe-Next-JS-baguio-city-3d/ea634383-4216-4c56-8a34-c384451aa1b4/scratchpad/bl/w/` (scratch, not committed).

## Gotchas a plan author must know (each verified below)

1. `export_scene.gltf(collection="NOPE")` with an unknown name returns `{'FINISHED'}` and writes an **empty GLB**. Always assert `nodes` is non-empty after export (§1).
2. Default export includes objects hidden with `hide_viewport`, `hide_set()` and `hide_render`. Pass `use_visible=True, use_renderable=True` (§1).
3. `export_image_quality` controls JPEG **and** WebP. `export_jpeg_quality` does nothing (§1).
4. `export_apply=False` skips Geometry Nodes modifiers. Unrealized GN instances are dropped unless `export_gn_mesh=True`, and then they become one glTF node per instance (1683 nodes for 1682 instances). Always Realize Instances first (§1, §5).
5. `MeshPolygon.loop_total` is read-only. `foreach_set("loop_total", ...)` **silently does nothing**. Set `loop_start` instead (§3).
6. `GeometryNodeSampleNearestSurface` returns the nearest point, not the point straight below. From 3000 m above terrain it was off by up to 1486 m. For "drape onto terrain" use `GeometryNodeRaycast` (§5).
7. `GeometryNodeExtrudeMesh` ignores its `Offset` default when unlinked; it extrudes along the face normal by `Offset Scale`. Face mode drops the bottom face: a quad becomes 5 faces (top plus 4 sides) (§5).
8. Blender's Python has **no** rasterio, pyproj, scipy, PIL, tifffile or osgeo. Data arrives as `.npy` produced by a `uv run` script (§3).
9. Texture budget: the two 1K ambientCG materials from the asset library, 6 images, export to **3.3 MB** as JPEG q80 and 300 KB as WebP q80. At 256 px they are 45.8 KB and 22.5 KB. Landmark budget is 150 KiB (§10).
10. `Camera.angle_x` does not report the effective horizontal FOV when `sensor_fit='VERTICAL'`. Trust the projection, not the property (§9).

---

## 1. glTF export: `bpy.ops.export_scene.gltf`

### 1a. Call and output

```python
import bpy
rna = bpy.ops.export_scene.gltf.get_rna_type()
for p in rna.properties: print(p.identifier, p.type, ...)   # 108 properties (excluding rna_type)
```

Operator id `EXPORT_SCENE_OT_gltf`, name "Export glTF 2.0". `export_format` is a **dynamic** enum: `enum_items` is empty at introspection time. The accepted values come from the error text:

```python
bpy.ops.export_scene.gltf(filepath="/dev/null", export_format="BAD")
# TypeError: Converting py args to operator properties: enum "BAD" not found in ('GLB', 'GLTF_SEPARATE')
```

`GLTF_EMBEDDED` is hidden unless the add-on preference `allow_embedded_format` is `True` (verified: with `bpy.context.preferences.addons['io_scene_gltf2'].preferences.allow_embedded_format = True` the accepted list becomes `('GLB', 'GLTF_SEPARATE', 'GLTF_EMBEDDED')`).

Relevant identifiers, defaults and enum items (all verbatim from the run):

| Identifier | Type, default | Enum items / range | Meaning |
|---|---|---|---|
| `filepath` | STRING `''` | | output path |
| `check_existing` | BOOL `True` | | set `False` for scripts |
| `will_save_settings` | BOOL `False` | | keep `False` |
| `export_format` | ENUM | `GLB`, `GLTF_SEPARATE` | binary or JSON plus files |
| `export_yup` | BOOL `True` | | "Export using glTF convention, +Y up" |
| `export_apply` | BOOL `False` | | "Apply modifiers (excluding Armatures)"; also required for Geometry Nodes |
| `use_selection` | BOOL `False` | | selected objects only |
| `use_visible` | BOOL `False` | | visible objects only |
| `use_renderable` | BOOL `False` | | renderable objects only |
| `use_active_collection` / `use_active_collection_with_nested` | BOOL `False` / `True` | | active collection filter |
| `use_active_scene` | BOOL `False` | | |
| `collection` | STRING `''` | | "Export only objects from this collection (and its children)", by **name** |
| `at_collection_center` | BOOL `False` | | re-centres on the mean of root-object origins (not the footprint centroid) |
| `export_extras` | BOOL `False` | | custom properties become `extras` (node, mesh, material) |
| `export_cameras` | BOOL `False` | | |
| `export_lights` | BOOL `False` | | uses `KHR_lights_punctual` |
| `export_animations` | BOOL `True` | | set `False` |
| `export_skins`, `export_morph` | BOOL `True` | | set `False` for static scenery |
| `export_materials` | ENUM `EXPORT` | `EXPORT`, `PLACEHOLDER`, `VIEWPORT`, `NONE` | |
| `export_image_format` | ENUM `AUTO` | `AUTO`, `JPEG`, `WEBP`, `NONE` | `AUTO` wrote PNG for a generated texture |
| `export_image_quality` | INT 75 | 0 to 100 | drives JPEG and WebP |
| `export_jpeg_quality` | INT 75 | 0 to 100 | **no effect** (measured, §1c) |
| `export_image_add_webp` | BOOL `False` | | add a WebP next to the JPEG/PNG (`EXT_texture_webp` used, not required) |
| `export_image_webp_fallback` | BOOL `False` | | |
| `export_keep_originals` | BOOL `False` | | |
| `export_texcoords`, `export_normals` | BOOL `True` | | |
| `export_tangents` | BOOL `False` | | |
| `export_vertex_color` | ENUM `MATERIAL` | `MATERIAL`, `ACTIVE`, `NAME`, `NONE` | |
| `export_attributes` | BOOL `False` | | attributes starting with `_` |
| `export_gn_mesh` | BOOL `False` | | "Export Geometry nodes instance meshes" |
| `export_draco_mesh_compression_enable` | BOOL `False` | level 0 to 10, quantization 0 to 30 | `KHR_draco_mesh_compression`; library present (`libextern_draco.dylib`) |
| `export_use_gltfpack` | BOOL `False` | | **needs** the add-on preference `gltfpack_path_ui`; with it empty the call raises `PermissionError: [Errno 13] Permission denied: ''` |
| `export_gltfpack_tc` | BOOL `True` | | KTX2/BasisU, only through gltfpack |
| `export_gltfpack_tq` | INT 8 | 1 to 10 | texture quality |
| `export_gltfpack_si` | FLOAT 1.0 | 0 to 1 | simplify ratio |
| `export_gltfpack_sa`, `export_gltfpack_slb`, `export_gltfpack_kn`, `export_gltfpack_noq` | BOOL | | aggressive, lock borders, keep named nodes, no quantization |
| `export_gltfpack_vp/vt/vn/vc` | INT 14/12/8/8 | 1 to 16 | quantization bits |
| `export_gltfpack_vpi` | ENUM `Integer` | `Integer`, `Normalized`, `Floating-point` | |
| `export_shared_accessors`, `export_gpu_instances` | BOOL `False` | | `EXT_mesh_gpu_instancing` for children of an Empty |
| `use_mesh_edges`, `use_mesh_vertices` | BOOL `False` | | loose edges and points |
| `export_unused_images`, `export_unused_textures` | BOOL `False` | | |
| `export_hierarchy_full_collections` | BOOL `False` | | collection nodes |
| `export_hierarchy_flatten_objs` | BOOL `False` | | |
| `export_original_specular` | BOOL `False` | | |
| `export_import_convert_lighting_mode` | ENUM `SPEC` | `SPEC`, `COMPAT`, `RAW` | lights only |
| `export_copyright` | STRING `''` | | |
| `export_texture_dir` | STRING `''` | | `GLTF_SEPARATE` only |

Compression: **meshopt is not an option in the add-on** (no string "meshopt" anywhere in its source). The only mesh compression Blender writes is Draco. Meshopt and KTX2 are produced by gltfpack **after** export, which is what contract C8 already says. `gltfpack` is not on `PATH` (UNVERIFIED that `npx gltfpack` runs; an npx cache directory containing a `gltfpack` package exists, not exercised).

### 1b. Axis and transform behaviour (verified on a marker triangle)

Test: triangle at Blender (east 1, north 2, up 3). Exported POSITION min `[1, 3, -2.1]`, max `[1.1, 3, -2]`. So with `export_yup=True`: **glTF = (east, up, -north)**. East stays +X, up becomes +Y, north becomes -Z. Matches contract C2.

Object transforms are written on the node: objects at world (2000, 3000, 1500) exported with `translation [2000, 1500, -3000]`. Objects at the origin have no `translation`. Rotation: Blender `Rz(+30 deg)` became quaternion `[0, 0.25882, 0, 0.96593]`, i.e. +30 deg about glTF +Y (counter-clockwise seen from above). `at_collection_center=True` shifted by the mean of the root objects' origins (`2020` in the test, giving translations `-20, -10, 0, 10, 20`), so it is **not** a footprint-centroid tool. Author each landmark around its own origin and leave object transforms at identity.

Filters measured on 5 objects (`shown`, `shown2`, `hidden_viewport`, `hidden_render`, `hidden_eye`):

| flags | nodes exported |
|---|---|
| default | all 5 |
| `use_visible=True` | `shown`, `shown2`, `hidden_render` |
| `use_renderable=True` | `shown`, `shown2`, `hidden_viewport`, `hidden_eye` |
| both | `shown`, `shown2` (the final helper below relies on this) |
| `use_selection=True`, nothing selected | none |

`collection=` with a collection that is not linked into the scene still exports its objects (tested with `ORPHAN`). With a missing collection it writes a 132-byte GLB with no nodes and returns `FINISHED`.

With `export_cameras/lights/animations` all `False`, a collection that contained the factory Camera, Light and a keyframed object exported 0 cameras, 0 lights, 0 animations. With all three `True`: 1 camera, 1 light (`KHR_lights_punctual` in `extensionsRequired`), 1 animation.

### 1c. Images, extensions, quality (512x512 noisy texture, one plane)

| call | total bytes | note |
|---|---|---|
| `JPEG`, `export_image_quality` 30 / 60 / 90 | 12,968 / 21,300 / 66,068 | quality works |
| `JPEG`, `export_image_quality=75`, `export_jpeg_quality` 30 or 90 | 30,868 both | `export_jpeg_quality` ignored |
| `WEBP`, quality 30 / 60 / 90 | 8,040 / 13,476 / 70,504 | `extensionsUsed` and `extensionsRequired` = `["EXT_texture_webp"]` |
| `AUTO` | 433,620 | PNG |
| `NONE` | no `images` | materials keep their numbers |
| `JPEG` + `export_image_add_webp=True` | 49,512 | WebP preferred, JPEG fallback; `EXT_texture_webp` used but **not** required |

`export_extras=True` produced `extras` on the node, mesh and material (`{'note': 'obj'}`, `{'mnote': 'mesh'}`, `{'mat_note': 'mat'}`). The exporter does not resize images: shrink them in Blender first (`image.scale(w, h)`). Draco (`KHR_draco_mesh_compression`) added to `extensionsRequired`. Normals and tangents both on (with UVs) gave `NORMAL, POSITION, TANGENT, TEXCOORD_0`; normals off with tangents on gave only `POSITION, TEXCOORD_0` (no TANGENT), so tangents need normals.

Determinism (contract C7): the same call run twice in one process and in two separate processes gives byte-identical files (`371caaa64be5ee73...` JPEG, `c3eac3dbc967d9dc...` WebP, `faae0a9d4e75...` for the PNG `AUTO` case). The `asset.generator` string is `Khronos glTF Blender I/O v4.5.47`, so an add-on upgrade changes every hash.

### 1d. Verified recommended call (use this)

Saved at `.../scratchpad/bl/w/export_landmark.py`. Run on a collection containing a textured mesh, a solidified plane, a camera, a light, a nested collection and a `hide_viewport` helper. Result: 2 nodes, 13 triangles, 3772 bytes (JPEG) or 3188 bytes (WebP), helper and camera and light excluded, identical sha256 across reruns and across two processes.

```python
import bpy, json, struct, hashlib, os

def export_landmark_glb(collection_name, out_path, image_format="JPEG", image_quality=80):
    """Export one landmark collection to a single GLB; returns {bytes, triangles, nodes, sha256}. Verified on Blender 4.5.2."""
    scene_colls = {c.name for c in bpy.context.scene.collection.children_recursive}
    assert collection_name in scene_colls, f"collection {collection_name!r} is not linked into the scene"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=out_path, check_existing=False, will_save_settings=False,
        export_format="GLB",
        collection=collection_name,
        use_visible=True, use_renderable=True, use_selection=False,
        export_yup=True,
        export_apply=True,                 # bakes modifiers, including Geometry Nodes
        export_gn_mesh=False,              # Realize Instances before export
        export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False,
        export_materials="EXPORT",
        export_image_format=image_format,  # JPEG | WEBP | AUTO | NONE
        export_image_quality=image_quality,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_vertex_color="NONE", export_attributes=False,
        export_extras=False,
        export_draco_mesh_compression_enable=False,   # meshopt and KTX2 happen later, in gltfpack
        export_use_gltfpack=False,
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
    assert not j.get("cameras") and not j.get("animations") and "KHR_lights_punctual" not in j.get("extensions", {})
    return {"bytes": len(data), "triangles": tris, "nodes": len(j["nodes"]),
            "images": [i.get("mimeType") for i in j.get("images", [])],
            "extensionsRequired": j.get("extensionsRequired"), "sha256": hashlib.sha256(data).hexdigest()}
```

Choosing the image format is M3's call: `WEBP` makes `EXT_texture_webp` a **required** extension (three.js `GLTFLoader` has `EXT_texture_webp` support; browser decode, UNVERIFIED in this repo's three 0.186.0). `JPEG` has no extension risk. Not run: a GLB through three.js `GLTFLoader` or the Khronos validator (UNVERIFIED).

MCP `export_scene` tool schema (no collection filter; use `object_names` or call the operator through `execute_blender_code`): `filepath`, `format` (`glb` default or `fbx`), `object_names` (list), `selection_only`, `apply_modifiers` (default true), `user_prompt`. Not run: executing `bpy.ops.export_scene.gltf` in the shared instance (it writes a file; UNVERIFIED there, identical operator signature though).

---

## 2. Blender Python and numpy

Call (headless): `import bpy, sys, numpy; print(bpy.app.version_string, bpy.app.build_hash, sys.version, numpy.__version__)`

```
BLENDER 4.5.2 LTS b'ab25eae04993'
PY 3.11.11 (main, Apr 25 2025, 12:39:20) [Clang 17.0.0 (clang-1700.0.13.3)]
NUMPY 1.26.4
```

Live instance (`execute_blender_code`): `blender 4.5.2 LTS | python 3.11.11` and `numpy 1.26.4`. Same.

Not importable inside Blender's Python (all raised `ModuleNotFoundError`): `rasterio`, `pyproj`, `scipy`, `PIL`, `tifffile`, `osgeo`. Plan consequence: a `uv run` script reads the GeoTIFF and projects, then writes `.npy`; Blender reads it with `np.load`. Blender "never projects" (contract C1) holds.

---

## 3. 937x937 grid mesh from a numpy height array

### 3a. What is writable in 4.5 (introspected)

```
MeshPolygon: vertices ro=False | loop_start ro=False | loop_total ro=True | material_index ro=False | use_smooth ro=False | normal/center/area ro=True
MeshLoop:    vertex_index ro=False | edge_index ro=False | normal/tangent/bitangent ro=True
MeshVertex:  co ro=False | normal ro=True
MeshEdge:    vertices ro=False | use_seam ro=False | use_edge_sharp ro=False
Mesh.polygons / loops / vertices / edges: collections, ro=True, with .add(count)
Mesh.polygon_offset_indices: not a property
```

`me.polygons.foreach_set("loop_total", ...)` returns `None` and **changes nothing** (loop_total stayed 4 when asked for 3). `me.polygons[0].loop_total = 3` raises `AttributeError: bpy_struct: attribute "loop_total" from "MeshPolygon" is read-only`. The hidden attributes (`.corner_vert`, `.corner_edge`, `.edge_verts`, `.select_*`) exist and `.corner_vert` data is writable, but the `foreach_set` route above is enough.

### 3b. Verified function (also at `.../w/grid_mesh.py`)

Faces from a plain `foreach_set` mesh are smooth-shaded (`polygons[0].use_smooth` is `True`; there is no `sharp_face` attribute). All face normals point up. `validate()` returned `False` (no problems).

```python
import bpy, numpy as np

def grid_mesh_from_xyz(name, X, Y, Z, collection=None):
    """X, Y, Z: float arrays shaped (rows, cols), ROW 0 = SOUTH edge, col 0 = WEST edge
    (flip a north-first raster with arr[::-1]). Quads wind CCW seen from +Z (normals up)."""
    rows, cols = Z.shape
    co = np.empty((rows, cols, 3), np.float32)
    co[..., 0], co[..., 1], co[..., 2] = X, Y, Z
    idx = np.arange(rows * cols, dtype=np.int32).reshape(rows, cols)
    quad = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1)
    nq = (rows - 1) * (cols - 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(rows * cols); me.loops.add(nq * 4); me.polygons.add(nq)
    me.vertices.foreach_set("co", co.ravel())
    me.loops.foreach_set("vertex_index", quad)
    me.polygons.foreach_set("loop_start", np.arange(0, nq * 4, 4, dtype=np.int32))   # loop_total is derived
    me.update(calc_edges=True)
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    return ob
```

Use per-vertex arrays, not a constant cell size: a 1 arc-second post is about 29.6 m east-west and 30.7 m north-south at 16.4 N, and the local TM shears the lattice slightly. M2's data script should project every post's (lng, lat) with `LOCAL_TM` and save `E, N, Z` as float32 `.npy`. A raster is north-first: pass `Z[::-1]`, `E[::-1]`, `N[::-1]`.

### 3c. Timings (headless, synthetic 937x937 float32, this Mac)

| method | time |
|---|---|
| `grid_mesh_from_xyz` (foreach_set + `update(calc_edges=True)`) | **0.19 s** (877,969 verts, 876,096 quads, 3,504,384 loops, 1,754,064 edges) |
| `bpy.ops.mesh.primitive_grid_add(x_subdivisions=936, y_subdivisions=936)` + `foreach_set co` | 0.26 s (same counts) |
| `Mesh.from_pydata(numpy verts, [], numpy quads)` | 0.69 s (numpy arrays accepted) |
| `uv_layers.new("UVMap")` + `foreach_set("uv", ...)` | 0.08 s |

Corner checks passed (SW post equals `H[-1, 0]`, NE post equals `H[0, -1]` of the north-first array). A saved `.blend` holding LOD0, LOD1 and LOD2: 54.6 MB with `compress=True`, 108.5 MB without.

---

## 4. Decimate modifier and applying it

### 4a. Properties (`DecimateModifier`, introspected)

```
decimate_type ENUM [COLLAPSE, UNSUBDIV, DISSOLVE] default COLLAPSE
ratio FLOAT [0, 1] default 1.0           iterations INT default 0 (UNSUBDIV)
angle_limit FLOAT default 0.0872664600610733 (DISSOLVE)    delimit ENUM_FLAG [NORMAL, MATERIAL, SEAM, SHARP, UV] default ['NORMAL']
use_collapse_triangulate BOOL default False    use_symmetry BOOL False    symmetry_axis ENUM [X, Y, Z] default X
vertex_group STRING    invert_vertex_group BOOL    vertex_group_factor FLOAT default 1.0    use_dissolve_boundaries BOOL False
face_count INT (read-only result)
```

`bpy.ops.object.modifier_apply` parameters: `modifier` (STRING), `report` (BOOL false), `merge_customdata` (BOOL true), `single_user` (BOOL false), `all_keyframes` (BOOL false), `use_selected_objects` (BOOL false).

### 4b. Two verified ways to apply

```python
# A) operator, needs a context override when run headless
md = ob.modifiers.new("Decimate", 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = 0.5; md.use_collapse_triangulate = True
with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
    bpy.ops.object.modifier_apply(modifier="Decimate")          # {'FINISHED'}; ob.modifiers is empty afterwards

# B) no operator: evaluate and copy; the source mesh is untouched
dg = bpy.context.evaluated_depsgraph_get()
new_me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
```

Method B is the better default for LOD0/1/2 (keeps LOD0, no context games).

### 4c. Measured on the 937x937 grid (1,752,192 triangles)

| ratio | method | polys | **triangles** | verts | time |
|---|---|---|---|---|---|
| 0.5 | A (`modifier_apply`) | 876,096 | **876,096** (exactly 0.5000) | 439,138 | 4.9 to 5.8 s |
| 0.5 | B (`new_from_object`) | 876,096 | 876,096 | 439,138 | 4.8 to 5.5 s |
| 0.15 | A | 262,828 | **262,828** (exactly 0.1500) | 131,921 | 7.5 to 8.7 s |
| 0.15 | B | 262,828 | 262,828 | 131,921 | 7.4 to 7.9 s |

The ratio applies to **triangles** of the triangulated mesh. With `use_collapse_triangulate=True` polys equals triangles; with the default `False` the same vertices come out but pairs of triangles are merged back into quads (a run gave 675,063 faces for the same 876,096 triangles). Spec §5's "~650k faces" for LOD0 is wrong for the real 937x937 clip: LOD0 is 876,096 quads (1.75 M triangles), so LOD1 is about 876 k triangles and LOD2 about 263 k.

Determinism (C7): vertex-coordinate sha256 prefixes `c6afbc15307d` (0.5) and `5befbc1a9f4a` (0.15) were identical across two separate processes, and across A, B and a default-flag rerun.

---

## 5. Geometry Nodes (4.5.2)

Sockets read live with `describe_node_type` and cross-checked headless (`node.inputs[i].identifier / .type / .enabled`). In 4.5 socket **identifiers equal names** for these nodes. `D` marks sockets disabled in the default mode.

| bl_idname | Inputs (identifier, type) | Outputs | Properties |
|---|---|---|---|
| `GeometryNodeDistributePointsOnFaces` | `Mesh` GEOMETRY, `Selection` BOOLEAN, `Distance Min` VALUE (D), `Density Max` VALUE (D), `Density` VALUE, `Density Factor` VALUE (D), `Seed` INT | `Points` GEOMETRY, `Normal` VECTOR, `Rotation` ROTATION | `distribute_method` `RANDOM`/`POISSON`; `use_legacy_normal`. Defaults: Density 10, Density Max 10, Density Factor 1. `POISSON` enables Distance Min, Density Max, Density Factor and disables Density |
| `GeometryNodeInstanceOnPoints` | `Points`, `Selection`, `Instance` GEOMETRY, `Pick Instance` BOOLEAN, `Instance Index` INT, `Rotation` ROTATION, `Scale` VECTOR (default 1,1,1) | `Instances` GEOMETRY | none |
| `GeometryNodeCurveToMesh` | `Curve` GEOMETRY, `Profile Curve` GEOMETRY, `Scale` VALUE (1.0), `Fill Caps` BOOLEAN | `Mesh` GEOMETRY | none |
| `GeometryNodeExtrudeMesh` | `Mesh`, `Selection`, `Offset` VECTOR, `Offset Scale` VALUE (1.0), `Individual` BOOLEAN (default True; D in EDGES/VERTICES) | `Mesh`, `Top` BOOLEAN, `Side` BOOLEAN | `mode` `VERTICES`/`EDGES`/`FACES` (default `FACES`) |
| `GeometryNodeRaycast` | `Target Geometry` GEOMETRY, `Attribute` (type follows `data_type`), `Source Position` VECTOR, `Ray Direction` VECTOR (default 0,0,-1), `Ray Length` VALUE (100.0) | `Is Hit` BOOLEAN, `Hit Position` VECTOR, `Hit Normal` VECTOR, `Hit Distance` VALUE, `Attribute` | `mapping` `INTERPOLATED`/`NEAREST`; `data_type` `FLOAT`, `INT`, `FLOAT_VECTOR`, `FLOAT_COLOR`, `BYTE_COLOR`, `STRING`, `BOOLEAN`, `FLOAT2`, `INT8`, `INT16_2D`, `INT32_2D`, `QUATERNION`, `FLOAT4X4` |
| `GeometryNodeSampleNearestSurface` | `Mesh` GEOMETRY, `Value` (type follows `data_type`), `Group ID` INT, `Sample Position` VECTOR, `Sample Group ID` INT | `Value`, `Is Valid` BOOLEAN | `data_type` (same 13 items) |
| `GeometryNodeRealizeInstances` | `Geometry`, `Selection`, `Realize All` BOOLEAN (True), `Depth` INT (0) | `Geometry` | none |
| `GeometryNodeSetPosition` | `Geometry`, `Selection`, `Position` VECTOR, `Offset` VECTOR | `Geometry` | none |

Also verified to exist with these identifiers: `GeometryNodeInputPosition` (out `Position`), `GeometryNodeObjectInfo` (in `Object` OBJECT, `As Instance`; out `Transform` MATRIX, `Location`, `Rotation`, `Scale`, `Geometry`; property `transform_space` `ORIGINAL`/`RELATIVE`), `GeometryNodeCollectionInfo`, `GeometryNodeMeshToCurve` (in `Mesh`, `Selection`; out `Curve`), `GeometryNodeCurvePrimitiveLine` (in `Start`, `End`; out `Curve`), `GeometryNodeCurvePrimitiveCircle`, `GeometryNodeJoinGeometry`, `GeometryNodeStoreNamedAttribute` (in `Geometry`, `Selection`, `Name`, `Value`), `GeometryNodeInputNamedAttribute`, `GeometryNodeSetMaterial` (in `Geometry`, `Selection`, `Material`), `GeometryNodeMergeByDistance`, `GeometryNodeTransform`, `GeometryNodeInputNormal`, `GeometryNodeSampleIndex`, `GeometryNodeMeshBoolean`, `GeometryNodeSplitEdges`, `GeometryNodeSetShadeSmooth`, `GeometryNodeSetMaterialIndex`, `GeometryNodeMeshIcoSphere` (in `Radius`, `Subdivisions`; out `Mesh`).

### 5a. Verified building blocks (headless, run end to end)

```python
def new_group(name):
    ng = bpy.data.node_groups.new(name, 'GeometryNodeTree')
    ng.interface.new_socket("Geometry", in_out='INPUT',  socket_type='NodeSocketGeometry')
    ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
    return ng, ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
def L(ng, a, ao, b, bi): ng.links.new(a.outputs[ao], b.inputs[bi])          # indices or names both work
md = ob.modifiers.new("GN", 'NODES'); md.node_group = ng                      # evaluated like any modifier
dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
```

- **Scatter draped on terrain** (plane at z=3000 above a 100x100 terrain, `Seed=7`, `Density=0.0002`): Distribute Points on Faces, then Set Position with `Hit Position` from Raycast (`Target Geometry` from `Object Info` with `transform_space='ORIGINAL'`, `Source Position` from Input Position, `Ray Direction (0,0,-1)`, `Ray Length 10000`), then Instance on Points (Ico Sphere, radius 5, subdivisions 1), then Realize Instances. Result: 1682 instances, 20,184 verts, 0.003 s. Instance centres vs `Object.ray_cast` on the same terrain: max error **0.0007 m**. Identical vertex hash across two processes (`2ccf9ceec647`). The `SampleNearestSurface` variant (same inputs) was off by up to 1486 m, so don't use it for draping.
- **Road ribbon**: Mesh to Curve (4-point polyline mesh), Curve Primitive Line profile `(-3,0,0)` to `(3,0,0)`, Curve to Mesh: 8 verts, 3 quads, y-extent `-3 to 53` (6 m wide), as expected.
- **Building massing**: footprint quad, Extrude Mesh `mode='FACES'`, `Offset Scale=12`, `Individual=False`, `Offset` left unlinked: 8 verts, **5** faces, z 0 to 12 (top plus 4 sides; the bottom is gone, which saves triangles).
- **Exposed modifier inputs**: `ng.interface.new_socket("Height", in_out='INPUT', socket_type='NodeSocketFloat')` gave identifier `Socket_2` (the geometry input is `Socket_0`, output `Socket_1`). Set with `md["Socket_2"] = 25.0`. Look the identifier up with `[i.identifier for i in ng.interface.items_tree if i.name == "Height"]`.
- **Export interplay** (collection `LM_gn`, unrealized GN instances, 1682 of them): `export_apply=True, export_gn_mesh=False` gave 1 node and no mesh; `export_apply=True, export_gn_mesh=True` gave 1683 nodes (one mesh of 60 verts reused); `export_apply=False, export_gn_mesh=True` also added the base plane. With **realized** geometry: `export_apply=True` gave one primitive of 100,920 verts (33,640 triangles); `export_apply=False` gave only the 4-vert base plane. So GN output needs `export_apply=True` and `Realize Instances`.

---

## 6. Terrain height sampling

### 6a. Signatures (live `bpy_api_lookup "Object.ray_cast"`, live `__doc__` for `mathutils.bvhtree`)

```
Object.ray_cast(origin, direction, distance=1.7014117e+38, depsgraph=None) -> (result: bool, location: Vector3, normal: Vector3, index: int)
   "Cast a ray onto evaluated geometry, in object space"; index = -1 on miss; on a miss location/normal are (0,0,0)
BVHTree.FromObject(object, depsgraph, deform=True, render=False, cage=False, epsilon=0.0)
BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0.0)       # also FromBMesh(bmesh, epsilon=0.0)
BVHTree.ray_cast(origin, direction, distance=sys.float_info.max) -> (Vector location, Vector normal, int index, float distance), all None on a miss
BVHTree.find_nearest(origin, distance=1.84467e+19) -> (location, normal, index, distance)
```

Everything is in **object space**: with a non-identity object matrix, invert it first.

### 6b. Verified sample (937x937 terrain object moved to location (500, -200, 0))

```python
from mathutils import Vector, bvhtree
dg = bpy.context.evaluated_depsgraph_get()
def terrain_z(ob, wx, wy, top=5000.0, reach=10000.0):
    inv = ob.matrix_world.inverted()
    o = inv @ Vector((wx, wy, top)); d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    ok, loc, nrm, idx = ob.ray_cast(o, d, distance=reach, depsgraph=dg)
    return (ob.matrix_world @ loc).z if ok else None
bvh = bvhtree.BVHTree.FromObject(ob, dg)                       # object space
# world-space tree from numpy, no object needed:
bvh_w = bvhtree.BVHTree.FromPolygons(co.reshape(-1, 3), tris, all_triangles=True)   # co float32 (n,3), tris int32 (m,3): numpy arrays are accepted
loc, nrm, idx, dist = bvh_w.ray_cast(Vector((x, y, 5000.0)), Vector((0, 0, -1)), 10000.0)   # loc.z is the height
```

Measured: `Object.ray_cast` first call 128 ms (builds the BVH), then 1000 queries in 2.4 ms. `BVHTree.FromObject` on 876 k quads 0.11 s; `FromPolygons` from numpy (1.75 M tris) 0.98 s, 2000 vertical rays in 3.7 ms. `ob.ray_cast` and the world-space tree agreed within 0.0007 m. A numpy bilinear lookup of the same posts differed by up to 2.7 m (synthetic noise of sigma 2 m per post) because a quad is two triangles, not a bilinear patch: use the BVH when the exported surface must match, bilinear only for rough checks. `find_nearest` from (15000, 15000, 2000) returned a point 840 m away (nearest, not below).

Modifiers count: `Object.ray_cast` uses the **evaluated** mesh, so a leftover Decimate modifier changes the answer.

---

## 7. glTF import: `bpy.ops.import_scene.gltf`

Operator id `IMPORT_SCENE_OT_gltf`, 19 properties (exact identifiers, defaults):

```
filepath ''   directory ''   files (collection)   filter_glob '*.glb;*.gltf'   loglevel 0
export_import_convert_lighting_mode ENUM [SPEC, COMPAT, RAW] default 'SPEC'
import_pack_images BOOL True        merge_vertices BOOL False
import_shading ENUM [NORMALS, FLAT, SMOOTH] default 'NORMALS'
bone_heuristic ENUM [BLENDER, TEMPERANCE, FORTUNE] default 'BLENDER'   disable_bone_shape BOOL False   bone_shape_scale_factor FLOAT 1.0
guess_original_bind_pose BOOL True
import_webp_texture BOOL False   (loads the WebP texture instead of the PNG/JPEG fallback)
import_unused_materials BOOL False   import_select_created_objects BOOL True
import_scene_extras BOOL True   import_scene_as_collection BOOL True   import_merge_material_slots BOOL True
```

Round trip verified: the marker triangle exported to glTF `(1, 3, -2)` came back at Blender `(1.0, 2.0, 3.0)`. `import_scene.gltf(filepath=...)` works with no arguments. The importer does **not** support meshopt or KTX2: it raises `RuntimeError: Error: Extension EXT_meshopt_compression is not available on this addon version` (a hand-patched GLB with `extensionsRequired: ["EXT_meshopt_compression"]`; the supported-extension list in `io/imp/gltf2_io_gltf.py` has Draco, WebP, `KHR_mesh_quantization` and others, no meshopt, no `KHR_texture_basisu`). So a gltfpack-compressed GLB can't be re-imported into Blender; keep the pre-gltfpack GLB for round trips. Draco GLBs import fine.

---

## 8. Render engines and EEVEE volumetrics

Headless factory startup: `scene.render.engine` is `BLENDER_EEVEE_NEXT`. Live instance: `BLENDER_EEVEE_NEXT` (read only, not assigned).

```python
sc.render.engine = "NOT_AN_ENGINE"
# TypeError: bpy_struct: item.attr = val: enum "NOT_AN_ENGINE" not found in ('BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH', 'CYCLES')
```

Accepted: `BLENDER_EEVEE_NEXT`, `BLENDER_WORKBENCH`, `CYCLES`. `BLENDER_EEVEE` raises `TypeError` (renamed). `render.bl_rna.properties['engine'].enum_items` under-reports (`['BLENDER_EEVEE_NEXT']` only), as the MCP guidance warns.

`scene.eevee` (`SceneEEVEE`), volumetric and related properties, with 4.5.2 defaults:

```
volumetric_start 0.1 [1e-6, inf]    volumetric_end 100.0    use_volume_custom_range True
volumetric_tile_size ENUM ['1','2','4','8','16'] default '8'
volumetric_samples INT 64 [1,256]   volumetric_sample_distribution 0.8 [0,1]   volumetric_ray_depth INT 16 [1,16]
volumetric_light_clamp 0.0          use_volumetric_shadows False   volumetric_shadow_samples INT 16 [1,128]
clamp_volume_direct 0.0   clamp_volume_indirect 1e-08
use_shadows True   shadow_ray_count 1   shadow_step_count 6   shadow_resolution_scale 1.0   light_threshold 0.01
use_raytracing False   ray_tracing_method ENUM [PROBE, SCREEN]   ray_tracing_options (pointer)
use_fast_gi True   fast_gi_method ENUM [AMBIENT_OCCLUSION_ONLY, GLOBAL_ILLUMINATION]   fast_gi_distance 0.0   fast_gi_quality 0.25
use_gtao False   gtao_distance 0.2   gtao_quality 0.25
taa_samples 16   taa_render_samples 64   use_taa_reprojection True   use_overscan False   overscan_size 3.0
shadow_pool_size ENUM ['16'..'1024'] default '512'
```

There is no scene-level "fog" toggle in EEVEE Next. Haze comes from the world: a `ShaderNodeVolumePrincipled` (inputs `Color`, `Color Attribute`, `Density`, `Density Attribute`, `Anisotropy`, `Absorption Color`, `Emission Strength`, `Emission Color`, `Blackbody Intensity`, `Blackbody Tint`, `Temperature`, `Temperature Attribute`, `Weight`) or `ShaderNodeVolumeScatter` (inputs `Color`, `Density`, `Anisotropy`, `IOR`, `Backscatter`, `Alpha`, `Diameter`, `Weight`) linked into the `Volume` input of the `OUTPUT_WORLD` node (its inputs are `Surface` and `Volume`, both SHADER). Also `world.use_eevee_finite_volume`. Mist (depth cue pass): `world.mist_settings` has `use_mist, intensity, start, depth, height, falloff`, plus `view_layer.use_pass_mist`. Sky: `ShaderNodeTexSky.sky_type` items `PREETHAM, HOSEK_WILKIE, NISHITA`, with `sun_disc, sun_size, sun_intensity, sun_elevation, sun_rotation, altitude, air_density, dust_density, ozone_density`. Sun light: `SunLight` has `angle, energy, color, use_shadow`. Default view transform is `AgX`. Defaults for output: 1920x1080 at 100 percent.

---

## 9. Cameras, and reproducing MapLibre's camera

### 9a. Blender camera properties (introspected)

`Camera`: `type` [`PERSP`, `ORTHO`, `PANO`, `CUSTOM`], `lens` (default 50, mm), `lens_unit` [`MILLIMETERS`, `FOV`], `angle` / `angle_x` / `angle_y` (radians, all writable), `sensor_fit` [`AUTO`, `HORIZONTAL`, `VERTICAL`], `sensor_width` 36, `sensor_height` 24, `clip_start` 0.1, `clip_end` 1000 (hard max 3.4e38), `shift_x`, `shift_y`, `dof`. The 3D viewport has its own `SpaceView3D.clip_start` (0.01) and `clip_end` (1000). `RegionView3D.view_perspective` items: `PERSP`, `ORTHO`, `CAMERA` (setting it to `CAMERA` in the live viewport so `get_viewport_screenshot` shows the camera is UNVERIFIED, not run because it changes the shared UI).

### 9b. MapLibre derivation (maplibre-gl **5.24.0**, `node_modules/maplibre-gl/dist/maplibre-gl-dev.js`)

| fact | source line |
|---|---|
| default vertical FOV `this._fovInRadians = 0.6435011087932844` = 36.8699 deg = `2*atan(1/3)` | 55151 |
| `cameraToCenterDistance = 0.5 / Math.tan(halfFov) * this._height` (px), which is **1.5 x viewport height** | 55511 to 55512 |
| `worldSize = tileSize * 2**zoom`, `tileSize = 512` | 55135, 55263 |
| `pixelPerMeter = mercatorZfromAltitude(1, center.lat) * worldSize` = `worldSize / (2*pi*R*cos(lat))` | 56394 |
| `earthRadius = 6371008.8` | 36206 |
| camera distance in metres = `cameraToCenterDistance / pixelPerMeter` | 55605 to 55608 |
| camera offset from centre = `-cameraDirectionFromPitchBearing(pitch, bearing) * distance`, where the direction is `(sin(p)*sin(b), -sin(p)*cos(b), cos(p))` in (east, mercator-y south, up) | 50453 to 50470 |
| camera altitude = `cos(pitch) * cameraToCenterDistance / pixelPerMeter + elevation` | 55599 to 55602 |
| centre `elevation` = `terrain.getElevationForLngLatZoom(center, tileZoom)`, which multiplies the DEM by `terrain.exaggeration` | 70631, 72676 |
| near plane `_nearZ = height / 50` (px); the far plane `_farZ` is derived from pitch and the horizon | 56382 to 56386 |

The app adds nothing: `components/map/MapView.tsx` constructs the map with `maxPitch: 80` and no `fov`; `MapControls.tsx` `flyTo`s without `padding`, so `centerOffset` is zero. Terrain exaggeration is `TERRAIN_EXAGGERATION = 1.35` (`lib/map/sources.ts:43`) unless the `/api/geo/terrain` config says otherwise.

Result, for viewport height `H` CSS px, zoom `z`, pitch `p`, bearing `b` (clockwise from north), centre latitude `phi`:

```
mpp = 2*pi*6371008.8*cos(phi) / (512 * 2**z)           # ground metres per CSS px at the centre
d   = 1.5 * H * mpp                                    # camera to centre, metres
camera = centre + d * ( -sin(p)*sin(b),  -sin(p)*cos(b),  cos(p) )     # (east, north, up)
centre.z = exaggeration * terrain_height_at_centre     # MapLibre's own elevation is exaggerated
```

`d` is unexaggerated metres; only the centre's height carries the exaggeration. Blender setup:

```python
cd.type = 'PERSP'; cd.sensor_fit = 'VERTICAL'; cd.lens_unit = 'FOV'; cd.angle = 0.6435011087932844   # lens becomes exactly 36.0 mm with sensor_height 24
scene.render.resolution_x, scene.render.resolution_y = W, H         # the viewport in CSS px; resolution_percentage 100
co.rotation_mode = 'XYZ'; co.rotation_euler = (radians(p), 0.0, -radians(b))   # pitch 0 looks straight down; bearing clockwise
cd.clip_start = 10.0; cd.clip_end = 100000.0
```

Verified headless for DEFAULT_CAMERA at H=900, W=1440: forward vector `(-0.296198, 0.813798, -0.5)` equals the expected `(sin b sin p, cos b sin p, -cos p)`; the up vector has z > 0 (no roll); the centre projects to NDC `(0.5, 0.5)`; a point `d/3` above the centre along camera-up projects to NDC y `1.0` (vertical FOV right), and a point `(W/H)*d/3` along camera-right projects to NDC x `1.0` (horizontal FOV follows the aspect). `to_track_quat('-Z','Y')` toward the centre gave Euler `(60, 0, 20)` deg, the same aim. Not verified: a pixel comparison with a live MapLibre frame (UNVERIFIED); the derivation is from source plus the Blender projection test. If the Blender terrain object is not Z-scaled, scale it by the exaggeration to compare against the map.

`angle_x` is **not** the effective horizontal FOV under `VERTICAL` fit: it printed 53.13 deg (from the 36 mm sensor width) while the real horizontal FOV at 1440x900 is `2*atan((W/H)/3)` = 56.14 deg (the projection test confirms the latter).

### 9c. The six app views at H = 900 px (computed with `LOCAL_TM`)

Local TM computed in pure Python (Krueger n-series, `.../w/tm.py`) because pyproj is not installed yet. Cross-check against contract C1: at the four padded-bounds corners it gives convergence +0.0353, -0.0375, +0.0358, -0.0381 deg (contract: within +-0.038) and scale 1.0000022 to 1.0000025 (contract: <= 1.000003); round trip error below 1e-9 m. Verify against pyproj once M1's environment exists (UNVERIFIED against pyproj itself).

`dUp` is added to the centre's exaggerated height. Rotation is `(rot_x, 0, rot_z)` degrees, XYZ Euler.

| view | zoom | pitch | bearing | centre E, N (m) | mpp | d (m) | dE | dN | dUp | rot_x | rot_z | farthest padded corner (m) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DEFAULT | 13.5 | 60 | -20 | 0.0, 0.0 | 6.474 | 8739.8 | 2588.7 | -7112.4 | 4369.9 | 60 | 20 | 26,622 |
| burnham-park | 15.5 | 55 | -25 | -256.4, 1029.2 | 1.618 | 2184.9 | 756.4 | -1622.0 | 1253.2 | 55 | 25 | 20,287 |
| session-road | 16 | 60 | 30 | 74.8, 1051.3 | 1.144 | 1544.9 | -669.0 | -1158.7 | 772.5 | 60 | -30 | 20,823 |
| mines-view | 15 | 65 | -60 | 3685.0, 1350.4 | 2.289 | 3089.8 | 2425.1 | -1400.2 | 1305.8 | 65 | 60 | 24,415 |
| camp-john-hay | 14.5 | 55 | 15 | 2424.8, -741.3 | 3.237 | 4370.1 | -926.5 | -3457.8 | 2506.6 | 55 | -15 | 23,657 |
| kennon-road | 13 | 70 | -10 | 961.5, -4127.7 | 9.157 | 12362.3 | 2017.2 | -11440.3 | 4228.2 | 70 | 10 | 33,945 |

The farthest padded-bounds corner is up to 33.9 km from a camera, so `clip_end >= 40,000` covers the model; the pitch-70 horizon reaches past the bounds, so 100,000 is the safer render value. These viewport sizes are placeholders: position scales linearly with `H`, so use the real app viewport (not recorded anywhere) when comparing frames.

---

## 10. Assets

### 10a. Files

```
~/Documents/Blender/Assets/baguio_cc0_materials.blend   149,309 bytes (148 K)  exists
~/Documents/Blender/Assets/ambientCG/                    4.5 MB, 4 folders: Asphalt031, Concrete034, CorrugatedSteel005, CorrugatedSteel009
```

Headless `bpy.ops.wm.open_mainfile(filepath=...)` (prints "Library file, loading empty scene"), then `bpy.data.materials`:

```
('ACG_Asphalt031', users=1, fake_user=True, asset=True, use_nodes=True)
('ACG_Concrete034', ...)   ('ACG_CorrugatedSteel005', ...)   ('ACG_CorrugatedSteel009', ...)
```

Only those four materials; no objects, meshes, node groups or collections. Each has 3 image textures (Color sRGB, Roughness Non-Color, Normal Non-Color), all **external absolute paths** under `~/Documents/Blender/Assets/ambientCG/<Id>/` (not packed): `Asphalt031` 1024x1024, `Concrete034` 1024x512, `CorrugatedSteel005` 1024x1024, `CorrugatedSteel009` 1024x512. Asset tags empty, catalog id `00000000-0000-0000-0000-000000000000`.

Two findings: **Asphalt031 uses `..._NormalDX.jpg`** (DirectX green channel) through a Normal Map node (tangent space), but Blender and glTF expect OpenGL; the `..._NormalGL.jpg` file is in the same folder, so point the material at it (the other three already use `NormalGL`). The CorrugatedSteel005 folder has a `Metalness` map that the material does not use (roofs would render dielectric until it is wired).

### 10b. Append and export cost (verified)

```python
with bpy.data.libraries.load(os.path.expanduser("~/Documents/Blender/Assets/baguio_cc0_materials.blend"), link=False) as (src, dst):
    dst.materials = [m for m in src.materials if m.startswith("ACG_")]
```

The images resolve from their absolute paths. Exporting a collection with two planes (`ACG_CorrugatedSteel005` and `ACG_Concrete034`) through the recommended call:

| images | bytes |
|---|---|
| 1K JPEG q80 | **3,319,472** |
| 1K WEBP q80 | 300,156 |
| none | 2,084 |
| scaled to 256 px, JPEG q80 | 45,768 |
| scaled to 256 px, WEBP q80 | 22,480 |

The landmark budget is 150 KiB over the wire with textures, so landmark textures must be shrunk (`image.scale`) and WebP or KTX2; do not ship the 1K files.

### 10c. Poly Haven and related MCP tool parameters (from the tool schemas)

| tool | parameters |
|---|---|
| `get_polyhaven_status` | (none besides `user_prompt`); live answer: "PolyHaven integration is enabled and ready to use." |
| `get_polyhaven_categories` | `asset_type` (`hdris` default, `textures`, `models`, `all`) |
| `search_polyhaven_assets` | `query`, `asset_type` (default `all`), `category`, `attributes` (object), `min_size_m` (number), `limit` (default 20, max 50) |
| `get_polyhaven_asset_preview` | `asset_id` |
| `download_polyhaven_asset` | `asset_id` (required), `asset_type` (required: `hdris`, `textures`, `models`), `resolution` (default `"1k"`; also 2k, 4k, 8k), `file_format` (optional: `hdr` default or `exr` for HDRIs; `jpg` default, `png` or `exr` for textures; models take none) |
| `set_texture` | `object_name`, `texture_id` (replaces **every** material slot on the object) |

Every MCP tool also takes `user_prompt` (verbatim user words). `get_scene_info` requires it.

---

## 11. `scene.blendermcp_use_polyhaven` in the live instance

Read-only call via `execute_blender_code`:

```python
print(hasattr(bpy.context.scene, "blendermcp_use_polyhaven"), getattr(bpy.context.scene, "blendermcp_use_polyhaven", "<missing>"))
# True True
```

It exists and is currently `True`. The live scene also exposes: `blendermcp_auto_start_server, blendermcp_hunyuan3d_*, blendermcp_hyper3d_api_key, blendermcp_hyper3d_mode, blendermcp_polypizza_api_key, blendermcp_port, blendermcp_server_running, blendermcp_sketchfab_api_key, blendermcp_use_hunyuan3d, blendermcp_use_hyper3d, blendermcp_use_polyhaven, blendermcp_use_polypizza, blendermcp_use_sketchfab, blendermcp_use_tripo` (names only; no values were read for the key properties). Contract C8's "resets in a new file" is unverified here but consistent: it is a per-scene property.

---

## Notes for the M2 (terrain) plan

1. **Hand-off format.** `uv run` script: read `model/data/dem/copernicus-glo30-baguio.tif` (M1 not run yet, so the file does not exist; its orientation and whether posts are pixel centres or corners (`AREA_OR_POINT`) are **UNVERIFIED**, read the transform with rasterio), project every post's (lng, lat) through `LOCAL_TM`, save `E, N, Z` float32 `.npy` (about 3.5 MB each at 937x937). Blender: `np.load`, `grid_mesh_from_xyz` (0.19 s).
2. **LODs.** LOD0 876,096 quads (1.75 M triangles); LOD1 = Decimate COLLAPSE 0.5 (876,096 triangles); LOD2 = 0.15 (262,828 triangles). Build both with `new_from_object` (about 5 s and 8 s). Decimate is deterministic across processes. `.blend` with all three: 54.6 MB compressed.
3. **Validation / foundations.** Use `Object.ray_cast` (or a world-space `BVHTree.FromPolygons`) for landmark foundation heights: 1000 samples in about 2 ms.
4. **Exaggeration.** For render comparison against the app, Z-scale the terrain by 1.35 (or the live config) and put camera z at `1.35 * terrain_z(centre) + dUp`; landmark GLBs stay unexaggerated (the runtime scales Z).
5. **Ledger-worthy surprises.** Spec §5 "~650k faces" is stale (876 k quads); spec §4.0 add-on version/protocol (1.7/9) is stale (1.8/13); the contract's mention of research notes under `docs/superpowers/research/2026-10-01-*.md` found no prior files in that folder (this note is the first).
