"""baguio-public-market: the Baguio City Market, built from every OSM building inside the market's outline (88
blocks and stalls): concrete walls to their mapped or estimated storeys, low hip roofs in the market's corrugated
red, green, blue and grey where a block is near-rectangular (flat roofs elsewhere), and the barrel-vaulted roof
of the Hangar Market. The exclusion ring takes these out of the building massing, so this model carries them.
Data: model/data/landmarks/baguio-public-market/buildings.json (`uv run model/scripts/landmark_osm.py buildings
baguio-public-market`). Sources and estimates: model/landmarks/baguio-public-market.md.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/baguio_public_market.py"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "baguio-public-market"
coll, fp = lm.begin(SLUG)
srgb = lm.srgb
rng = np.random.default_rng(1913)

WALLS = [lm.material(f"MAT_market_wall_{i}", srgb(*c), 0.9) for i, c in enumerate(((214, 208, 196), (196, 190, 178), (226, 222, 212)))]
ROOFS = [lm.material(f"MAT_market_roof_{i}", srgb(*c), 0.6) for i, c in enumerate(
    ((168, 58, 46), (52, 120, 84), (62, 98, 150), (150, 152, 150), (120, 124, 128), (182, 92, 52)))]   # [S3]/owner palette
VAULT = lm.textured("MAT_market_vault", lm.pattern_image("TEX_market_vault", lm.corrugated((0.40, 0.62, 0.48))), srgb(102, 158, 122), 0.5)
S = lm.Shapes(coll, 0.0, {})
STOREY = 3.2                                     # ESTIMATE: market storeys

blds = json.loads((lm.ROOT / "model" / "data" / "landmarks" / SLUG / "buildings.json").read_text())
lowest = 0.0
for i, b in enumerate(blds):
    ring = b["ring"]
    zt = max(lm.rel_ground(fp, ring))
    zl = min(lm.rel_ground(fp, ring, low=True)) - 1.0
    lowest = min(lowest, zl)
    levels = b["levels"]                         # [S2] where mapped
    if not levels:
        area = 0.5 * abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])))
        levels = 1 if area < 60 else 2           # ESTIMATE: small stalls one storey, blocks two
    top = zt + (b["height"] or levels * STOREY)
    S.prism(f"b{i:03d}", [(y, x) for x, y in ring], zl, top, WALLS[i % 3], tessellate=len(ring) > 4)
    # roof: a low hip over the minimum-area rectangle when the block is near-rectangular, else a flat slab
    best = None
    for k in range(len(ring)):
        (x0, y0), (x1, y1) = ring[k], ring[(k + 1) % len(ring)]
        brg = math.degrees(math.atan2(x1 - x0, y1 - y0))
        R = lm.Shapes(coll, brg, {}, pitch_deg=16.0)
        aw = [R.xy(x, y, 0)[:2] for x, y in ring]
        a0, a1 = min(a for a, w in aw), max(a for a, w in aw)
        w0, w1 = min(w for a, w in aw), max(w for a, w in aw)
        if best is None or (a1 - a0) * (w1 - w0) < best[0]:
            best = ((a1 - a0) * (w1 - w0), R, a0, a1, w0, w1)
    area = 0.5 * abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1])))
    rect, R, a0, a1, w0, w1 = best
    if b["name"] and "hangar" in b["name"].lower():
        # [S2] "Hangar Market": a barrel vault along its long side (ESTIMATE: rise = a third of the span)
        along = (a1 - a0) >= (w1 - w0)
        span = (w1 - w0) if along else (a1 - a0)
        segs = 8
        verts, faces = [], []
        for e in (0, 1):
            for k in range(segs + 1):
                t = math.pi * k / segs
                off, rise = -math.cos(t) * span / 2, math.sin(t) * span / 3
                if along:
                    verts.append((a0 if e == 0 else a1, (w0 + w1) / 2 + off, top + rise))
                else:
                    verts.append(((a0 + a1) / 2 + off, w0 if e == 0 else w1, top + rise))
        n = segs + 1
        faces = [(k, k + 1, n + k + 1, n + k) for k in range(segs)] + [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        R.tile = {VAULT.name: 1.0}
        R.mesh(f"vault_{i:03d}", verts, faces, VAULT, uv="wa" if along else "aw")
    elif area / rect > 0.85 and area > 30:
        R.hip(f"roof_{i:03d}", a0 - 0.3, a1 + 0.3, w0 - 0.3, w1 + 0.3, top, ROOFS[int(rng.integers(len(ROOFS)))])
    else:
        S.prism(f"roof_{i:03d}", [(y, x) for x, y in ring], top, top + 0.3, ROOFS[int(rng.integers(len(ROOFS)))], tessellate=len(ring) > 4)

cx, cy = blds[0]["ring"][0]
lm.human_reference(coll, cx + 2.0, cy + 2.0)
print("BUILDINGS", len(blds))
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
