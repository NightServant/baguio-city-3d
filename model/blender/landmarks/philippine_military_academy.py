"""philippine-military-academy: Borromeo Field, the Academy's parade ground, draped over the map's terrain, and the
Tirso G. Fajardo Memorial Grandstand on its north side: the long grey stand with its blue band bearing
COURAGE, INTEGRITY, LOYALTY between the two crests, the central arch, the raised roof canopy, the row of flags
along the roof and the fence and flags along the field's edge; pines round the field (ready-made CC0 Kenney).
Dimensions: model/landmarks/philippine-military-academy.md ([S2] OSM field and grandstand; heights are ESTIMATEs).
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/philippine_military_academy.py"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "philippine-military-academy"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1936)             # seeded; the Academy's Baguio campus [S1]

FIELD = lm.textured("MAT_pma_field", lm.pattern_image("TEX_pma_field",
                    np.array((0.38, 0.56, 0.26)) * (1 + 0.05 * np.sin(2 * np.pi * 8 * lm._grid()[1]))[..., None]), srgb(100, 142, 64), 0.95)
GREY = lm.material("MAT_pma_grey", srgb(118, 124, 132), 0.8)             # [S3] the stand's grey walls
BLUE = lm.material("MAT_pma_blue", srgb(36, 112, 206), 0.6)              # [S3] the blue band
WHITE = lm.material("MAT_pma_white", srgb(240, 240, 236), 0.7)           # [S3] lettering, canopy, posts
GOLD = lm.material("MAT_pma_gold", srgb(222, 176, 52), 0.5)              # [S3] the crests
DARK = lm.material("MAT_pma_dark", srgb(30, 32, 36), 0.6)                # [S3] the arch's shade and the fence
FLAGS = [lm.material(f"MAT_pma_flag_{i}", srgb(*c), 0.7) for i, c in enumerate(((206, 40, 40), (40, 160, 70), (232, 200, 40), (240, 240, 236), (40, 90, 190)))]
PINES = lm.FloraMix("forest")   # mixed species (owner 2026-10-07: "not just pine trees"), model/flora.json
S = lm.Shapes(coll, 0.0, {FIELD.name: 10.0})
G = lm.Shapes(coll, 90.0, {})                   # the grandstand's frame: a east along it, w south (to the field)

# [S2] Borromeo Field way/373844844, measured from the footprint's anchor
FIELD_RING = [(46.5, -81.2), (-37.3, -80.1), (-46.8, -78.8), (-56.2, -75.6), (-62.5, -71.8), (-67.4, -64.9), (-111.7, 40.4),
              (-112.3, 45.9), (-110.0, 51.2), (-106.4, 56.0), (-100.5, 60.2), (-93.0, 63.8), (-84.1, 65.8), (63.7, 66.6),
              (73.1, 60.9), (81.3, 46.3), (86.4, 33.9), (92.4, 18.8), (97.8, 2.1), (106.5, -26.1), (106.5, -30.4),
              (104.9, -35.3), (100.8, -39.8), (55.6, -75.9), (51.8, -78.6)]
lowest = lm.drape(S, fp, "field", FIELD_RING, FIELD, step=6.0, lift=0.25)

# [S2] the grandstand way/346262101: 94.1 x 11.3 m along the field's north edge
GA0, GA1 = -30.5, 63.7                          # its east-west extent (x)
GY0, GY1 = 66.2, 77.9                           # its north-south extent (y); the front (to the field) is at GY0
ring = [(GA0, GY0), (GA1, GY0), (GA1, GY1), (GA0, GY1)]
zt = max(lm.rel_ground(fp, ring))
zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
lowest = min(lowest, zl)
z0 = zt + 0.3
H = 9.5                                         # ESTIMATE: two storeys and the band (S3)
S.box("stand", GY0, GY1, GA0, GA1, zl, z0 + H, GREY)                     # Shapes bearing 0: a = y, w = x
S.box("band", GY0 - 0.1, GY0, GA0 + 1.0, GA1 - 1.0, z0 + H - 2.4, z0 + H - 0.6, BLUE)
S.box("band_top", GY0 - 0.12, GY0, GA0 + 1.0, GA1 - 1.0, z0 + H - 0.6, z0 + H - 0.45, WHITE)
mid = (GA0 + GA1) / 2
for word, cx, wid in (("COURAGE", GA0 + 16.0, 10.0), ("INTEGRITY", mid, 12.0), ("LOYALTY", GA1 - 16.0, 10.0)):
    S.box(f"word_{word}", GY0 - 0.14, GY0 - 0.1, cx - wid / 2, cx + wid / 2, z0 + H - 1.8, z0 + H - 1.15, WHITE)   # [S3] the words
for k, cx in enumerate((mid - 13.0, mid + 13.0)):                       # [S3] the two crests between the words
    S.disc(f"crest_{k}", "a", GY0 - 0.12, cx, z0 + H - 1.5, 0.9, 0.1, GOLD)
S.arch_panel("arch", "a", GY0 - 0.02, mid, 5.0, z0, z0 + 5.5, 0.05, DARK, round_top=True)   # [S3] the central arch
S.box("canopy", GY0 + 1.5, GY1 - 1.0, GA0 + 16.0, GA1 - 16.0, z0 + H, z0 + H + 1.8, WHITE)  # [S3] the raised roof canopy
for k, fx in enumerate(np.linspace(GA0 + 18.0, GA1 - 18.0, 12)):                       # flags along the roof
    S.beam(f"roof_pole_{k}", (fx, GY0 + 1.0, z0 + H + 1.8), (fx, GY0 + 1.0, z0 + H + 5.0), 0.04, WHITE)
    S.box(f"roof_flag_{k}", GY0 + 0.98, GY0 + 1.02, fx + 0.05, fx + 1.1, z0 + H + 4.2, z0 + H + 4.9, FLAGS[k % len(FLAGS)])
# the fence along the field's edge in front of the stand, with a flag on every third post [S3]
FY = GY0 - 4.0
zf = max(lm.rel_ground(fp, [(GA0, FY), (mid, FY), (GA1, FY)])) + 0.1
S.beam("fence_rail", (GA0, FY, zf + 0.9), (GA1, FY, zf + 0.9), 0.05, DARK)
for k, fx in enumerate(np.arange(GA0, GA1 + 0.1, 3.0)):
    S.beam(f"fence_post_{k:02d}", (fx, FY, zf - 0.3), (fx, FY, zf + 1.0), 0.06, WHITE)
    if k % 3 == 1:
        S.beam(f"fence_pole_{k:02d}", (fx, FY - 0.5, zf), (fx, FY - 0.5, zf + 4.5), 0.03, WHITE)
        S.box(f"fence_flag_{k:02d}", FY - 0.52, FY - 0.48, fx + 0.05, fx + 0.9, zf + 3.8, zf + 4.4, FLAGS[k % len(FLAGS)])

# Pines along the field's west and east edges [S3], about every 24 m
n = 0
for k in range(len(FIELD_RING)):
    (x0, y0), (x1, y1) = FIELD_RING[k], FIELD_RING[(k + 1) % len(FIELD_RING)]
    if y0 > 60 and y1 > 60:                     # not along the grandstand
        continue
    L = math.hypot(x1 - x0, y1 - y0)
    for t in np.arange(6.0, L, 24.0):
        nx, ny = (y1 - y0) / L, -(x1 - x0) / L  # outward for a CW ring, inward for CCW; flip below if inside
        px, py = x0 + (x1 - x0) * t / L + nx * 9.0, y0 + (y1 - y0) * t / L + ny * 9.0
        if lm.inside(FIELD_RING, px, py):
            px, py = px - 18.0 * nx, py - 18.0 * ny
        z = lm.rel_ground(fp, [(px, py)], low=True)[0] - 0.3
        lowest = min(lowest, z)
        lm.place(coll, f"tree_{n:02d}", PINES[n], px, py, z, rng.uniform(0, 360), rng.uniform(0.85, 1.15))
        n += 1

lm.human_reference(coll, mid + 5.0, FY - 3.0)
print("STAND FLOOR", round(z0, 2), "TREES", n)
lm.detail(coll, fp, blocks=[GREY])   # shared sub-detail pass (lm_common.detail)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
