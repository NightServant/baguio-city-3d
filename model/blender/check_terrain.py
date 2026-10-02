"""M2 gates, run headless on the saved .blend:
  /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/check_terrain.py
Prints PASS/FAIL lines; exits 1 if any check fails."""
import json
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
TERRAIN = ROOT / "model" / "data" / "terrain"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

ANCHOR_TOLERANCE_M = 35          # Phase 9 M2 gate
RIDGE_TOLERANCE_M = 25
failures = 0


def check(ok, name, detail):
    global failures
    failures += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name}: {detail}")


grid = json.loads((TERRAIN / "grid.json").read_text())
ref = json.loads((TERRAIN / "anchors.json").read_text())
build = json.loads((TERRAIN / "build.json").read_text())

want0 = 2 * (grid["rows"] - 1) * (grid["cols"] - 1)
tris = build["triangles"]
check(tris["LOD0"] == want0, "LOD0 triangles", f"{tris['LOD0']:,} (expected {want0:,})")
check(abs(tris["LOD1"] - want0 * 0.5) <= 2, "LOD1 triangles", f"{tris['LOD1']:,} (expected {want0 * 0.5:,.0f})")
check(abs(tris["LOD2"] - want0 * 0.15) <= 2, "LOD2 triangles", f"{tris['LOD2']:,} (expected {want0 * 0.15:,.0f})")

names = {c.name for c in bpy.data.collections}
need = {"BAGUIO_MASTER", "00_REFERENCE", "10_TERRAIN", "20_ROADS", "30_BUILDINGS", "BLD_PROCEDURAL", "BLD_HERO",
        "40_LANDMARKS", "50_VEGETATION", "55_STREETFURNITURE", "60_MATERIALS", "90_EXPORT"}
check(need <= names, "collection tree", f"missing {sorted(need - names)}" if need - names else "complete")

zs = terrain_z([(a["e"], a["n"]) for a in ref["anchors"]])
worst = 0.0
for a, z in zip(ref["anchors"], zs):
    d = None if z is None else z - a["terrarium_m"]
    worst = max(worst, abs(d)) if d is not None else worst
    check(d is not None and abs(d) <= ANCHOR_TOLERANCE_M, f"anchor {a['slug']}",
          "no hit" if d is None else f"mesh {z:.1f} m vs Terrarium {a['terrarium_m']} m ({d:+.1f})")
print(f"INFO  worst anchor difference {worst:.1f} m")
rz = terrain_z([(ref["ridge"]["e"], ref["ridge"]["n"])])[0]
check(rz is not None and abs(rz - ref["ridge"]["expected_m"]) <= RIDGE_TOLERANCE_M,
      "Mines View ridge registration", f"{rz} m, expected about {ref['ridge']['expected_m']}")

print("\nM2 gates pass" if not failures else f"\n{failures} check(s) failed")
sys.exit(1 if failures else 0)
