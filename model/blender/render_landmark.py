"""Review renders for one landmark in context (landmark procedure step C): three close views plus the
nearest app preset camera, Workbench with shadows and cavity, and a contact sheet.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/render_landmark.py -- <slug> <facade-bearing-deg> [preset] [distance-scale]
<facade-bearing-deg> is the direction the camera looks to face the landmark's front (clockwise from north)."""
import json
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index("--") + 1:]
slug, front = args[0], float(args[1])
preset = args[2] if len(args) > 2 and args[2] != "-" else None
scale = float(args[3]) if len(args) > 3 else 1.0  # widen the close views for large sites (a lake, a park)
out = ROOT / "model" / "data" / "renders" / "landmarks"
out.mkdir(parents=True, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light, sh.color_type, sh.show_shadows, sh.show_cavity = "STUDIO", "TEXTURE", True, True  # textures where a material has one
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1280, 800, 100
ax, ay, az = bpy.data.objects[f"CTX_{slug}"].location
target = (ax, ay, az + 12.0)


def shoot(name, bearing, pitch, dist):
    b, p = math.radians(bearing), math.radians(pitch)
    cam = bpy.data.objects.get(f"CAM_LM_{name}") or bpy.data.objects.new(f"CAM_LM_{name}", bpy.data.cameras.new(f"CAM_LM_{name}"))
    if not cam.users_collection:
        bpy.data.collections["00_REFERENCE"].objects.link(cam)
    cam.data.lens_unit, cam.data.angle, cam.data.clip_start, cam.data.clip_end = "FOV", math.radians(40), 1.0, 50_000.0
    cam.location = (target[0] - dist * math.sin(p) * math.sin(b), target[1] - dist * math.sin(p) * math.cos(b), target[2] + dist * math.cos(p))
    cam.rotation_mode, cam.rotation_euler = "XYZ", (p, 0.0, -b)
    scene.camera = cam
    scene.render.filepath = str(out / f"{slug}-{name}.png")
    bpy.ops.render.render(write_still=True)
    return scene.render.filepath


# Review on the terrain the app draws (contract C2, ground fitting): a 6 m grid of the map's DEM round the
# landmark stands in for the Copernicus terrain, a surface model that reads tree canopy, in the close views.
sys.path.insert(0, str(ROOT / "model" / "blender"))
import lm_common as lm  # noqa: E402
fp = json.loads((ROOT / "model" / "data" / "landmarks" / slug / "footprint.json").read_text())
R, STEP = 300 * scale, 6.0
n = int(2 * R / STEP) + 1
xs = [-R + STEP * i for i in range(n)]
zs = lm.map_ground(fp, [(x, y) for y in xs for x in xs] + [(0.0, 0.0)])
me = bpy.data.meshes.new("MAP_GROUND")
me.from_pydata([(ax + x, ay + y, az + (zs[j * n + i] - zs[-1]) * lm.EXAG) for j, y in enumerate(xs) for i, x in enumerate(xs)], [],
               [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i) for j in range(n - 1) for i in range(n - 1)])
ground = bpy.data.objects.new("MAP_GROUND", me)
bpy.data.collections["00_REFERENCE"].objects.link(ground)
terrain = [o for o in bpy.data.objects if o.name.startswith("TERRAIN_")]
for o in terrain:
    o.hide_render = True
shots = [shoot("front", front, 70, 95 * scale), shoot("aerial", front + 35, 50, 140 * scale), shoot("side", front + 95, 72, 110 * scale)]
for o in terrain:
    o.hide_render = False
ground.hide_render = True
if preset:
    scene.camera = bpy.data.objects[f"CAM_{preset}"]
    scene.render.filepath = str(out / f"{slug}-preset-{preset}.png")
    bpy.ops.render.render(write_still=True)
    shots.append(scene.render.filepath)
print("RENDERS", " ".join(shots))
