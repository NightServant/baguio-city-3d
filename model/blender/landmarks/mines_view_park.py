"""mines-view-park: the observation deck on the cliff edge (stone paving on a rock base, log railings), its
timber tepee frame with the red slat canopy and the black eagle on top, the rock face beside it, the
stepped stone walkway down from the park, and Benguet pines (ready-made CC0 Kenney pines, rocks, bushes).
Dimensions: model/landmarks/mines-view-park.md ([S2] OSM deck loop, walkway and cliff; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/mines_view_park.py"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "mines-view-park"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
ax, ay = fp["anchor_tm"]
ring = fp["rings"][0]                       # [S2] park outline, local metres around its centroid, CCW


def rock_face(rgb=(0.46, 0.42, 0.37)):     # [S3] grey-brown rock with moss
    """Layered rock (6 m tile): wavy strata, vertical cracks, mossy green patches; tiles seamlessly."""
    Y, X, grain = lm._grid()
    strata = np.sin(2 * np.pi * (6 * Y + 0.35 * np.sin(2 * np.pi * 2 * X)))
    crack = np.abs(np.sin(2 * np.pi * (5 * X + 0.3 * np.sin(2 * np.pi * 3 * Y)))) < 0.06
    moss = np.clip((np.sin(2 * np.pi * (2 * X + Y)) * np.sin(2 * np.pi * (X - 3 * Y)) - 0.35) * 3, 0, 1)
    base = np.array(rgb) * ((1 + 0.10 * strata) * np.where(crack, 0.65, 1.0))[..., None]
    return (base * (1 - 0.6 * moss[..., None]) + np.array((0.25, 0.33, 0.18)) * 0.6 * moss[..., None]) * (1 + 0.04 * grain)


PAVING = lm.textured("MAT_mines_paving", lm.pattern_image("TEX_mines_paving", lm.flagstones()), srgb(143, 135, 125), 0.9)
ROCK = lm.textured("MAT_mines_rock", lm.pattern_image("TEX_mines_rock", rock_face()), srgb(112, 104, 90), 0.95)
POLE = lm.material("MAT_mines_pole", srgb(196, 168, 128), 0.8)       # [S3] pale weathered timber poles
SLAT = lm.material("MAT_mines_slat", srgb(150, 72, 52), 0.7)         # [S3] red-brown canopy slats
LOG = lm.material("MAT_mines_log", srgb(104, 76, 54), 0.85)          # [S3] rustic log railings
EAGLE = lm.material("MAT_mines_eagle", srgb(38, 38, 40), 0.6)        # [S3] black eagle sculpture
CURB = lm.material("MAT_mines_curb", srgb(128, 124, 116), 0.9)
# Ready-made CC0 assets (Kenney kits, model/sources.json), recoloured toward S3
PINES = [lm.asset_mesh("pine_tall_c", 18.0, {"leafs": (72, 108, 62), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("pine_tall_a", 14.0, {"leafs": (64, 100, 58), "woodBark": (96, 74, 56)})]
BUSH = lm.asset_mesh("bush", 1.4, {"": (64, 104, 52)})
S = lm.Shapes(coll, 0.0, {PAVING.name: 3.0, ROCK.name: 6.0})   # bearing 0: a = north (y), w = east (x)
rng = np.random.default_rng(1950)


def q(x, y, z):
    return (y, x, z)                        # local (x east, y north, z) -> Shapes (a, w, z)


def ztop(pts):
    """Highest ground over the given local points, relative to the anchor's, on either DEM (lm.rel_ground)."""
    return max(lm.rel_ground(fp, pts))


def zlow(pts):
    return min(lm.rel_ground(fp, pts, low=True))


def beam(name, p0, p1, half, mat):
    """Square-section timber from p0 to p1 (local x, y, z)."""
    d = np.subtract(p1, p0)
    d = d / np.linalg.norm(d)
    u = np.cross(d, (0, 0, 1)) if abs(d[2]) < 0.99 else np.array((1.0, 0, 0))
    u = u / np.linalg.norm(u) * half
    v = np.cross(d, u)
    v = v / np.linalg.norm(v) * half
    corners = [-u - v, u - v, u + v, -u + v]
    S.hexa(name, [q(*(np.add(p0, c))) for c in corners], [q(*(np.add(p1, c))) for c in corners], mat)


def chaikin(pts):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
    return out


# --- The deck: [S2] the OSM footway loop round the cliff-top (way/53619552), grown 20% about its centre
loop = [(38.4, -0.4), (41.3, -6.6), (47.0, -11.2), (52.2, -11.8), (57.9, -7.8), (57.4, -1.5), (51.6, 3.0), (45.3, 3.0)]
cx, cy = sum(p[0] for p in loop) / len(loop), sum(p[1] for p in loop) / len(loop)
deck = chaikin([(cx + (x - cx) * 1.2, cy + (y - cy) * 1.2) for x, y in loop])
deck = [p for p in deck] if sum((x1 - x0) * (y1 + y0) for (x0, y0), (x1, y1) in zip(deck, deck[1:] + deck[:1])) < 0 else deck[::-1]
grid = [(cx + gx, cy + gy) for gx in range(-12, 13, 2) for gy in range(-12, 13, 2)]
inside_deck = lambda px, py: sum(((y0 > py) != (y1 > py)) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0)
                                 for (x0, y0), (x1, y1) in zip(deck, deck[1:] + deck[:1])) % 2 == 1
zd = ztop(deck + [p for p in grid if inside_deck(*p)]) + 0.3     # flat deck above every sample: never buried
zbot = zlow(deck) - 1.5
lowest = zbot
# Rock base: tapers out 35% to the lowest ground, so the 30 m DEM's smoothed slope reads as the cliff [S2]
base = [(cx + (x - cx) * 1.35, cy + (y - cy) * 1.35) for x, y in deck]
n = len(deck)
S.mesh("deck_rock", [q(x, y, zbot) for x, y in base] + [q(x, y, zd - 0.3) for x, y in deck],
       [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)], ROCK)
S.prism("deck_paving", [(y, x) for x, y in deck], zd - 0.35, zd, PAVING)

# Edge: a low stone curb, log posts every ~2 m and two log rails, open at the walkway entrance (west)
entrance = min(range(n), key=lambda i: deck[i][0])
for i in range(n):
    if i in (entrance, (entrance - 1) % n):
        continue
    (x0, y0), (x1, y1) = deck[i], deck[(i + 1) % n]
    L = math.hypot(x1 - x0, y1 - y0)
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    nx, ny = dy, -dx                        # outward for a CCW ring
    f = lambda t, o, x0=x0, y0=y0, dx=dx, dy=dy, nx=nx, ny=ny: (x0 + dx * t - nx * o, y0 + dy * t - ny * o)
    quad = [f(-0.2, 0.0), f(L + 0.2, 0.0), f(L + 0.2, 0.4), f(-0.2, 0.4)]
    S.hexa(f"curb_{i:02d}", [q(x, y, zd - 0.35) for x, y in quad], [q(x, y, zd + 0.35) for x, y in quad], CURB)
    for k in range(max(1, round(L / 2.0))):
        px, py = f(k * L / max(1, round(L / 2.0)), 0.2)
        beam(f"post_{i:02d}_{k}", (px, py, zd + 0.35), (px, py, zd + 1.15), 0.08, LOG)
    for r, h in enumerate((0.7, 1.1)):
        (px0, py0), (px1, py1) = f(0.0, 0.2), f(L, 0.2)
        beam(f"rail_{i:02d}_{r}", (px0, py0, zd + h), (px1, py1, zd + h), 0.06, LOG)

# --- The tepee: [S3] ~12 poles leaning in to a crossing ~7 m up and fanning past it; a ring canopy of red
# slats at ~3 m; the black eagle on top. All ESTIMATEs scaled from the people in S3 (1.6-1.7 m).
tx, ty = cx, cy
R0, ZJ, POLES = 2.8, 7.0, 12
for k in range(POLES):
    t = 2 * math.pi * (k + 0.5) / POLES
    b = (tx + R0 * math.cos(t), ty + R0 * math.sin(t), zd)
    a = (tx, ty, zd + ZJ)
    e = tuple(b[j] + 1.32 * (a[j] - b[j]) for j in range(3))   # past the crossing, as in S3
    beam(f"pole_{k:02d}", b, e, 0.075, POLE)
ZC = zd + 3.0
rc = R0 * (1 - 3.0 / ZJ)                    # the poles' radius at the canopy
for k in range(36):                         # radial slats, overhanging the outer ring as in S3
    t = 2 * math.pi * k / 36
    beam(f"slat_{k:02d}", (tx + (rc - 0.2) * math.cos(t), ty + (rc - 0.2) * math.sin(t), ZC),
         (tx + 5.4 * math.cos(t), ty + 5.4 * math.sin(t), ZC), 0.06, SLAT)
for name, r in (("inner", rc + 0.3), ("outer", 4.8)):     # two ring beams carrying the slats
    for k in range(12):
        t0, t1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
        beam(f"ring_{name}_{k:02d}", (tx + r * math.cos(t0), ty + r * math.sin(t0), ZC - 0.12),
             (tx + r * math.cos(t1), ty + r * math.sin(t1), ZC - 0.12), 0.07, POLE)
ZE = zd + 1.32 * ZJ + 0.2                 # eagle sits on the fanned pole tips
beam("eagle_body", (tx, ty, ZE - 0.5), (tx, ty, ZE + 0.6), 0.2, EAGLE)
beam("eagle_head", (tx + 0.25, ty, ZE + 0.55), (tx + 0.55, ty, ZE + 0.7), 0.12, EAGLE)
for side in (-1, 1):                        # wings raised in a V across the view, as in S3 (2022): flat plates
    for j, (w0, z0, w1, z1, c) in enumerate(((0.1, 0.2, 0.9, 0.75, 0.55), (0.9, 0.75, 1.7, 1.3, 0.4))):
        S.hexa(f"eagle_wing_{side}_{j}", [q(tx - c, ty + side * w0, ZE + z0), q(tx + c, ty + side * w0, ZE + z0),
                                          q(tx + c, ty + side * w1, ZE + z1), q(tx - c, ty + side * w1, ZE + z1)],
               [q(tx - c, ty + side * w0, ZE + z0 + 0.08), q(tx + c, ty + side * w0, ZE + z0 + 0.08),
                q(tx + c, ty + side * w1, ZE + z1 + 0.08), q(tx - c, ty + side * w1, ZE + z1 + 0.08)], EAGLE)
beam("eagle_tail", (tx - 0.1, ty, ZE - 0.45), (tx - 0.5, ty, ZE - 0.75), 0.1, EAGLE)

# --- Rock face on the deck's south side, rising above it (S3: on the right, looking out east)
for k, (rx, ry, h, rx_, ry_) in enumerate(((44.5, -12.8, 5.5, 4.0, 3.0), (51.0, -14.2, 4.0, 3.2, 2.6))):
    zb = min(zlow([(rx, ry)]), zd) - 1.0       # a seeded, lumpy outcrop in the rock texture, from the slope up
    lowest = min(lowest, zb)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    vs = [(v.co.x * rx_ * rng.uniform(0.8, 1.15), v.co.y * ry_ * rng.uniform(0.8, 1.15), (v.co.z + 1) / 2) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    S.mesh(f"rock_{k}", [q(rx + x, ry + y, zb + z * (zd + h - zb)) for x, y, z in vs], faces, ROCK)
for k, (bx, by) in enumerate(((41.0, -10.5), (47.5, -12.8), (53.8, -12.6), (39.5, -7.8))):
    lm.place(coll, f"bush_{k}", BUSH, bx, by, zd + 0.3, rng.uniform(0, 360), rng.uniform(0.8, 1.2))

# --- The walkway down from the park [S2] footway way/53619549: 3 m stone treads, 1 m long, each level
# with the highest ground under it (so steps appear where the slope drops), log rail on the south side
path = [(-6.8, -7.9), (-2.2, -7.3), (11.6, -7.4), (16.1, -6.8), (21.4, -6.1), (32.0, -0.6), (38.4, -0.4)]
segs = []
for (x0, y0), (x1, y1) in zip(path, path[1:]):
    L = math.hypot(x1 - x0, y1 - y0)
    for k in range(math.ceil(L)):
        segs.append(((x0, y0), ((x1 - x0) / L, (y1 - y0) / L), k, min(k + 1.0, L)))
steps = []
for (x0, y0), (dx, dy), t0, t1 in segs:
    nx, ny = -dy, dx                        # left of travel = north side
    corners = [(x0 + dx * t + nx * o, y0 + dy * t + ny * o) for t, o in ((t0, -1.5), (t1 + 0.05, -1.5), (t1 + 0.05, 1.5), (t0, 1.5))]
    steps.append((corners, ztop(corners) + 0.15, (x0 + dx * t0 - nx * 1.7, y0 + dy * t0 - ny * 1.7)))
for i, (corners, h, _) in enumerate(steps):
    lowest = min(lowest, h - 1.5)
    S.hexa(f"tread_{i:03d}", [q(x, y, h - 1.5) for x, y in corners], [q(x, y, h) for x, y in corners], PAVING)
posts = steps[::2]
for i, (_, h, (px, py)) in enumerate(posts):
    beam(f"walk_post_{i:03d}", (px, py, h - 0.1), (px, py, h + 1.0), 0.07, LOG)
    if i + 1 < len(posts):
        _, h1, (px1, py1) = posts[i + 1]
        beam(f"walk_rail_{i:03d}", (px, py, h + 0.9), (px1, py1, h1 + 0.9), 0.05, LOG)

# --- Benguet pines across the park [S1, S3], clear of the deck and the walkway (jittered 12 m grid)


def inside_park(px, py):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


def near_path(px, py, gap):
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        L2 = (x1 - x0) ** 2 + (y1 - y0) ** 2
        t = max(0.0, min(1.0, ((px - x0) * (x1 - x0) + (py - y0) * (y1 - y0)) / L2))
        if math.hypot(px - x0 - t * (x1 - x0), py - y0 - t * (y1 - y0)) < gap:
            return True
    return False


trees = 0
for gx in np.arange(-60, 70, 12.0):
    for gy in np.arange(-20, 40, 12.0):
        px, py = gx + rng.uniform(-3, 3), gy + rng.uniform(-3, 3)
        if not inside_park(px, py) or near_path(px, py, 6.0) or math.hypot(px - cx, py - cy) < 16:
            continue
        z = zlow([(px, py)]) - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{trees:02d}", PINES[trees % 2], px, py, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        trees += 1

lm.human_reference(coll, cx + 3.5, cy - 3.5)
print("DECK", round(zd, 2), "m vs the centroid's ground; rock base to", round(zbot, 2), "; trees", trees)
depth = -lowest
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
