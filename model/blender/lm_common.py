"""Shared helpers for landmark modeling scripts (landmark procedure, step C). Blender 4.5.2.

A landmark lives in collection LM_<slug> under 40_LANDMARKS, authored around the local origin:
(0, 0, 0) is the footprint centroid on the ground, +Y is north, 1 unit = 1 m. A collection
instance placed at the anchor in 00_REFERENCE shows it in context for renders."""
import json
import math
import os
import re
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

TIER_TRIANGLES = {1: 25_000, 2: 10_000}
# The app stretches the terrain by TERRAIN_EXAGGERATION but draws models at true scale (lib/map/modelTransform.ts),
# so rel_ground returns stretched relief: ground-hugging parts fit the map, buildings keep their real heights.
EXAG = float(re.search(r"TERRAIN_EXAGGERATION = ([\d.]+)", (ROOT / "lib" / "map" / "sources.ts").read_text())[1])


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
    for n in [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"]:   # a texture from an earlier build: start flat
        mat.node_tree.nodes.remove(n)                                      # (textured() and detail() add theirs back)
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


TERRARIUM = ROOT / "model" / "data" / "terrarium" / "14"   # model/scripts/fetch_terrarium.py
_tiles = {}


def map_ground(fp, pts):
    """Elevation (m) of the terrain the app draws (AWS Terrarium z14, lib/map/sources.ts) under local points
    (x east, y north, metres from fp's anchor), sampled as MapLibre does: bilinear, pixel i at coordinate i.
    Local metres -> degrees is linear about the anchor (WGS84 radii): within a few hundred metres the
    tmerc frame's scale and convergence error is centimetres."""
    alng, alat = fp["anchor_lnglat"]
    s2 = 0.00669437999014 * math.sin(math.radians(alat)) ** 2      # WGS84 e^2 sin^2(lat)
    m_lat = math.radians(6378137.0 * (1 - 0.00669437999014) / (1 - s2) ** 1.5)
    m_lng = math.radians(6378137.0 / math.sqrt(1 - s2) * math.cos(math.radians(alat)))
    n = 2 ** 14 * 256

    def px(i, j):
        key = (i // 256, j // 256)
        if key not in _tiles:
            _tiles[key] = np.load(TERRARIUM / str(key[0]) / f"{key[1]}.npy")
        return float(_tiles[key][j % 256, i % 256])

    out = []
    for x, y in pts:
        lng, lat = alng + x / m_lng, alat + y / m_lat
        u = (lng + 180) / 360 * n
        v = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
        i, j = math.floor(u), math.floor(v)
        fu, fv = u - i, v - j
        top = px(i, j) * (1 - fu) + px(i + 1, j) * fu
        bot = px(i, j + 1) * (1 - fu) + px(i + 1, j + 1) * fu
        out.append(top * (1 - fv) + bot * fv)
    return out


def rel_ground(fp, pts, low=False):
    """Ground under local points relative to the anchor's ground, on the terrain the app draws (map_ground):
    the app sets each model on it, so ground-hugging parts fit it alone. Copernicus GLO-30 is a surface
    model that reads tree canopy (5-10 m high over Camp John Hay's pines), so fitting to the higher of the
    two floated the Bell Amphitheater's stairs (owner report 2026-10-05). low=True gives the lower of the
    two DEMs, for depths and tree bases, so nothing floats in the Blender review either."""
    mp = map_ground(fp, list(pts) + [(0.0, 0.0)])
    rel = [(m - mp[-1]) * EXAG for m in mp[:-1]]
    if not low:
        return rel
    ax, ay = fp["anchor_tm"]
    cop = terrain_z([(ax + x, ay + y) for x, y in pts] + [(ax, ay)])
    return [min(m, (c - cop[-1]) * EXAG) if c is not None else m for m, c in zip(rel, cop[:-1])]


def drape(S, fp, name, ring, mat, step=8.0, lift=0.15):
    """A surface laid on the map's terrain over a local ring [(x, y), ...]: the ring plus interior points every `step` m,
    triangulated (constrained Delaunay), each vertex `lift` m above rel_ground, with a skirt to 1 m under the
    lowest ground so its edge never floats. For fields and lawns too big to be level on the DEM. S: a Shapes in
    bearing 0. Returns the skirt's bottom."""
    from mathutils import Vector
    from mathutils.geometry import delaunay_2d_cdt
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    inner = [(x, y) for x in np.arange(min(xs) + step / 2, max(xs), step) for y in np.arange(min(ys) + step / 2, max(ys), step)
             if inside(ring, x, y) and min(math.hypot(x - px, y - py) for px, py in ring) > step / 3]
    n = len(ring)
    pts = [Vector(p) for p in list(ring) + inner]
    vco, _, faces, orig, *_ = delaunay_2d_cdt(pts, [(i, (i + 1) % n) for i in range(n)], [list(range(n))], 1, 1e-4)
    out = {k: i for i, ks in enumerate(orig) for k in ks if k < n}          # ring index -> output vertex
    zs = rel_ground(fp, [(v.x, v.y) for v in vco])
    zb = min(rel_ground(fp, list(ring), low=True)) - 1.0
    verts = [(v.y, v.x, z + lift) for v, z in zip(vco, zs)]
    m = len(verts)
    verts += [(y, x, zb) for x, y in ring]
    sides = [(out[i], out[(i + 1) % n], m + (i + 1) % n, m + i) for i in range(n)]
    S.mesh(name, verts, [tuple(f) for f in faces] + sides + [tuple(range(m + n - 1, m - 1, -1))], mat)
    return zb


def foundation(coll, fp, mat):
    """Contract C2: geometry below Z=0 reaches the lowest terrain under the footprint plus 1 m (either DEM)."""
    lowest = min(rel_ground(fp, [(x, y) for ring in fp["rings"] for x, y in ring] + [(0.0, 0.0)], low=True))
    depth = -lowest + 1.0
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
        if not ob.data.uv_layers and any(m and any(n.type == "TEX_IMAGE" for n in m.node_tree.nodes) for m in ob.data.materials):
            _face_uvs(ob, 2.0)   # a textured part built without UVs (glTF: TEXCOORD_0 is required, M7 validator)
        me = ob.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        zmin = min(zmin, min((ob.matrix_world @ v.co).z for v in me.vertices))
        ob.evaluated_get(dg).to_mesh_clear()
    out = {"slug": slug, "tier": tier, "triangles": tris, "budget": TIER_TRIANGLES[tier], "depth": depth, "z_min": zmin}
    print("REPORT", json.dumps(out))
    if os.environ.get("LM_PROBE"):            # measuring an over-budget scene: report, save, don't fail
        return out
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


def flagstones(rgb=(0.56, 0.53, 0.49), seed=1950):
    """Crazy paving: 24 stones per tile (Voronoi cells, wrapped), dark grout, per-stone tint."""
    Y, X, grain = _grid()
    pts = np.random.default_rng(seed).uniform(0, 1, (24, 2))
    d1, d2, idx = np.full(X.shape, 9.0), np.full(X.shape, 9.0), np.zeros(X.shape)
    for k, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(X - px - ox, Y - py - oy)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                idx = np.where(closer, k, idx)
                d1 = np.where(closer, d, d1)
    shade = np.where(d2 - d1 < 0.02, 0.6, 1 + 0.08 * np.sin(idx * 12.9898))
    return np.array(rgb) * (shade[..., None] * (1 + 0.03 * grain))


def inside(ring, px, py):
    """Even-odd point-in-polygon test for a ring [[x, y], ...] in local metres."""
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


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

    def xy(self, x, y, z):
        """Local (x east, y north, z) -> this frame's (a, w, z)."""
        return (x * self.U[0] + y * self.U[1], x * self.V[0] + y * self.V[1], z)

    def beam(self, name, p0, p1, half, mat):
        """Square-section member between local (x, y, z) points p0 and p1."""
        d = np.subtract(p1, p0)
        d = d / np.linalg.norm(d)
        u = np.cross(d, (0, 0, 1)) if abs(d[2]) < 0.99 else np.array((1.0, 0, 0))
        u = u / np.linalg.norm(u) * half
        v = np.cross(d, u)
        v = v / np.linalg.norm(v) * half
        cs = [-u - v, u - v, u + v, -u + v]
        return self.hexa(name, [self.xy(*np.add(p0, c)) for c in cs], [self.xy(*np.add(p1, c)) for c in cs], mat)

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

    def hip(self, name, a0, a1, w0, w1, ze, mat):
        """Hip roof over a rectangle at eave height ze, ridge along the longer side; returns the ridge height."""
        if a1 - a0 >= w1 - w0:
            d, wm = (w1 - w0) / 2, (w0 + w1) / 2
            zr = ze + d * self.pitch
            verts = [(a0, w0, ze), (a1, w0, ze), (a1, w1, ze), (a0, w1, ze), (a0 + d, wm, zr), (a1 - d, wm, zr)]
            uv = "aw"
        else:
            d, am = (a1 - a0) / 2, (a0 + a1) / 2
            zr = ze + d * self.pitch
            verts = [(a0, w0, ze), (a0, w1, ze), (a1, w1, ze), (a1, w0, ze), (am, w0 + d, zr), (am, w1 - d, zr)]
            uv = "wa"
        self.mesh(name, verts, [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 4, 3), (1, 2, 5)], mat, uv)
        return zr

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

    def arch_panel(self, name, axis, at, c, width, z0, z1, depth, mat, round_top=False):
        """Arched opening as a thin prism on a wall facing along `axis`: pointed, or round (a semicircle)."""
        h = width / 2
        if round_top:
            pts = [(c - h, z0), (c + h, z0)] + [(c + h * math.cos(math.pi * i / 6), z1 - h + h * math.sin(math.pi * i / 6)) for i in range(7)]
        else:
            pts = [(c - h, z0), (c + h, z0), (c + h, z1 - h), (c, z1), (c - h, z1 - h)]
        n = len(pts)
        if axis == "a":
            verts = [(at, x, z) for x, z in pts] + [(at - depth, x, z) for x, z in pts]
        else:
            verts = [(x, at, z) for x, z in pts] + [(x, at - depth, z) for x, z in pts]
        return self.mesh(name, verts, [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], mat)


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
    "pine_simple_a": "nature-kit/Models/GLTF format/tree_pineTallA.glb",     # 78 triangles: for whole woods
    "pine_simple_c": "nature-kit/Models/GLTF format/tree_pineTallC.glb",
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


# --- Sub-detail pass (owner 2026-10-06: wall and roof patterns, entrances, windows on every landmark) ---------------

def _face_uvs(ob, tile):
    """Per-face UVs at `tile` m: u runs level along the face, v up it (up a wall, up a roof's slope), so pattern rows stay
    level and corrugation ribs run down the slope. Meshes that already have UVs keep them."""
    from mathutils import Vector
    me = ob.data
    if me.uv_layers:
        return
    layer, mw = me.uv_layers.new(name="UVMap"), ob.matrix_world
    for poly in me.polygons:
        n = (mw.to_3x3() @ poly.normal).normalized()
        flat = abs(n.z) > 0.95
        t = Vector((1, 0, 0)) if flat else Vector((-n.y, n.x, 0)).normalized()
        b = Vector((0, 1, 0)) if flat else n.cross(t)
        for li in poly.loop_indices:
            p = mw @ me.vertices[me.loops[li].vertex_index].co
            layer.data[li].uv = (p.dot(t) / tile, p.dot(b) / tile)


def _pattern(coll, mat, make, tile):
    """Texture an untextured material with make(its own sRGB colour), and UV every object of `coll` that uses it."""
    nt = mat.node_tree
    if not any(n.type == "TEX_IMAGE" for n in nt.nodes):
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        lin = tuple(bsdf.inputs["Base Color"].default_value)[:3]
        s = [12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055 for c in lin]
        textured(mat.name, pattern_image("TEX_" + mat.name[4:], make(s)), lin, bsdf.inputs["Roughness"].default_value)
    for ob in coll.all_objects:
        if ob.type == "MESH" and mat.name in [m.name for m in ob.data.materials if m]:
            _face_uvs(ob, tile)


def detail(coll, fp, roofs=(), walls=(), blocks=(), storey=3.2, bay=3.4, frame_rgb=(236, 234, 226), glass_rgb=(40, 48, 58)):
    """Shared sub-detail: corrugated sheet (1 m tile) on untextured `roofs`; block joints (2 m tile) on untextured `walls`,
    and on untextured `blocks`;
    and on every wall quad of those materials windows per storey and bay, plus one door on each object's longest wall
    whose middle is at ground level. Rows are level from the wall's floor (its foot, or the highest ground outside it),
    stepping down where the ground falls away. Openings are proud quads, frame 8 cm and glass 14 cm off the wall, in one
    object. ESTIMATEs (typical, not measured): 3.2 m storeys, 3.4 m bays, 1.2 x 1.4 m windows on 0.9 m sills,
    1.5 x 2.4 m doors."""
    from mathutils import Vector
    for mat in roofs:
        _pattern(coll, mat, corrugated, 1.0)
    for mat in list(walls) + list(blocks):        # blocks: the pattern alone (plinths, rims, stone, no openings)
        _pattern(coll, mat, wall_blocks, 2.0)
    names = {m.name for m in walls}
    faces, runs = {}, {}                            # object -> [(width, n, t, p0, s0, s1, zb, zt)]
    for ob in coll.all_objects:
        if ob.type != "MESH":
            continue
        slots = {i for i, m in enumerate(ob.data.materials) if m and m.name in names}
        mw = ob.matrix_world
        for poly in ob.data.polygons:
            if poly.material_index not in slots or len(poly.vertices) != 4:
                continue
            n = (mw.to_3x3() @ poly.normal).normalized()
            if abs(n.z) > 0.05:
                continue
            n = Vector((n.x, n.y, 0)).normalized()
            ps = [mw @ ob.data.vertices[i].co for i in poly.vertices]
            t = Vector((-n.y, n.x, 0))
            ss, zs = [p.dot(t) for p in ps], sorted(p.z for p in ps)
            if zs[2] - zs[1] >= 2.8:                 # one wall run: same plane and band (outlines come in short strips)
                key = (ob.name, round(n.x, 2), round(n.y, 2), round(ps[0].dot(n), 1), round(zs[1], 1), round(zs[2], 1))
                runs.setdefault(key, []).append((min(ss), max(ss), n, t, ps[0], zs[1], zs[2]))
    for key, strips in runs.items():
        strips.sort(key=lambda r: r[0])
        merged = [list(strips[0])]
        for r in strips[1:]:
            if r[0] <= merged[-1][1] + 0.05:
                merged[-1][1] = max(merged[-1][1], r[1])
            else:
                merged.append(list(r))
        for s0, s1, n, t, p0, zb, zt in merged:
            if s1 - s0 >= bay:
                faces.setdefault(key[0], []).append((s1 - s0, n, t, p0, s0, s1, zb, zt))
    if not faces:
        return
    bays = []                                        # (face, centres, ground points)
    for fs in faces.values():
        for f in fs:
            w, n, t, p0, s0, s1, zb, zt = f
            m = int(w // bay)
            cs = [s0 + (w - m * bay) / 2 + bay * (i + 0.5) for i in range(m)]
            bays.append((f, cs, [tuple((p0 + (c - p0.dot(t)) * t + n * 0.6).xy) for c in cs]))
    ground = iter(rel_ground(fp, [q for _, _, qs in bays for q in qs]))
    gmap = {id(f): [next(ground) for _ in cs] for f, cs, _ in bays}
    verts, quads = [], []                            # quads: (corner indices, material slot)

    def quad(f, c, hw, z0, z1, d, slot):
        _, n, t, p0, *_ = f
        k = len(verts)
        for s, z in ((c - hw, z0), (c + hw, z0), (c + hw, z1), (c - hw, z1)):
            p = p0 + (s - p0.dot(t)) * t + n * d
            verts.append((p.x, p.y, z))
        quads.append(((k, k + 1, k + 2, k + 3), slot))

    for fs in faces.values():
        door = None
        for f in sorted(fs, key=lambda f: -f[0]):
            gs, cs = gmap[id(f)], next(cs for g, cs, _ in bays if g is f)
            floor = max(f[6], max(gs))
            mid = min(range(len(cs)), key=lambda i: abs(cs[i] - (f[4] + f[5]) / 2))
            if door is None and gs[mid] >= floor - 0.5:
                door = (id(f), mid)
            for k in range(-8, 16):
                sill = floor + k * storey + 0.9
                if sill + 1.4 > f[7] - 0.3:
                    break
                for i, c in enumerate(cs):
                    if sill < max(gs[i], f[6]) + 0.6:
                        continue
                    if k == 0 and door == (id(f), i):
                        quad(f, c, 0.9, floor, floor + 2.6, 0.08, 0)
                        quad(f, c, 0.75, floor, floor + 2.4, 0.14, 2)
                        continue
                    quad(f, c, 0.7, sill - 0.1, sill + 1.5, 0.08, 0)
                    quad(f, c, 0.6, sill, sill + 1.4, 0.14, 1)
    key = coll.name[3:]
    mats = [material(f"MAT_{key}_frame", srgb(*frame_rgb), 0.7), material(f"MAT_{key}_glass", srgb(*glass_rgb), 0.2),
            material(f"MAT_{key}_door", srgb(92, 62, 42), 0.7)]
    me = bpy.data.meshes.new(f"{key}_openings")
    me.from_pydata(verts, [], [q for q, _ in quads])
    for m in mats:
        me.materials.append(m)
    for poly, (_, slot) in zip(me.polygons, quads):
        poly.material_index = slot
    coll.objects.link(bpy.data.objects.new(f"{key}_openings", me))
    print("DETAIL", key, "windows+doors", sum(1 for _, s in quads if s), "quads", len(quads))


# --- Ground surfaces and whole parks (owner 2026-10-06: Session Road at 1:1; "the complete 3d-model of Burnham Park") ----

def surface(coll, fp, name, m, lift, mat, sheet=False, tile=None, outer=None):
    """A triangle mesh {"v": [[x, y]], "f": [[i, j, k]]} laid on the map's terrain, each vertex `lift` m above it, with a
    skirt from its border to 1 m under the lowest ground (none for a `sheet`, e.g. an awning). `outer`: skirt only the
    border edges lying on that ring (a park's outline): inside it the ground classes meet within centimetres of each
    other, and their skirts would only cost bytes. Returns the skirt's bottom (0 for a sheet)."""
    if not m["f"]:
        return 0.0
    xy = [tuple(v) for v in m["v"]]
    g = rel_ground(fp, xy)
    bm = bmesh.new()
    top = [bm.verts.new((x, y, z + lift)) for (x, y), z in zip(xy, g)]
    for f in m["f"]:
        try:
            bm.faces.new([top[i] for i in f])
        except ValueError:                    # a duplicate triangle from two grid cells
            pass
    bm.edges.ensure_lookup_table()
    zb = 0.0
    if not sheet:
        zb = min(rel_ground(fp, xy, low=True)) - 1.0
        low = {}
        border = [e for e in bm.edges if len(e.link_faces) == 1]
        if outer is not None:
            a = np.asarray(outer, float)
            ab = np.roll(a, -1, axis=0) - a

            def on_outer(q):
                t = np.clip(((q - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-9), 0, 1)
                return np.min(np.linalg.norm(a + ab * t[:, None] - q, axis=1)) < 0.6

            border = [e for e in border if on_outer((np.array(e.verts[0].co.xy) + np.array(e.verts[1].co.xy)) / 2)]
        for e in border:
            for v in e.verts:
                low.setdefault(v, bm.verts.new((v.co.x, v.co.y, zb)))
            lp = e.link_loops[0]
            a, b = lp.vert, lp.link_loop_next.vert
            bm.faces.new((b, a, low[a], low[b]))  # outward: to the right of the face's own edge direction
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    if tile:
        _face_uvs(ob, tile)
    return zb


PARK_COLOURS = {"lawn": (104, 150, 72), "wood": (80, 120, 62), "garden": (126, 150, 84), "paved": (168, 166, 162),
                "plaza": (156, 154, 150), "playground": (128, 158, 84), "track": (84, 88, 96), "pitch": (90, 152, 66),
                "pool": (64, 156, 196)}     # paving in concrete grey: the basemap's park fill is beige, and owner 2026-10-06
# saw beige paving as holes. Lifts clear the map's terrain mesh, which departs from the bilinear DEM by up to ~0.3 m
# between its vertices on the park's slopes (owner 2026-10-06: the terrain showed through the lawns at 0.12 m).
PARK_LIFT = {"lawn": 0.3, "wood": 0.3, "garden": 0.34, "paved": 0.4, "plaza": 0.4, "playground": 0.36, "track": 0.44,
             "pitch": 0.4, "pool": 0.45}


def park(coll, fp, pk, key, seed=1925, bay=8.0):
    """A park part from landmark_osm.py park (park.json) at 1:1: ground surfaces per class on the map's terrain; football
    and tennis markings; buildings (grandstands as stepped seating under a roof facing the nearest pitch, greenhouses in
    glass, roof-only shelters on posts, a ring building (the skating rink) as a roofed ring round an open floor, the rest
    as blocks with windows and hip or flat roofs); hedges and walls; bicycle-rental kiosks, memorials, fountains and
    lamps; and the trees (Kenney pines and broadleaves). Heights are ESTIMATEs (see the landmark's sheet). Returns the
    lowest z. `key` prefixes the material names."""
    rng = np.random.default_rng(seed)
    S = Shapes(coll, 0.0, {})
    lowest = 0.0
    running = any(t["sport"] == "running" for t in pk["tracks"])
    colours = dict(PARK_COLOURS, track=(170, 76, 60) if running else PARK_COLOURS["track"])   # a running track is red
    mats = {k: material(f"MAT_{key}_{k}", srgb(*c), 0.9) for k, c in colours.items()}
    for k, m in pk["ground"].items():
        if k in mats:
            lowest = min(lowest, surface(coll, fp, f"{key}_ground_{k}", m, PARK_LIFT[k], mats[k], outer=pk["region"]))
    paint = material(f"MAT_{key}_paint", srgb(236, 236, 230), 0.6)
    play = [material(f"MAT_{key}_play_{i}", srgb(*c), 0.6) for i, c in enumerate(((214, 64, 52), (240, 190, 50), (52, 120, 196)))]
    pg, sites = pk["ground"].get("playground", {"v": [], "f": []}), []
    for f in pg["f"]:                                 # play equipment on the playground, at least 22 m apart (ESTIMATE)
        c = np.mean([pg["v"][i] for i in f], axis=0)
        if all(math.dist(c, q) > 22 for q in sites):
            sites.append(c)
    for j, (x, y) in enumerate(sites[:10]):
        z = rel_ground(fp, [(x, y)])[0] + 0.2
        if j % 2 == 0:                                # a slide tower: deck, roof, chute
            S.box(f"{key}_play_{j}_deck", y - 1.2, y + 1.2, x - 1.2, x + 1.2, z + 1.4, z + 1.6, play[0])
            S.pyramid(f"{key}_play_{j}_roof", y, x, 1.4, z + 3.0, z + 4.0, play[1])
            for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                S.box(f"{key}_play_{j}_post_{dx}{dy}", y + dy * 1.1 - 0.06, y + dy * 1.1 + 0.06, x + dx * 1.1 - 0.06, x + dx * 1.1 + 0.06, z, z + 3.0, play[2])
            S.beam(f"{key}_play_{j}_chute", (x + 1.2, y, z + 1.5), (x + 4.2, y, z + 0.2), 0.35, play[1])
        else:                                         # a swing frame
            for dy in (-2.0, 2.0):
                S.beam(f"{key}_play_{j}_leg_{dy:+.0f}a", (x - 1.0, y + dy, z), (x, y + dy, z + 2.6), 0.06, play[2])
                S.beam(f"{key}_play_{j}_leg_{dy:+.0f}b", (x + 1.0, y + dy, z), (x, y + dy, z + 2.6), 0.06, play[2])
            S.beam(f"{key}_play_{j}_bar", (x, y - 2.0, z + 2.6), (x, y + 2.0, z + 2.6), 0.07, play[0])
    gz = lambda pts: rel_ground(fp, pts)

    def line(name, p0, p1, half, lift):
        (x0, y0), (x1, y1) = p0, p1
        z0, z1 = gz([p0, p1])
        S.beam(name, (x0, y0, z0 + lift), (x1, y1, z1 + lift), half, paint)

    for j, pt in enumerate(pk["pitches"]):            # markings on the pitch's rectangle (FIFA/ITF proportions)
        r = [np.array(p, float) for p in pt["ring"]]
        if np.linalg.norm(r[1] - r[0]) < np.linalg.norm(r[2] - r[1]):
            r = r[1:] + r[:1]
        L, W = np.linalg.norm(r[1] - r[0]), np.linalg.norm(r[2] - r[1])
        u, v = (r[1] - r[0]) / L, (r[3] - r[0]) / W
        P = lambda a, b: tuple(r[0] + u * a + v * b)
        lift = PARK_LIFT["pitch"] + 0.03
        segs = [((1, 1), (L - 1, 1)), ((L - 1, 1), (L - 1, W - 1)), ((L - 1, W - 1), (1, W - 1)), ((1, W - 1), (1, 1))]
        if pt["sport"] == "soccer":
            segs += [((L / 2, 1), (L / 2, W - 1))]
            for e in (1, L - 1):                      # penalty boxes, 16.5 x 40.3 m scaled to the field
                d = 16.5 * L / 105 * (1 if e == 1 else -1)
                h = 20.15 * W / 68
                segs += [((e, W / 2 - h), (e + d, W / 2 - h)), ((e + d, W / 2 - h), (e + d, W / 2 + h)), ((e + d, W / 2 + h), (e, W / 2 + h))]
            rc = 9.15 * W / 68
            circ = [(L / 2 + rc * math.cos(2 * math.pi * i / 16), W / 2 + rc * math.sin(2 * math.pi * i / 16)) for i in range(16)]
            segs += list(zip(circ, circ[1:] + circ[:1]))
        else:
            segs += [((L / 2, 1), (L / 2, W - 1))]    # the net line
        for i, (a, b) in enumerate(segs):
            line(f"{key}_mark_{j}_{i:02d}", P(*a), P(*b), 0.06, lift)
    pitch_c = [np.mean(np.array(p["ring"], float), axis=0) for p in pk["pitches"]]
    wall = material(f"MAT_{key}_wall", srgb(232, 226, 210), 0.8)
    roofs = [material(f"MAT_{key}_roof_{i}", srgb(*c), 0.6) for i, c in enumerate(((150, 58, 42), (58, 108, 74), (52, 86, 132)))]
    glass = material(f"MAT_{key}_glass", srgb(170, 200, 196), 0.15)
    steel = material(f"MAT_{key}_steel", srgb(150, 154, 160), 0.4)
    seat = material(f"MAT_{key}_seat", srgb(186, 182, 172), 0.8)
    for j, b in enumerate(pk["buildings"]):
        ring = b["ring"]
        z0 = max(gz(ring)) + 0.2
        zb = min(rel_ground(fp, ring, low=True)) - 1.0
        lowest = min(lowest, zb)
        h = b["height"] or (b["levels"] or 0) * 3.2 or {"guardhouse": 3.0, "toilets": 3.5, "greenhouse": 4.0, "roof": 4.2,
                                                         "grandstand": 9.0, "cleanroom": 3.0}.get(b["kind"], 6.4)
        aw = [(y, x) for x, y in ring]
        if b["holes"]:                                # the skating rink: a roofed ring round the open floor
            hole = b["holes"][0]
            S.prism(f"{key}_b{j}_floor", [(y, x) for x, y in hole], zb, z0 + 0.1, seat, tessellate=True)
            out = max(math.dist(p, np.mean(hole, axis=0)) for p in ring)
            hc = np.mean(np.array(hole, float), axis=0)
            rin = np.mean([math.dist(p, hc) for p in hole])
            n = 24
            pts = [(hc[0] + r * math.cos(2 * math.pi * i / n), hc[1] + r * math.sin(2 * math.pi * i / n)) for r in (rin, rin + (out - rin) * 0.8) for i in range(n)]
            verts = [(y, x, z0 + 5.0) for x, y in pts] + [(y, x, z0 + 5.4) for x, y in pts]
            faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
            faces = [tuple(reversed(f)) for f in faces] + [tuple(c + 2 * n for c in f) for f in faces]
            faces += [(i, (i + 1) % n, 2 * n + (i + 1) % n, 2 * n + i) for i in range(n)] + [(n + (i + 1) % n, n + i, 3 * n + i, 3 * n + (i + 1) % n) for i in range(n)]
            S.mesh(f"{key}_b{j}_roof", verts, faces, roofs[1])
            for i in range(0, n, 2):
                x, y = pts[i]
                S.box(f"{key}_b{j}_post_{i}", y - 0.15, y + 0.15, x - 0.15, x + 0.15, z0, z0 + 5.0, steel)
            continue
        if b["kind"] == "roof":                       # a shelter: roof on posts
            S.prism(f"{key}_b{j}_roof", aw, z0 + h - 0.3, z0 + h, roofs[1], tessellate=True)
            for i, (x, y) in enumerate(ring[::max(1, len(ring) // 4)]):
                S.box(f"{key}_b{j}_post_{i}", y - 0.15, y + 0.15, x - 0.15, x + 0.15, z0, z0 + h - 0.3, steel)
            continue
        if b["kind"] == "grandstand":                 # stepped seating rising away from the nearest pitch, a roof over it
            c = np.mean(np.array(ring, float), axis=0)
            toward = (min(pitch_c, key=lambda q: np.linalg.norm(q - c)) - c) if pitch_c else np.array((0.0, 1.0))
            toward = toward / max(np.linalg.norm(toward), 1e-9)
            G = Shapes(coll, math.degrees(math.atan2(-toward[0], -toward[1])), {})   # a: back, away from the field
            pa = [G.xy(x, y, 0)[:2] for x, y in ring]
            a0, a1 = min(p[0] for p in pa), max(p[0] for p in pa)
            w0, w1 = min(p[1] for p in pa), max(p[1] for p in pa)
            steps = 8
            for k in range(steps):
                s0 = a0 + (a1 - a0) * k / steps
                G.box(f"{key}_b{j}_step_{k}", s0, a1, w0, w1, zb if k == 0 else z0, z0 + 0.5 + 0.55 * k, seat)
            G.box(f"{key}_b{j}_back", a1 - 0.4, a1, w0, w1, z0, z0 + h, wall)
            G.mesh(f"{key}_b{j}_canopy", [(a0 + (a1 - a0) * 0.2, w0 - 0.5, z0 + h - 0.5), (a1 + 0.5, w0 - 0.5, z0 + h + 0.6),
                                          (a1 + 0.5, w1 + 0.5, z0 + h + 0.6), (a0 + (a1 - a0) * 0.2, w1 + 0.5, z0 + h - 0.5)], [(0, 1, 2, 3)], roofs[1])
            for w in np.linspace(w0 + 1, w1 - 1, max(2, int((w1 - w0) / 12) + 1)):
                G.box(f"{key}_b{j}_col_{w:.0f}", a1 - 1.0, a1 - 0.5, w - 0.25, w + 0.25, z0, z0 + h, steel)
            continue
        mat = glass if b["kind"] == "greenhouse" else wall
        S.prism(f"{key}_b{j}", aw, zb, z0 + h, mat, tessellate=True)
        S.prism(f"{key}_b{j}_roof", [(y, x) for x, y in ring], z0 + h, z0 + h + 0.4, glass if b["kind"] == "greenhouse" else roofs[j % 3], tessellate=True)
        if len(ring) == 4 and b["kind"] != "greenhouse":   # a hip roof over a four-sided block
            e0 = np.array(ring[1]) - np.array(ring[0])
            H = Shapes(coll, math.degrees(math.atan2(e0[0], e0[1])), {})
            pa = [H.xy(x, y, 0)[:2] for x, y in ring]
            H.hip(f"{key}_b{j}_hip", min(p[0] for p in pa), max(p[0] for p in pa), min(p[1] for p in pa), max(p[1] for p in pa), z0 + h + 0.4, roofs[j % 3])
    hedge = material(f"MAT_{key}_hedge", srgb(64, 110, 52), 0.95)
    stone = material(f"MAT_{key}_stone", srgb(170, 166, 156), 0.9)
    for j, ln in enumerate(pk["lines"]):
        if ln["kind"] not in ("hedge", "wall"):
            continue
        pts = ln["pts"]
        zs = gz(pts)
        for i in range(len(pts) - 1):
            half, lift, mat = (0.45, 0.45, hedge) if ln["kind"] == "hedge" else (0.15, 0.6, stone)
            S.beam(f"{key}_{ln['kind']}_{j}_{i}", (*pts[i], zs[i] + lift), (*pts[i + 1], zs[i + 1] + lift), half, mat)
    kiosk = material(f"MAT_{key}_kiosk", srgb(52, 120, 176), 0.6)
    bronze = material(f"MAT_{key}_bronze", srgb(96, 78, 52), 0.5)
    water = material(f"MAT_{key}_water", srgb(70, 140, 170), 0.15)
    for j, p in enumerate(pk["points"]):
        x, y = p["xy"]
        z = gz([(x, y)])[0] + 0.15
        if p["kind"] == "bicycle_rental":             # a rental stall: counter and a blue roof
            S.box(f"{key}_rent_{j}", y - 1.0, y + 1.0, x - 1.5, x + 1.5, z, z + 1.1, wall)
            S.box(f"{key}_rent_{j}_roof", y - 1.4, y + 1.4, x - 1.9, x + 1.9, z + 2.4, z + 2.6, kiosk)
            for dx in (-1.6, 1.6):
                S.box(f"{key}_rent_{j}_post_{dx:+.0f}", y - 0.05, y + 0.05, x + dx - 0.05, x + dx + 0.05, z, z + 2.4, steel)
        elif p["kind"] == "memorial":                 # a plinth and its bust or marker
            S.box(f"{key}_memo_{j}", y - 1.0, y + 1.0, x - 1.0, x + 1.0, z, z + 1.6, stone)
            S.box(f"{key}_memo_{j}_bust", y - 0.35, y + 0.35, x - 0.3, x + 0.3, z + 1.6, z + 2.4, bronze)
        elif p["kind"] == "fountain":
            S.cone(f"{key}_fount_{j}", y, x, 3.0, z, z + 0.6, stone, seg=12)
            S.cone(f"{key}_fount_{j}_water", y, x, 2.6, z + 0.55, z + 0.62, water, seg=12)
        elif p["kind"] == "lamp":
            S.box(f"{key}_lamp_{j}", y - 0.06, y + 0.06, x - 0.06, x + 0.06, z, z + 4.0, steel)
    trees = {"pine": [asset_mesh("pine_simple_c", 16.0, {"leafs": (60, 96, 56), "woodBark": (92, 70, 54)}),
                      asset_mesh("pine_simple_a", 13.0, {"leafs": (54, 88, 52), "woodBark": (92, 70, 54)})],
             "broad": [asset_mesh("broadleaf", 9.0, {"leafs": (88, 124, 60), "woodBark": (110, 84, 60)})]}
    for j, t in enumerate(pk["trees"]):
        x, y = t["xy"]
        z = rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        place(coll, f"{key}_tree_{j:03d}", trees[t["kind"]][j % len(trees[t["kind"]])], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    detail(coll, fp, roofs=roofs, walls=[wall], bay=bay)
    return lowest
