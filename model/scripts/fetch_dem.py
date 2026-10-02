# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["rasterio==1.5.2"]
# ///
"""M1: clip the Copernicus GLO-30 tile that covers Baguio to the padded map bounds, read remotely.

Output: model/data/dem/copernicus-glo30-baguio.tif, EPSG:4326, EGM2008 heights in metres,
1 arc-second posts. Run: uv run model/scripts/fetch_dem.py"""
import datetime
import math
import subprocess

import rasterio
from rasterio.windows import Window, from_bounds

from common import DATA, DEM, PADDED, ROOT, file_hash, load_sources, save_sources

# One 1°x1° tile (N16-17, E120-121) holds all of PADDED.
TILE = "Copernicus_DSM_COG_10_N16_00_E120_00_DEM"
URL = f"https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/{TILE}/{TILE}.tif"  # the bucket's own region
LICENCE = ("https://dataspace.copernicus.eu/explore-data/data-collections/"
           "copernicus-contributing-missions/collections-description/COP-DEM")
ATTRIBUTION = ("produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH "
               "2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved")


def remote_headers():
    out = subprocess.run(["curl", "-fsSI", URL], check=True, capture_output=True, text=True).stdout
    h = dict(line.split(": ", 1) for line in out.splitlines() if ": " in line)
    h = {k.lower(): v.strip() for k, v in h.items()}
    return {"etag": h["etag"].strip('"'), "last_modified": h["last-modified"], "remote_bytes": int(h["content-length"])}


PIECE = 256 * 1024
PIECES = DATA / "raw" / "copernicus-pieces"
SPARSE = DATA / "raw" / f"{TILE}.sparse.tif"


def fetch_range(start, length):
    """Bytes [start, start+length) of the remote tile, in 256 KiB pieces cached on disk, so an
    interrupted run resumes where it stopped (the link measured 4-7 KB/s on 2026-10-02)."""
    PIECES.mkdir(parents=True, exist_ok=True)
    out = bytearray()
    for a in range(start, start + length, PIECE):
        b = min(a + PIECE, start + length) - 1
        piece = PIECES / f"{a}-{b}.bin"
        if not piece.exists() or piece.stat().st_size != b - a + 1:
            subprocess.run(["curl", "-fsS", "--retry", "8", "--retry-all-errors", "-r", f"{a}-{b}", "-o", str(piece), URL], check=True)
        out += piece.read_bytes()
        assert len(out) == b - start + 1, f"short piece {piece.name}"
    return bytes(out)


def clip():
    """Fetch only the COG's header and the internal 1024x1024 tiles under PADDED (about 10 MB of the
    32 MB tile) into a sparse local copy, then clip from it. Provenance = ETag + the clip's sha256."""
    head = remote_headers()
    SPARSE.parent.mkdir(parents=True, exist_ok=True)
    with open(SPARSE, "wb") as f:
        f.truncate(head["remote_bytes"])
        f.write(fetch_range(0, 65536))
    with rasterio.open(SPARSE) as src:
        w = from_bounds(*PADDED, transform=src.transform)
        # Snap outward to whole posts so the clip always covers PADDED.
        c0, r0 = math.floor(w.col_off), math.floor(w.row_off)
        c1, r1 = math.ceil(w.col_off + w.width), math.ceil(w.row_off + w.height)
        bh, bw = src.block_shapes[0]
        blocks = [(bx, by) for by in range(r0 // bh, (r1 - 1) // bh + 1) for bx in range(c0 // bw, (c1 - 1) // bw + 1)]
        spans = [(int(src.get_tag_item(f"BLOCK_OFFSET_{bx}_{by}", "TIFF", bidx=1)),
                  int(src.get_tag_item(f"BLOCK_SIZE_{bx}_{by}", "TIFF", bidx=1))) for bx, by in blocks]
    assert all(o > 0 and n > 0 for o, n in spans), f"block offsets beyond the header: {spans}"
    with open(SPARSE, "r+b") as f:
        for o, n in spans:
            f.seek(o)
            f.write(fetch_range(o, n))
    with rasterio.open(SPARSE) as src:
        win = Window(c0, r0, c1 - c0, r1 - r0)
        data = src.read(1, window=win)
        profile = dict(driver="GTiff", dtype="float32", count=1, width=c1 - c0, height=r1 - r0,
                       crs=src.crs, transform=src.window_transform(win), compress="deflate", predictor=3)
    DEM.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(DEM, "w", **profile) as dst:
        dst.write(data, 1)
    today = datetime.date.today().isoformat()
    sources = load_sources()
    sources["copernicus-glo30"] = {
        "url": URL, **head, "blocks": blocks, "window_posts": [c0, r0, c1 - c0, r1 - r0],
        "file": str(DEM.relative_to(ROOT)), "retrieved": today, "bytes": DEM.stat().st_size,
        "sha256": file_hash(DEM, "sha256"), "vertical_datum": "EGM2008 (EPSG:3855)",
        "licence": LICENCE, "attribution": ATTRIBUTION,
        "access_note": f"Copernicus Digital Elevation Model (DEM) was accessed on {today} "
                       "from https://registry.opendata.aws/copernicus-dem",
    }
    save_sources(sources)
    print(f"wrote {DEM.relative_to(ROOT)}: {c1 - c0}x{r1 - r0} posts from blocks {blocks}, "
          f"{float(data.min()):.1f} to {float(data.max()):.1f} m")


if __name__ == "__main__":
    clip()
