"""A district of detailed buildings (owner 2026-10-07: Session Road's "colorful apartments, fine-dining and fast food
restaurants", and the city's hotels), from model/data/landmarks/<slug>/district.json (model/scripts/district_osm.py):
- walls on each building's OSM outline, from below its lowest ground to its height (OSM's, else an ESTIMATE), in a
  facade texture (model/scripts/district_textures.py: apartment, commercial or hotel bays) tinted by the building's
  paint, a vertex colour, so every building shares three materials;
- on the street side: shopfronts on the ground storey, and above them the tenants' signs (the district's sign atlas:
  each name in its colours, plain lettering); balconies on flats and hotels; a hotel's name on a board on its parapet
  and a canopy over its entrance;
- flat roofs behind a 0.9 m parapet, with water tanks on stands; the roof itself shows the satellite photograph in the
  app (a material named *_roof_photo, components/map/layers/imageryAtlas.ts).
Dimensions are ESTIMATEs (model/landmarks/session-road-buildings.md, hotels.md).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/district.py -- <slug>"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = sys.argv[sys.argv.index("--") + 1]
coll, fp = lm.begin(SLUG)
D = lm.ROOT / "model" / "data" / "landmarks" / SLUG
DIST = json.loads((D / "district.json").read_text())
CELLS = json.loads((D / "signs.json").read_text())
KEY = SLUG.replace("-", "_")
BAY, STOREY, SHOP_H, PARAPET = 3.4, 3.2, 3.6, 0.9
PAINT = [(236, 232, 222), (232, 220, 190), (230, 160, 130), (160, 208, 180), (150, 188, 222), (242, 212, 120),
         (196, 112, 82), (190, 170, 212), (172, 192, 142), (242, 190, 150), (186, 186, 182), (96, 160, 160)]   # district_osm.PAINT
TRIM, RAIL, CANOPY = (240, 238, 232), (52, 54, 58), (246, 246, 242)
TANKS = [(40, 96, 176), (34, 34, 36), (226, 226, 222)]                                             # plastic water tanks


def image(path):
    img = bpy.data.images.load(str(path), check_existing=True)
    img.pack()
    return img


def tinted(name, img):
    """A texture multiplied by the vertex colour "Col" (exported as baseColorTexture x COLOR_0)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.85
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    if img is None:
        nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mix.inputs[6])
        nt.links.new(vc.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    mat.diffuse_color = (0.8, 0.78, 0.72, 1.0)
    return mat


FACADE = {k: tinted(f"MAT_{KEY}_facade_{k}", image(lm.ROOT / "model" / "data" / "district" / f"facade_{k}.png"))
          for k in ("apartment", "commercial", "hotel")}
SHOP = lm.textured(f"MAT_{KEY}_shopfront", image(lm.ROOT / "model" / "data" / "district" / "shopfront.png"), lm.srgb(90, 98, 108), 0.4)
SIGNS = lm.textured(f"MAT_{KEY}_signs", image(D / "signs.png"), lm.srgb(200, 60, 50), 0.6)
PAINTED = tinted(f"MAT_{KEY}_paint", None)                  # trim, parapets, balconies, rails, tanks, canopies
ROOF = lm.material(f"MAT_{KEY}_roof_photo", lm.srgb(150, 146, 140), 0.9)   # the app drapes the photograph on it


class Batch:
    """Faces for one material: vertices with a colour each, loops with UVs."""

    def __init__(self, mat):
        self.mat, self.v, self.c, self.f, self.uv = mat, [], [], [], []

    def poly(self, pts, colour, uvs=None):
        k = len(self.v)
        self.v += [tuple(map(float, p)) for p in pts]
        self.c += [colour] * len(pts)
        self.f.append(tuple(range(k, k + len(pts))))
        self.uv += uvs or [(0.0, 0.0)] * len(pts)

    def box(self, c, d, n, half_a, half_n, z0, z1, colour):
        """A box centred on c (x, y), half_a along unit d, half_n along unit n, from z0 to z1."""
        if d[0] * n[1] - d[1] * n[0] < 0:                 # keep d x n up, so the faces wind outward
            n = (-n[0], -n[1])
        P = lambda a, b, z: (c[0] + d[0] * a + n[0] * b, c[1] + d[1] * a + n[1] * b, z)
        corners = [(-half_a, -half_n), (half_a, -half_n), (half_a, half_n), (-half_a, half_n)]
        bot = [P(a, b, z0) for a, b in corners]
        top = [P(a, b, z1) for a, b in corners]
        self.poly(top, colour)
        for i in range(4):
            j = (i + 1) % 4
            self.poly([bot[i], bot[j], top[j], top[i]], colour)   # faces whose winding gives outward normals for d x n = up
        self.poly(list(reversed(bot)), colour)

    def build(self, name):
        if not self.f:
            return
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        lin = np.array([lm.srgb(*c) for c in self.c], np.float32)
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        attr.data.foreach_set("color", np.column_stack([lin, np.ones(len(lin), np.float32)]).ravel())
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", np.array([self.uv[i] for f in self.f for i in f], np.float32).ravel())
        me.materials.append(self.mat)
        coll.objects.link(bpy.data.objects.new(name, me))


B = {k: Batch(m) for k, m in [("apartment", FACADE["apartment"]), ("commercial", FACADE["commercial"]), ("hotel", FACADE["hotel"]),
                               ("shop", SHOP), ("signs", SIGNS), ("paint", PAINTED), ("roof", ROOF)]}
shade = lambda rgb, k: tuple(min(255, round(c * k)) for c in rgb)


def cap(ring, z):
    """The roof: the outline at z, triangulated (concave outlines too)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in ring]
    try:
        f = bm.faces.new(vs)
    except ValueError:
        bm.free()
        return
    bmesh.ops.triangulate(bm, faces=[f], quad_method="BEAUTY", ngon_method="BEAUTY")
    for t in bm.faces:
        B["roof"].poly([tuple(v.co) for v in t.verts], (150, 146, 140))
    bm.free()


def sign_uv(cell):
    cols, rows = CELLS["cols"], CELLS["rows"]
    c, r = cell % cols, cell // cols
    u0, u1, v0, v1 = c / cols, (c + 1) / cols, 1 - (r + 1) / rows, 1 - r / rows
    return [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]


lowest = float("inf")                                   # the lowest base (it may sit above the anchor's ground)
stats = {"buildings": 0, "signs": 0, "balconies": 0, "tanks": 0}
rng = np.random.default_rng(1909)
for bi, b in enumerate(DIST["buildings"]):
    ring = [tuple(p) for p in b["ring"]]
    n_ = len(ring)
    if n_ < 3:
        continue
    g = lm.rel_ground(fp, ring)
    glow = lm.rel_ground(fp, ring, low=True)
    front = set(b["front"])
    if not front:                                       # no street found: the longest side is the front
        front = {max(range(n_), key=lambda i: math.dist(ring[i], ring[(i + 1) % n_]))}
    mids = [((ring[i][0] + ring[(i + 1) % n_][0]) / 2, (ring[i][1] + ring[(i + 1) % n_][1]) / 2) for i in range(n_)]
    gm = lm.rel_ground(fp, mids)
    floor0 = max(gm[i] for i in front) if front else max(g)                      # the street's level
    top = max(floor0 + b["height"], max(g) + 3.0)
    base = min(glow) - 1.0
    lowest = min(lowest, base)
    paint = PAINT[b["paint"] % len(PAINT)]
    kind = b["kind"] if b["kind"] in FACADE else "commercial"
    shop = b.get("shopfront") and front
    for i in range(n_):
        a, c = np.array(ring[i]), np.array(ring[(i + 1) % n_])
        d = c - a
        L = float(np.linalg.norm(d))
        if L < 0.3:
            continue
        nb = max(1, round(L / BAY))
        quad = lambda z0, z1: [(a[0], a[1], z0), (c[0], c[1], z0), (c[0], c[1], z1), (a[0], a[1], z1)]
        if shop and i in front:
            B["paint"].poly(quad(base, floor0), shade(paint, 0.8))
            B["shop"].poly(quad(floor0, floor0 + SHOP_H), (255, 255, 255), [(0, 0), (nb, 0), (nb, 1), (0, 1)])
            v0, v1 = 0.0, (top - floor0 - SHOP_H) / STOREY
            if top > floor0 + SHOP_H + 0.5:
                B[kind].poly(quad(floor0 + SHOP_H, top), paint, [(0, v0), (nb, v0), (nb, v1), (0, v1)])
        else:
            v0, v1 = (base - floor0) / STOREY, (top - floor0) / STOREY
            B[kind].poly(quad(base, top), paint, [(0, v0), (nb, v0), (nb, v1), (0, v1)])
        B["paint"].poly(quad(top, top + PARAPET), shade(paint, 0.92))
        B["paint"].poly(list(reversed(quad(top, top + PARAPET))), shade(paint, 0.8))   # the parapet's inner face
    cap(ring, top)
    stats["buildings"] += 1
    # the street side: signs over the shops, balconies above, a hotel's board and canopy
    fronts = sorted(front, key=lambda i: -math.dist(ring[i], ring[(i + 1) % n_]))
    signs = list(enumerate(b.get("signs", [])))
    for i in fronts:
        a, c = np.array(ring[i]), np.array(ring[(i + 1) % n_])
        L = float(np.linalg.norm(c - a))
        d = (c - a) / max(L, 1e-9)
        nrm = np.array((d[1], -d[0]))
        if b["kind"] != "hotel":
            s_ = 0.5
            while signs and s_ + 3.8 <= L - 0.3:
                j, s = signs.pop(0)
                cell = CELLS["cells"].get(f"{b['id']}#{j}")
                if cell is None:
                    continue
                p0, p1 = a + d * s_ + nrm * 0.3, a + d * (s_ + 3.8) + nrm * 0.3
                z0 = floor0 + SHOP_H + 0.1
                B["signs"].poly([(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z0 + 0.95), (p0[0], p0[1], z0 + 0.95)],
                                (255, 255, 255), sign_uv(cell))
                B["paint"].box(((p0 + p1) / 2 - nrm * 0.15), d, nrm, 1.95, 0.14, z0 - 0.05, z0 + 1.0, (60, 62, 66))   # the sign's box
                stats["signs"] += 1
                s_ += 4.2
        if b["kind"] in ("apartment", "hotel"):                               # balconies every other bay, storeys above the street
            nb, made = max(1, round(L / BAY)), 0
            for s in range(1, b["levels"]):                                   # each storey above the street's (or the shops')
                z = floor0 + SHOP_H + (s - 1) * STOREY if shop else floor0 + s * STOREY
                if z + 1.0 > top:
                    break
                for k in range(s % 2, nb, 2):
                    if made >= 40:                                            # a building's cap (triangle budget)
                        break
                    made += 1
                    cb = a + d * (L / nb) * (k + 0.5) + nrm * 0.55
                    hw = min(1.3, L / nb / 2 - 0.3)
                    if hw < 0.6:
                        continue
                    B["paint"].box(cb, d, nrm, hw, 0.55, z - 0.12, z + 0.05, shade(paint, 0.9))   # the slab in the wall's paint
                    B["paint"].box(cb + nrm * 0.52, d, nrm, hw, 0.03, z + 0.05, z + 1.0, RAIL)
                    stats["balconies"] += 1
        if b["kind"] == "hotel" and i == fronts[0]:
            cell = CELLS["cells"].get(f"{b['id']}#0")
            if cell is not None:                                              # the name on a board on the parapet
                w = min(L - 1.0, 1.2 + 0.55 * len(b.get("hotel") or ""), 16.0)
                if w > 3.0:
                    mid = (a + c) / 2
                    p0, p1 = mid - d * w / 2 + nrm * 0.15, mid + d * w / 2 + nrm * 0.15
                    h = w / 4
                    z0 = top + PARAPET
                    B["signs"].poly([(p0[0], p0[1], z0), (p1[0], p1[1], z0), (p1[0], p1[1], z0 + h), (p0[0], p0[1], z0 + h)],
                                    (255, 255, 255), sign_uv(cell))
                    B["paint"].box(mid - nrm * 0.05, d, nrm, w / 2, 0.1, z0 - 0.1, z0 + h, RAIL)
                    stats["signs"] += 1
            mid = (a + c) / 2 + nrm * 1.4                                     # the entrance canopy, on two posts
            B["paint"].box(mid, d, nrm, min(2.5, L / 2 - 0.5), 1.4, floor0 + 3.0, floor0 + 3.25, CANOPY)
            for side in (-1, 1):
                B["paint"].box(mid + d * side * (min(2.5, L / 2 - 0.5) - 0.2) + nrm * 1.2, d, nrm, 0.08, 0.08, floor0, floor0 + 3.0, RAIL)
    # water tanks on the roof, on stands
    area = 0.5 * abs(sum(ring[i][0] * ring[(i + 1) % n_][1] - ring[(i + 1) % n_][0] * ring[i][1] for i in range(n_)))
    cx, cy = np.mean(ring, axis=0)
    for k in range(1 if area < 300 else 2):
        tx, ty = cx + rng.uniform(-2, 2), cy + rng.uniform(-2, 2)
        if not lm.inside(ring, tx, ty):
            continue
        colour = TANKS[(bi + k) % 3]
        B["paint"].box((tx, ty), (1, 0), (0, 1), 0.8, 0.8, top, top + 1.2, (110, 112, 116))
        seg = 8
        zt0, zt1 = top + 1.2, top + 3.0
        pts = [(tx + 0.7 * math.cos(2 * math.pi * q / seg), ty + 0.7 * math.sin(2 * math.pi * q / seg)) for q in range(seg)]
        for q in range(seg):
            p, r = pts[q], pts[(q + 1) % seg]
            B["paint"].poly([(p[0], p[1], zt0), (r[0], r[1], zt0), (r[0], r[1], zt1), (p[0], p[1], zt1)], colour)
        B["paint"].poly([(x, y, zt1) for x, y in pts], shade(colour, 1.1))
        stats["tanks"] += 1

for k, batch in B.items():
    batch.build(f"{KEY}_{k}")
print("DISTRICT", json.dumps(stats))
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
