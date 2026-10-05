"""the-mansion: the Mansion House (1908), the President's summer residence: the white two-storey H plan, the
recessed central block with its round-arched ground-floor arcade and green hip roof, the flat-roofed wings with
parapets and urns, windows, the front lawn, flower beds and flagpole; and the wrought-iron main gate on its
stone-and-brick piers, 180 m up the axis toward Wright Park. Pines round the lawn (ready-made CC0 Kenney).
Dimensions: model/landmarks/the-mansion.md ([S2] OSM outline and gate markers; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/the_mansion.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "the-mansion"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1908)             # seeded; built 1908 [S1]

WALL = lm.textured("MAT_mansion_wall", lm.pattern_image("TEX_mansion_wall", lm.wall_blocks((0.95, 0.95, 0.93))), srgb(240, 240, 236), 0.8)
ROOF = lm.material("MAT_mansion_roof", srgb(70, 150, 112), 0.6)          # [S3] green roof
DARK = lm.material("MAT_mansion_dark", srgb(44, 48, 52), 0.5)            # windows and the arcade's shade
TRIM = lm.material("MAT_mansion_trim", srgb(210, 208, 200), 0.8)
LAWN = lm.material("MAT_mansion_lawn", srgb(104, 146, 66), 0.95)
FLOWER = lm.material("MAT_mansion_flower", srgb(208, 52, 44), 0.8)       # [S3] red flower beds
PIER = lm.material("MAT_mansion_pier", srgb(132, 70, 58), 0.9)           # [S3] the gate's brick-and-stone piers
IRON = lm.material("MAT_mansion_iron", srgb(26, 28, 30), 0.5)            # [S3] black wrought iron
PINES = [lm.asset_mesh("pine_tall_c", 22.0, {"leafs": (64, 98, 56), "woodBark": (96, 74, 56)}),
         lm.asset_mesh("pine_tall_a", 18.0, {"leafs": (58, 92, 52), "woodBark": (96, 74, 56)})]
# [S2] the outline's sides run at 49 / 139 deg: a runs north-east along the facade, w south-east (to the back)
H = lm.Shapes(coll, 49.0, {WALL.name: 2.0}, pitch_deg=24.0)
lowest = 0.0


def top(pts_aw):
    return max(lm.rel_ground(fp, [H.P(a, w, 0)[:2] for a, w in pts_aw]))


def low(pts_aw):
    return min(lm.rel_ground(fp, [H.P(a, w, 0)[:2] for a, w in pts_aw], low=True))


# [S2] the H in its own frame (metres): two wings and the central block between them; the front (north-west,
# toward Wright Park and the gate) is at w = -12.4 for the centre, -17.1 for the wings
WINGS = [(-22.4, -13.9, -17.1, 20.0), (13.5, 22.2, -16.9, 20.1)]
CENTRE = (-13.9, 13.5, -12.4, 9.0)
parts = WINGS + [CENTRE]
corners = [(a, w) for a0, a1, w0, w1 in parts for a in (a0, a1) for w in (w0, w1)]
z0 = top(corners) + 0.4                       # one floor level for the house, clear of the ground (ESTIMATE)
zl = low(corners) - 1.0
lowest = min(lowest, zl)
EAVE = z0 + 8.0                               # two storeys of 4 m (ESTIMATE from S3)
for i, (a0, a1, w0, w1) in enumerate(WINGS):
    H.box(f"wing_{i}", a0, a1, w0, w1, zl, EAVE, WALL)
    H.box(f"wing_{i}_parapet", a0 - 0.15, a1 + 0.15, w0 - 0.15, w1 + 0.15, EAVE, EAVE + 0.9, TRIM)
    H.box(f"wing_{i}_roof", a0 + 0.2, a1 - 0.2, w0 + 0.2, w1 - 0.2, EAVE + 0.2, EAVE + 0.5, ROOF)
    for ua in (a0, a1):                        # [S3] urns on the parapet corners at the front
        H.cone(f"wing_{i}_urn_{ua:.0f}", ua, w0, 0.35, EAVE + 0.9, EAVE + 1.7, TRIM, seg=6)
    for k, ua in enumerate(np.linspace(a0 + 2.0, a1 - 2.0, 3)):   # front windows, both floors
        for fl in (0, 1):
            H.box(f"wing_{i}_win_{k}_{fl}", ua - 0.6, ua + 0.6, w0 - 0.06, w0 + 0.1, z0 + 1.0 + 4 * fl, z0 + 3.0 + 4 * fl, DARK)
    side = a0 if i == 0 else a1                # side windows along the wing's outer face
    for k, uw in enumerate(np.arange(w0 + 3.0, w1 - 1.0, 4.0)):
        for fl in (0, 1):
            aa = (side - 0.1, side + 0.06) if i == 0 else (side - 0.06, side + 0.1)
            H.box(f"wing_{i}_side_{k}_{fl}", *aa, uw - 0.6, uw + 0.6, z0 + 1.0 + 4 * fl, z0 + 3.0 + 4 * fl, DARK)
a0, a1, w0, w1 = CENTRE
H.box("centre", a0, a1, w0, w1, zl, EAVE, WALL)
H.hip("centre_roof", a0 - 0.6, a1 + 0.6, w0 - 0.6, w1 + 0.6, EAVE, ROOF)
H.box("centre_cornice", a0 - 0.3, a1 + 0.3, w0 - 0.3, w0, EAVE - 0.5, EAVE, TRIM)
for k, ua in enumerate(np.linspace(a0 + 2.6, a1 - 2.6, 6)):   # [S3] the ground-floor arcade: six round arches
    H.arch_panel(f"arcade_{k}", "w", w0 - 0.02, ua, 2.6, z0, z0 + 3.6, -0.1, DARK, round_top=True)
    H.box(f"centre_win_{k}", ua - 0.55, ua + 0.55, w0 - 0.06, w0 + 0.1, z0 + 5.0, z0 + 7.0, DARK)
H.box("terrace", a0, a1, w0 - 3.0, w0, zl, z0, TRIM)                  # the front terrace under the arcade

# Front lawn, flower beds and flagpole [S3], draped on the ground in 6 m squares between the wings and beyond
for i, wa in enumerate(np.arange(-48.0, -18.0, 6.0)):
    for j, aa in enumerate(np.arange(-24.0, 24.0, 6.0)):
        sq = [(aa, wa), (aa + 6.05, wa), (aa + 6.05, wa + 6.05), (aa, wa + 6.05)]
        zt = top(sq) + 0.1
        H.box(f"lawn_{i}_{j}", aa, aa + 6.05, wa, wa + 6.05, low(sq) - 1.0, zt, LAWN)
        lowest = min(lowest, low(sq) - 1.0)
for side in (-1, 1):
    bed = [(side * 6.0 - 4.0, -22.0), (side * 6.0 + 4.0, -22.0), (side * 6.0 + 4.0, -19.5), (side * 6.0 - 4.0, -19.5)]
    zt = top(bed) + 0.1
    H.box(f"bed_{side}", side * 6.0 - 4.0, side * 6.0 + 4.0, -22.0, -19.5, zt - 0.3, zt + 0.5, FLOWER)
zf = top([(0.0, -30.0)])
H.beam("flagpole", H.P(0.0, -30.0, zf), H.P(0.0, -30.0, zf + 14.0), 0.08, TRIM)
H.box("flag", 0.1, 2.3, -30.05, -29.95, zf + 12.6, zf + 13.9, FLOWER)

# --- The main gate [S2] OSM "Mansion House" nodes at the compound's entrance, about 180 m up the axis toward
# Wright Park; [S3] two brick-and-stone piers with white cornices and urns, the wrought-iron arch and leaves
GA, GW = -3.7, -183.4                           # [S2] the gate's (a, w), from OSM node/7692329151 and its neighbours (+-5 m)
zg = top([(GA - 5.0, GW), (GA + 5.0, GW)]) + 0.1
zgl = low([(GA - 5.0, GW), (GA + 5.0, GW)]) - 1.0
lowest = min(lowest, zgl)
for side in (-1, 1):
    pc = GA + side * 3.4
    H.box(f"gate_pier_{side}", pc - 0.75, pc + 0.75, GW - 0.75, GW + 0.75, zgl, zg + 5.2, PIER)
    H.box(f"gate_pier_cap_{side}", pc - 0.95, pc + 0.95, GW - 0.95, GW + 0.95, zg + 5.2, zg + 5.8, TRIM)
    H.cone(f"gate_urn_{side}", pc, GW, 0.45, zg + 5.8, zg + 6.9, TRIM, seg=6)
    H.box(f"gate_side_pier_{side}", GA + side * 7.4 - 0.5, GA + side * 7.4 + 0.5, GW - 0.5, GW + 0.5, zgl, zg + 3.6, PIER)
    H.box(f"gate_side_cap_{side}", GA + side * 7.4 - 0.65, GA + side * 7.4 + 0.65, GW - 0.65, GW + 0.65, zg + 3.6, zg + 4.0, TRIM)
for k in range(10):                             # the iron arch over the opening
    t0, t1 = math.pi * k / 10, math.pi * (k + 1) / 10
    H.beam(f"gate_arch_{k}", H.P(GA + 2.65 * math.cos(t0), GW, zg + 5.0 + 2.0 * math.sin(t0)), H.P(GA + 2.65 * math.cos(t1), GW, zg + 5.0 + 2.0 * math.sin(t1)), 0.07, IRON)
for k, ua in enumerate(GA + np.linspace(-2.5, 2.5, 13)):   # gate leaves: vertical bars, and the side screens
    H.beam(f"gate_bar_{k}", H.P(ua, GW, zg), H.P(ua, GW, zg + 4.6), 0.03, IRON)
for zz in (zg + 0.3, zg + 2.4, zg + 4.6):
    H.beam(f"gate_rail_{zz - zg:.1f}", H.P(GA - 2.6, GW, zz), H.P(GA + 2.6, GW, zz), 0.04, IRON)
    for side in (-1, 1):
        H.beam(f"gate_screen_{side}_{zz - zg:.1f}", H.P(GA + side * 4.2, GW, min(zz, zg + 3.4)), H.P(GA + side * 6.9, GW, min(zz, zg + 3.4)), 0.04, IRON)

n = 0
for wa, aa in ((-40.0, -34.0), (-40.0, 34.0), (-60.0, -30.0), (-60.0, 30.0), (-90.0, -26.0), (-90.0, 26.0), (-120.0, -24.0),
               (-120.0, 24.0), (-150.0, -22.0), (-150.0, 22.0), (10.0, -36.0), (12.0, 36.0), (30.0, 0.0)):
    x, y, _ = H.P(aa + rng.uniform(-3, 3), wa + rng.uniform(-3, 3), 0.0)
    z = lm.rel_ground(fp, [(x, y)], low=True)[0] - 0.3
    lowest = min(lowest, z)
    lm.place(coll, f"tree_{n:02d}", PINES[n % 2], x, y, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
    n += 1

hx, hy, _ = H.P(0.0, -16.0, 0.0)
lm.human_reference(coll, hx, hy)
print("FLOOR", round(z0, 2), "GATE", round(zg, 2))
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
