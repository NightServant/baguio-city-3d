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
    mat.diffuse_color = (*rgb, 1.0)  # viewport/Workbench colour (renders and MCP screenshots)
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


# --- Shared shape and pattern helpers (moved from the cathedral script, M4) --------------------------

import math  # noqa: E402

import numpy as np  # noqa: E402


def srgb(r, g, b):
    """sRGB 0-255 -> linear 0-1, for Principled Base Color."""
    f = lambda c: (c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b))


def pattern_image(name, rgb):
    """Pack a generated sRGB pattern (n x n x 3, rows from the bottom) into the .blend as an image."""
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False)
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((n, n, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


def textured(name, img, mean_rgb, roughness):
    mat = material(name, mean_rgb, roughness)
    nt = mat.node_tree
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"])
    return mat


# Generated, seeded 256 px tiles (no downloads; deterministic). Values are sRGB.
N = 256


def _grid():
    Y, X = (np.mgrid[0:N, 0:N] + 0.5) / N  # Y = v (up), X = u
    return Y, X, np.random.default_rng(1936).normal(0.0, 1.0, (N, N, 1))


def wall_blocks(rgb=(0.925, 0.925, 0.910)):
    """Painted walls with faint block joints: 0.5 m courses, 1 m blocks, running bond (2 m tile)."""
    Y, X, grain = _grid()
    row = np.floor(Y * 4)
    bx, by = (X * 2 + (row % 2) * 0.5) % 1.0, (Y * 4) % 1.0
    joint = (np.minimum(bx, 1 - bx) < 0.010) | (np.minimum(by, 1 - by) < 0.018)
    block = 1 + 0.012 * np.sin(np.floor(X * 2 + (row % 2) * 0.5) * 12.9898 + row * 78.233)
    shade = block[..., None] * (1 + 0.010 * grain) * np.where(joint, 0.88, 1.0)[..., None]
    return np.array(rgb) * shade


def corrugated(rgb=(0.77, 0.16, 0.14)):
    """Corrugated metal roofing: 8 ribs per 1 m tile, running down the slope, light weathering."""
    Y, X, grain = _grid()
    rib = 0.90 + 0.14 * np.sin(2 * np.pi * 8 * X)
    return np.array(rgb) * (rib[..., None] * (1 + 0.025 * grain))


def fish_scales(rgb=(0.78, 0.17, 0.15)):
    """Fish-scale shingles: 6 rows x 6 scales per 1.5 m tile, alternate rows offset."""
    Y, X, grain = _grid()
    row = np.floor(Y * 6)
    cx = (X * 6 + (row % 2) * 0.5) % 1.0 - 0.5
    cy = (Y * 6) % 1.0
    edge = 0.42 - 0.42 * np.sqrt(np.clip(1 - (2 * cx) ** 2, 0, 1))
    t = np.clip((cy - edge) / (1 - edge + 1e-6), 0, 1)
    shade = np.where(cy >= edge, 1.06 - 0.24 * t, 0.70)
    shade = np.where(np.abs(cy - edge) < 0.035, 0.52, shade)
    col = np.floor(X * 6 + (row % 2) * 0.5) % 6
    tint = 1 + 0.05 * np.sin(col * 12.9898 + row * 78.233)
    return np.array(rgb) * ((shade * tint)[..., None] * (1 + 0.02 * grain))


class Shapes:
    """Modeling in a building frame: a runs along `bearing_deg` (clockwise from north), w to its right,
    z up; all solids are closed. Textured materials named in `tile` get box-mapped UVs at tile[name]
    metres per repeat: on roofs uv="aw" runs ribs down a ridge laid along a, uv="wa" for a ridge
    along w; on walls and spires v is height, so pattern rows stay level."""

    def __init__(self, coll, bearing_deg, tile=None, pitch_deg=38.0):
        b = math.radians(bearing_deg)
        self.U = (math.sin(b), math.cos(b))
        self.V = (self.U[1], -self.U[0])
        self.coll, self.tile, self.pitch = coll, tile or {}, math.tan(math.radians(pitch_deg))

    def P(self, a, w, z):
        return (a * self.U[0] + w * self.V[0], a * self.U[1] + w * self.V[1], z)

    def mesh(self, name, verts, faces, mat, uv="aw", uvs=None):
        """uvs: optional explicit (u, v) per vertex, e.g. a road texture running along a street."""
        bm = bmesh.new()
        vs = [bm.verts.new(self.P(*v)) for v in verts]
        for f in faces:
            bm.faces.new([vs[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        tile = self.tile.get(mat.name)
        if uvs is not None:
            layer = bm.loops.layers.uv.new("UVMap")
            idx = {v: i for i, v in enumerate(vs)}
            for f in bm.faces:
                for lp in f.loops:
                    lp[layer].uv = uvs[idx[lp.vert]]
        elif tile:
            layer = bm.loops.layers.uv.new("UVMap")
            src = dict(zip(vs, verts))
            for f in bm.faces:
                pts = [src[lp.vert] for lp in f.loops]
                n = [sum((p[(k + 1) % 3] - q[(k + 1) % 3]) * (p[(k + 2) % 3] + q[(k + 2) % 3])
                         for p, q in zip(pts, pts[1:] + pts[:1])) for k in range(3)]  # Newell normal
                axis = max(range(3), key=lambda k: abs(n[k]))
                for lp in f.loops:
                    a, w, z = src[lp.vert]
                    u, v = ((a, w) if uv == "aw" else (w, a)) if axis == 2 else ((w, z) if axis == 0 else (a, z))
                    lp[layer].uv = (u / tile, v / tile)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        self.coll.objects.link(ob)
        return ob

    def hexa(self, name, bottom, top, mat, uv="aw", uvs=None):
        """Closed solid from 4 bottom and 4 top (a, w, z) corners in matching order."""
        return self.mesh(name, bottom + top, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, uv, uvs)

    def box(self, name, a0, a1, w0, w1, z0, z1, mat, uv="aw"):
        return self.hexa(name, [(a0, w0, z0), (a1, w0, z0), (a1, w1, z0), (a0, w1, z0)],
                         [(a0, w0, z1), (a1, w0, z1), (a1, w1, z1), (a0, w1, z1)], mat, uv)

    def prism(self, name, pts, z0, z1, mat, uv="aw", tessellate=False):
        """Vertical prism over a polygon of (a, w) points. tessellate=True splits the caps into triangles
        with mathutils' polygon tessellator: a concave n-gon cap can otherwise triangulate badly and leave
        holes (seen on Burnham Lake's 28-point outline)."""
        n = len(pts)
        verts = [(a, w, z0) for a, w in pts] + [(a, w, z1) for a, w in pts]
        if tessellate:
            from mathutils.geometry import tessellate_polygon
            tris = tessellate_polygon([[(a, w, 0.0) for a, w in pts]])
            caps = [tuple(t) for t in tris] + [tuple(n + i for i in t) for t in tris]
        else:
            caps = [tuple(range(n)), tuple(range(n, 2 * n))]
        faces = caps + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self.mesh(name, verts, faces, mat, uv)

    def gable_along_a(self, name, a0, a1, w0, w1, ze, mat):
        wm, zr = (w0 + w1) / 2, ze + (w1 - w0) / 2 * self.pitch
        verts = [(a0, w0, ze), (a1, w0, ze), (a1, w1, ze), (a0, w1, ze), (a0, wm, zr), (a1, wm, zr)]
        return self.mesh(name, verts, [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 3, 4), (1, 2, 5)], mat), zr

    def gable_along_w(self, name, a0, a1, w0, w1, ze, mat):
        am, zr = (a0 + a1) / 2, ze + (a1 - a0) / 2 * self.pitch
        verts = [(a0, w0, ze), (a0, w1, ze), (a1, w1, ze), (a1, w0, ze), (am, w0, zr), (am, w1, zr)]
        return self.mesh(name, verts, [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 3, 4), (1, 2, 5)], mat, uv="wa"), zr

    def gable_wall(self, name, a0, a1, w0, w1, ze, zr, mat):
        """Triangular wall filling a gable end, thickness a0..a1."""
        wm = (w0 + w1) / 2
        return self.mesh(name, [(a0, w0, ze), (a0, w1, ze), (a0, wm, zr), (a1, w0, ze), (a1, w1, ze), (a1, wm, zr)],
                         [(0, 1, 2), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], mat)

    def pyramid(self, name, ac, wc, half, z0, z1, mat):
        verts = [(ac - half, wc - half, z0), (ac + half, wc - half, z0), (ac + half, wc + half, z0), (ac - half, wc + half, z0), (ac, wc, z1)]
        return self.mesh(name, verts, [(0, 1, 2, 3), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], mat)

    def cone(self, name, ac, wc, r, z0, z1, mat, seg=8):
        ring = [(ac + r * math.cos(2 * math.pi * i / seg), wc + r * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)]
        return self.mesh(name, ring + [(ac, wc, z1)], [tuple(range(seg))] + [(i, (i + 1) % seg, seg) for i in range(seg)], mat)

    def disc(self, name, axis, at, c1, c2, r, depth, mat, seg=16):
        """Thin cylinder on a wall: axis 'a' (wall faces along a, centre w=c1, z=c2) or 'w' (centre a=c1, z=c2)."""
        ring = [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
        if axis == "a":
            verts = [(at, c1 + x, c2 + y) for x, y in ring] + [(at - depth, c1 + x, c2 + y) for x, y in ring]
        else:
            verts = [(c1 + x, at, c2 + y) for x, y in ring] + [(c1 + x, at - depth, c2 + y) for x, y in ring]
        faces = [tuple(range(seg)), tuple(range(seg, 2 * seg))] + [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
        return self.mesh(name, verts, faces, mat)

    def arch_panel(self, name, axis, at, c, width, z0, z1, depth, mat):
        """Pointed-arch opening as a thin pentagonal prism on a wall facing along `axis`."""
        h = width / 2
        pts = [(c - h, z0), (c + h, z0), (c + h, z1 - h), (c, z1), (c - h, z1 - h)]
        if axis == "a":
            verts = [(at, x, z) for x, z in pts] + [(at - depth, x, z) for x, z in pts]
        else:
            verts = [(x, at, z) for x, z in pts] + [(x, at - depth, z) for x, z in pts]
        return self.mesh(name, verts, [(0, 1, 2, 3, 4), (5, 6, 7, 8, 9)] + [(i, (i + 1) % 5, 5 + (i + 1) % 5, 5 + i) for i in range(5)], mat)


# --- Ready-made CC0 assets (owner request 2026-10-05) -----------------------------------------------
# Kits fetched by model/scripts/fetch_assets.py (provenance in model/sources.json).
ASSET_DIR = ROOT / "model" / "data" / "assets" / "kenney"
ASSETS = {
    "pine_tall_c": "nature-kit/Models/GLTF format/tree_pineTallC_detailed.glb",
    "pine_tall_a": "nature-kit/Models/GLTF format/tree_pineTallA_detailed.glb",
    "broadleaf": "nature-kit/Models/GLTF format/tree_default.glb",
    "oak": "nature-kit/Models/GLTF format/tree_oak.glb",
    "rowboat": "watercraft-kit/Models/GLB format/boat-row-small.glb",
    "rowboat_large": "watercraft-kit/Models/GLB format/boat-row-large.glb",
    "street_light": "city-kit-roads/Models/GLB format/light-curved.glb",
    "traffic_light": "city-kit-roads/Models/GLB format/traffic-light.glb",
    "bush": "nature-kit/Models/GLTF format/plant_bushDetailed.glb",
}


def asset_mesh(name, height, recolor=None):
    """One mesh per asset, imported once: all its parts joined with transforms applied, base centred on
    the origin, scaled to `height` metres. recolor maps a material-name prefix to an sRGB 0-255 colour
    (e.g. Kenney's teal leaves to a Benguet-pine green). Placed copies share this mesh, so a GLB
    stores it once."""
    key = f"ASSET_{name}_{height:g}"
    me = bpy.data.meshes.get(key)
    if me:
        return me
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ASSET_DIR / ASSETS[name]))
    new = [o for o in bpy.data.objects if o not in before]
    parts = [o for o in new if o.type == "MESH"]
    mats = []                                   # joined material list, first-seen order
    for o in parts:
        for m in o.data.materials:
            if m and m not in mats:
                mats.append(m)
    bm = bmesh.new()
    for o in parts:
        part = o.data.copy()
        part.transform(o.matrix_world)
        for poly in part.polygons:              # part-local slot -> joined list index
            m = o.data.materials[poly.material_index] if o.data.materials else None
            poly.material_index = mats.index(m) if m in mats else 0
        bm.from_mesh(part)
        bpy.data.meshes.remove(part)
    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    k = height / (hi[2] - lo[2])
    for v in bm.verts:
        v.co.x, v.co.y, v.co.z = (v.co.x - (lo[0] + hi[0]) / 2) * k, (v.co.y - (lo[1] + hi[1]) / 2) * k, (v.co.z - lo[2]) * k
    me = bpy.data.meshes.new(key)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for mat in me.materials:
        for prefix, rgb in (recolor or {}).items():
            if mat.name.startswith(prefix):
                c = srgb(*rgb)
                bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if mat.use_nodes else None
                if bsdf:
                    bsdf.inputs["Base Color"].default_value = (*c, 1.0)
                mat.diffuse_color = (*c, 1.0)
    return me


def place(coll, name, mesh, x, y, z, heading_deg=0.0, scale=1.0):
    """A linked copy of an asset mesh at local (x east, y north, z up), turned clockwise from north."""
    ob = bpy.data.objects.new(name, mesh)
    ob.location = (x, y, z)
    ob.rotation_euler = (0.0, 0.0, -math.radians(heading_deg))
    ob.scale = (scale, scale, scale)
    coll.objects.link(ob)
    return ob
