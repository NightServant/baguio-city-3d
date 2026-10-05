"""camp-john-hay: the Bell Amphitheater (1913) and the Bell House (1906).
- Amphitheater: the curved, hedged grass terraces round a lawn; the green-roofed octagonal gazebo on its
  stepped platform; the central stairway with white urn planters; lamp posts.
- Bell House: white clapboard walls, green hip roofs and trim, the raised veranda with white columns and
  balustrade, a chimney.
- Benguet pines (ready-made CC0 Kenney pines and bushes).
Dimensions: model/landmarks/camp-john-hay.md ([S2] OSM outlines and stairway; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/camp_john_hay.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "camp-john-hay"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1913)             # seeded; the amphitheater's year [S1]
amph, house = fp["rings"]                       # [S2] way/109508305, way/109375754 outlines, local metres


def grass(rgb=(0.36, 0.55, 0.25)):              # [S3] mown lawn
    """Lawn (4 m tile): mowing stripes and grain."""
    Y, X, grain = lm._grid()
    return np.array(rgb) * ((1 + 0.05 * np.sin(2 * np.pi * 4 * X))[..., None] * (1 + 0.06 * grain))


def flowers():                                  # [S3] red, orange, yellow and pink beds between the hedges
    """Flower bed (2 m tile): seeded blooms on dark foliage."""
    Y, X, grain = lm._grid()
    out = np.array((0.20, 0.36, 0.16)) * (1 + 0.10 * grain)
    pal = np.array([(0.85, 0.20, 0.15), (0.95, 0.55, 0.10), (0.95, 0.85, 0.20), (0.90, 0.40, 0.60), (0.95, 0.95, 0.90)])
    r = np.random.default_rng(1913)
    for (px, py), c in zip(r.uniform(0, 1, (90, 2)), r.integers(0, len(pal), 90)):
        d = np.hypot(((X - px + 0.5) % 1) - 0.5, ((Y - py + 0.5) % 1) - 0.5)
        out = np.where((d < 0.03)[..., None], pal[c], out)
    return out


def siding(sill, rgb=(0.93, 0.93, 0.90)):       # [S3] white clapboard, green-framed windows
    """Clapboard walls (3 m tile): 15 boards with shadow lines; one 1.2 x 1.5 m window per tile whose sill
    sits at height `sill` (mod 3 m), green frame and cross mullions."""
    Y, X, grain = lm._grid()
    board = (Y * 15) % 1.0
    out = np.array(rgb) * ((1 - 0.10 * (board < 0.12)) * (1 + 0.01 * grain[..., 0]))[..., None]
    v = (Y * 3 - sill) % 3.0                     # metres above the sill, mod the tile
    u = X * 3
    win = (np.abs(u - 1.5) < 0.6) & (v < 1.5)
    frame = win & ((np.abs(u - 1.5) > 0.5) | (v < 0.1) | (v > 1.4) | (np.abs(u - 1.5) < 0.04) | (np.abs(v - 0.75) < 0.04))
    out = np.where(win[..., None], np.array((0.17, 0.21, 0.23)), out)
    return np.where(frame[..., None], np.array((0.13, 0.42, 0.26)), out)


GRASS = lm.textured("MAT_cjh_grass", lm.pattern_image("TEX_cjh_grass", grass()), srgb(92, 140, 64), 0.95)
FLOWERS = lm.textured("MAT_cjh_flowers", lm.pattern_image("TEX_cjh_flowers", flowers()), srgb(80, 96, 50), 0.9)
HEDGE = lm.material("MAT_cjh_hedge", srgb(46, 92, 44), 0.9)                 # [S3] clipped dark hedges
PAVING = lm.textured("MAT_cjh_paving", lm.pattern_image("TEX_cjh_paving", lm.flagstones((0.78, 0.76, 0.72), 1906)), srgb(196, 192, 184), 0.9)
PILLAR = lm.textured("MAT_cjh_pillar", lm.pattern_image("TEX_cjh_pillar", lm.flagstones((0.58, 0.36, 0.30), 1929)), srgb(150, 94, 78), 0.9)
ROOF = lm.textured("MAT_cjh_roof", lm.pattern_image("TEX_cjh_roof", lm.corrugated((0.18, 0.50, 0.36))), srgb(46, 128, 92), 0.6)  # [S3] green
WHITE = lm.material("MAT_cjh_white", srgb(236, 236, 230), 0.7)              # [S3] white trim, steps, columns
FLOOR = lm.material("MAT_cjh_veranda", srgb(112, 64, 44), 0.6)             # [S3] red-brown veranda floor
LAMP = lm.material("MAT_cjh_lamp", srgb(30, 32, 34), 0.5)
URN = lm.material("MAT_cjh_urn", srgb(64, 140, 140), 0.6)                  # [S3] teal-rimmed urn planters
BRICK = lm.material("MAT_cjh_brick", srgb(120, 72, 58), 0.9)
PINES = [lm.asset_mesh("pine_tall_c", 24.0, {"leafs": (66, 100, 58), "woodBark": (96, 74, 56)}),   # [S1] tall stands
         lm.asset_mesh("pine_tall_a", 20.0, {"leafs": (58, 94, 54), "woodBark": (96, 74, 56)})]
BUSH = lm.asset_mesh("bush", 1.3, {"": (60, 110, 50)})
S = lm.Shapes(coll, 0.0, {GRASS.name: 4.0, FLOWERS.name: 2.0, PAVING.name: 3.0, PILLAR.name: 1.5, ROOF.name: 1.0}, pitch_deg=30.0)
lowest = 0.0


def q(x, y, z):
    return (y, x, z)                            # local (x east, y north, z) -> Shapes (a, w, z)


def top(pts):
    return max(lm.rel_ground(fp, pts))


def low(pts):
    return min(lm.rel_ground(fp, pts, low=True))


def slab(name, quad, z1, mat, z0=None):
    """Closed slab over a plan quad [(x, y)…] from z0 (default: 1 m under the lowest ground) up to z1."""
    global lowest
    z0 = low(quad) - 1.0 if z0 is None else z0
    lowest = min(lowest, z0)
    S.hexa(name, [q(x, y, z0) for x, y in quad], [q(x, y, z1) for x, y in quad], mat)


def beam(name, p0, p1, half, mat):
    d = np.subtract(p1, p0)
    d = d / np.linalg.norm(d)
    u = np.cross(d, (0, 0, 1)) if abs(d[2]) < 0.99 else np.array((1.0, 0, 0))
    u = u / np.linalg.norm(u) * half
    v = np.cross(d, u)
    v = v / np.linalg.norm(v) * half
    cs = [-u - v, u - v, u + v, -u + v]
    S.hexa(name, [q(*np.add(p0, c)) for c in cs], [q(*np.add(p1, c)) for c in cs], mat)


def octagon(cx, cy, r, phase=math.pi / 8):
    return [(cx + r * math.cos(phase + 2 * math.pi * i / 8), cy + r * math.sin(phase + 2 * math.pi * i / 8)) for i in range(8)]


# --- Bell Amphitheater [S2, S3]: a lawn ringed on the north, east and west by five curved terraces, open
# to the south, where the gazebo stands; the stairway (way/1358311047) comes down the axis from the north.
# Fitted to the map's terrain (lm.rel_ground). The 30 m DEMs can't hold the real excavated bowl, so the lawn
# drapes 0.2 m over the ground and each terrace, the gazebo and each tread sit on their own patch of it:
# a level lawn either floated or sank on the slope (owner report 2026-10-05).
LX, LY, RX, RY = -18.5, -7.0, 11.0, 7.5          # lawn centre and semi-axes (ESTIMATE, fitted to the S2 outline)
GX, GY = -17.5, -19.5                           # gazebo centre, in the outline's south lobe
RINGS, NSEG = 4, 24
grid = [(LX, LY)] + [(LX + RX * r / RINGS * math.cos(t), LY + RY * r / RINGS * math.sin(t))
                     for r in range(1, RINGS + 1) for t in np.linspace(0, 2 * math.pi, NSEG, endpoint=False)]
gz = [z + 0.2 for z in lm.rel_ground(fp, grid)]
zb = low(grid) - 1.0
lowest = min(lowest, zb)
edge = range(1 + (RINGS - 1) * NSEG, 1 + RINGS * NSEG)            # outer ring indices
verts = [q(x, y, z) for (x, y), z in zip(grid, gz)] + [q(grid[e][0], grid[e][1], zb) for e in edge]
faces = [(0, 1 + i, 1 + (i + 1) % NSEG) for i in range(NSEG)]
for r in range(RINGS - 1):
    a, b = 1 + r * NSEG, 1 + (r + 1) * NSEG
    faces += [(a + i, b + i, b + (i + 1) % NSEG, a + (i + 1) % NSEG) for i in range(NSEG)]
B = len(grid)
faces += [(edge[i], B + i, B + (i + 1) % NSEG, edge[(i + 1) % NSEG]) for i in range(NSEG)] + [tuple(range(B, B + NSEG))]
S.mesh("lawn", verts, faces, GRASS)
lawn_z = lambda x, y: lm.rel_ground(fp, [(x, y)])[0] + 0.2
TIERS, STEP_W, RISE = 5, 2.3, 0.35
SPAN = (math.radians(-28), math.radians(208))   # the terraces wrap from east-south-east round to west-south-west
GAP = math.radians(7)                           # half-width of the stairway's gap on the north axis
SEG = 22
heights = {}
for k in range(TIERS):
    for s in range(SEG):
        t0 = SPAN[0] + (SPAN[1] - SPAN[0]) * s / SEG
        t1 = SPAN[0] + (SPAN[1] - SPAN[0]) * (s + 1) / SEG
        mid = (t0 + t1) / 2
        if abs(mid - math.pi / 2) < GAP + (t1 - t0) / 2:
            continue
        r0, r1 = k * STEP_W, (k + 1) * STEP_W
        quad = [(LX + (RX + r) * math.cos(t), LY + (RY + r) * math.sin(t)) for r, t in ((r0, t0), (r1, t0), (r1, t1), (r0, t1))]
        h = max(top(quad) + 0.15 + RISE * (k + 1), heights.get((k - 1, s), (0, -99))[0] + 0.3)   # always steps up outward
        heights[(k, s)] = (h, mid)
        slab(f"tier_{k}_{s:02d}", quad, h, FLOWERS if k % 2 == 1 else GRASS)
        hq = [(LX + (RX + r) * math.cos(t), LY + (RY + r) * math.sin(t)) for r, t in ((r0 + 0.15, t0), (r0 + 0.75, t0), (r0 + 0.75, t1), (r0 + 0.15, t1))]
        slab(f"hedge_{k}_{s:02d}", hq, h + 0.55, HEDGE, z0=h - 0.2)              # [S3] hedge along each tier's front

# Gazebo [S3, photos 1-3]: octagonal, on three white steps; eight stone pillars; green octagonal roof with a
# small lantern and finial; white beam ring. Sizes are ESTIMATEs from the people in S3.
base = octagon(GX, GY, 5.8)
z0g = top(base) + 0.15                          # its own level: the ground under its platform, not the lawn's
S.prism("gazebo_base", [(y, x) for x, y in base], low(base) - 1.0, z0g, PAVING)
lowest = min(lowest, low(base) - 1.0)
for i, r in enumerate((5.8, 5.2, 4.6)):
    S.prism(f"gazebo_step_{i}", [(y, x) for x, y in octagon(GX, GY, r)], z0g, z0g + 0.3 * (i + 1), WHITE)
zg = z0g + 0.9
for i, (px, py) in enumerate(octagon(GX, GY, 3.9)):
    S.box(f"gazebo_pillar_{i}", py - 0.25, py + 0.25, px - 0.25, px + 0.25, zg, zg + 3.0, PILLAR)
ring = octagon(GX, GY, 3.9)
for i in range(8):
    (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % 8]
    beam(f"gazebo_beam_{i}", (x0, y0, zg + 3.1), (x1, y1, zg + 3.1), 0.15, WHITE)
S.cone("gazebo_roof", GY, GX, 5.2 / math.cos(math.pi / 8), zg + 3.25, zg + 5.6, ROOF, seg=8)
S.prism("gazebo_lantern", [(y, x) for x, y in octagon(GX, GY, 0.7)], zg + 5.0, zg + 5.8, WHITE)
S.cone("gazebo_lantern_roof", GY, GX, 1.0, zg + 5.8, zg + 6.5, ROOF, seg=8)
beam("gazebo_finial", (GX, GY, zg + 6.4), (GX, GY, zg + 7.2), 0.05, WHITE)

# The stairway [S2] way/1358311047 and on up the slope to the north: 2.4 m stone treads, 1 m long, each on
# the highest ground under it, so the terraces stand either side of it.
y_top, y_lawn = 38.4, LY + RY - 0.3
x_at = lambda y: -19.6 + (y + 1.6) / 40.0 * 2.0          # [S2] the way runs (-17.6, 38.4) -> (-19.6, -1.6)
n = math.ceil(y_top - y_lawn)
for i in range(n):
    y0, y1 = y_lawn + i, min(y_lawn + i + 1.05, y_top)
    quad = [(x_at(y0) - 1.2, y0), (x_at(y0) + 1.2, y0), (x_at(y1) + 1.2, y1), (x_at(y1) - 1.2, y1)]
    h = top(quad) + 0.15                                   # on the ground, cut between the beds as in S3 (a flight
                                                           # raised to the rim read as a ramp: owner report 2026-10-05)
    slab(f"stair_{i:02d}", quad, h, PAVING)
    if i % 4 == 2:                                         # [S3] white urn planters with teal rims, both sides
        for side in (-1, 1):
            ux, uy = x_at(y0) + side * 1.6, y0
            S.box(f"urn_base_{i:02d}_{side}", uy - 0.2, uy + 0.2, ux - 0.2, ux + 0.2, h - 0.3, h + 0.5, WHITE)
            S.cone(f"urn_{i:02d}_{side}", uy, ux, 0.25, h + 0.5, h + 1.0, WHITE, seg=6)   # point-down bowl reads at range
            S.prism(f"urn_rim_{i:02d}_{side}", [(uy + 0.45 * math.sin(a), ux + 0.45 * math.cos(a)) for a in np.linspace(0, 2 * math.pi, 6, endpoint=False)], h + 0.95, h + 1.1, URN)
            lm.place(coll, f"urn_plant_{i:02d}_{side}", BUSH, ux, uy, h + 1.0, rng.uniform(0, 360), 0.5)

# Lamp posts round the lawn [S3]: black poles with lantern heads
for i, t in enumerate(np.linspace(0, 2 * math.pi, 9, endpoint=False)):
    lx, ly = LX + (RX - 0.6) * math.cos(t), LY + (RY - 0.6) * math.sin(t)
    if math.hypot(lx - GX, ly - GY) < 6.5 or abs(lx - x_at(ly)) < 2:
        continue
    lz = lawn_z(lx, ly)
    beam(f"lamp_{i}", (lx, ly, lz - 0.3), (lx, ly, lz + 3.2), 0.06, LAMP)
    S.box(f"lamp_head_{i}", ly - 0.2, ly + 0.2, lx - 0.2, lx + 0.2, lz + 3.2, lz + 3.7, WHITE)

# --- The Bell House [S2] way/109375754 (L plan), in its own frame: the north side runs at bearing 103.1
H = lm.Shapes(coll, 103.1, {ROOF.name: 1.0}, pitch_deg=26.0)
wings = [(6.4, 38.7, -29.3, -12.6), (21.0, 38.6, -12.6, 8.4)]          # [S2] the L as two rectangles
hf = max(lm.rel_ground(fp, house)) + 0.6       # the main floor, raised clear of the slope (ESTIMATE)
SIDING = lm.textured("MAT_cjh_siding", lm.pattern_image("TEX_cjh_siding", siding((hf + 0.9) % 3.0)), srgb(232, 232, 226), 0.7)
H.tile[SIDING.name] = 3.0
h_low = min(lm.rel_ground(fp, house, low=True)) - 1.0
VER = 2.2                                       # veranda depth inside the outline (ESTIMATE, S3 photo 2)
# Open edges of each wing (veranda columns and rail); the joint between the wings (w = -12.6, a 21..38.6) is
# interior, so wing 0's south edge stops at a = 21 and wing 1 has no north edge.
edges = [[((6.4, -29.3), (38.7, -29.3)), ((38.7, -29.3), (38.7, -12.6)), ((21.0, -12.6), (6.4, -12.6)), ((6.4, -12.6), (6.4, -29.3))],
         [((38.6, -12.6), (38.6, 8.4)), ((38.6, 8.4), (21.0, 8.4)), ((21.0, 8.4), (21.0, -12.6))]]
for i, (a0, a1, w0, w1) in enumerate(wings):
    H.box(f"house_plinth_{i}", a0 + VER, a1 - VER, w0 + VER, w1 - VER, h_low, hf - 0.2, SIDING)   # lower level, on the slope
    H.box(f"house_floor_{i}", a0, a1, w0, w1, hf - 0.2, hf, FLOOR)
    H.box(f"house_walls_{i}", a0 + VER, a1 - VER, w0 + VER, w1 - VER, hf, hf + 3.4, SIDING)
    H.hip(f"house_roof_{i}", a0 - 0.4, a1 + 0.4, w0 - 0.4, w1 + 0.4, hf + 3.4, ROOF)
    for (pa0, pw0), (pa1, pw1) in edges[i]:
        L = math.hypot(pa1 - pa0, pw1 - pw0)
        da, dw = (pa1 - pa0) / L, (pw1 - pw0) / L
        na, nw = -dw, da                         # perpendicular; the rail sits 0.2 m in from the edge either way
        k = max(1, round(L / 3.0))
        for j in range(k + 1):
            ca, cw = pa0 + (pa1 - pa0) * j / k, pw0 + (pw1 - pw0) * j / k
            ca, cw = min(max(ca, a0 + 0.2), a1 - 0.2), min(max(cw, w0 + 0.2), w1 - 0.2)
            gx, gy, _ = H.P(ca, cw, 0.0)           # columns stand on the ground: the veranda is raised on the downhill side
            H.box(f"house_col_{i}_{pa0:.0f}_{pw0:.0f}_{j}", ca - 0.15, ca + 0.15, cw - 0.15, cw + 0.15,
                  min(hf, lm.rel_ground(fp, [(gx, gy)], low=True)[0] - 0.3), hf + 3.4, WHITE)
        ends = [(pa0, pw0), (pa1, pw1)]
        ends = [(min(max(a, a0 + 0.2), a1 - 0.2), min(max(w, w0 + 0.2), w1 - 0.2)) for a, w in ends]
        (ra0, rw0), (ra1, rw1) = ends
        foot = [(ra0 - 0.06 * na, rw0 - 0.06 * nw), (ra1 - 0.06 * na, rw1 - 0.06 * nw), (ra1 + 0.06 * na, rw1 + 0.06 * nw), (ra0 + 0.06 * na, rw0 + 0.06 * nw)]
        H.hexa(f"house_rail_{i}_{pa0:.0f}_{pw0:.0f}", [(a, w, hf + 0.85) for a, w in foot], [(a, w, hf + 1.0) for a, w in foot], WHITE)
H.box("house_walls_joint", 21.0 + VER, 38.6 - VER, -12.6 - VER - 0.1, -12.6 + VER + 0.1, h_low, hf + 3.4, SIDING)
lowest = min(lowest, h_low)
H.box("house_chimney", 14.0, 15.2, -22.5, -21.3, hf + 3.0, hf + 3.4 + 8.35 * math.tan(math.radians(26)) + 1.2, BRICK)   # [S3]
for j, (ba, bw) in enumerate(((6.0, -31.0), (12.0, -31.5), (18.0, -31.0), (24.0, -31.5), (30.0, -31.0), (40.2, -20.0), (40.5, -10.0), (40.2, 0.0))):
    x, y, _ = H.P(ba, bw, 0.0)                     # [S3] round clipped shrubs along the front path
    lm.place(coll, f"house_shrub_{j}", BUSH, x, y, lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.1, rng.uniform(0, 360), rng.uniform(1.2, 1.6))

# --- Benguet pines [S1, S3]: round the amphitheater's rim and the house, clear of the stair and buildings


def inside(ring_, px, py):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring_, ring_[1:] + ring_[:1]):
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


spots = [(LX + (RX + TIERS * STEP_W + 4.5) * math.cos(t), LY + (RY + TIERS * STEP_W + 4.5) * math.sin(t))
         for t in np.linspace(math.radians(-60), math.radians(240), 16)]
spots += [H.P(a, w, 0.0)[:2] for a, w in ((2.0, -34.0), (44.0, -34.0), (45.0, 12.0), (15.0, 12.0), (2.0, -8.0))]
trees = 0
for px, py in spots:
    px, py = px + rng.uniform(-1.5, 1.5), py + rng.uniform(-1.5, 1.5)
    if abs(px - x_at(py)) < 6.0 and py > LY or inside(house, px, py) or math.hypot(px - GX, py - GY) < 8:
        continue
    z = lm.rel_ground(fp, [(px, py)], low=True)[0] - 0.3
    lowest = min(lowest, z)
    lm.place(coll, f"tree_{trees:02d}", PINES[trees % 2], px, py, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    trees += 1

lm.human_reference(coll, LX + 3.0, LY)
print("GAZEBO", round(z0g, 2), "HOUSE FLOOR", round(hf, 2), "TREES", trees)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
