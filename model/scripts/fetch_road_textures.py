# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pillow==11.3.0"]
# ///
"""Photo-scanned road surfaces (owner 2026-10-07: "Use realistic 3d assets from the internet to restore the asphalt
texture of the city-wide roads"): CC0 textures from Poly Haven (polyhaven.com), the 1k diffuse maps, downsized to
512 px WebP for the web map. The runtime tiles them in world space on the road tiles and Session Road
(components/map/layers/ModelLayer.ts) and keeps the roads' own colours: each texture's mean (linear) is in the index,
so the shader keeps the detail and not the photograph's tint.
Writes public/models/textures/<name>.<hash8>.webp and index.json; provenance in model/sources.json.
Run: uv run model/scripts/fetch_road_textures.py"""
import datetime
import hashlib
import io
import json
import subprocess

import numpy as np
from PIL import Image

from common import ROOT, load_sources, save_sources

UA = "baguio-city-3d/1.0"
# name -> (Poly Haven asset, the real-world size of one tile in metres, from the asset's dimensions). Every carriageway is
# asphalt (owner 2026-10-07). Sidewalks (owner 2026-10-08: "richer textures", after the SESSION ROAD to SM Baguio walk
# video, youtube.com/watch?v=_6sBS3FvTKo): hexagonal concrete pavers on the main roads (Session Road, 1:15 to 4:00), red
# brick pavers on the secondary roads (the climb to SM, 7:00), plain concrete on the rest and on every kerb. The brick
# scan is 1.94 m, tiled at 2.0 m so the runtime's world wrap (816 m) stays a whole number of every tile.
TEXTURES = {"asphalt": ("asphalt_06", 3.0), "pavers": ("concrete_pavers_02", 2.0), "hex": ("hexagonal_concrete_paving", 1.6),
            "brick": ("short_bricks_floor", 2.0), "concrete": ("concrete_floor_01", 2.0)}
OUT = ROOT / "public" / "models" / "textures"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.webp"):
        old.unlink()
    sources, index = load_sources(), {}
    for name, (asset, metres) in TEXTURES.items():
        meta = json.loads(subprocess.run(["curl", "-fsS", "-A", UA, f"https://api.polyhaven.com/files/{asset}"],
                                         check=True, capture_output=True).stdout)
        f = meta["Diffuse"]["1k"]["jpg"]
        raw = subprocess.run(["curl", "-fsS", "-A", UA, f["url"]], check=True, capture_output=True).stdout
        assert hashlib.md5(raw).hexdigest() == f["md5"], f"{asset}: md5 mismatch"
        img = Image.open(io.BytesIO(raw)).convert("RGB").resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=82, method=6)
        data = buf.getvalue()
        file = f"{name}.{hashlib.sha256(data).hexdigest()[:8]}.webp"
        (OUT / file).write_bytes(data)
        a = np.asarray(img, np.float64) / 255
        lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4).reshape(-1, 3).mean(0)
        index[name] = {"url": f"/models/textures/{file}", "metres": metres, "mean": [round(float(v), 5) for v in lin]}
        sources[f"polyhaven-{asset}"] = {"url": f"https://polyhaven.com/a/{asset}", "file": f["url"], "md5": f["md5"],
                                         "retrieved": datetime.date.today().isoformat(), "licence": "CC0 1.0",
                                         "attribution": "Poly Haven (polyhaven.com), CC0", "shipped": f"public/models/textures/{file}"}
        print(f"{name}: {asset}, {len(data):,} bytes, mean (linear) {index[name]['mean']}")
    (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
    save_sources(sources)


if __name__ == "__main__":
    main()
