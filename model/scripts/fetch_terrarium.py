# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pillow==11.3.0"]
# ///
"""The map's own terrain: AWS Terrain Tiles (Terrarium encoding), zoom 14, the source and zoom that
lib/map/sources.ts gives MapLibre. Landmarks lay ground-hugging parts on the higher of this and Copernicus
(lm_common.rel_ground): the app sets each model on this terrain, and the two DEMs differ by metres on steep
slopes (Mines View's walkway sank under the map's ground, owner report 2026-10-05).
Fetches the z14 tiles within 400 m of every landmark destination, decodes each to metres
(model/data/terrarium/14/<x>/<y>.npy, float32 256 x 256, rows from the north) and records provenance.
Run: uv run model/scripts/fetch_terrarium.py"""
import datetime
import io
import json
import math
import subprocess

import numpy as np
from PIL import Image

from common import DATA, ROOT, file_hash, load_sources, save_sources

Z = 14
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
DIR = DATA / "terrarium" / str(Z)
PAD_M = 400.0


def tile(lng, lat):
    n = 2 ** Z
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return int((lng + 180) / 360 * n), int(y)


def main():
    feats = json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]
    need = set()
    for f in feats:
        lng, lat = f["geometry"]["coordinates"]
        dlng, dlat = PAD_M / (111_320 * math.cos(math.radians(lat))), PAD_M / 110_574
        (x0, y0), (x1, y1) = tile(lng - dlng, lat + dlat), tile(lng + dlng, lat - dlat)
        need |= {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}
    sources = load_sources()
    rec = sources.get("aws-terrarium-z14", {"tiles": {}})
    for x, y in sorted(need):
        png = DIR / str(x) / f"{y}.png"
        if not png.exists():
            png.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["curl", "-fsSL", "--retry", "5", "--retry-all-errors", "-A", "baguio-city-3d/1.0",
                            "-o", str(png), URL.format(z=Z, x=x, y=y)], check=True)
        rgb = np.asarray(Image.open(io.BytesIO(png.read_bytes())).convert("RGB"), dtype=np.float64)
        np.save(png.with_suffix(".npy"), (rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768).astype(np.float32))
        rec["tiles"][f"{Z}/{x}/{y}"] = file_hash(png, "sha256")
    rec.update({"url": URL, "zoom": Z, "retrieved": rec.get("retrieved", datetime.date.today().isoformat()),
                "use": "landmark ground fitting only (lm_common.rel_ground); not shipped",
                "attribution": "Terrain Tiles: Mapzen / Tilezen, AWS Open Data (https://github.com/tilezen/joerd/blob/master/docs/attribution.md)"})
    sources["aws-terrarium-z14"] = rec
    save_sources(sources)
    print(f"terrarium z{Z}: {len(need)} tiles")


if __name__ == "__main__":
    main()
