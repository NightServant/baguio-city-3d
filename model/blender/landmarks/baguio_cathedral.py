"""baguio-cathedral: the cathedral building (twin towers with spires, nave, transept, apse, porch).
Dimensions: model/landmarks/baguio-cathedral.md. Plan positions are [S2] (OSM, measured); heights are
ESTIMATEs from [S3] (owner's photo); colours are [S3].
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_cathedral.py"""
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-cathedral"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
TRIM = lm.material("MAT_cathedral_trim", srgb(150, 155, 160), 0.8)     # [S3] grey trim
CAP = lm.material("MAT_cathedral_cap", srgb(110, 125, 140), 0.6)       # [S3] blue-grey pinnacle caps
DARK = lm.material("MAT_cathedral_opening", srgb(58, 60, 64), 0.9)     # openings, louvres
ROBE = lm.material("MAT_cathedral_statue", srgb(70, 100, 175), 0.7)    # [S3] statue niche, blue robe
RIDGE = lm.material("MAT_cathedral_ridge", srgb(150, 32, 28), 0.6)     # ridge caps, darker than the sheet
WALL = lm.textured("MAT_cathedral_wall", lm.pattern_image("TEX_cathedral_wall", lm.wall_blocks()), srgb(236, 236, 232), 0.85)    # [S3]
ROOF = lm.textured("MAT_cathedral_roof", lm.pattern_image("TEX_cathedral_roof", lm.corrugated()), srgb(196, 42, 36), 0.55)       # [S3]
SCALES = lm.textured("MAT_cathedral_spire", lm.pattern_image("TEX_cathedral_spire", lm.fish_scales()), srgb(190, 40, 34), 0.6)   # [S3]
# [S2] building axis: façade at SSE, apse at NNW; metres per texture repeat; ESTIMATE 38° roof pitch [S3]
S = lm.Shapes(coll, -26.3, {WALL.name: 2.0, ROOF.name: 1.0, SCALES.name: 1.5}, pitch_deg=38.0)


depth = lm.foundation(coll, fp, TRIM)   # a grey plinth where the hill falls away

# Nave [S2]: a -23.1..15.0, w -8.8..9.2; eave 11 m, ridge from the 38° pitch (ESTIMATE)
EAVE = 11.0
S.box("nave", -23.1, 15.0, -8.8, 9.2, 0.0, EAVE, WALL)
_, nave_ridge = S.gable_along_a("nave_roof", -22.9, 15.4, -9.3, 9.7, EAVE, ROOF)
S.gable_wall("facade_gable", -23.3, -22.9, -8.8, 9.2, EAVE, nave_ridge - 0.2, WALL)
S.gable_wall("rear_gable", 15.0, 15.4, -8.8, 9.2, EAVE, nave_ridge - 0.2, WALL)
S.box("eave_trim_w", -23.1, 15.0, -9.0, -8.8, EAVE - 0.5, EAVE, TRIM)
S.box("eave_trim_e", -23.1, 15.0, 9.2, 9.4, EAVE - 0.5, EAVE, TRIM)

# Transept [S2]: a 5.1..15.0, w -12.9..12.3; same eave, ridge from the pitch
S.box("transept", 5.1, 15.0, -12.9, 12.3, 0.0, EAVE, WALL)
_, tr_ridge = S.gable_along_w("transept_roof", 4.7, 15.4, -13.3, 12.7, EAVE, ROOF)
for side, w0, w1, wc in (("w", -13.1, -12.9, -12.9), ("e", 12.3, 12.5, 12.3)):
    S.mesh(f"transept_gable_{side}", [(5.1, w0, EAVE), (15.0, w0, EAVE), (10.05, w0, tr_ridge - 0.2), (5.1, w1, EAVE), (15.0, w1, EAVE), (10.05, w1, tr_ridge - 0.2)],
         [(0, 1, 2), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], WALL)
    S.disc(f"transept_rose_{side}", "w", wc + (0.15 if side == "e" else -0.15), 10.05, 8.2, 1.3, 0.2, TRIM)

# Apse [S2]: rounded end to a 27.8, width 10.4; wall 9 m, half-cone roof (ESTIMATE)
AC, AW, AR = 22.6, -0.1, 5.2
half = [(AC + AR * math.cos(t), AW + AR * math.sin(t)) for t in [math.radians(-90 + 15 * i) for i in range(13)]]
S.prism("apse", [(15.0, AW - AR), *half, (15.0, AW + AR)], 0.0, 9.0, WALL)
_, apse_ridge = S.gable_along_a("apse_roof", 15.0, AC, AW - AR - 0.4, AW + AR + 0.4, 9.0, ROOF)
ring = [(AC + (AR + 0.4) * math.cos(t), AW + (AR + 0.4) * math.sin(t), 9.0) for t in [math.radians(-90 + 15 * i) for i in range(13)]]
S.mesh("apse_roof_cone", ring + [(AC, AW, apse_ridge)], [(i, i + 1, 13) for i in range(12)] + [(0, 12, 13)], ROOF)

# Porch [S2]: a -25.5..-23.1, w -4.3..4.5; 5 m with a red lean-to (ESTIMATE)
S.box("porch", -25.5, -23.1, -4.3, 4.5, 0.0, 5.0, WALL)
S.hexa("porch_roof", [(-25.9, -4.7, 4.6), (-23.1, -4.7, 5.8), (-23.1, 4.9, 5.8), (-25.9, 4.9, 4.6)],
     [(-25.9, -4.7, 4.85), (-23.1, -4.7, 6.05), (-23.1, 4.9, 6.05), (-25.9, 4.9, 4.85)], ROOF, uv="wa")
S.arch_panel("porch_door", "a", -25.45, 0.1, 2.6, 0.0, 3.8, 0.15, DARK)

# Façade [S3]: rose window, cross at the apex, statue niche, flanking arched windows
S.disc("facade_rose", "a", -23.35, 0.2, 13.0, 1.5, 0.2, TRIM)
S.disc("facade_rose_inner", "a", -23.45, 0.2, 13.0, 0.9, 0.1, DARK)
S.box("cross_v", -23.3, -23.0, 0.08, 0.32, nave_ridge - 0.3, nave_ridge + 2.2, WALL)
S.box("cross_h", -23.3, -23.0, -0.45, 0.85, nave_ridge + 1.1, nave_ridge + 1.38, WALL)
S.box("niche", -23.25, -23.05, -0.6, 1.0, 6.4, 8.6, DARK)
S.box("statue", -23.35, -23.15, -0.25, 0.65, 6.6, 8.3, ROBE)
for w in (-2.6, 3.0):
    S.arch_panel(f"facade_window_{w:+.0f}", "a", -23.15, w, 1.3, 6.0, 9.8, 0.12, DARK)

# Nave side windows [S3: arched openings], between the towers and the transept
for a in (-16.5, -12.3, -8.1, -3.9, 0.3):
    S.arch_panel(f"side_window_w_{a:+.0f}", "w", -8.85, a, 1.2, 4.0, 8.6, 0.12, DARK)
    S.arch_panel(f"side_window_e_{a:+.0f}", "w", 9.33, a, 1.2, 4.0, 8.6, 0.12, DARK)

# Towers [S2 positions; ESTIMATE heights]: 5 m squares at the façade corners
SHAFT, BAL, SPIRE = 20.0, 1.2, 12.0
for name, wc, clock in (("west", -6.3, True), ("east", 6.7, False)):
    ac, h = -20.6, 2.5
    S.box(f"tower_{name}", ac - h, ac + h, wc - h, wc + h, 0.0, SHAFT, WALL)
    S.box(f"tower_{name}_plinth", ac - h - 0.15, ac + h + 0.15, wc - h - 0.15, wc + h + 0.15, 0.0, 1.2, TRIM)
    S.box(f"tower_{name}_cornice", ac - h - 0.15, ac + h + 0.15, wc - h - 0.15, wc + h + 0.15, SHAFT - 0.45, SHAFT, TRIM)
    for i, (a0, a1, w0, w1) in enumerate(((ac - h, ac + h, wc - h, wc - h + 0.25), (ac - h, ac + h, wc + h - 0.25, wc + h),
                                          (ac - h, ac - h + 0.25, wc - h, wc + h), (ac + h - 0.25, ac + h, wc - h, wc + h))):
        S.box(f"tower_{name}_balustrade_{i}", a0, a1, w0, w1, SHAFT, SHAFT + BAL, WALL)
    for i, (pa, pw) in enumerate(((ac - h, wc - h), (ac - h, wc + h), (ac + h, wc - h), (ac + h, wc + h))):
        S.box(f"tower_{name}_pinnacle_{i}", pa - 0.2, pa + 0.2, pw - 0.2, pw + 0.2, SHAFT, SHAFT + BAL + 0.5, WALL)
        S.cone(f"tower_{name}_cap_{i}", pa, pw, 0.3, SHAFT + BAL + 0.5, SHAFT + BAL + 1.6, CAP)
    S.pyramid(f"tower_{name}_spire", ac, wc, h - 0.3, SHAFT, SHAFT + BAL + SPIRE, SCALES)
    S.box(f"tower_{name}_finial", ac - 0.08, ac + 0.08, wc - 0.08, wc + 0.08, SHAFT + BAL + SPIRE - 0.3, SHAFT + BAL + SPIRE + 1.6, TRIM)
    S.box(f"tower_{name}_finial_bar", ac - 0.06, ac + 0.06, wc - 0.35, wc + 0.35, SHAFT + BAL + SPIRE + 1.0, SHAFT + BAL + SPIRE + 1.15, TRIM)
    for z in (6.0, 11.0):  # [S3] horizontal bands
        S.box(f"tower_{name}_band_{z:.0f}", ac - h - 0.12, ac + h + 0.12, wc - h - 0.12, wc + h + 0.12, z, z + 0.3, TRIM)
    for i, (pa, pw) in enumerate(((ac - h, wc - h), (ac - h, wc + h), (ac + h, wc - h), (ac + h, wc + h))):  # corner pilasters
        S.box(f"tower_{name}_corner_{i}", pa - 0.28, pa + 0.28, pw - 0.28, pw + 0.28, 1.2, SHAFT - 0.45, TRIM)
    out_w = (wc - h) if name == "west" else (wc + h)
    for k, z in enumerate((12.9, 13.6, 14.3, 15.0)):  # louvre slats over the belfry openings
        S.box(f"tower_{name}_slat_front_{k}", ac - h - 0.2, ac - h - 0.1, wc - 0.75, wc + 0.75, z, z + 0.12, TRIM)
        w0, w1 = (out_w - 0.2, out_w - 0.1) if name == "west" else (out_w + 0.1, out_w + 0.2)
        S.box(f"tower_{name}_slat_out_{k}", ac - 0.75, ac + 0.75, w0, w1, z, z + 0.12, TRIM)
    # belfry louvres on all four faces, and a lower slit
    S.arch_panel(f"tower_{name}_louvre_front", "a", ac - h - 0.02, wc, 1.7, 12.5, 16.2, 0.12, DARK)
    S.arch_panel(f"tower_{name}_louvre_back", "a", ac + h + 0.12, wc, 1.7, 12.5, 16.2, 0.12, DARK)
    S.arch_panel(f"tower_{name}_louvre_out", "w", (wc - h - 0.02) if name == "west" else (wc + h + 0.12), ac, 1.7, 12.5, 16.2, 0.12, DARK)
    S.arch_panel(f"tower_{name}_slit_front", "a", ac - h - 0.02, wc, 0.8, 6.0, 8.8, 0.1, DARK)
    # [S3] clock on the west tower's front; rose windows on the other front and the outer faces
    S.disc(f"tower_{name}_front_ring", "a", ac - h - 0.02, wc, 18.0, 1.05, 0.12, TRIM)
    if clock:
        S.disc(f"tower_{name}_clock_face", "a", ac - h - 0.1, wc, 18.0, 0.85, 0.08, WALL)
    else:
        S.disc(f"tower_{name}_rose_inner", "a", ac - h - 0.1, wc, 18.0, 0.6, 0.08, DARK)
    S.disc(f"tower_{name}_side_rose", "w", (wc - h - 0.02) if name == "west" else (wc + h + 0.12), ac, 18.0, 1.0, 0.12, TRIM)


# Detail [S3]: plinth, string course and pilasters along the nave; ridge caps; rose-window tracery
for side, (f0, f1), (p0, p1) in (("w", (-8.95, -8.8), (-9.15, -8.8)), ("e", (9.2, 9.35), (9.2, 9.55))):
    S.box(f"plinth_{side}", -23.1, 15.0, f0, f1, 0.0, 0.9, TRIM)
    S.box(f"string_course_{side}", -23.1, 15.0, f0, f1, 9.7, 10.0, TRIM)
    for a in (-18.6, -14.4, -10.2, -6.0, -1.8, 2.4):
        S.box(f"pilaster_{side}_{a:+.0f}", a - 0.35, a + 0.35, p0, p1, 0.0, 10.4, TRIM)
S.box("nave_ridge_cap", -22.9, 15.4, 0.02, 0.38, nave_ridge - 0.05, nave_ridge + 0.18, RIDGE)
S.box("transept_ridge_cap", 9.87, 10.23, -13.3, 12.7, tr_ridge - 0.05, tr_ridge + 0.18, RIDGE)
for k in range(6):  # six spokes over the façade rose window
    t = math.pi * k / 6
    da, dz = 1.35 * math.cos(t), 1.35 * math.sin(t)
    pa, pz = 0.07 * -math.sin(t), 0.07 * math.cos(t)
    corners = [(0.2 - da - pa, 13.0 - dz - pz), (0.2 + da - pa, 13.0 + dz - pz), (0.2 + da + pa, 13.0 + dz + pz), (0.2 - da + pa, 13.0 - dz + pz)]
    S.hexa(f"rose_spoke_{k}", [(-23.62, w, z) for w, z in corners], [(-23.52, w, z) for w, z in corners], WALL)
S.disc("rose_hub", "a", -23.6, 0.2, 13.0, 0.32, 0.1, WALL)

# [S3] trees on the cathedral grounds, along the sides and behind the apse, never in front of the
# façade (the forecourt and the stairs from Session Road). Ready-made CC0 Kenney assets; seeded.
import numpy as np  # noqa: E402

PINES = [lm.asset_mesh("pine_tall_c", 17.0, {"leafs": (58, 92, 56), "woodBark": (92, 70, 54)}),
         lm.asset_mesh("pine_tall_a", 14.0, {"leafs": (52, 86, 52), "woodBark": (92, 70, 54)})]
BROAD = lm.asset_mesh("broadleaf", 10.0, {"leafs": (88, 122, 60), "woodBark": (110, 84, 60)})
rng = np.random.default_rng(1920)             # seeded; groundbreaking year [S1]
spots = [(a, side * rng.uniform(14.0, 19.0)) for a in np.arange(-14.0, 24.0, 7.5) for side in (-1, 1)]
spots += [(rng.uniform(31.0, 36.0), w) for w in (-9.0, 0.0, 9.0)]
for n, (a, w) in enumerate(spots):
    x, y, _ = S.P(a, w, 0.0)
    gz = lm.rel_ground(fp, [(x, y)], low=True)[0]
    mesh = BROAD if n % 4 == 3 else PINES[n % 2]
    lm.place(coll, f"tree_{n:02d}", mesh, x, y, gz - 0.3,
             rng.uniform(0, 360), rng.uniform(0.85, 1.15))

front = S.P(-34.0, 0.2, 0.0)
lm.human_reference(coll, front[0], front[1])
lm.report(SLUG, coll, depth)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
