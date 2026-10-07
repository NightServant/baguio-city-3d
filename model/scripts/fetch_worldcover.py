# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "rasterio==1.4.3"]
# ///
"""Land cover for the landscape (owner request 2026-10-07: green and stone landscapes, trees of every kind):
ESA WorldCover 2021 v200, 10 m, read as a window of the padded bounds straight from the cloud-optimised
GeoTIFF on AWS Open Data (HTTP range requests; the 3x3 degree tile itself is not downloaded).
Classes: 10 tree cover, 20 shrubland, 30 grassland, 40 cropland, 50 built-up, 60 bare/sparse, 70 snow,
80 water, 90 herbaceous wetland, 95 mangroves, 100 moss and lichen.
Output: model/data/landcover/worldcover.npz (classes, uint8, north-up; west/north edges and pixel size in degrees).
Run: uv run model/scripts/fetch_worldcover.py"""
import datetime

import numpy as np
import rasterio
from rasterio.windows import from_bounds

from common import DATA, PADDED, ROOT, file_hash, load_sources, save_sources

URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N15E120_Map.tif"
OUT = DATA / "landcover" / "worldcover.npz"


def main():
    with rasterio.Env(GDAL_HTTP_USERAGENT="baguio-city-3d/1.0", GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(URL) as src:
            win = from_bounds(*PADDED, transform=src.transform).round_offsets().round_lengths()
            cls = src.read(1, window=win)
            t = src.window_transform(win)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(OUT, classes=cls, west=t.c, north=t.f, dx=t.a, dy=-t.e)
    sources = load_sources()
    sources["esa-worldcover"] = {
        "url": URL, "file": str(OUT.relative_to(ROOT)), "retrieved": datetime.date.today().isoformat(),
        "window": [int(win.col_off), int(win.row_off), int(win.width), int(win.height)],
        "md5": file_hash(OUT, "md5"),
        "licence": "CC BY 4.0, https://creativecommons.org/licenses/by/4.0/",
        "attribution": "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) "
                       "processed by ESA WorldCover consortium",
    }
    save_sources(sources)
    vals, counts = np.unique(cls, return_counts=True)
    print(f"wrote {OUT.relative_to(ROOT)}: {cls.shape[1]} x {cls.shape[0]} px of {t.a * 111320:.1f} m;",
          {int(v): f"{c / cls.size:.1%}" for v, c in zip(vals, counts)})


if __name__ == "__main__":
    main()
