"""M2: one Blender camera per app view (DEFAULT_CAMERA + CAMERA_PRESETS), placed like MapLibre 5.24's
camera (research §9b), and a Workbench render of each for owner review.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/cameras.py [-- m5]
The render is unexaggerated; the app shows terrain at 1.35x, so expect flatter relief than on screen."""
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_sample import terrain_z  # noqa: E402

FOV = 0.6435011087932844      # MapLibre default vertical FOV
W, H = 1440, 900              # placeholder viewport; position scales linearly with H
OUT = ROOT / "model" / "data" / "renders" / (sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "m2")   # e.g. -- m5


def main():
    scene = bpy.context.scene
    views = json.loads((ROOT / "model" / "data" / "terrain" / "anchors.json").read_text())["views"]
    ref = bpy.data.collections["00_REFERENCE"]
    for ob in [o for o in ref.objects if o.name.startswith("CAM_")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    try:
        scene.render.engine = "BLENDER_WORKBENCH"
    except TypeError as e:  # dynamic enum (MCP guidance): report the accepted identifiers
        raise SystemExit(f"Workbench unavailable: {e}")
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, H, 100
    OUT.mkdir(parents=True, exist_ok=True)
    for v in views:
        p, b = math.radians(v["pitch"]), math.radians(v["bearing"])
        mpp = 2 * math.pi * 6371008.8 * math.cos(math.radians(v["lat"])) / (512 * 2 ** v["zoom"])
        d = 1.5 * H * mpp
        cz = terrain_z([(v["e"], v["n"])])[0] or 0.0
        cd = bpy.data.cameras.new(f"CAM_{v['name']}")
        cd.type, cd.sensor_fit, cd.lens_unit, cd.angle = "PERSP", "VERTICAL", "FOV", FOV
        cd.clip_start, cd.clip_end = 10.0, 100_000.0
        co = bpy.data.objects.new(f"CAM_{v['name']}", cd)
        ref.objects.link(co)
        co.location = (v["e"] - d * math.sin(p) * math.sin(b), v["n"] - d * math.sin(p) * math.cos(b), cz + d * math.cos(p))
        co.rotation_mode, co.rotation_euler = "XYZ", (p, 0.0, -b)
        scene.camera = co
        scene.render.filepath = str(OUT / f"{v['name']}.png")
        bpy.ops.render.render(write_still=True)
        print(f"RENDER {v['name']}: camera at {tuple(round(c) for c in co.location)}")
    bpy.ops.wm.save_mainfile()


main()
