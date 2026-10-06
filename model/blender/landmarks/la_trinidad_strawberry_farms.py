"""la-trinidad-strawberry-farms: the La Trinidad strawberry farm's pick-your-own field by its parking: the field
draped over the valley floor in rows of black-mulched beds with strawberry plants, white plastic low tunnels
over a block of rows, the green shade-net fence round it, and the giant strawberry lying on its side by the
parking.
Dimensions: model/landmarks/la-trinidad-strawberry-farms.md ([S2] OSM field and sculpture; the rest are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/la_trinidad_strawberry_farms.py"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "la-trinidad-strawberry-farms"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1960)


def beds():
    """Strawberry beds (2.4 m tile, two beds): 0.9 m of black plastic mulch dotted with plants, 0.3 m soil paths."""
    Y, X, grain = lm._grid()
    v = (Y * 2) % 1.0                            # two beds across the tile
    out = np.where((v < 0.75)[..., None], np.array((0.10, 0.10, 0.11)), np.array((0.42, 0.33, 0.24)))
    plant = (v < 0.75) & ((np.abs(((v * 3) % 1) - 0.5) < 0.22)) & (np.abs(((X * 8) % 1) - 0.5) < 0.3)
    out = np.where(plant[..., None], np.array((0.20, 0.46, 0.18)), out)
    return out * (1 + 0.04 * grain)


FIELD = lm.textured("MAT_strawberry_beds", lm.pattern_image("TEX_strawberry_beds", beds()), srgb(46, 60, 40), 0.8)
TUNNEL = lm.material("MAT_strawberry_tunnel", srgb(232, 236, 236), 0.3)  # [S3] white plastic low tunnels
NET = lm.material("MAT_strawberry_net", srgb(52, 150, 120), 0.8)         # [S3] green shade-net fence
RED = lm.material("MAT_strawberry_red", srgb(206, 40, 44), 0.5)          # [S3] the giant strawberry
LEAF = lm.material("MAT_strawberry_leaf", srgb(46, 96, 72), 0.6)
SEED = lm.material("MAT_strawberry_seed", srgb(236, 204, 64), 0.5)
S = lm.Shapes(coll, 0.0, {FIELD.name: 2.4})
ring = fp["rings"][0]
lowest = lm.drape(S, fp, "field", ring, FIELD, step=6.0, lift=0.2)

# Low tunnels [S3]: white half-cylinders over every second bed in a block of rows, along the rows (bearing 168.5)
F = lm.Shapes(coll, 168.5, {})
aw = [F.xy(x, y, 0)[:2] for x, y in ring]
A0, A1 = min(a for a, w in aw), max(a for a, w in aw)
W0 = min(w for a, w in aw)
k = 0
for wc in np.arange(W0 + 20.0, W0 + 44.0, 2.4):            # ESTIMATE: a 24 m block of tunnels (S3)
    for a0 in np.arange(A0, A1, 10.0):
        a1 = a0 + 10.0
        if not all(lm.inside(ring, *F.P(a, wc, 0)[:2]) for a in (a0, a1)):
            continue
        h = max(lm.rel_ground(fp, [F.P(a, wc + dw, 0)[:2] for a in (a0, a1) for dw in (-0.5, 0.5)])) + 0.2
        segs = 6
        verts = [(a, wc + 0.5 * math.cos(math.pi * j / segs), h + 0.55 * math.sin(math.pi * j / segs)) for a in (a0, a1) for j in range(segs + 1)]
        n = segs + 1
        faces = [(j, j + 1, n + j + 1, n + j) for j in range(segs)] + [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        F.mesh(f"tunnel_{k:03d}", verts, faces, TUNNEL)
        k += 1

# The shade-net fence along the field's edge [S3]: 1.5 m, in pieces of up to 8 m on the ground
for i in range(len(ring)):
    (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % len(ring)]
    L = math.hypot(x1 - x0, y1 - y0)
    for t in np.arange(0.0, L, 8.0):
        t1 = min(t + 8.0, L)
        p0 = (x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L)
        p1 = (x0 + (x1 - x0) * t1 / L, y0 + (y1 - y0) * t1 / L)
        z = lm.rel_ground(fp, [p0, p1])
        S.hexa(f"net_{i:02d}_{t:03.0f}", [(p0[1], p0[0], z[0] - 0.3), (p1[1], p1[0], z[1] - 0.3), (p1[1] + 0.01, p1[0] + 0.04, z[1] - 0.3), (p0[1] + 0.01, p0[0] + 0.04, z[0] - 0.3)],
               [(p0[1], p0[0], z[0] + 1.5), (p1[1], p1[0], z[1] + 1.5), (p1[1] + 0.01, p1[0] + 0.04, z[1] + 1.5), (p0[1] + 0.01, p0[0] + 0.04, z[0] + 1.5)], NET)

# The giant strawberry [S2] way/949726775, lying on its side by the parking [S3]: red, yellow seeds, a green cap
SX, SY = -214.0, -152.3
G = lm.Shapes(coll, 202.2, {})                   # [S2] its long axis
ga, gw, _ = G.xy(SX, SY, 0)
zg = max(lm.rel_ground(fp, [(SX + dx, SY + dy) for dx in (-3, 3) for dy in (-3, 3)])) + 0.1
bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
verts = []
for v in bm.verts:
    x, y, z = v.co
    taper = 1.0 - 0.35 * (x + 1) / 2               # narrower toward the tip (+a)
    verts.append((ga + x * 3.8, gw + y * 2.9 * taper, zg + (z * taper + 1) * 1.45))
faces = [tuple(v.index for v in f.verts) for f in bm.faces]
bm.free()
G.mesh("strawberry", verts, faces, RED)
for j in range(5):                               # the leaf cap: five blades over the back end
    t = 2 * math.pi * j / 5
    G.hexa(f"leaf_{j}", [(ga - 3.9, gw, zg + 1.45), (ga - 3.9, gw, zg + 1.45), (ga - 2.4, gw + 1.9 * math.cos(t) - 0.5 * math.sin(t), zg + 1.45 + 1.9 * math.sin(t) + 0.5 * math.cos(t)),
                                     (ga - 2.4, gw + 1.9 * math.cos(t) + 0.5 * math.sin(t), zg + 1.45 + 1.9 * math.sin(t) - 0.5 * math.cos(t))],
           [(ga - 4.0, gw, zg + 1.45), (ga - 4.0, gw, zg + 1.45), (ga - 2.5, gw + 1.9 * math.cos(t) - 0.5 * math.sin(t), zg + 1.45 + 1.9 * math.sin(t) + 0.5 * math.cos(t)),
            (ga - 2.5, gw + 1.9 * math.cos(t) + 0.5 * math.sin(t), zg + 1.45 + 1.9 * math.sin(t) - 0.5 * math.cos(t))], LEAF)
for j in range(28):                              # seeds over the upper surface
    th, ph = rng.uniform(-0.6, 0.95), rng.uniform(0.15, math.pi - 0.15)
    x, y, z = th, math.cos(ph) * math.sqrt(max(0.0, 1 - th * th)), math.sin(ph) * math.sqrt(max(0.0, 1 - th * th))
    taper = 1.0 - 0.35 * (x + 1) / 2
    sa, sw, sz = ga + x * 3.85, gw + y * 2.95 * taper, zg + (z * taper * 1.02 + 1) * 1.45
    G.box(f"seed_{j:02d}", sa - 0.12, sa + 0.12, sw - 0.07, sw + 0.07, sz - 0.07, sz + 0.07, SEED)

hx, hy = ring[1]
lm.human_reference(coll, hx + 3.0, hy)
print("TUNNELS", k)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
