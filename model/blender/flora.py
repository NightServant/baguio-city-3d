"""The landscape's plant and stone archetypes (owner 2026-10-07: "Baguio City must be filled with different kinds of
trees, not just pine trees"), and a pedestrian (owner 2026-10-08: "add people"), modelled low-poly in Blender for GPU
instancing. Each archetype is one mesh at a
reference height; an instance scales it to its species' height and tints it (model/flora.json):
- vertex colour alpha 255 marks the tinted parts (foliage, or a flowering tree's blossom), alpha 0 the parts that keep
  their own colour (bark, a flowering tree's leaves);
- the tinted parts are near-white, shaded per tier, so the instance colour reads true.
Archetypes, in model/flora.json order: Benguet pine (open crown in tiers on a tall trunk), cypress (a narrow flame),
araucaria (whorls of level branches), round broadleaf (lumpy dome), flowering broadleaf (blossom on the crown's top
faces), tall broadleaf (eucalyptus and agoho: a pale trunk, a high, thin crown), person (the jacket tinted), shrub, and
rock.
Output: model/data/flora/archetypes.npz (per archetype: positions in metres, x east, y north, z up; RGBA colours;
triangles) and the review render model/data/renders/flora.png.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python model/blender/flora.py"""
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
FLORA = json.loads((ROOT / "model" / "flora.json").read_text())
OUT = ROOT / "model" / "data" / "flora" / "archetypes.npz"
BARK, PALE_BARK, LEAF = (92, 70, 54), (196, 186, 170), (64, 104, 52)   # sRGB; a flowering tree's leaves stay LEAF
SKIN, HAIR, JEANS = (172, 124, 92), (30, 26, 24), (54, 62, 84)    # a pedestrian's fixed parts (ESTIMATEs)


def part(make, rgb, alpha, shade=1.0):
    """One coloured part: `make(bm)` adds geometry to a fresh bmesh; returns (triangles [n, 3, 3], rgba)."""
    bm = bmesh.new()
    make(bm)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    tris = np.array([[tuple(v.co) for v in f.verts] for f in bm.faces], np.float32)
    bm.free()
    c = tuple(round(min(255, k * shade)) for k in rgb)
    return tris, (*c, alpha)


def jitter(bm, rng, amount, keep_z=False):
    for v in bm.verts:
        d = rng.uniform(-amount, amount, 3)
        v.co += Vector((d[0], d[1], 0.0 if keep_z else d[2]))


def block(x0, x1, y0, y1, z0, z1):
    """A box, x across the body, y forward."""
    def make(bm):
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
                            @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)), verts=bm.verts)
    return make


def ico(c, r, squash=1.0, sub=1, rng=None, jit=0.0):
    def make(bm):
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
        if rng is not None and jit:
            jitter(bm, rng, jit)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((1, 1, squash, 1)), verts=bm.verts)
    return make


def trunk(z0, z1, r0, r1, n=5, lean=(0.0, 0.0)):
    """A tapered n-sided trunk without caps (its base is under the ground, its top inside the crown)."""
    def make(bm):
        lo = [bm.verts.new((r0 * math.cos(2 * math.pi * i / n), r0 * math.sin(2 * math.pi * i / n), z0)) for i in range(n)]
        hi = [bm.verts.new((lean[0] + r1 * math.cos(2 * math.pi * i / n), lean[1] + r1 * math.sin(2 * math.pi * i / n), z1)) for i in range(n)]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return make


def bipyramid(c, r, up, down, n, rng, jit, halves="both"):
    """A tier of foliage: an n-sided ring at c, apexes `up` above and `down` below it (`halves`: both, top or bottom)."""
    def make(bm):
        a0 = rng.uniform(0, 2 * math.pi)
        ring = [bm.verts.new((c[0] + r * (1 + rng.uniform(-jit, jit)) * math.cos(a0 + 2 * math.pi * i / n),
                              c[1] + r * (1 + rng.uniform(-jit, jit)) * math.sin(a0 + 2 * math.pi * i / n),
                              c[2] + rng.uniform(-jit, jit) * r * 0.3)) for i in range(n)]
        top = bm.verts.new((c[0] + rng.uniform(-0.2, 0.2) * r, c[1] + rng.uniform(-0.2, 0.2) * r, c[2] + up))
        bot = bm.verts.new((c[0], c[1], c[2] - down))
        for i in range(n):
            j = (i + 1) % n
            if halves != "bottom":
                bm.faces.new((ring[i], ring[j], top))
            if halves != "top":
                bm.faces.new((ring[j], ring[i], bot))
    return make


def spindle(rings, n, apex):
    """A solid of revolution through (z, r) rings, closed by a bottom cap and an apex."""
    def make(bm):
        loops = [[bm.verts.new((r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z)) for i in range(n)] for z, r in rings]
        bm.faces.new(list(reversed(loops[0])))
        for a, b in zip(loops, loops[1:]):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((a[i], a[j], b[j], b[i]))
        tip = bm.verts.new((0, 0, apex))
        for i in range(n):
            bm.faces.new((loops[-1][i], loops[-1][(i + 1) % n], tip))
    return make


def archetypes():
    rng = np.random.default_rng(1909)
    W = (255, 255, 255)
    out = {}
    # Benguet pine [flora.json]: a straight trunk, the crown in its upper half as irregular, flattened tiers
    out["pine"] = [part(trunk(-0.6, 15.6, 0.3, 0.09), BARK, 0)] + [
        part(bipyramid((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), z), r, up, down, 6, rng, 0.3), W, 255, shade)
        for z, r, up, down, shade in ((7.6, 2.7, 1.5, 1.1, 0.80), (9.9, 2.6, 1.5, 1.0, 0.87), (12.0, 2.2, 1.4, 0.9, 0.93), (13.9, 1.5, 1.3, 0.7, 1.0))
    ] + [part(spindle([(14.6, 0.7)], 5, 16.0), W, 255, 1.0)]
    # Cypress: a short trunk under a narrow flame
    out["cypress"] = [part(trunk(-0.6, 1.4, 0.2, 0.15, 4), BARK, 0),
                      part(spindle([(0.8, 0.75), (4.0, 1.25), (7.0, 0.85)], 6, 10.0), W, 255, 0.92)]
    # Araucaria (Norfolk Island pine, bunya): a trunk to the tip, level whorls of branches narrowing upward
    whorls = []
    for k, (z, r) in enumerate(((5.6, 3.4), (8.2, 3.0), (10.6, 2.5), (12.8, 2.0), (14.8, 1.5), (16.6, 0.9))):
        whorls.append(part(bipyramid((0, 0, z), r, 0.7, 0.45, 5, rng, 0.08), W, 255, 0.80 + 0.04 * k))
    out["araucaria"] = [part(trunk(-0.6, 18.0, 0.28, 0.06, 4), BARK, 0)] + whorls
    # Round broadleaf (alder, maple, balete, paperbark): a trunk and a lumpy two-blob dome
    out["round"] = [part(trunk(-0.6, 4.2, 0.28, 0.16), BARK, 0),
                    part(ico((0, 0, 5.8), 3.0, 0.78, 1, rng, 0.35), W, 255, 0.95),
                    part(ico((1.7, 0.8, 4.9), 2.0, 0.85, 1, rng, 0.3), W, 255, 0.85)]
    # Flowering broadleaf (African tulip, pink shower, coral tree, bottlebrush, calliandra): the same dome, its upward
    # faces in blossom (tinted), the rest its own leaf green
    out["bloom"] = [part(trunk(-0.6, 3.6, 0.26, 0.15), BARK, 0)]
    for c, r, sq in (((0, 0, 5.2), 2.8, 0.8), ((-1.5, -0.6, 4.4), 1.9, 0.85)):
        tris, _ = part(ico(c, r, sq, 1, rng, 0.3), W, 255)
        n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
        up = n[:, 2] / np.linalg.norm(n, axis=1) > 0.3
        bloom = up & (rng.random(len(tris)) < 0.65)
        out["bloom"] += [(tris[bloom], (255, 255, 255, 255)), (tris[~bloom], (*LEAF, 0))]
    # Tall broadleaf (eucalyptus, agoho): a pale, slightly leaning trunk, a fork, a high thin crown of three blobs
    out["tall"] = [part(trunk(-0.6, 12.5, 0.3, 0.12, 4, (0.4, 0.2)), PALE_BARK, 0),
                   part(trunk(10.0, 15.0, 0.1, 0.06, 4, (-1.2, 0.6)), PALE_BARK, 0)]
    for (x, y, z, r, sh) in ((0.6, 0.3, 15.0, 2.0, 0.95), (-1.1, 0.7, 13.6, 1.7, 0.85), (1.2, -0.6, 12.4, 1.6, 0.8)):
        out["tall"].append(part(bipyramid((x, y, z), r, 1.6, 1.3, 6, rng, 0.25), W, 255, sh))
    # Person [flora.json S5]: legs in jeans, a jacket and its sleeves (tinted), a head with its top faces in hair; 1.63 m,
    # 80 triangles
    head, _ = part(ico((0, 0.01, 1.525), 0.11, 1.1, 0), SKIN, 0)
    nz = np.cross(head[:, 1] - head[:, 0], head[:, 2] - head[:, 0])
    hair = (nz[:, 2] / np.linalg.norm(nz, axis=1) > 0.2) | (nz[:, 1] / np.linalg.norm(nz, axis=1) < -0.5)   # crown and back
    out["person"] = [part(block(-0.16, -0.03, -0.07, 0.07, 0.0, 0.84), JEANS, 0), part(block(0.03, 0.16, -0.07, 0.07, 0.0, 0.84), JEANS, 0),
                     part(block(-0.2, 0.2, -0.11, 0.11, 0.8, 1.4), W, 255, 0.95),
                     part(block(-0.28, -0.2, -0.07, 0.07, 0.84, 1.37), W, 255, 0.82), part(block(0.2, 0.28, -0.07, 0.07, 0.84, 1.37), W, 255, 0.82),
                     (head[~hair], (*SKIN, 0)), (head[hair], (*HAIR, 0))]
    # Shrub: two low blobs
    out["shrub"] = [part(bipyramid((0, 0, 0.45), 0.8, 0.6, 0.45, 5, rng, 0.15), W, 255, 0.95),
                    part(bipyramid((0.55, 0.3, 0.35), 0.6, 0.45, 0.35, 5, rng, 0.12), W, 255, 0.85)]
    # Rock: a jittered, flattened boulder sunk a third into the ground
    out["rock"] = [part(ico((0, 0, 0.25), 0.9, 0.62, 1, rng, 0.22), W, 255, 1.0)]
    return out


def lods():
    """Far versions (tiles beyond the near ring): one crown solid on a three-sided trunk, 16 to 26 triangles. Shrubs and
    rocks have none: the runtime draws them near only. Same tinting flags as the full archetypes."""
    rng = np.random.default_rng(1925)
    W = (255, 255, 255)
    stem = lambda z1, r=0.25: part(trunk(-0.6, z1, r, r * 0.7, 3), BARK, 0)
    half = lambda c, r, up, down, h, rgba: (part(bipyramid(c, r, up, down, 5, rng, 0.1, h), rgba[:3], rgba[3]))
    return {
        "pine": [stem(7.0), part(spindle([(6.5, 2.1), (10.5, 2.6)], 5, 16.0), W, 255, 0.9)],
        "cypress": [part(spindle([(0.8, 0.75), (4.0, 1.2)], 4, 10.0), W, 255, 0.92)],
        "araucaria": [stem(6.0), part(spindle([(5.2, 3.1)], 5, 18.0), W, 255, 0.88)],
        "round": [stem(4.0), part(bipyramid((0.3, 0.2, 5.4), 3.2, 2.4, 1.7, 5, rng, 0.1), W, 255, 0.92)],
        "bloom": [stem(3.6), half((0.0, 0.0, 4.9), 3.0, 2.2, 1.6, "top", (*W, 255)), half((0.0, 0.0, 4.9), 3.0, 2.2, 1.6, "bottom", (*LEAF, 0))],
        "tall": [part(trunk(-0.6, 13.0, 0.3, 0.15, 3), PALE_BARK, 0), part(bipyramid((0.3, 0.2, 13.8), 2.5, 2.6, 2.0, 5, rng, 0.1), W, 255, 0.9)],
    }


def flatten(parts):
    """Triangles -> indexed (position, colour) vertices, shared within a part."""
    pos, col, idx = [], [], []
    for tris, rgba in parts:
        if len(tris) == 0:
            continue
        flat = tris.reshape(-1, 3)
        keys, inv = np.unique(np.round(flat, 4), axis=0, return_inverse=True)
        idx.append(inv.reshape(-1, 3) + sum(len(p) for p in pos))
        pos.append(keys.astype(np.float32))
        col.append(np.tile(np.array(rgba, np.uint8), (len(keys), 1)))
    return np.vstack(pos), np.vstack(col), np.vstack(idx).astype(np.uint32)


def preview(arch):
    """A row of every species at its typical height, tinted as flora.json says, for the review render."""
    scene = bpy.context.scene
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    x = 0.0
    srgb = lambda c: [((k / 255) / 12.92 if k / 255 <= 0.04045 else ((k / 255 + 0.055) / 1.055) ** 2.4) for k in c]
    for sp in FLORA["species"]:
        pos, col, idx = arch[sp["archetype"]]
        h = sum(sp["height_m"]) / 2
        k = h / FLORA["archetypes"][sp["archetype"]]["ref_height_m"]
        tint = np.array(sp.get("bloom") or sp["foliage"], float) / 255
        rgb = np.where(col[:, 3:4] == 255, col[:, :3] / 255 * tint, col[:, :3] / 255)
        me = bpy.data.meshes.new(sp["key"])
        me.from_pydata([tuple(p * k) for p in pos], [], [tuple(t) for t in idx])
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for i, c in enumerate(rgb):
            attr.data[i].color = (*srgb(c * 255), 1.0)
        ob = bpy.data.objects.new(sp["key"], me)
        ob.location = (x + 4, 0, 0)
        scene.collection.objects.link(ob)
        x += 10
    plane = bpy.data.meshes.new("ground")
    plane.from_pydata([(-5, -20, 0), (x + 5, -20, 0), (x + 5, 20, 0), (-5, 20, 0)], [], [(0, 1, 2, 3)])
    scene.collection.objects.link(bpy.data.objects.new("ground", plane))
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type, cam.data.ortho_scale = "ORTHO", x + 10
    cam.location, cam.rotation_euler = (x / 2, -120, 14), (math.radians(88), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light, sh.color_type, sh.show_shadows, sh.show_cavity = "STUDIO", "VERTEX", True, True
    scene.render.resolution_x, scene.render.resolution_y = 2400, 560
    scene.render.filepath = str(ROOT / "model" / "data" / "renders" / "flora.png")
    bpy.ops.render.render(write_still=True)
    cam.location, cam.rotation_euler = (x / 2, -95, 80), (math.radians(50), 0, 0)
    scene.render.filepath = str(ROOT / "model" / "data" / "renders" / "flora-oblique.png")
    bpy.ops.render.render(write_still=True)


def main():
    raw = archetypes()
    arch = {k: flatten(v) for k, v in raw.items()}
    far = {f"{k}_lod": flatten(v) for k, v in lods().items()}
    assert list(arch) == list(FLORA["archetypes"]), "flora.json lists the archetypes in build order"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT, **{f"{k}_{a}": v for k, (p, c, i) in {**arch, **far}.items() for a, v in (("pos", p), ("col", c), ("idx", i))})
    for k, (p, c, i) in {**arch, **far}.items():
        print(f"FLORA {k}: {len(i)} triangles, {len(p)} vertices, height {p[:, 2].max():.1f} m")
    preview(arch)


main()
