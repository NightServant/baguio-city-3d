# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pillow==11.3.0", "scipy==1.16.2", "shapely==2.1.2", "pyproj==3.8.0", "mapbox-earcut==1.0.3"]
# ///
"""The city's trees, shrubs and rocks in 3D (owner 2026-10-07: "Baguio City must be filled with different kinds of
trees, not just pine trees"), as GPU-instanced tiles for the web map's near zoom:
- sites from the land cover (build_landcover.py's classes: ESA WorldCover 2021 with OSM's woods, farms, lawns and rock),
  at a density per class (DENSITY, per hectare, ESTIMATEs), plus every OSM single tree and tree row;
- kept clear of buildings, of every road, path and stair at its width, of water, and of every landmark's exclusion
  ring (the landmarks plant their own);
- species by zone (model/flora.json: forest away from buildings, urban among them, park in OSM parks and gardens),
  height in the species' range; rocks on bare ground and slopes steeper than 30 degrees, shrubs under the trees and
  in the scrub;
- standing on the map's terrain (AWS Terrarium z14, stretched by EXAG), z16 tiles over the city's bounds.
A tile is N records of 8 bytes, in random order (the runtime thins far tiles by taking a prefix): x and y in 1/80 m
from the tile centre + 400 m (uint16), the ground in 1/20 m above the tile's lowest (uint16), species, height in 1/8 m.
The archetype meshes (model/blender/flora.py) ship once, as one GLB.
Writes public/models/flora/. Run: uv run model/scripts/build_flora.py"""
import hashlib
import json
import math
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import shapely
from PIL import Image, ImageDraw
from scipy import ndimage
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

from build_landcover import CLASSES, CROP, FOREST, GRASS, LAWN, NONE, ROCK, SCRUB, WATER, polygon
from build_massing import EXAG, Ground, load_buildings, slippy, tile_bounds
from build_roads import DEFAULT_LANES, LANE_M, MIN_WIDTH
from common import DATA, EXACT, LANDMARKS, OSM, ROOT

Z = 16
FLORA = json.loads((ROOT / "model" / "flora.json").read_text())
ARCH = list(FLORA["archetypes"])
SPECIES = {s["key"]: i for i, s in enumerate(FLORA["species"])}
PUBLIC = ROOT / "public" / "models" / "flora"
C = 40075016.686
LAT0 = 16.4
K0 = C * math.cos(math.radians(LAT0))          # the planar frame: Web Mercator x true metres at LAT0 (north up)
# per hectare (ESTIMATEs): trees, shrubs, rocks. "forest" is WorldCover tree cover over 25 m from a building, "urban"
# the tree cover nearer; NONE is WorldCover's built-up land (yards and street trees)
DENSITY = {"forest": (34, 5, 1.5), "urban": (20, 3, 0.5), NONE: (2.5, 1, 0), GRASS: (1.5, 4, 1), LAWN: (2.5, 6, 0),
           SCRUB: (4, 70, 3), CROP: (0.6, 1, 0), ROCK: (1, 12, 30)}
STEEP_DEG, STEEP_ROCKS = 30.0, 4.0          # rocks a hectare added on slopes steeper than this
PATH_W = {"footway": 2.0, "path": 1.5, "cycleway": 2.0, "steps": 2.0, "bridleway": 2.0, "pedestrian": 6.0, "track": 3.5,
          "corridor": 2.0}                    # metres (ESTIMATEs)
CLEAR_M = 1.2                                 # trunks stand at least this far from a wall or a kerb
URBAN_M = 25.0


def gxy(lng, lat):
    lng, lat = np.asarray(lng, float), np.asarray(lat, float)
    return (lng + 180) / 360 * K0, np.arcsinh(np.tan(np.radians(lat))) / (2 * math.pi) * K0


def to_g(geom):
    return shapely.transform(geom, lambda c: np.column_stack(gxy(c[:, 0], c[:, 1])))


def obstacles():
    """Buildings, roads (drivable at lanes x LANE_M, paths and steps at PATH_W), and landmark rings, in the planar frame."""
    blds = [to_g(g) for _, _, g in load_buildings()]
    roads = []
    for el in json.loads(OSM.read_text())["elements"]:
        t, g = el.get("tags", {}), el.get("geometry") or []
        kind = t.get("highway", "").removesuffix("_link")
        if el["type"] != "way" or len(g) < 2 or not kind or t.get("tunnel") == "yes":
            continue
        if kind in DEFAULT_LANES:
            try:
                lanes = int(str(t.get("lanes", "")).split(";")[0])
            except ValueError:
                lanes = DEFAULT_LANES[kind]
            w = max(lanes * LANE_M, MIN_WIDTH.get(kind, 3.0)) + 3.0      # a verge or sidewalk each side
        else:
            w = PATH_W.get(kind, 2.0)
        roads.append(shapely.buffer(to_g(LineString([(p["lon"], p["lat"]) for p in g])), w / 2 + CLEAR_M, cap_style="flat"))
    rings = [to_g(Polygon(e["exclusion"])) for e in json.loads(LANDMARKS.read_text()).values()]
    land = json.loads((DATA / "osm" / "landscape.json").read_text())["elements"]
    parks = [to_g(p) for el in land if el.get("tags", {}).get("leisure") in ("park", "garden") and (p := polygon(el)) is not None]
    trees = [gxy(el["lon"], el["lat"]) for el in land if el["type"] == "node" and el.get("tags", {}).get("natural") == "tree"]
    for el in land:
        if el["type"] == "way" and el.get("tags", {}).get("natural") == "tree_row":
            ln = to_g(LineString([(p["lon"], p["lat"]) for p in el["geometry"]]))
            trees += [(q.x, q.y) for q in (ln.interpolate(d) for d in np.arange(0, ln.length, 8.0))]
    return blds, roads, rings, parks, trees


_S = {}


def _init():
    blds, roads, rings, parks, trees = obstacles()
    c = np.load(CLASSES)
    _S.update(blds=blds, bt=STRtree(blds), roads=roads, rt=STRtree(roads), rings=rings, xt=STRtree(rings), parks=parks,
              pt=STRtree(parks), trees=np.array(trees, float).reshape(-1, 2), cls=c["classes"], west=float(c["west"]),
              north=float(c["north"]), dx=float(c["dx"]), dy=float(c["dy"]), ground=Ground(1))
    weights = {}
    for zone, mix in FLORA["zones"].items():
        keys = list(mix)
        p = np.array([mix[k] for k in keys], float)
        weights[zone] = (np.array([SPECIES[k] for k in keys]), p / p.sum())
    _S["mix"] = weights


def raster(geoms, x0, y1, n):
    """A 1 m mask (n x n, row 0 at the top) of shapely polygons in the planar frame."""
    im = Image.new("1", (n, n), 0)
    d = ImageDraw.Draw(im)
    for g in geoms:
        for p in getattr(g, "geoms", [g]):
            if p.geom_type != "Polygon" or p.is_empty:
                continue
            d.polygon([(x - x0, y1 - y) for x, y in p.exterior.coords], fill=1)
            for h in p.interiors:
                d.polygon([(x - x0, y1 - y) for x, y in h.coords], fill=0)
    return np.asarray(im, bool)


def tile(x, y):
    S = _S
    w, s, e, n = tile_bounds(x, y, Z)
    rng = np.random.default_rng(int(hashlib.sha256(f"flora-{x}-{y}".encode()).hexdigest()[:8], 16))
    # candidate sites: class-grid cells inside the tile, each kept with its class's per-hectare probability
    c0, c1 = int((w - S["west"]) / S["dx"]), int(math.ceil((e - S["west"]) / S["dx"]))
    r0, r1 = int((S["north"] - n) / S["dy"]), int(math.ceil((S["north"] - s) / S["dy"]))
    c0, r0, c1, r1 = max(c0, 0), max(r0, 0), min(c1, S["cls"].shape[1]), min(r1, S["cls"].shape[0])
    if c1 <= c0 or r1 <= r0:
        return None
    cls = S["cls"][r0:r1, c0:c1]
    cell_ha = S["dx"] * 111_320 * math.cos(math.radians(LAT0)) * S["dy"] * 110_574 / 1e4
    gx0, gy0 = gxy(w, s)
    gx1, gy1 = gxy(e, n)
    N = int(math.ceil(max(gx1 - gx0, gy1 - gy0))) + 2
    box = shapely.box(gx0 - 2, gy0 - 2, gx1 + 2, gy1 + 2)
    blds = [S["blds"][i] for i in S["bt"].query(box)]
    solid = raster(blds, gx0, gy1, N)
    near_b = ndimage.distance_transform_edt(~solid) if solid.any() else np.full(solid.shape, 1e9)
    blocked = ndimage.binary_dilation(solid, iterations=int(CLEAR_M + 0.5))
    blocked |= raster([S["roads"][i] for i in S["rt"].query(box)], gx0, gy1, N)
    blocked |= raster([S["rings"][i] for i in S["xt"].query(box)], gx0, gy1, N)
    park = raster([S["parks"][i] for i in S["pt"].query(box)], gx0, gy1, N)
    rows, cols = np.nonzero(cls != WATER)
    k = cls[rows, cols]
    lng = S["west"] + (c0 + cols + rng.random(len(cols))) * S["dx"]
    lat = S["north"] - (r0 + rows + rng.random(len(rows))) * S["dy"]
    px, py = gxy(lng, lat)
    i, j = np.clip((gy1 - py).astype(int), 0, N - 1), np.clip((px - gx0).astype(int), 0, N - 1)
    ok = ~blocked[i, j] & (lng >= w) & (lng < e) & (lat >= s) & (lat < n)
    zone_key = np.where(k == FOREST, np.where(near_b[i, j] > URBAN_M, 1, 2), 0)    # 1 forest, 2 urban (tree cover only)
    recs = []
    for kind in range(3):                                                         # trees, shrubs, rocks
        dens = np.array([DENSITY["forest" if zk == 1 else "urban" if zk == 2 else kk][kind] if (zk or kk in DENSITY) else 0.0
                         for kk, zk in zip(k.tolist(), zone_key.tolist())])
        if kind == 2:
            g = S["ground"]
            gz = lambda a, b: g(a, b)
            dzx = (gz(lng + 2e-5, lat) - gz(lng - 2e-5, lat)) / (4e-5 * 111_320 * math.cos(math.radians(LAT0)))
            dzy = (gz(lng, lat + 2e-5) - gz(lng, lat - 2e-5)) / (4e-5 * 110_574)
            steep = np.degrees(np.arctan(np.hypot(dzx, dzy))) > STEEP_DEG
            dens = dens + np.where(steep & (k != NONE), STEEP_ROCKS, 0)
        keep = ok & (rng.random(len(k)) < dens * cell_ha)
        recs.append((kind, lng[keep], lat[keep], k[keep], zone_key[keep], park[i[keep], j[keep]]))
    # OSM's own trees where mapped, kept clear of roads, buildings and landmarks like the rest (a mapped street tree on
    # Session Road's median stood a pine in the traffic: owner 2026-10-07, "The rendering issue persists")
    t = S["trees"]
    inside = (t[:, 0] >= gx0) & (t[:, 0] < gx1) & (t[:, 1] >= gy0) & (t[:, 1] < gy1)
    if inside.any():
        tx, ty = t[inside, 0], t[inside, 1]
        ti, tj = np.clip((gy1 - ty).astype(int), 0, N - 1), np.clip((tx - gx0).astype(int), 0, N - 1)
        clear = ~blocked[ti, tj]
        tx, ty, ti, tj = tx[clear], ty[clear], ti[clear], tj[clear]
        tlng = tx / K0 * 360 - 180
        tlat = np.degrees(np.arctan(np.sinh(ty / K0 * 2 * math.pi)))
        recs.append((0, tlng, tlat, np.full(len(tx), NONE), np.full(len(tx), 2), park[ti, tj]))
    lngs, lats, sp, hs = [], [], [], []
    for kind, lg, lt, kk, zk, pk in recs:
        if not len(lg):
            continue
        if kind == 0:
            zone = np.where(pk, "park", np.where(zk == 1, "forest", np.where((kk == LAWN) | (kk == GRASS), "park", "urban")))
            ids = np.empty(len(lg), int)
            for zname in ("forest", "urban", "park"):
                m = zone == zname
                ids[m] = rng.choice(S["mix"][zname][0], m.sum(), p=S["mix"][zname][1])
        elif kind == 1:
            ids = np.where((kk == SCRUB) | (kk == ROCK), SPECIES["shrub_dry"], SPECIES["shrub"])
        else:
            ids = np.full(len(lg), SPECIES["rock"])
        lo = np.array([FLORA["species"][q]["height_m"][0] for q in ids])
        hi = np.array([FLORA["species"][q]["height_m"][1] for q in ids])
        h = lo + (hi - lo) * rng.random(len(ids)) ** 1.3                         # more young trees than old
        if kind == 2:
            h = np.where(kk == ROCK, h * 1.8, h)                                  # outcrops on bare rock
        lngs.append(lg), lats.append(lt), sp.append(ids), hs.append(h)
    if not lngs:
        return None
    lng, lat, sp, h = np.concatenate(lngs), np.concatenate(lats), np.concatenate(sp), np.concatenate(hs)
    order = rng.permutation(len(lng))
    lng, lat, sp, h = lng[order], lat[order], sp[order], h[order]
    # the tile frame: metres east and north of the tile centre at its own Mercator scale (as the runtime places it)
    clng, clat = (w + e) / 2, (s + n) / 2
    k_t = C * math.cos(math.radians(clat))
    mx = lambda a: (np.asarray(a) + 180) / 360
    my = lambda a: np.arcsinh(np.tan(np.radians(np.asarray(a)))) / (2 * math.pi)
    ex, ny = (mx(lng) - mx(clng)) * k_t, (my(lat) - my(clat)) * k_t
    ground = S["ground"](lng, lat) * EXAG
    e0 = math.floor(ground.min() * 20) / 20
    rec = np.zeros(len(lng), dtype=[("x", "<u2"), ("y", "<u2"), ("e", "<u2"), ("s", "u1"), ("h", "u1")])
    rec["x"] = np.clip(np.round((ex + 400) * 80), 0, 65535)
    rec["y"] = np.clip(np.round((ny + 400) * 80), 0, 65535)
    rec["e"] = np.clip(np.round((ground - e0) * 20), 0, 65535)
    rec["s"], rec["h"] = sp, np.clip(np.round(h * 8), 1, 255)
    data = rec.tobytes()
    name = f"{Z}-{x}-{y}.{hashlib.sha256(data).hexdigest()[:8]}.bin"
    (PUBLIC / name).write_bytes(data)
    counts = np.bincount([ARCH.index(FLORA["species"][q]["archetype"]) for q in sp], minlength=len(ARCH))
    return [x, y, len(lng), round(e0, 2), name], counts


def lin(c):
    c = np.asarray(c, float) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def archetypes_glb():
    """The archetypes (full and far versions) as one GLB of named meshes: glTF frame (x east, y up, z south), linear
    RGBA vertex colours; alpha marks the tinted parts."""
    a = np.load(DATA / "flora" / "archetypes.npz")
    names = ARCH + [f"{k}_lod" for k in ARCH if f"{k}_lod_pos" in a]
    binary, views, accessors, meshes, nodes = b"", [], [], [], []

    def add(arr, target, comp, typ, norm=False, mm=False):
        nonlocal binary
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": arr.nbytes, "target": target})
        acc = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
        if norm:
            acc["normalized"] = True
        if mm:
            acc["min"], acc["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accessors.append(acc)
        binary += arr.tobytes() + b"\0" * (-arr.nbytes % 4)
        return len(accessors) - 1

    for k in names:
        p, c, i = a[f"{k}_pos"], a[f"{k}_col"], a[f"{k}_idx"]
        pos = np.column_stack([p[:, 0], p[:, 2], -p[:, 1]]).astype(np.float32)
        col = np.column_stack([np.round(lin(c[:, :3]) * 255), c[:, 3]]).astype(np.uint8)
        prim = {"attributes": {"POSITION": add(pos, 34962, 5126, "VEC3", mm=True), "COLOR_0": add(col, 34962, 5121, "VEC4", True)},
                "indices": add(i.reshape(-1).astype(np.uint16), 34963, 5123, "SCALAR"), "material": 0}
        meshes.append({"name": k, "primitives": [prim]})
        nodes.append({"name": k, "mesh": len(meshes) - 1})
    g = {"asset": {"version": "2.0", "generator": "baguio-city-3d build_flora"}, "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}],
         "nodes": nodes, "meshes": meshes, "materials": [{"name": "flora", "pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 0.9}}],
         "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors}
    js = json.dumps(g, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    data = (b"glTF" + (2).to_bytes(4, "little") + total.to_bytes(4, "little") + len(js).to_bytes(4, "little") + b"JSON" + js
            + len(binary).to_bytes(4, "little") + b"BIN\0" + binary)
    name = f"archetypes.{hashlib.sha256(data).hexdigest()[:8]}.glb"
    (PUBLIC / name).write_bytes(data)
    return name, names


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.iterdir():
        old.unlink()
    x0, y0 = slippy(EXACT[0], EXACT[3], Z)
    x1, y1 = slippy(EXACT[2], EXACT[1], Z)
    jobs = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    with ProcessPoolExecutor(initializer=_init) as ex:
        out = [r for r in ex.map(tile, *zip(*jobs), chunksize=8) if r]
    tiles = [r[0] for r in out]
    per_arch = np.sum([r[1] for r in out], axis=0)
    glb, meshes = archetypes_glb()
    index = {"z": Z, "archetypes": f"/models/flora/{glb}", "meshes": meshes,
             "ref": [FLORA["archetypes"][k]["ref_height_m"] for k in ARCH],
             "species": [[ARCH.index(s["archetype"]), *(s.get("bloom") or s["foliage"])] for s in FLORA["species"]],
             "tiles": tiles}
    (PUBLIC / "index.json").write_text(json.dumps(index, separators=(",", ":")) + "\n")
    sizes = np.array([t[2] * 8 for t in tiles])
    print(f"flora: {len(tiles)} tiles, {sizes.sum() / 1e6:.1f} MB, {int(sizes.sum() // 8):,} instances; per tile p50 "
          f"{np.median(sizes) / 1e3:.1f} KB, p95 {np.percentile(sizes, 95) / 1e3:.1f} KB, max {sizes.max() / 1e3:.1f} KB")
    print("per archetype:", dict(zip(ARCH, per_arch.tolist())))


if __name__ == "__main__":
    main()
