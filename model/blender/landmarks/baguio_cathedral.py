"""baguio-cathedral: the cathedral building (twin towers with spires, nave, transept, apse, porch).
Dimensions: model/landmarks/baguio-cathedral.md. Plan positions are [S2] (OSM, measured); heights are
ESTIMATEs from [S3] (owner's photo); colours are [S3].
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_cathedral.py"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-cathedral"
BEARING = math.radians(-26.3)                 # [S2] building axis: façade at SSE, apse at NNW
U = (math.sin(BEARING), math.cos(BEARING))    # a: along the axis, towards the apse
V = (U[1], -U[0])                             # w: across, to the right facing the apse
PITCH = math.tan(math.radians(38))            # ESTIMATE roof pitch [S3]


def srgb(r, g, b):
    f = lambda c: (c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b))


coll, fp = lm.begin(SLUG)
TRIM = lm.material("MAT_cathedral_trim", srgb(150, 155, 160), 0.8)     # [S3] grey trim
CAP = lm.material("MAT_cathedral_cap", srgb(110, 125, 140), 0.6)       # [S3] blue-grey pinnacle caps
DARK = lm.material("MAT_cathedral_opening", srgb(58, 60, 64), 0.9)     # openings, louvres
ROBE = lm.material("MAT_cathedral_statue", srgb(70, 100, 175), 0.7)    # [S3] statue niche, blue robe
RIDGE = lm.material("MAT_cathedral_ridge", srgb(150, 32, 28), 0.6)     # ridge caps, darker than the sheet


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
    mat = lm.material(name, mean_rgb, roughness)
    nt = mat.node_tree
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.links.new(tex.outputs["Color"], next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"])
    return mat


# Generated, seeded 256 px tiles (no downloads; deterministic). Values are sRGB.
N = 256
Y, X = (np.mgrid[0:N, 0:N] + 0.5) / N          # Y = v (up), X = u
rng = np.random.default_rng(1936)              # seeded; the cathedral's completion year [S1]
grain = rng.normal(0.0, 1.0, (N, N, 1))


def wall_pattern():
    """[S3] painted concrete walls with faint block joints: 0.5 m courses, 1 m blocks, running bond (2 m tile)."""
    row = np.floor(Y * 4)
    bx, by = (X * 2 + (row % 2) * 0.5) % 1.0, (Y * 4) % 1.0
    joint = (np.minimum(bx, 1 - bx) < 0.010) | (np.minimum(by, 1 - by) < 0.018)
    block = 1 + 0.012 * np.sin(np.floor(X * 2 + (row % 2) * 0.5) * 12.9898 + row * 78.233)
    shade = block[..., None] * (1 + 0.010 * grain) * np.where(joint, 0.88, 1.0)[..., None]
    return np.array([0.925, 0.925, 0.910]) * shade


def corrugated_pattern():
    """[S3] red metal roofing: 8 ribs per 1 m tile, running down the slope, light weathering."""
    rib = 0.90 + 0.14 * np.sin(2 * np.pi * 8 * X)
    return np.array([0.77, 0.16, 0.14]) * (rib[..., None] * (1 + 0.025 * grain))


def scale_pattern():
    """[S3] the spires' fish-scale shingles: 6 rows x 6 scales per 1.5 m tile, alternate rows offset."""
    row = np.floor(Y * 6)
    cx = (X * 6 + (row % 2) * 0.5) % 1.0 - 0.5
    cy = (Y * 6) % 1.0
    edge = 0.42 - 0.42 * np.sqrt(np.clip(1 - (2 * cx) ** 2, 0, 1))      # scalloped lower edge
    t = np.clip((cy - edge) / (1 - edge + 1e-6), 0, 1)
    shade = np.where(cy >= edge, 1.06 - 0.24 * t, 0.70)                   # lit lower lip, shadowed top
    shade = np.where(np.abs(cy - edge) < 0.035, 0.52, shade)              # the gap between scales
    col = np.floor(X * 6 + (row % 2) * 0.5) % 6
    tint = 1 + 0.05 * np.sin(col * 12.9898 + row * 78.233)
    return np.array([0.78, 0.17, 0.15]) * ((shade * tint)[..., None] * (1 + 0.02 * grain))


WALL = textured("MAT_cathedral_wall", pattern_image("TEX_cathedral_wall", wall_pattern()), srgb(236, 236, 232), 0.85)
ROOF = textured("MAT_cathedral_roof", pattern_image("TEX_cathedral_roof", corrugated_pattern()), srgb(196, 42, 36), 0.55)
SCALES = textured("MAT_cathedral_spire", pattern_image("TEX_cathedral_spire", scale_pattern()), srgb(190, 40, 34), 0.6)
TILE = {WALL.name: 2.0, ROOF.name: 1.0, SCALES.name: 1.5}   # metres per texture repeat

def P(a, w, z):
    return (a * U[0] + w * V[0], a * U[1] + w * V[1], z)


def mesh(name, verts, faces, mat, uv="aw"):
    """Faces in building coordinates (a, w, z). Textured materials get box-mapped UVs in the building
    frame at TILE[mat] metres per repeat: on roofs, uv="aw" runs the ribs down a ridge laid along a,
    uv="wa" for a ridge laid along w; on walls and spires, v is height, so pattern rows stay level."""
    bm = bmesh.new()
    vs = [bm.verts.new(P(*v)) for v in verts]
    for f in faces:
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    tile = TILE.get(mat.name)
    if tile:
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
    coll.objects.link(ob)
    return ob


def hexa(name, bottom, top, mat, uv="aw"):
    """Closed solid from 4 bottom and 4 top (a, w, z) corners in matching order."""
    return mesh(name, bottom + top, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, uv)


def box(name, a0, a1, w0, w1, z0, z1, mat):
    return hexa(name, [(a0, w0, z0), (a1, w0, z0), (a1, w1, z0), (a0, w1, z0)],
                [(a0, w0, z1), (a1, w0, z1), (a1, w1, z1), (a0, w1, z1)], mat)


def prism(name, pts, z0, z1, mat):
    """Vertical prism over a polygon of (a, w) points."""
    n = len(pts)
    verts = [(a, w, z0) for a, w in pts] + [(a, w, z1) for a, w in pts]
    faces = [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mesh(name, verts, faces, mat)


def gable_along_a(name, a0, a1, w0, w1, ze, mat):
    wm, zr = (w0 + w1) / 2, ze + (w1 - w0) / 2 * PITCH
    verts = [(a0, w0, ze), (a1, w0, ze), (a1, w1, ze), (a0, w1, ze), (a0, wm, zr), (a1, wm, zr)]
    return mesh(name, verts, [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 3, 4), (1, 2, 5)], mat), zr


def gable_along_w(name, a0, a1, w0, w1, ze, mat):
    am, zr = (a0 + a1) / 2, ze + (a1 - a0) / 2 * PITCH
    verts = [(a0, w0, ze), (a0, w1, ze), (a1, w1, ze), (a1, w0, ze), (am, w0, zr), (am, w1, zr)]
    return mesh(name, verts, [(0, 1, 2, 3), (0, 1, 5, 4), (3, 2, 5, 4), (0, 3, 4), (1, 2, 5)], mat, uv="wa"), zr


def gable_wall(name, a0, a1, w0, w1, ze, zr, mat):
    """Triangular wall filling a gable end, thickness a0..a1."""
    wm = (w0 + w1) / 2
    return mesh(name, [(a0, w0, ze), (a0, w1, ze), (a0, wm, zr), (a1, w0, ze), (a1, w1, ze), (a1, wm, zr)],
                [(0, 1, 2), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], mat)


def pyramid(name, ac, wc, half, z0, z1, mat):
    verts = [(ac - half, wc - half, z0), (ac + half, wc - half, z0), (ac + half, wc + half, z0), (ac - half, wc + half, z0), (ac, wc, z1)]
    return mesh(name, verts, [(0, 1, 2, 3), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], mat)


def cone(name, ac, wc, r, z0, z1, mat, seg=8):
    ring = [(ac + r * math.cos(2 * math.pi * i / seg), wc + r * math.sin(2 * math.pi * i / seg), z0) for i in range(seg)]
    return mesh(name, ring + [(ac, wc, z1)], [tuple(range(seg))] + [(i, (i + 1) % seg, seg) for i in range(seg)], mat)


def disc(name, axis, at, c1, c2, r, depth, mat, seg=16):
    """Thin cylinder on a wall: axis 'a' (wall faces along a, centre w=c1, z=c2) or 'w' (centre a=c1, z=c2)."""
    ring = [(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
    if axis == "a":
        verts = [(at, c1 + x, c2 + y) for x, y in ring] + [(at - depth, c1 + x, c2 + y) for x, y in ring]
    else:
        verts = [(c1 + x, at, c2 + y) for x, y in ring] + [(c1 + x, at - depth, c2 + y) for x, y in ring]
    faces = [tuple(range(seg)), tuple(range(seg, 2 * seg))] + [(i, (i + 1) % seg, seg + (i + 1) % seg, seg + i) for i in range(seg)]
    return mesh(name, verts, faces, mat)


def arch_panel(name, axis, at, c, width, z0, z1, depth, mat):
    """Pointed-arch opening as a thin pentagonal prism on a wall facing along `axis`."""
    h = width / 2
    pts = [(c - h, z0), (c + h, z0), (c + h, z1 - h), (c, z1), (c - h, z1 - h)]
    if axis == "a":
        verts = [(at, x, z) for x, z in pts] + [(at - depth, x, z) for x, z in pts]
    else:
        verts = [(x, at, z) for x, z in pts] + [(x, at - depth, z) for x, z in pts]
    return mesh(name, verts, [(0, 1, 2, 3, 4), (5, 6, 7, 8, 9)] + [(i, (i + 1) % 5, 5 + (i + 1) % 5, 5 + i) for i in range(5)], mat)


depth = lm.foundation(coll, fp, TRIM)   # a grey plinth where the hill falls away

# Nave [S2]: a -23.1..15.0, w -8.8..9.2; eave 11 m, ridge from the 38° pitch (ESTIMATE)
EAVE = 11.0
box("nave", -23.1, 15.0, -8.8, 9.2, 0.0, EAVE, WALL)
_, nave_ridge = gable_along_a("nave_roof", -22.9, 15.4, -9.3, 9.7, EAVE, ROOF)
gable_wall("facade_gable", -23.3, -22.9, -8.8, 9.2, EAVE, nave_ridge - 0.2, WALL)
gable_wall("rear_gable", 15.0, 15.4, -8.8, 9.2, EAVE, nave_ridge - 0.2, WALL)
box("eave_trim_w", -23.1, 15.0, -9.0, -8.8, EAVE - 0.5, EAVE, TRIM)
box("eave_trim_e", -23.1, 15.0, 9.2, 9.4, EAVE - 0.5, EAVE, TRIM)

# Transept [S2]: a 5.1..15.0, w -12.9..12.3; same eave, ridge from the pitch
box("transept", 5.1, 15.0, -12.9, 12.3, 0.0, EAVE, WALL)
_, tr_ridge = gable_along_w("transept_roof", 4.7, 15.4, -13.3, 12.7, EAVE, ROOF)
for side, w0, w1, wc in (("w", -13.1, -12.9, -12.9), ("e", 12.3, 12.5, 12.3)):
    mesh(f"transept_gable_{side}", [(5.1, w0, EAVE), (15.0, w0, EAVE), (10.05, w0, tr_ridge - 0.2), (5.1, w1, EAVE), (15.0, w1, EAVE), (10.05, w1, tr_ridge - 0.2)],
         [(0, 1, 2), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], WALL)
    disc(f"transept_rose_{side}", "w", wc + (0.15 if side == "e" else -0.15), 10.05, 8.2, 1.3, 0.2, TRIM)

# Apse [S2]: rounded end to a 27.8, width 10.4; wall 9 m, half-cone roof (ESTIMATE)
AC, AW, AR = 22.6, -0.1, 5.2
half = [(AC + AR * math.cos(t), AW + AR * math.sin(t)) for t in [math.radians(-90 + 15 * i) for i in range(13)]]
prism("apse", [(15.0, AW - AR), *half, (15.0, AW + AR)], 0.0, 9.0, WALL)
_, apse_ridge = gable_along_a("apse_roof", 15.0, AC, AW - AR - 0.4, AW + AR + 0.4, 9.0, ROOF)
ring = [(AC + (AR + 0.4) * math.cos(t), AW + (AR + 0.4) * math.sin(t), 9.0) for t in [math.radians(-90 + 15 * i) for i in range(13)]]
mesh("apse_roof_cone", ring + [(AC, AW, apse_ridge)], [(i, i + 1, 13) for i in range(12)] + [(0, 12, 13)], ROOF)

# Porch [S2]: a -25.5..-23.1, w -4.3..4.5; 5 m with a red lean-to (ESTIMATE)
box("porch", -25.5, -23.1, -4.3, 4.5, 0.0, 5.0, WALL)
hexa("porch_roof", [(-25.9, -4.7, 4.6), (-23.1, -4.7, 5.8), (-23.1, 4.9, 5.8), (-25.9, 4.9, 4.6)],
     [(-25.9, -4.7, 4.85), (-23.1, -4.7, 6.05), (-23.1, 4.9, 6.05), (-25.9, 4.9, 4.85)], ROOF, uv="wa")
arch_panel("porch_door", "a", -25.45, 0.1, 2.6, 0.0, 3.8, 0.15, DARK)

# Façade [S3]: rose window, cross at the apex, statue niche, flanking arched windows
disc("facade_rose", "a", -23.35, 0.2, 13.0, 1.5, 0.2, TRIM)
disc("facade_rose_inner", "a", -23.45, 0.2, 13.0, 0.9, 0.1, DARK)
box("cross_v", -23.3, -23.0, 0.08, 0.32, nave_ridge - 0.3, nave_ridge + 2.2, WALL)
box("cross_h", -23.3, -23.0, -0.45, 0.85, nave_ridge + 1.1, nave_ridge + 1.38, WALL)
box("niche", -23.25, -23.05, -0.6, 1.0, 6.4, 8.6, DARK)
box("statue", -23.35, -23.15, -0.25, 0.65, 6.6, 8.3, ROBE)
for w in (-2.6, 3.0):
    arch_panel(f"facade_window_{w:+.0f}", "a", -23.15, w, 1.3, 6.0, 9.8, 0.12, DARK)

# Nave side windows [S3: arched openings], between the towers and the transept
for a in (-16.5, -12.3, -8.1, -3.9, 0.3):
    arch_panel(f"side_window_w_{a:+.0f}", "w", -8.85, a, 1.2, 4.0, 8.6, 0.12, DARK)
    arch_panel(f"side_window_e_{a:+.0f}", "w", 9.33, a, 1.2, 4.0, 8.6, 0.12, DARK)

# Towers [S2 positions; ESTIMATE heights]: 5 m squares at the façade corners
SHAFT, BAL, SPIRE = 20.0, 1.2, 12.0
for name, wc, clock in (("west", -6.3, True), ("east", 6.7, False)):
    ac, h = -20.6, 2.5
    box(f"tower_{name}", ac - h, ac + h, wc - h, wc + h, 0.0, SHAFT, WALL)
    box(f"tower_{name}_plinth", ac - h - 0.15, ac + h + 0.15, wc - h - 0.15, wc + h + 0.15, 0.0, 1.2, TRIM)
    box(f"tower_{name}_cornice", ac - h - 0.15, ac + h + 0.15, wc - h - 0.15, wc + h + 0.15, SHAFT - 0.45, SHAFT, TRIM)
    for i, (a0, a1, w0, w1) in enumerate(((ac - h, ac + h, wc - h, wc - h + 0.25), (ac - h, ac + h, wc + h - 0.25, wc + h),
                                          (ac - h, ac - h + 0.25, wc - h, wc + h), (ac + h - 0.25, ac + h, wc - h, wc + h))):
        box(f"tower_{name}_balustrade_{i}", a0, a1, w0, w1, SHAFT, SHAFT + BAL, WALL)
    for i, (pa, pw) in enumerate(((ac - h, wc - h), (ac - h, wc + h), (ac + h, wc - h), (ac + h, wc + h))):
        box(f"tower_{name}_pinnacle_{i}", pa - 0.2, pa + 0.2, pw - 0.2, pw + 0.2, SHAFT, SHAFT + BAL + 0.5, WALL)
        cone(f"tower_{name}_cap_{i}", pa, pw, 0.3, SHAFT + BAL + 0.5, SHAFT + BAL + 1.6, CAP)
    pyramid(f"tower_{name}_spire", ac, wc, h - 0.3, SHAFT, SHAFT + BAL + SPIRE, SCALES)
    box(f"tower_{name}_finial", ac - 0.08, ac + 0.08, wc - 0.08, wc + 0.08, SHAFT + BAL + SPIRE - 0.3, SHAFT + BAL + SPIRE + 1.6, TRIM)
    box(f"tower_{name}_finial_bar", ac - 0.06, ac + 0.06, wc - 0.35, wc + 0.35, SHAFT + BAL + SPIRE + 1.0, SHAFT + BAL + SPIRE + 1.15, TRIM)
    for z in (6.0, 11.0):  # [S3] horizontal bands
        box(f"tower_{name}_band_{z:.0f}", ac - h - 0.12, ac + h + 0.12, wc - h - 0.12, wc + h + 0.12, z, z + 0.3, TRIM)
    for i, (pa, pw) in enumerate(((ac - h, wc - h), (ac - h, wc + h), (ac + h, wc - h), (ac + h, wc + h))):  # corner pilasters
        box(f"tower_{name}_corner_{i}", pa - 0.28, pa + 0.28, pw - 0.28, pw + 0.28, 1.2, SHAFT - 0.45, TRIM)
    out_w = (wc - h) if name == "west" else (wc + h)
    for k, z in enumerate((12.9, 13.6, 14.3, 15.0)):  # louvre slats over the belfry openings
        box(f"tower_{name}_slat_front_{k}", ac - h - 0.2, ac - h - 0.1, wc - 0.75, wc + 0.75, z, z + 0.12, TRIM)
        w0, w1 = (out_w - 0.2, out_w - 0.1) if name == "west" else (out_w + 0.1, out_w + 0.2)
        box(f"tower_{name}_slat_out_{k}", ac - 0.75, ac + 0.75, w0, w1, z, z + 0.12, TRIM)
    # belfry louvres on all four faces, and a lower slit
    arch_panel(f"tower_{name}_louvre_front", "a", ac - h - 0.02, wc, 1.7, 12.5, 16.2, 0.12, DARK)
    arch_panel(f"tower_{name}_louvre_back", "a", ac + h + 0.12, wc, 1.7, 12.5, 16.2, 0.12, DARK)
    arch_panel(f"tower_{name}_louvre_out", "w", (wc - h - 0.02) if name == "west" else (wc + h + 0.12), ac, 1.7, 12.5, 16.2, 0.12, DARK)
    arch_panel(f"tower_{name}_slit_front", "a", ac - h - 0.02, wc, 0.8, 6.0, 8.8, 0.1, DARK)
    # [S3] clock on the west tower's front; rose windows on the other front and the outer faces
    disc(f"tower_{name}_front_ring", "a", ac - h - 0.02, wc, 18.0, 1.05, 0.12, TRIM)
    if clock:
        disc(f"tower_{name}_clock_face", "a", ac - h - 0.1, wc, 18.0, 0.85, 0.08, WALL)
    else:
        disc(f"tower_{name}_rose_inner", "a", ac - h - 0.1, wc, 18.0, 0.6, 0.08, DARK)
    disc(f"tower_{name}_side_rose", "w", (wc - h - 0.02) if name == "west" else (wc + h + 0.12), ac, 18.0, 1.0, 0.12, TRIM)


# Detail [S3]: plinth, string course and pilasters along the nave; ridge caps; rose-window tracery
for side, (f0, f1), (p0, p1) in (("w", (-8.95, -8.8), (-9.15, -8.8)), ("e", (9.2, 9.35), (9.2, 9.55))):
    box(f"plinth_{side}", -23.1, 15.0, f0, f1, 0.0, 0.9, TRIM)
    box(f"string_course_{side}", -23.1, 15.0, f0, f1, 9.7, 10.0, TRIM)
    for a in (-18.6, -14.4, -10.2, -6.0, -1.8, 2.4):
        box(f"pilaster_{side}_{a:+.0f}", a - 0.35, a + 0.35, p0, p1, 0.0, 10.4, TRIM)
box("nave_ridge_cap", -22.9, 15.4, 0.02, 0.38, nave_ridge - 0.05, nave_ridge + 0.18, RIDGE)
box("transept_ridge_cap", 9.87, 10.23, -13.3, 12.7, tr_ridge - 0.05, tr_ridge + 0.18, RIDGE)
for k in range(6):  # six spokes over the façade rose window
    t = math.pi * k / 6
    da, dz = 1.35 * math.cos(t), 1.35 * math.sin(t)
    pa, pz = 0.07 * -math.sin(t), 0.07 * math.cos(t)
    corners = [(0.2 - da - pa, 13.0 - dz - pz), (0.2 + da - pa, 13.0 + dz - pz), (0.2 + da + pa, 13.0 + dz + pz), (0.2 - da + pa, 13.0 - dz + pz)]
    hexa(f"rose_spoke_{k}", [(-23.62, w, z) for w, z in corners], [(-23.52, w, z) for w, z in corners], WALL)
disc("rose_hub", "a", -23.6, 0.2, 13.0, 0.32, 0.1, WALL)

front = P(-34.0, 0.2, 0.0)
lm.human_reference(coll, front[0], front[1])
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
