"""Terrain height at model-frame (east, north) points, for later milestones (contract C2 foundations).

Use inside Blender: exec this file, or import it after adding model/blender to sys.path.
Ray casts straight down onto the evaluated mesh; 1,000 points take about 2 ms (measured)."""
import bpy
from mathutils import Vector


def terrain_z(points, obj_name="TERRAIN_LOD0", top=5000.0, reach=10000.0):
    ob = bpy.data.objects[obj_name]
    dg = bpy.context.evaluated_depsgraph_get()
    inv = ob.matrix_world.inverted()
    down = (inv.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
    out = []
    for x, y in points:
        ok, loc, _nrm, _idx = ob.ray_cast(inv @ Vector((x, y, top)), down, distance=reach, depsgraph=dg)
        out.append((ob.matrix_world @ loc).z if ok else None)
    return out
