# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""Landmark procedure step D: compress, budget-check, hash and publish one landmark.
Run: uv run model/scripts/pack_landmark.py <slug>"""
import hashlib
import json
import struct
import subprocess
import sys

from common import DATA, LANDMARKS, ROOT

GLTFPACK = "gltfpack@1.3.0"  # zeux/meshoptimizer; `npm view gltfpack version` on 2026-10-02
KIB = 1024
BUDGET = {1: (150 * KIB, 60 * KIB), 2: (150 * KIB, None)}  # (whole file, geometry) per tier, contract C6
PUBLIC = ROOT / "public" / "models" / "landmarks"
MANIFEST = ROOT / "model" / "out" / "landmarks-manifest.json"


def glb_stats(data):
    jlen = struct.unpack_from("<I", data, 12)[0]
    j = json.loads(data[20:20 + jlen])
    tris = 0
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            acc = j["accessors"][p["indices"]] if "indices" in p else j["accessors"][p["attributes"]["POSITION"]]
            tris += acc["count"] // 3
    image_bytes = sum(j["bufferViews"][im["bufferView"]]["byteLength"] for im in j.get("images", []) if "bufferView" in im)
    return tris, len(data) - image_bytes


def main(slug):
    reg = json.loads(LANDMARKS.read_text())[slug]
    raw = DATA / "out" / f"{slug}.raw.glb"
    packed = DATA / "out" / f"{slug}.packed.glb"
    subprocess.run(["npx", "-y", GLTFPACK, "-i", str(raw), "-o", str(packed), "-cc", "-mi"], check=True)  # -mi: repeated assets as GPU instances
    data = packed.read_bytes()
    tris, geometry = glb_stats(data)
    whole_cap, geom_cap = BUDGET[reg["tier"]]
    assert len(data) <= whole_cap, f"{slug}: {len(data)} bytes > {whole_cap}"
    assert geom_cap is None or geometry <= geom_cap, f"{slug}: geometry {geometry} bytes > {geom_cap}"
    sha = hashlib.sha256(data).hexdigest()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for old in PUBLIC.glob(f"{slug}.*.glb"):
        old.unlink()
    name = f"{slug}.{sha[:8]}.glb"
    (PUBLIC / name).write_bytes(data)
    lng, lat = reg["anchor"]
    entry = {"slug": slug, "lng": lng, "lat": lat, "url": f"/models/landmarks/{name}", "rotationDeg": 0, "altitudeM": 0,
             "triangles": tris, "bytes": len(data), "geometryBytes": geometry, "sha256": sha}
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"landmarks": []}
    manifest["landmarks"] = sorted([e for e in manifest["landmarks"] if e["slug"] != slug] + [entry], key=lambda e: e["slug"])
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    keep = ("slug", "lng", "lat", "url", "rotationDeg", "altitudeM")
    (PUBLIC / "index.json").write_text(json.dumps({"landmarks": [{k: e[k] for k in keep} for e in manifest["landmarks"]]}, indent=2) + "\n")
    print(f"PACK {slug}: {len(data):,} bytes (geometry {geometry:,}), {tris:,} triangles, {name}")


if __name__ == "__main__":
    main(sys.argv[1])
