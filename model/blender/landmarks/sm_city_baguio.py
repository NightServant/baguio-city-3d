"""sm-city-baguio: SM City Baguio on Luneta Hill and Sky Ranch beside it, after the owner's aerial photos [S4].
- The mall: a grey parking podium and five terrace tiers stepping back down the hill's west face (the rice-terrace
  verandas, [S1]), in lime-green panel cladding. Each terrace has a lime slab edge, a hedge, glazed shopfronts and a
  white canopy over its walkway.
- The main entrance on Luneta Hill Drive: the curved glazed bay with three grey bands, the canopy and the SM sign [S3].
- The roof: a white block at the north end with the SM logo painted on its roof and blue plant, a lime hall on the east,
  and the sky garden between them: a cluster of large membrane tents, medium tents, round lawn beds with trees, white
  umbrellas, hedges along the parapet (owner 2026-10-06: green accents, especially the sky garden).
- Sky Ranch ([S1]): the Baguio Eye (45 m wheel, 50 m tall, 24 gondolas), a drop tower, a carousel and a Viking ride.
- Benguet pines on the hill's slopes (ready-made CC0 Kenney).
Dimensions: model/landmarks/sm-city-baguio.md ([S2] OSM outline; heights are ESTIMATEs from [S3] unless cited).
Run: uv run model/scripts/landmark_osm.py insets sm-city-baguio dir=0.975,-0.22 tol=1.0 0 7 14 21 28 35; uv run model/scripts/sm_sign.py;
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
    """Lime-green panel cladding (2 m tile): 1.0 x 0.5 m panels, stack bond, fine joints, faint per-panel tint [S3, S4]."""
    Y, X, grain = lm._grid()
    joint = (np.minimum((X * 2) % 1, 1 - (X * 2) % 1) < 0.02) | (np.minimum((Y * 4) % 1, 1 - (Y * 4) % 1) < 0.03)
    tint = 1 + 0.025 * np.sin(np.floor(X * 2) * 12.9898 + np.floor(Y * 4) * 78.233)
    return np.array((0.73, 0.83, 0.33)) * np.where(joint, 0.88, tint)[..., None] * (1 + 0.012 * grain)


def parking():
    """The parking podium (6 m tile): grey concrete, two 3 m decks with dark open bays 0.9-2.6 m up, and a pale column
    every 6 m [S4]."""
    Y, X, grain = lm._grid()
    v, u = (Y * 6) % 3.0, X * 6
    out = np.full(X.shape, 0.60) * (1 + 0.02 * grain[..., 0])
    out = np.where((v > 0.9) & (v < 2.6), 0.22, out)
    out = np.where(np.abs(u - 3.0) < 0.45, 0.66, out)
    return np.repeat(out[..., None], 3, axis=2) * np.array((1.0, 1.0, 0.97))


WALL = lm.textured("MAT_sm_wall", lm.pattern_image("TEX_sm_wall", cladding()), srgb(186, 212, 84), 0.8)   # [S4] lime green
PARK = lm.textured("MAT_sm_parking", lm.pattern_image("TEX_sm_parking", parking()), srgb(140, 140, 136), 0.9)
LIME = lm.material("MAT_sm_lime", srgb(176, 206, 62), 0.6)        # [S4] terrace slab edges and parapet
CANOPY = lm.material("MAT_sm_white", srgb(238, 238, 234), 0.5)    # [S4] the terraces' white canopies, the north block
HALLROOF = lm.material("MAT_sm_hallroof", srgb(214, 216, 214), 0.6)
logo_img = bpy.data.images.load(str(DATA / "roof_logo.png"), check_existing=False)
logo_img.pack()
LOGO = lm.textured("MAT_sm_logo", logo_img, srgb(220, 228, 244), 0.6)
DECK = lm.textured("MAT_sm_deck", lm.pattern_image("TEX_sm_deck", lm.wall_blocks((0.70, 0.69, 0.66))), srgb(180, 178, 170), 0.9)
sign_img = bpy.data.images.load(str(DATA / "sign.png"), check_existing=False)
sign_img.pack()
SIGN = lm.textured("MAT_sm_sign", sign_img, srgb(220, 224, 236), 0.5)
BAND = lm.material("MAT_sm_band", srgb(118, 120, 124), 0.5)       # [S3] grey bands round the entrance
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
TREE = lm.asset_mesh("broadleaf", 5.0, {"leafs": (72, 120, 58), "woodBark": (100, 78, 58)})   # garden shade trees
HEDGE = lm.material("MAT_sm_hedge", srgb(64, 112, 52), 0.95)      # owner 2026-10-06: green accents, the sky garden
S = lm.Shapes(coll, 0.0, {WALL.name: 2.0, DECK.name: 4.0, PARK.name: 6.0})   # bearing 0: a = north (y), w = east (x)
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


def ring_dist(pt, ring):
    """Distance from a point to a ring's boundary."""
    a = np.asarray(ring, float)
    b = np.roll(a, -1, axis=0)
    ab = b - a
    t = np.clip(((pt - a) * ab).sum(1) / np.maximum((ab * ab).sum(1), 1e-9), 0, 1)
    return float(np.min(np.linalg.norm(a + ab * t[:, None] - pt, axis=1)))


def stepped(ring, other):
    """Per edge of `ring`: whether it stands clear (> 2 m) of `other`'s boundary, i.e. a terrace lies along it."""
    return [ring_dist((np.asarray(ring[j]) + np.asarray(ring[(j + 1) % len(ring)])) / 2, other) > 2.0 for j in range(len(ring))]


def band(name, ring, d_in, d_out, z0, z1, mat, sides="otbi", keep=None):
    """A ring band round a CCW outline, from d_in to d_out m outside it (negative = inside), z0 to z1, with no cap over
    the middle (a parapet, a slab edge, a canopy). `sides` keeps the outer, top, bottom and inner faces; the hidden
    ones are left out to save triangles. `keep` (per edge) drops the edges where the band doesn't belong."""
    o, i = offset(ring, d_out), offset(ring, d_in)
    n = len(ring)
    verts = [(y, x, z) for ring_, z in ((o, z0), (o, z1), (i, z0), (i, z1)) for x, y in ring_]
    faces = []
    for j in range(n):
        q = (j + 1) % n
        if keep is not None and not keep[j]:
            continue
        faces += [f for c, f in (("o", (j, q, n + q, n + j)), ("i", (2 * n + q, 2 * n + j, 3 * n + j, 3 * n + q)),
                                 ("t", (n + j, n + q, 3 * n + q, 3 * n + j)), ("b", (q, j, 2 * n + j, 2 * n + q))) if c in sides]
    S.mesh(name, verts, faces, mat)


# --- The mall (owner's aerial photos, 2026-10-06, [S4]) -----------------------------------------------------------
def clip(ring, axis, value, keep_above):
    """Sutherland-Hodgman: the part of a ring on one side of x (axis 0) or y (axis 1) = value."""
    inside = lambda q: (q[axis] >= value) if keep_above else (q[axis] <= value)
    out = []
    for q0, q1 in zip(ring, ring[1:] + ring[:1]):
        if inside(q0):
            out.append(q0)
        if inside(q0) != inside(q1):
            t = (value - q0[axis]) / (q1[axis] - q0[axis])
            out.append((q0[0] + (q1[0] - q0[0]) * t, q0[1] + (q1[1] - q0[1]) * t))
    return out


TIERS = json.loads((DATA / "insets.json").read_text())
RINGS = [TIERS[k] for k in ("0", "7", "14", "21", "28", "35")]   # each terrace 7 m back on the downhill side [S4]
TOP = RINGS[-1]
ENTRY_HINT = (68.0, 40.0)                      # [S2] Luneta Hill Drive, the main entrance's driveway
k = min(range(len(TOP)), key=lambda i: math.dist(TOP[i], ENTRY_HINT))
p0, p1 = np.array(TOP[k]), np.array(TOP[(k + 1) % len(TOP)])
if np.linalg.norm(p1 - p0) < 20:              # use the longer neighbouring edge
    p0, p1 = np.array(TOP[k - 1]), np.array(TOP[k])
EF = lm.rel_ground(fp, [tuple((p0 + p1) / 2)])[0] + 0.3        # the entrance floor, on the drive's ground
STOREY = 4.5                                   # ESTIMATE: mall storey (S3: ground floor + two bands to the roof edge)
ROOF = EF + 3 * STOREY
LEVELS = [ROOF - (5 - k) * STOREY for k in range(5)]   # the five terrace floors, one storey apart [S4]
zl = min(lm.rel_ground(fp, RINGS[0], low=True)) - 1.0
lowest = min(lowest, zl)
for k, ring in enumerate(RINGS):              # the podium (parking, [S4]) and five terrace tiers
    S.prism(f"tier_{k}", aw(ring), zl if k == 0 else LEVELS[k - 1], LEVELS[k] if k < 5 else ROOF, PARK if k == 0 else WALL, tessellate=True)
for k, z in enumerate(LEVELS):                # each terrace [S4]: lime slab edge, hedge, shopfronts under a white canopy,
    edge, back = stepped(RINGS[k], RINGS[k + 1]), stepped(RINGS[k + 1], RINGS[k])   # only where the tier steps back
    band(f"fascia_{k}", RINGS[k], -0.1, 0.3, z - 0.8, z + 0.1, LIME, "otb", edge)
    band(f"hedge_{k}", RINGS[k], -1.2, -0.3, z, z + 0.7, HEDGE, "oti", edge)
    band(f"shops_{k}", RINGS[k + 1], -0.1, 0.06, z + 0.1, z + 3.3, GLASS, "o", back)
    band(f"canopy_{k}", RINGS[k + 1], -0.1, 3.2, z + 3.5, z + 3.8, CANOPY, "otb", back)
S.prism("roof_deck", aw(offset(TOP, -0.3)), ROOF, ROOF + 0.05, DECK, tessellate=True)
band("parapet", TOP, -0.3, 0.3, ROOF - 0.8, ROOF + 1.1, LIME, "otbi")
band("hedge_roof", TOP, -1.5, -0.3, ROOF, ROOF + 0.75, HEDGE, "oti")

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
E.box("sign_panel", ea - 25.0, ea - 3.0, ew, ew + 0.6, ROOF - 6.6, ROOF - 1.2, CANOPY)
E.mesh("sign", [(ea - 24.6, ew + 0.62, ROOF - 6.2), (ea - 3.4, ew + 0.62, ROOF - 6.2), (ea - 3.4, ew + 0.62, ROOF - 1.6),
                (ea - 24.6, ew + 0.62, ROOF - 1.6)], [(0, 1, 2, 3)], SIGN, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
for j, ca in enumerate(np.arange(ea - 22.0, ea - 2.0, 4.0)):              # planters along the drive
    E.box(f"planter_{j}", ca - 1.6, ca + 1.6, ew + 9.6, ew + 10.8, EF - 0.3, EF + 0.5, BAND)
    E.box(f"planter_bed_{j}", ca - 1.5, ca + 1.5, ew + 9.7, ew + 10.7, EF + 0.5, EF + 0.8, HEDGE)

# The roof [S4]: a white block at the north end with the SM logo painted on its roof and blue plant on it, a lime hall
# with a pale roof on the east, and between them the sky garden: a cluster of large membrane tents, medium tents, round
# lawn beds each with a tree, and small white umbrellas.
ys = [y for x, y in TOP]
north_y = max(ys) - 48.0
NB = clip(TOP, 1, north_y, True)
S.prism("north_block", aw(NB), ROOF, ROOF + 9.0, CANOPY, tessellate=True)
nbx, nby = np.mean([x for x, y in NB]), np.mean([y for x, y in NB])
S.mesh("roof_logo", [(nby - 11, nbx - 22, ROOF + 9.05), (nby - 11, nbx + 22, ROOF + 9.05), (nby + 11, nbx + 22, ROOF + 9.05),
                     (nby + 11, nbx - 22, ROOF + 9.05)], [(0, 1, 2, 3)], LOGO, uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
for j in range(6):
    ux, uy = nbx - 20 + 8 * j, nby + 15
    if lm.inside(NB, ux, uy):
        S.box(f"roof_unit_{j}", uy - 2.0, uy + 2.0, ux - 3.0, ux + 3.0, ROOF + 9.0, ROOF + 11.0, BLUE)
cxt = np.mean([x for x, y in TOP])
EH = clip(clip(TOP, 0, cxt + 14.0, True), 1, north_y, False)
S.prism("east_hall", aw(EH), ROOF, ROOF + 8.0, WALL, tessellate=True)
S.prism("east_hall_roof", aw(offset(EH, -0.2)), ROOF + 8.0, ROOF + 8.3, HALLROOF, tessellate=True)
G = clip(clip(TOP, 0, cxt + 14.0, False), 1, north_y, False)    # the sky garden
gx, gy = np.mean([x for x, y in G]), np.mean([y for x, y in G])
tents = [(gx + dx, gy + dy, 9.0, 15.0) for dx in (-9.0, 9.0) for dy in (-9.0, 9.0)]   # the big cluster [S4]
tents += [(gx + dx, gy + dy, 6.0, 11.0) for dx, dy in ((-14, -40), (8, -42), (-12, 40), (10, 38))]
for j, (x, y, half, peak) in enumerate(tents):
    if not lm.inside(G, x, y):
        continue
    S.pyramid(f"tent_{j}", y, x, half, ROOF + 6.0, ROOF + peak, WHITE)
    S.cone(f"tent_cap_{j}", y, x, 0.9, ROOF + peak - 0.4, ROOF + peak + 1.4, STEEL, seg=6)
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        S.box(f"tent_post_{j}_{dx}_{dy}", y + dy * (half - 0.5) - 0.18, y + dy * (half - 0.5) + 0.18,
              x + dx * (half - 0.5) - 0.18, x + dx * (half - 0.5) + 0.18, ROOF, ROOF + 6.0, STEEL)
beds = []
for x in np.arange(min(x for x, y in G) + 9, max(x for x, y in G) - 8, 17.0):   # round lawn beds round the tents [S4]
    for y in np.arange(min(y for x, y in G) + 9, max(y for x, y in G) - 8, 17.0):
        if (all(lm.inside(G, x + dx, y + dy) for dx in (-8, 8) for dy in (-8, 8))
                and all(max(abs(x - q[0]), abs(y - q[1])) > q[2] + 7.5 for q in tents) and len(beds) < 12):
            beds.append((x, y))
for j, (x, y) in enumerate(beds):
    r = 6.5
    S.prism(f"bed_kerb_{j}", [(y + (r + 0.4) * math.sin(2 * math.pi * i / 14), x + (r + 0.4) * math.cos(2 * math.pi * i / 14)) for i in range(14)],
            ROOF, ROOF + 0.45, CANOPY)
    S.prism(f"bed_{j}", [(y + r * math.sin(2 * math.pi * i / 14), x + r * math.cos(2 * math.pi * i / 14)) for i in range(14)], ROOF, ROOF + 0.55, GRASS)
    lm.place(coll, f"bed_tree_{j}", TREE, x, y, ROOF + 0.55, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
for j, (x, y) in enumerate([(gx - 22, gy + 2), (gx + 22, gy - 4), (gx - 4, gy + 24), (gx + 4, gy - 26)]):   # white umbrellas
    if lm.inside(G, x, y):
        S.cone(f"umbrella_{j}", y, x, 3.2, ROOF + 2.4, ROOF + 3.4, WHITE, seg=8)
        S.box(f"umbrella_pole_{j}", y - 0.06, y + 0.06, x - 0.06, x + 0.06, ROOF, ROOF + 2.4, STEEL)

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
        d = min(math.dist((x, y), q) for q in RINGS[0])
        if lm.inside(RINGS[0], x, y) or lm.inside(SKY, x, y) or d > 30.0 or d < 6.0 or x > 40.0 or rng.uniform() < 0.45:
            continue
        z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"pine_{k:02d}", PINES[k % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        k += 1

lm.human_reference(coll, *((p0 + p1) / 2 + np.array(t) * -12.0))
print("SM", {"entrance floor": round(EF, 1), "roof": round(ROOF, 1), "terraces": [round(z, 1) for z in LEVELS], "tents": len(tents),
             "beds": len(beds), "pines": k})
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
