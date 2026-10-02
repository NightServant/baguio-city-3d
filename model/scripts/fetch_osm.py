# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""M1: fetch the model's OpenStreetMap data from Overpass: every building (way and relation) and every
highway way in the padded bounds, with tags and geometry. Output: model/data/osm/baguio-padded.json.
Run: uv run model/scripts/fetch_osm.py

Deviation from the M1 plan (2026-10-02): the link measured 4-7 KB/s, so Geofabrik's 608 MB Philippines
file (and osmium-tool's large Homebrew dependencies) were impractical. Overpass returns only what later
milestones use, gzip-compressed. Overpass needs a non-personal user agent (curl's default gets HTTP 406)."""
import datetime
import json
import os
import subprocess

from common import OSM, PADDED, ROOT, file_hash, load_sources, save_sources

API = "https://overpass-api.de/api/interpreter"
UA = "baguio-city-3d/1.0"


def query():
    w, s, e, n = PADDED
    return (f"[out:json][timeout:1800][maxsize:1073741824][bbox:{s},{w},{n},{e}];"
            '(way["building"];way["highway"];);out tags geom qt;'
            # relations need full output: `out tags` drops their member lists (and so their outlines)
            'relation["building"];out geom qt;')


def main():
    q = query()
    OSM.parent.mkdir(parents=True, exist_ok=True)
    part = OSM.with_suffix(".part")
    subprocess.run(["curl", "-fS", "--compressed", "--retry", "3", "--retry-delay", "60", "-A", UA,
                    "--data-urlencode", f"data={q}", "-o", str(part), API], check=True)
    doc = json.loads(part.read_text())
    if doc.get("remark"):
        raise SystemExit(f"Overpass remark (timeout or size limit?): {doc['remark']}")
    os.replace(part, OSM)
    sources = load_sources()
    sources["osm-overpass"] = {
        "url": API, "query": q, "file": str(OSM.relative_to(ROOT)),
        "retrieved": datetime.date.today().isoformat(),
        "osm_data_until": doc.get("osm3s", {}).get("timestamp_osm_base", ""),
        "elements": len(doc["elements"]), "bytes": OSM.stat().st_size, "md5": file_hash(OSM, "md5"),
        "licence": "Open Database License 1.0, https://www.openstreetmap.org/copyright",
        "attribution": "\u00a9 OpenStreetMap contributors",
    }
    save_sources(sources)
    print(f"wrote {OSM.relative_to(ROOT)}: {len(doc['elements']):,} elements, {OSM.stat().st_size / 1e6:.1f} MB, "
          f"data until {sources['osm-overpass']['osm_data_until']}")


if __name__ == "__main__":
    main()
