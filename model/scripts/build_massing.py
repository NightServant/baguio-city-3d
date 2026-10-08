# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pyproj==3.8.0", "shapely==2.1.2", "mapbox-earcut==1.0.3"]
# ///
"""M5: OSM building footprints -> streamed massing tiles for the web map (contract C2, C3).

  uv run model/scripts/build_massing.py measure          # skirt and tile-size numbers
  uv run model/scripts/build_massing.py build [near|far]  # near and far tiles (or one level) + index.json

Heights are plausible massing from the spec §6 heuristic, never survey data. Seeded only by OSM ids.
Rules shared with the landmarks (owner, 2026-10-06):
- **True heights on the stretched ground.** The app stretches the terrain by TERRAIN_EXAGGERATION but draws models at
  true scale, so a vertex's Y is ground x EXAG + its real height above the ground (metres, anchor at altitude 0).
- **The map's own ground.** AWS Terrarium z14 (model/scripts/fetch_terrarium.py), sampled bilinear as MapLibre does.
- **Detail at no byte cost.** Each vertex carries its building's roof colour (RGB) and, in alpha, its wall colour
  (WALLS index x 64) and its floor's height modulo a storey (6 bits). The app's shader (ModelLayer.ts) draws the walls in
  that colour with a window per 3 m bay and 3.2 m storey, rows level from the floor, and ribs on pitched roofs, so walls
  and roof share their corner vertices and no texture or UVs ship.
- **Tiles split to fit.** Near tiles start at z15 and split (quadtree) until each holds <= NEAR_MAX buildings; far tiles
  (boxes on the larger buildings) start at z13 and split at FAR_MAX, so a view needs few draw calls."""
import hashlib
import json
import math
import re
import subprocess
import sys
import zlib
from concurrent.futures import ThreadPoolExecutor

import mapbox_earcut
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry.polygon import orient
from shapely.strtree import STRtree

from common import DATA, LANDMARKS, LOCAL_TM, OSM, ROOT
from pack_landmark import GLTFPACK

ZOOM = 15            # near tiles start here (about 1.2 km across) and split while over NEAR_MAX
FAR_ZOOM = 13        # far tiles start here (about 4.9 km) and split while over FAR_MAX
NEAR_MAX, FAR_MAX = 700, 4000
SKIRT_M = 9.0        # buried wall below the lowest corner: `measure` p99 z14-vs-z12 gap 8.8 m (stretched), rounded up
STOREY_M = 3.2       # spec §6
BAY_M = 3.0          # ESTIMATE: one window per bay
ROOF_PITCH = math.radians(18)
FAR_MIN_AREA = 60.0  # far LOD drops smaller buildings (sub-pixel at the default zoom 13.5: ~6.7 m per pixel)
FAR_BOX_AREA = 200.0 # far LOD: smaller ones are their roof only (walls are sub-pixel); larger ones a box
CBD_M = 600.0
PUBLIC = ROOT / "public" / "models" / "buildings"
WORK = DATA / "massing"
EXAG = float(re.search(r"TERRAIN_EXAGGERATION = ([\d.]+)", (ROOT / "lib" / "map" / "sources.ts").read_text())[1])
COMMERCIAL = {"commercial", "retail", "hotel", "office", "apartments", "hospital", "school", "university",
              "college", "public", "civic", "government", "church", "cathedral", "dormitory"}


def srgb(r, g, b):
    """sRGB 0-255 -> linear 0-255 (glTF vertex colours are linear)."""
    f = lambda c: ((c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4) * 255
    return (round(f(r)), round(f(g)), round(f(b)), 255)


# ESTIMATE weights read from the owner's aerial reference (2026-10-02): red/rust dominant, then blue,
# green, teal, white/grey sheet, some orange.
ROOFS_PITCHED = [(srgb(150, 58, 42), 32), (srgb(176, 64, 48), 10), (srgb(52, 86, 132), 15), (srgb(58, 108, 74), 13),
                 (srgb(44, 120, 118), 10), (srgb(200, 200, 196), 12), (srgb(196, 112, 52), 8)]
ROOF_FLAT = srgb(140, 140, 135)
WALLS = [srgb(214, 204, 182), srgb(196, 196, 190), srgb(224, 214, 170), srgb(232, 228, 220)]


def pick(weighted, key):
    total = sum(w for _, w in weighted)
    r = zlib.crc32(key.encode()) % total
    for item, w in weighted:
        if r < w:
            return item
        r -= w


def height_m(tags, area, dist_cbd, oid):
    try:
        return float(str(tags["height"]).lower().replace("m", "").strip())
    except (KeyError, ValueError):
        pass
    try:
        return max(1.0, float(tags["building:levels"])) * STOREY_M
    except (KeyError, ValueError):
        pass
    levels = 3.0 if tags.get("building") in COMMERCIAL else 2.5
    levels += 1.0 if dist_cbd < CBD_M else 0.5 if dist_cbd < 1500 else 0.0
    levels = levels + 1.0 if area > 600 else min(levels, 1.5) if area < 40 else levels
    levels += 0.5 if "name" in tags else 0.0
    levels += (zlib.crc32(oid.encode()) % 5 - 2) * 0.5  # -1..+1 storey, seeded by the OSM id
    return float(min(10, max(1, round(levels)))) * STOREY_M


class Ground:
    """The map's terrain (AWS Terrarium z14 .npy tiles from fetch_terrarium.py), bilinear, pixel i at coordinate i, as
    MapLibre samples it. `step` > 1 averages step x step pixel blocks: the coarser DEM the map draws when zoomed out."""

    def __init__(self, step=1):
        self.step, self.tiles = step, {}

    def _px(self, i, j):
        out = np.empty(i.shape)
        for key in set(zip((i // 256).tolist(), (j // 256).tolist())):
            if key not in self.tiles:
                a = np.load(DATA / "terrarium" / "14" / str(key[0]) / f"{key[1]}.npy").astype(np.float64)
                if self.step > 1:
                    s = self.step
                    a = np.repeat(np.repeat(a.reshape(256 // s, s, 256 // s, s).mean(axis=(1, 3)), s, 0), s, 1)
                self.tiles[key] = a
            m = (i // 256 == key[0]) & (j // 256 == key[1])
            out[m] = self.tiles[key][j[m] % 256, i[m] % 256]
        return out

    def __call__(self, lng, lat):
        n = 2 ** 14 * 256
        lng, lat = np.asarray(lng, np.float64), np.asarray(lat, np.float64)
        u = (lng + 180) / 360 * n
        v = (1 - np.arcsinh(np.tan(np.radians(lat))) / math.pi) / 2 * n
        i, j = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
        fu, fv = u - i, v - j
        top = self._px(i, j) * (1 - fu) + self._px(i + 1, j) * fu
        bot = self._px(i, j + 1) * (1 - fu) + self._px(i + 1, j + 1) * fu
        return top * (1 - fv) + bot * fv


def slippy(lng, lat, z):
    n = 2 ** z
    return int((lng + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def tile_bounds(x, y, z):
    n = 2 ** z
    lat = lambda yy: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))
    return x / n * 360 - 180, lat(y + 1), (x + 1) / n * 360 - 180, lat(y)


def load_buildings():
    """OSM building polygons (ways and multipolygon relations) with tags, from M1's Overpass extract."""
    from shapely.geometry import LineString, Polygon
    from shapely.ops import linemerge, polygonize, unary_union
    out = []
    for el in json.loads(OSM.read_text())["elements"]:
        tags = el.get("tags", {})
        if "building" not in tags:
            continue
        if el["type"] == "way":
            g = el.get("geometry") or []
            if len(g) < 4 or g[0] != g[-1]:
                continue
            geom = Polygon([(p["lon"], p["lat"]) for p in g])
        else:
            parts = {"outer": [], "inner": []}
            for m in el.get("members", []):
                if m.get("type") == "way" and m.get("role") in parts and m.get("geometry"):
                    parts[m["role"]].append(LineString([(p["lon"], p["lat"]) for p in m["geometry"]]))
            if not parts["outer"]:
                continue
            geom = unary_union(list(polygonize(linemerge(parts["outer"]))))
            if parts["inner"]:
                geom = geom.difference(unary_union(list(polygonize(linemerge(parts["inner"])))))
        if geom.is_valid and not geom.is_empty and geom.geom_type in ("Polygon", "MultiPolygon"):
            out.append((f"{el['type']}/{el['id']}", tags, geom))
    return sorted(out, key=lambda b: b[0])  # stable order -> deterministic output


def prepare():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    to_tm = lambda g: shapely.transform(g, lambda c: np.column_stack(fwd.transform(c[:, 0], c[:, 1])))
    reg = json.loads(LANDMARKS.read_text())
    missing = [s for s, e in reg.items() if not e["exclusion"] and not e.get("exclusion_parts")]
    assert not missing, f"landmarks without an exclusion ring: {missing}"
    # a landmark's ring, or a district's parts: each modelled building's footprint shrunk 0.5 m (district_osm.py)
    excl = STRtree([to_tm(shapely.Polygon(r)) for e in reg.values() for r in ([e["exclusion"]] if e["exclusion"] else []) + e.get("exclusion_parts", [])])
    cbd = next(f["geometry"]["coordinates"] for f in json.loads((ROOT / "data/geojson/landmarks.geojson").read_text())["features"]
               if f["properties"]["slug"] == "session-road")
    cbd_tm = shapely.Point(fwd.transform(*cbd))
    kept, dropped = [], 0
    for oid, tags, geom in load_buildings():
        tm = to_tm(geom)
        if not tm.is_valid or tm.area < 4:
            continue
        if len(excl.query(tm, predicate="intersects")):
            dropped += 1
            continue
        kept.append((oid, tags, geom, tm, tm.distance(cbd_tm)))
    print(f"buildings kept {len(kept):,}, dropped by landmark exclusions {dropped:,}")
    return fwd, kept


def footing(kept, ground):
    """Per building: the lowest and mean ground (true metres) under its outline, sampled at its corners and every 8 m
    along its walls (one vectorised DEM lookup for the whole city)."""
    pts, starts = [], []
    for oid, tags, geom, tm, d in kept:
        ring = (geom if geom.geom_type == "Polygon" else max(geom.geoms, key=lambda g: g.area)).exterior
        n = max(4, int(tm.length / 8))
        starts.append(sum(len(q) for q in pts))
        pts.append(np.vstack([shapely.get_coordinates(ring.interpolate(np.linspace(0, 1, n, endpoint=False), normalized=True)),
                              np.asarray(ring.coords)]))
    allp = np.vstack(pts)
    g = ground(allp[:, 0], allp[:, 1])
    counts = np.diff(starts + [len(allp)])
    return np.minimum.reduceat(g, starts), np.add.reduceat(g, starts) / counts


def building_mesh(oid, tags, tm, lo, mean, top_h, dist_cbd, far):
    """Walls (buried SKIRT_M below the lowest ground) + flat or gable roof, in local metres (east, north, up), corners
    shared by walls and roof (flat shading comes from the shader). The ground is stretched by EXAG, heights are true.
    Far LOD: the minimum rectangle (or the convex hull simplified at 2 m when the rectangle overfills), flat; under
    FAR_BOX_AREA only its roof (the walls are sub-pixel there)."""
    floor = mean * EXAG                          # the building's floor on the stretched ground
    top, foot = floor + top_h, lo * EXAG - SKIRT_M
    rect = tm.minimum_rotated_rectangle
    fill = tm.area / max(rect.area, 1e-9)
    walls = not far or tm.area >= FAR_BOX_AREA
    if far:
        tm = rect if fill >= 0.7 else tm.convex_hull.simplify(2.0)
    else:
        tm = tm.simplify(0.3)
    gable = (not far and dist_cbd >= CBD_M and top_h < 4 * STOREY_M and tm.area <= 300 and fill >= 0.85
             and tags.get("roof:shape") != "flat")
    flat = not gable and (dist_cbd < CBD_M or top_h >= 4 * STOREY_M or far)
    roof = ROOF_FLAT if dist_cbd < CBD_M or top_h >= 4 * STOREY_M else pick(ROOFS_PITCHED, oid)   # far keeps the colour
    w = zlib.crc32((oid + "w").encode()) % len(WALLS)
    colour = (*roof[:3], w * 64 + min(63, int(round((floor % STOREY_M) / STOREY_M * 64)) % 64))
    pos, idx = [], []
    for poly in getattr(tm, "geoms", [tm]):
        if poly.is_empty or poly.geom_type != "Polygon":
            continue
        poly = orient(poly, 1.0)
        tops = []
        for ring in [poly.exterior, *poly.interiors]:
            c = np.asarray(ring.coords)[:-1]
            n, k = len(c), len(pos)
            if not walls:                       # far, small: the roof alone
                pos += [(x, y, top) for x, y in c]
                tops.append((c, k))
                continue
            pos += [(x, y, foot) for x, y in c] + [(x, y, top) for x, y in c]
            for i in range(n):                  # exterior CCW, holes CW: (b_i, b_j, t_j, t_i) faces outward
                j = (i + 1) % n
                idx += [k + i, k + j, k + n + j, k + i, k + n + j, k + n + i]
            tops.append((c, k + n))
        if not gable:
            verts = np.vstack([c for c, _ in tops])
            ends = np.cumsum([len(c) for c, _ in tops]).astype(np.uint32)
            tri = mapbox_earcut.triangulate_float64(verts, ends).reshape(-1, 3)
            a, b, cc = verts[tri[:, 0]], verts[tri[:, 1]], verts[tri[:, 2]]
            flip = ((b[:, 0] - a[:, 0]) * (cc[:, 1] - a[:, 1]) - (cc[:, 0] - a[:, 0]) * (b[:, 1] - a[:, 1])) < 0
            tri[flip] = tri[flip][:, [0, 2, 1]]  # every roof triangle faces up (CCW from above)
            remap = np.concatenate([np.arange(len(c)) + k0 for c, k0 in tops])
            idx += remap[tri].ravel().tolist()
    if gable:
        r = np.asarray(rect.exterior.coords)[:4]
        if np.linalg.norm(r[1] - r[0]) < np.linalg.norm(r[2] - r[1]):
            r = np.roll(r, -1, axis=0)  # r[0]->r[1] is now a long side
        ridge_z = top + np.linalg.norm(r[2] - r[1]) / 2 * math.tan(ROOF_PITCH)
        m03, m12 = (r[0] + r[3]) / 2, (r[1] + r[2]) / 2
        k = len(pos)
        pos += [(*r[0], top), (*r[1], top), (*r[2], top), (*r[3], top), (*m03, ridge_z), (*m12, ridge_z)]
        centre = np.array([*np.asarray(rect.centroid.coords)[0], top])
        for f in [(0, 1, 5), (0, 5, 4), (2, 3, 4), (2, 4, 5), (1, 2, 5), (3, 0, 4)]:   # two slopes, two gable ends
            q = np.array([pos[k + i] for i in f])
            out = np.dot(np.cross(q[1] - q[0], q[2] - q[0]), q.mean(0) - centre) >= 0
            idx += [k + f[0], k + f[1], k + f[2]] if out else [k + f[0], k + f[2], k + f[1]]
    return pos, [colour] * len(pos), idx


def write_glb(path, pos, col, idx):
    p = np.asarray(pos, np.float32)
    p = np.column_stack([p[:, 0], p[:, 2], -p[:, 1]]).astype(np.float32)  # (east, north, up) -> glTF (east, up, -north)
    c = np.asarray(col, np.uint8)
    i = np.asarray(idx, np.uint32)
    binary = p.tobytes() + c.tobytes() + i.tobytes()
    g = {"asset": {"version": "2.0", "generator": "baguio-city-3d build_massing"}, "scene": 0, "scenes": [{"nodes": [0]}],
         "nodes": [{"mesh": 0}], "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1}, "indices": 2, "material": 0}]}],
         "materials": [{"name": "massing", "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.9}}],
         "buffers": [{"byteLength": len(binary)}],
         "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": p.nbytes, "target": 34962},
                         {"buffer": 0, "byteOffset": p.nbytes, "byteLength": c.nbytes, "target": 34962},
                         {"buffer": 0, "byteOffset": p.nbytes + c.nbytes, "byteLength": i.nbytes, "target": 34963}],
         "accessors": [{"bufferView": 0, "componentType": 5126, "count": len(p), "type": "VEC3", "min": p.min(0).tolist(), "max": p.max(0).tolist()},
                       {"bufferView": 1, "componentType": 5121, "normalized": True, "count": len(c), "type": "VEC4"},
                       {"bufferView": 2, "componentType": 5125, "count": len(i), "type": "SCALAR"}]}
    js = json.dumps(g, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    path.write_bytes(b"glTF" + (2).to_bytes(4, "little") + total.to_bytes(4, "little")
                     + len(js).to_bytes(4, "little") + b"JSON" + js + len(binary).to_bytes(4, "little") + b"BIN\0" + binary)
    return len(i) // 3


def quadtree(items, z, x, y, cap, out):
    """Split tile (z, x, y) into its four children while it holds more than `cap` buildings (by centroid)."""
    if len(items) <= cap or z >= 18:
        out[(z, x, y)] = items
        return
    kids = {}
    for it in items:
        c = it[2].centroid
        kids.setdefault(slippy(c.x, c.y, z + 1), []).append(it)
    for (cx, cy), sub in sorted(kids.items()):
        quadtree(sub, z + 1, cx, cy, cap, out)


def measure():
    fwd, kept = prepare()
    lo14, _ = footing(kept, Ground(1))
    lo12, _ = footing(kept, Ground(4))
    gap = np.maximum(0.0, lo14 - lo12) * EXAG
    heights = np.array([height_m(t, tm.area, d, o) for o, t, g, tm, d in kept])
    cbd = np.array([d < CBD_M for *_, d in kept])
    print(f"skirt: z14-vs-z12 lowest-ground gap (stretched) p50 {np.percentile(gap, 50):.1f} m, p95 {np.percentile(gap, 95):.1f} m, p99 {np.percentile(gap, 99):.1f} m")
    print(f"heights: CBD median {np.median(heights[cbd]) / STOREY_M:.1f} storeys, elsewhere {np.median(heights[~cbd]) / STOREY_M:.1f}")
    for z in (14, 15):
        counts = {}
        for o, t, g, tm, d in kept:
            c = g.centroid
            counts[slippy(c.x, c.y, z)] = counts.get(slippy(c.x, c.y, z), 0) + 1
        v = np.array(list(counts.values()))
        print(f"z{z}: {len(v)} tiles, buildings per tile p50 {np.percentile(v, 50):.0f}, p95 {np.percentile(v, 95):.0f}, max {v.max()}")


def build(only=None):
    fwd, kept = prepare()
    lo, mean = footing(kept, Ground(1))
    items = [(oid, tags, geom, tm, d, a, b) for (oid, tags, geom, tm, d), a, b in zip(kept, lo, mean)]
    sets = {}
    for lod, z0, cap, pool in (("near", ZOOM, NEAR_MAX, items), ("far", FAR_ZOOM, FAR_MAX, [it for it in items if it[3].area >= FAR_MIN_AREA])):
        if only and lod != only:
            continue
        roots = {}
        for it in pool:
            c = it[2].centroid
            roots.setdefault(slippy(c.x, c.y, z0), []).append(it)
        tiles = {}
        for (x, y), sub in sorted(roots.items()):
            quadtree(sub, z0, x, y, cap, tiles)
        sets[lod] = tiles
    WORK.joinpath("raw").mkdir(parents=True, exist_ok=True)
    for old in WORK.joinpath("raw").glob(f"{only or ''}*.glb"):
        old.unlink()
    jobs = []
    for lod, tiles in sets.items():
        for (z, x, y), its in sorted(tiles.items()):
            w, s, e, n = tile_bounds(x, y, z)
            alng, alat = (w + e) / 2, (s + n) / 2
            ax, ay = fwd.transform(alng, alat)
            pos, col, idx = [], [], []
            for oid, tags, geom, tm, d, a, b in its:
                local = shapely.transform(tm, lambda q: q - np.array([ax, ay]))
                p, c, i = building_mesh(oid, tags, local, a, b, height_m(tags, tm.area, d, oid), d, lod == "far")
                idx += [k + len(pos) for k in i]
                pos += p
                col += c
            raw = WORK / "raw" / f"{lod}-{z}-{x}-{y}.glb"
            tris = write_glb(raw, pos, col, idx)
            jobs.append((lod, f"{z}-{x}-{y}", raw, tris, len(its), [alng, alat], [round(v, 6) for v in shapely.total_bounds([it[2] for it in its]).tolist()]))
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob(f"{only or ''}*.glb"):
        old.unlink()

    def pack(job):
        lod, tid, raw, tris, count, anchor, bbox = job
        out = raw.with_suffix(".packed.glb")
        flags = ["-cc"] if lod == "near" else ["-cc", "-vp", "12"]   # far: ~1 m steps over a z13 tile, sub-pixel there
        subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw), "-o", str(out), *flags], check=True, capture_output=True)
        data = out.read_bytes()
        name = f"{lod}-{tid}.{hashlib.sha256(data).hexdigest()[:8]}.glb"
        (PUBLIC / name).write_bytes(data)
        return lod, {"id": tid, "anchor": anchor, "bbox": bbox, "url": f"/models/buildings/{name}", "bytes": len(data),
                     "triangles": tris, "buildings": count}

    doc = {"nearZoom": 15, "skirtM": SKIRT_M, "exaggeration": EXAG, "near": [], "far": []}
    if only:                                      # keep the other level as built
        doc.update({k: v for k, v in json.loads((PUBLIC / "index.json").read_text()).items() if k not in ("skirtM", "exaggeration", only)})
    with ThreadPoolExecutor(8) as pool:
        for lod, entry in pool.map(pack, jobs):
            doc[lod].append(entry)
    for lod in ("near", "far"):
        doc[lod].sort(key=lambda t: t["id"])
    (PUBLIC / "index.json").write_text(json.dumps(doc, separators=(",", ":")) + "\n")   # compact: every visit fetches it (C6)
    for lod in [only] if only else ("near", "far"):
        sizes = np.array([t["bytes"] for t in doc[lod]])
        print(f"{lod}: {len(sizes)} tiles, bytes p50 {np.percentile(sizes, 50):,.0f} p95 {np.percentile(sizes, 95):,.0f} max {sizes.max():,}, "
              f"total {sizes.sum():,}; triangles {sum(t['triangles'] for t in doc[lod]):,}; buildings {sum(t['buildings'] for t in doc[lod]):,}")


if __name__ == "__main__":
    {"measure": measure, "build": build}[sys.argv[1]](*sys.argv[2:])
