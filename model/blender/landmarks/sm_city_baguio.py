"""sm-city-baguio: SM City Baguio on Luneta Hill and Sky Ranch beside it.
- The mall: three tiers on its OSM outline, stepping back down the hill's west and north faces (the rice-terrace
  verandas, [S1]), in pale sage-green tiled cladding with dark-grey floor bands, glazed shopfronts along the terraces
  under a covered walkway (the Sunset Terraces, [S3]).
- The main entrance on Luneta Hill Drive: the curved glazed bay wrapped in three dark-grey bands, the entrance canopy,
  and the white sign with the blue SM circle ([S3]).
- The roof: the Sky Park's white tensile-membrane tents on steel columns, lawns and planters, and the green stair core
  with the SM sign ([S3]).
- Sky Ranch ([S1]): the Baguio Eye (45 m wheel, 50 m tall, 24 gondolas), a drop tower, a carousel and a Viking ride.
- Benguet pines on the hill's slopes (ready-made CC0 Kenney).
Dimensions: model/landmarks/sm-city-baguio.md ([S2] OSM outline; heights are ESTIMATEs from [S3] unless cited).
Run: uv run model/scripts/landmark_osm.py insets sm-city-baguio dir=0.975,-0.22 0 10 20; uv run model/scripts/sm_sign.py;
     /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/sm_city_baguio.py"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "sm-city-baguio"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(2003)             # seeded; the mall's opening year [S1]
DATA = lm.ROOT / "model" / "data" / "landmarks" / SLUG


def cladding():
    """Pale sage-green tiled cladding (2 m tile): 1.0 x 0.5 m tiles, stack bond, fine joints, faint per-tile tint [S3]."""
    Y, X, grain = lm._grid()
    joint = (np.minimum((X * 2) % 1, 1 - (X * 2) % 1) < 0.02) | (np.minimum((Y * 4) % 1, 1 - (Y * 4) % 1) < 0.03)
    tint = 1 + 0.025 * np.sin(np.floor(X * 2) * 12.9898 + np.floor(Y * 4) * 78.233)
    return np.array((0.70, 0.76, 0.62)) * np.where(joint, 0.86, tint)[..., None] * (1 + 0.012 * grain)


WALL = lm.textured("MAT_sm_wall", lm.pattern_image("TEX_sm_wall", cladding()), srgb(178, 194, 160), 0.8)
DECK = lm.textured("MAT_sm_deck", lm.pattern_image("TEX_sm_deck", lm.wall_blocks((0.70, 0.69, 0.66))), srgb(180, 178, 170), 0.9)
sign_img = bpy.data.images.load(str(DATA / "sign.png"), check_existing=False)
sign_img.pack()
SIGN = lm.textured("MAT_sm_sign", sign_img, srgb(220, 224, 236), 0.5)
BAND = lm.material("MAT_sm_band", srgb(74, 76, 80), 0.5)          # [S3] dark-grey floor bands and canopies
GLASS = lm.material("MAT_sm_glass", srgb(70, 92, 108), 0.15)      # [S3] glazed bay and shopfronts
RAIL = lm.material("MAT_sm_rail", srgb(200, 204, 206), 0.4)
WHITE = lm.material("MAT_sm_membrane", srgb(244, 244, 240), 0.6)  # [S3] tensile membrane
STEEL = lm.material("MAT_sm_steel", srgb(150, 154, 160), 0.4)
GRASS = lm.material("MAT_sm_grass", srgb(96, 146, 70), 0.95)
PAVE = lm.material("MAT_sm_pave", srgb(176, 168, 156), 0.9)
RED = lm.material("MAT_sm_red", srgb(200, 48, 44), 0.5)
YELLOW = lm.material("MAT_sm_yellow", srgb(236, 184, 48), 0.5)
BLUE = lm.material("MAT_sm_blue", srgb(36, 96, 186), 0.5)
PINES = [lm.asset_mesh("pine_tall_c", 20.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("pine_tall_a", 16.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
BUSH = lm.asset_mesh("bush", 1.4, {"leaf": (70, 118, 60)})
S = lm.Shapes(coll, 0.0, {WALL.name: 2.0, DECK.name: 4.0})   # bearing 0: a = north (y), w = east (x)
lowest = 0.0


def aw(ring):
    return [(y, x) for x, y in ring]


def offset(ring, d):
    """A CCW ring moved d m outward (mitred at each corner, capped at 3 x d for sharp ones)."""
    n, out = len(ring), []
    for i in range(n):
        (x0, y0), (x1, y1), (x2, y2) = ring[i - 1], ring[i], ring[(i + 1) % n]
        e1, e2 = np.array((x1 - x0, y1 - y0)), np.array((x2 - x1, y2 - y1))
        n1 = np.array((e1[1], -e1[0])) / max(np.linalg.norm(e1), 1e-9)
        n2 = np.array((e2[1], -e2[0])) / max(np.linalg.norm(e2), 1e-9)
        m = n1 + n2
        m = m / max(np.linalg.norm(m), 1e-9)
        k = min(3.0, 1.0 / max(np.dot(m, n1), 1e-3))
        out.append((x1 + m[0] * d * k, y1 + m[1] * d * k))
    return out


def band(name, ring, d_in, d_out, z0, z1, mat):
    """A ring band round a CCW outline, from d_in to d_out m outside it (negative = inside), z0 to z1: closed, with no
    cap over the middle (a parapet, a railing, a slab edge)."""
    o, i = offset(ring, d_out), offset(ring, d_in)
    n = len(ring)
    verts = [(y, x, z) for ring_, z in ((o, z0), (o, z1), (i, z0), (i, z1)) for x, y in ring_]
    faces = []
    for j in range(n):
        q = (j + 1) % n
        faces += [(j, q, n + q, n + j), (2 * n + q, 2 * n + j, 3 * n + j, 3 * n + q),       # outer, inner walls
                  (n + j, n + q, 3 * n + q, 3 * n + j), (q, j, 2 * n + j, 2 * n + q)]        # top, bottom
    S.mesh(name, verts, faces, mat)


# --- The mall --------------------------------------------------------------------------------------------------
TIERS = json.loads((DATA / "insets.json").read_text())
T0, T1, T2 = TIERS["0"], TIERS["10"], TIERS["20"]
ENTRY_HINT = (68.0, 40.0)                      # [S2] Luneta Hill Drive, the main entrance's driveway
k = min(range(len(T2)), key=lambda i: math.dist(T2[i], ENTRY_HINT))
p0, p1 = np.array(T2[k]), np.array(T2[(k + 1) % len(T2)])
if np.linalg.norm(p1 - p0) < 20:              # use the longer neighbouring edge
    p0, p1 = np.array(T2[k - 1]), np.array(T2[k])
EF = lm.rel_ground(fp, [tuple((p0 + p1) / 2)])[0] + 0.3        # the entrance floor, on the drive's ground
STOREY = 4.5                                   # ESTIMATE: mall storey (S3: ground floor + two bands to the roof edge)
ROOF = EF + 3 * STOREY
Z1 = EF - 4.0                                  # the upper terrace, one storey below the entrance
Z0 = Z1 - 2 * STOREY                           # the lower terrace
zl = min(lm.rel_ground(fp, T0, low=True)) - 1.0
lowest = min(lowest, zl)
for name, ring, z0, z1 in (("tier_0", T0, zl, Z0), ("tier_1", T1, Z0, Z1), ("tier_2", T2, Z1, ROOF)):
    S.prism(name, aw(ring), z0, z1, WALL, tessellate=True)
S.prism("roof_deck", aw(offset(T2, -0.3)), ROOF, ROOF + 0.05, DECK, tessellate=True)
for name, ring, z in (("band_0", T0, Z0), ("band_1", T1, Z1)):   # [S3] dark-grey slab edges
    band(name, ring, -0.1, 0.25, z - 0.9, z + 0.05, BAND)
band("parapet", T2, -0.3, 0.25, ROOF - 0.9, ROOF + 1.2, BAND)
band("rail_0", T0, -0.3, -0.15, Z0, Z0 + 1.1, RAIL)                 # terrace railings
band("rail_1", T1, -0.3, -0.15, Z1, Z1 + 1.1, RAIL)
for name, ring, z in (("shops_1", T1, Z0), ("shops_2", T2, Z1)):   # [S3] glazed shopfronts on the terraces
    band(name, ring, -0.1, 0.08, z + 0.1, z + 3.4, GLASS)
for name, ring, z in (("walk_roof_1", T1, Z0), ("walk_roof_2", T2, Z1)):   # [S3] the covered walkways over them
    band(name, ring, -0.1, 2.2, z + 3.6, z + 3.85, BAND)

# The main entrance (frame E: a along the facade, w outward, z up)
t = (p1 - p0) / np.linalg.norm(p1 - p0)
E = lm.Shapes(coll, math.degrees(math.atan2(t[0], t[1])), {SIGN.name: 1.0})
ea, ew, _ = E.xy(*((p0 + p1) / 2), 0)


def semi(r, n=10):
    return [(ea + 8.0 + r * math.cos(math.pi * i / n), ew + r * math.sin(math.pi * i / n)) for i in range(n + 1)]


E.prism("entry_glass", semi(9.0), EF, ROOF - 0.6, GLASS)                  # [S3] the curved glazed bay
for j, z in enumerate((EF + STOREY, EF + 2 * STOREY, ROOF - 0.6)):        # [S3] three curved bands round it
    E.prism(f"entry_band_{j}", semi(10.6), z - 0.7, z, BAND)
E.box("canopy", ea - 24.0, ea - 2.0, ew, ew + 9.0, EF + 4.0, EF + 4.4, BAND)   # [S3] the entrance canopy
for ca in (ea - 22.0, ea - 4.0):
    E.box(f"canopy_post_{ca:.0f}", ca - 0.2, ca + 0.2, ew + 8.2, ew + 8.6, EF, EF + 4.0, STEEL)
E.box("doors", ea - 20.0, ea - 6.0, ew, ew + 0.3, EF, EF + 3.2, GLASS)
E.box("sign_panel", ea - 25.0, ea - 3.0, ew, ew + 0.6, ROOF - 6.6, ROOF - 1.2, BAND)
E.mesh("sign", [(ea - 24.6, ew + 0.62, ROOF - 6.2), (ea - 3.4, ew + 0.62, ROOF - 6.2), (ea - 3.4, ew + 0.62, ROOF - 1.6),
                (ea - 24.6, ew + 0.62, ROOF - 1.6)], [(0, 1, 2, 3)], SIGN, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
for j, ca in enumerate(np.arange(ea - 22.0, ea - 2.0, 4.0)):              # planters along the drive
    E.box(f"planter_{j}", ca - 1.6, ca + 1.6, ew + 9.6, ew + 10.8, EF - 0.3, EF + 0.5, BAND)
    E.box(f"planter_bed_{j}", ca - 1.5, ca + 1.5, ew + 9.7, ew + 10.7, EF + 0.5, EF + 0.8, GRASS)

# The roof: the Sky Park's membrane tents along the west, lawns and planters, the stair core with its sign [S3]
cx = np.mean([x for x, y in T2])
tents = []
for gx in np.arange(min(x for x, y in T2) + 9, cx, 17.0):
    for gy in np.arange(min(y for x, y in T2) + 9, max(y for x, y in T2), 17.0):
        if all(lm.inside(T2, gx + dx, gy + dy) for dx in (-9, 9) for dy in (-9, 9)):
            tents.append((gx, gy))
for j, (x, y) in enumerate(tents[:8]):
    S.pyramid(f"tent_{j}", y, x, 7.5, ROOF + 5.0, ROOF + 11.0, WHITE)
    S.cone(f"tent_cap_{j}", y, x, 0.8, ROOF + 10.6, ROOF + 12.2, STEEL, seg=6)
    for dx, dy in ((-7, -7), (7, -7), (7, 7), (-7, 7)):
        S.box(f"tent_post_{j}_{dx}_{dy}", y + dy - 0.15, y + dy + 0.15, x + dx - 0.15, x + dx + 0.15, ROOF, ROOF + 5.0, STEEL)
lawns = [(x, y) for x in np.arange(cx + 4, max(x for x, y in T2) - 8, 14.0) for y in np.arange(min(y for x, y in T2) + 10, max(y for x, y in T2) - 10, 22.0)
         if all(lm.inside(T2, x + dx, y + dy) for dx in (-6, 6) for dy in (-9, 9))]
for j, (x, y) in enumerate(lawns[:10]):
    S.box(f"lawn_{j}", y - 8.0, y + 8.0, x - 5.0, x + 5.0, ROOF, ROOF + 0.35, GRASS)
    for dy in (-6.0, 0.0, 6.0):
        lm.place(coll, f"roof_bush_{j}_{dy:+.0f}", BUSH, x + 4.0, y + dy, ROOF + 0.35, rng.uniform(0, 360), rng.uniform(0.8, 1.2))
core = min(((x, y) for x, y in lawns), key=lambda q: q[1], default=(cx, np.mean([y for x, y in T2])))
S.box("stair_core", core[1] - 30.0, core[1] - 18.0, core[0] - 5.0, core[0] + 5.0, ROOF, ROOF + 6.0, WALL)
S.mesh("core_sign", [(core[1] - 29.5, core[0] - 5.02, ROOF + 2.0), (core[1] - 18.5, core[0] - 5.02, ROOF + 2.0),
                     (core[1] - 18.5, core[0] - 5.02, ROOF + 4.75), (core[1] - 29.5, core[0] - 5.02, ROOF + 4.75)],
       [(0, 3, 2, 1)], SIGN, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])

# --- Sky Ranch [S1]: paving, the Baguio Eye, a drop tower, a carousel, a Viking ride ---------------------------------
SKY = min(fp["rings"], key=len)               # the smaller ring: Sky Ranch's lot
lowest = min(lowest, lm.drape(S, fp, "skyranch_paving", SKY, PAVE, step=6.0, lift=0.2))
sx, sy = np.mean([x for x, y in SKY]), np.mean([y for x, y in SKY])
long_edge = max(zip(SKY, SKY[1:] + SKY[:1]), key=lambda e: math.dist(*e))
h = np.subtract(long_edge[1], long_edge[0]) / math.dist(*long_edge)   # the wheel stands along the lot's long side
n = np.array((-h[1], h[0]))
wx, wy = sx - h[0] * 12.0, sy - h[1] * 12.0
zg = lm.rel_ground(fp, [(wx, wy)])[0] + 0.2
HUB = zg + 27.5                                # [S1] 45 m wheel, 50 m tall: hub 27.5 m up (rim 5 m, gondola clear)
R, G = 22.5, 24                                # [S1] 24 gondolas
P = lambda u, v, z: (wx + h[0] * u + n[0] * v, wy + h[1] * u + n[1] * v, z)
for side in (-1.6, 1.6):
    pts = [P(R * math.cos(2 * math.pi * i / G), side, HUB + R * math.sin(2 * math.pi * i / G)) for i in range(G)]
    for i in range(G):
        S.beam(f"eye_rim_{side:+.0f}_{i:02d}", pts[i], pts[(i + 1) % G], 0.22, STEEL)
    for i in range(0, G, 2):
        S.beam(f"eye_spoke_{side:+.0f}_{i:02d}", P(0, side, HUB), pts[i], 0.08, STEEL)
for i in range(G):
    ang = 2 * math.pi * i / G
    u, z = R * math.cos(ang), HUB + R * math.sin(ang)
    c = P(u, 0, z - 1.8)
    S.beam(f"eye_gondola_{i:02d}", (c[0], c[1], z - 3.1), (c[0], c[1], z - 0.6), 1.05, [RED, YELLOW, BLUE][i % 3])
S.beam("eye_axle", P(0, -2.6, HUB), P(0, 2.6, HUB), 0.6, STEEL)
for side in (-2.6, 2.6):                       # A-frame legs
    for u in (-11.0, 11.0):
        S.beam(f"eye_leg_{side:+.0f}_{u:+.0f}", P(u, side * 2.5, zg - 1.0), P(0, side, HUB), 0.45, STEEL)
S.beam("eye_platform", P(-8.0, 0, zg), P(8.0, 0, zg), 3.0, PAVE)
tx, ty = sx + h[0] * 16.0 + n[0] * 8.0, sy + h[1] * 16.0 + n[1] * 8.0        # drop tower (ESTIMATE 32 m)
tz = lm.rel_ground(fp, [(tx, ty)])[0] + 0.2
S.box("drop_tower", ty - 1.3, ty + 1.3, tx - 1.3, tx + 1.3, tz, tz + 32.0, STEEL)
S.prism("drop_seats", [(ty + 3.2 * math.sin(2 * math.pi * i / 8), tx + 3.2 * math.cos(2 * math.pi * i / 8)) for i in range(8)], tz + 3.0, tz + 4.4, RED)
S.box("drop_top", ty - 2.0, ty + 2.0, tx - 2.0, tx + 2.0, tz + 32.0, tz + 33.5, YELLOW)
qx, qy = sx + h[0] * 2.0 - n[0] * 14.0, sy + h[1] * 2.0 - n[1] * 14.0          # carousel (ESTIMATE r 7 m)
qz = lm.rel_ground(fp, [(qx, qy)])[0] + 0.2
S.prism("carousel_base", [(qy + 7.0 * math.sin(2 * math.pi * i / 12), qx + 7.0 * math.cos(2 * math.pi * i / 12)) for i in range(12)], qz - 0.5, qz + 0.6, PAVE)
S.box("carousel_pole", qy - 0.4, qy + 0.4, qx - 0.4, qx + 0.4, qz + 0.6, qz + 5.0, YELLOW)
S.cone("carousel_roof", qy, qx, 7.4, qz + 4.6, qz + 7.6, RED, seg=12)
vx, vy = sx + h[0] * 22.0 - n[0] * 10.0, sy + h[1] * 22.0 - n[1] * 10.0        # Viking ride (ESTIMATE 12 m frame)
vz = lm.rel_ground(fp, [(vx, vy)])[0] + 0.2
V = lambda u, v, z: (vx + h[0] * u + n[0] * v, vy + h[1] * u + n[1] * v, z)
for v in (-3.0, 3.0):
    for u in (-5.0, 5.0):
        S.beam(f"viking_leg_{u:+.0f}_{v:+.0f}", V(u, v, vz), V(0, v, vz + 12.0), 0.25, BLUE)
S.beam("viking_axle", V(0, -3.2, vz + 12.0), V(0, 3.2, vz + 12.0), 0.3, STEEL)
S.beam("viking_hull", V(-7.0, 0, vz + 3.2), V(7.0, 0, vz + 3.2), 1.4, RED)
S.beam("viking_arm", V(0, 0, vz + 4.5), V(0, 0, vz + 12.0), 0.25, STEEL)

# --- Pines on the hill's slopes round the mall (Luneta Hill's pines, [S1] controversies) --------------------------------
k = 0
for gx in np.arange(-150.0, 120.0, 13.0):
    for gy in np.arange(-130.0, 230.0, 13.0):
        x, y = gx + rng.uniform(-4, 4), gy + rng.uniform(-4, 4)
        d = min(math.dist((x, y), q) for q in T0)
        if lm.inside(T0, x, y) or lm.inside(SKY, x, y) or d > 30.0 or d < 6.0 or x > 40.0 or rng.uniform() < 0.45:
            continue
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"pine_{k:02d}", PINES[k % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        k += 1

lm.human_reference(coll, *((p0 + p1) / 2 + np.array(t) * -12.0))
print("SM", {"entrance floor": round(EF, 1), "roof": round(ROOF, 1), "terraces": (round(Z0, 1), round(Z1, 1)), "tents": len(tents[:8]),
             "lawns": len(lawns[:10]), "pines": k})
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
