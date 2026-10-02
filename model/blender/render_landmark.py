"""Review renders for one landmark in context (landmark procedure step C): three close views plus the
nearest app preset camera, Workbench with shadows and cavity, and a contact sheet.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/render_landmark.py -- <slug> <facade-bearing-deg> [preset]
<facade-bearing-deg> is the direction the camera looks to face the landmark's front (clockwise from north)."""
import math
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
args = sys.argv[sys.argv.index("--") + 1:]
slug, front = args[0], float(args[1])
preset = args[2] if len(args) > 2 else None
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


shots = [shoot("front", front, 70, 95), shoot("aerial", front + 35, 50, 140), shoot("side", front + 95, 72, 110)]
if preset:
    scene.camera = bpy.data.objects[f"CAM_{preset}"]
    scene.render.filepath = str(out / f"{slug}-preset-{preset}.png")
    bpy.ops.render.render(write_still=True)
    shots.append(scene.render.filepath)
print("RENDERS", " ".join(shots))
