# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["rasterio==1.5.2", "pyproj==3.8.0"]
# ///
"""M2: project every DEM post into the model frame (contract C1) for Blender.

Writes model/data/terrain/{E,N,Z}.npy (float32, rows x cols, row 0 = south edge, col 0 = west edge),
anchors.json and grid.json. Run: uv run model/scripts/terrain_grid.py"""
import json

import numpy as np
import rasterio
from pyproj import Transformer

from common import DEM, LOCAL_TM, ROOT, TERRAIN, file_hash

RIDGE = (120.628, 16.417)  # spec §5 registration check
# lib/constants.ts DEFAULT_CAMERA and CAMERA_PRESETS (center, zoom, pitch, bearing)
VIEWS = {
    "default": ((120.596, 16.4023), 13.5, 60, -20),
    "burnham-park": ((120.5936, 16.4116), 15.5, 55, -25),
    "session-road": ((120.5967, 16.4118), 16, 60, 30),
    "mines-view": ((120.6305, 16.4145), 15, 65, -60),
    "camp-john-hay": ((120.6187, 16.3956), 14.5, 55, 15),
    "kennon-road": ((120.605, 16.365), 13, 70, -10),
}


def main():
    fwd = Transformer.from_crs("EPSG:4326", LOCAL_TM, always_xy=True)
    with rasterio.open(DEM) as d:
        z = d.read(1).astype(np.float64)
        rows, cols = z.shape
        # Post centres. M1 wrote an area-convention transform, so centres are at +0.5.
        cc, rr = np.meshgrid(np.arange(cols) + 0.5, np.arange(rows) + 0.5)
        t = d.transform
        lng = t.c + cc * t.a + rr * t.b
        lat = t.f + cc * t.d + rr * t.e
    e, n = fwd.transform(lng, lat)
    # Rasters are north-first; Blender's grid wants row 0 = south.
    TERRAIN.mkdir(parents=True, exist_ok=True)
    for name, arr in (("E", e), ("N", n), ("Z", z)):
        np.save(TERRAIN / f"{name}.npy", np.ascontiguousarray(arr[::-1], dtype=np.float32))

    # Round trip, contract C1 / spec §11 invariant: <= 1 m (expected ~0).
    lng2, lat2 = fwd.transform(e, n, direction="INVERSE")
    err = np.hypot((lng2 - lng) * 106_800, (lat2 - lat) * 110_700).max()
    assert err <= 1.0, f"round trip error {err:.3f} m"

    features = json.loads((ROOT / "data" / "geojson" / "landmarks.geojson").read_text())["features"]
    anchors = []
    for f in features:
        (ae, an) = fwd.transform(*f["geometry"]["coordinates"])
        anchors.append({"slug": f["properties"]["slug"], "e": ae, "n": an, "terrarium_m": f["properties"]["elevation_m"]})
    re_, rn = fwd.transform(*RIDGE)
    views = []
    for name, ((vlng, vlat), zoom, pitch, bearing) in VIEWS.items():
        ve, vn = fwd.transform(vlng, vlat)
        views.append({"name": name, "e": ve, "n": vn, "lat": vlat, "zoom": zoom, "pitch": pitch, "bearing": bearing})
    (TERRAIN / "anchors.json").write_text(json.dumps(
        {"anchors": anchors, "ridge": {"e": re_, "n": rn, "expected_m": 1530}, "views": views}, indent=2) + "\n")
    (TERRAIN / "grid.json").write_text(json.dumps({
        "rows": rows, "cols": cols, "dem_sha256": file_hash(DEM, "sha256"), "local_tm": LOCAL_TM,
        "z_min": float(z.min()), "z_max": float(z.max()), "round_trip_max_m": float(err)}, indent=2) + "\n")
    print(f"wrote {TERRAIN.relative_to(ROOT)}: {rows}x{cols} posts, z {z.min():.1f} to {z.max():.1f} m, "
          f"E {e.min():.0f}..{e.max():.0f}, N {n.min():.0f}..{n.max():.0f}, round trip {err:.2e} m")


if __name__ == "__main__":
    main()
