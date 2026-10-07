# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = []
# ///
"""Landscape and street-life data from Overpass (owner request 2026-10-07: trees of every kind, green and stone
landscapes, pathways, Session Road's shops and restaurants, the city's hotels), in the padded bounds:
- hotels and other lodging (`tourism`);
- single trees and tree rows; woods, scrub, grass, rock and cliffs; forests, lawns, farms, cemeteries; parks,
  gardens, golf courses and pitches;
- retaining walls, walls, hedges and embankments;
- restaurants, cafes, fast food, banks and shops (Session Road's frontages).
Footways, paths and steps are already in the M1 extract (every `highway` way, fetch_osm.py).
Output: model/data/osm/landscape.json. Run: uv run model/scripts/fetch_landscape.py"""
import datetime
import json
import os
import subprocess

from common import DATA, PADDED, ROOT, file_hash, load_sources, save_sources

API = "https://overpass-api.de/api/interpreter"
UA = "baguio-city-3d/1.0"                 # contract C8: a non-personal user agent
OUT = DATA / "osm" / "landscape.json"


def query():
    w, s, e, n = PADDED
    return (f"[out:json][timeout:900][maxsize:536870912][bbox:{s},{w},{n},{e}];("
            'nwr["tourism"~"^(hotel|motel|hostel|guest_house|apartment|resort|chalet)$"];'
            'node["natural"="tree"];way["natural"="tree_row"];'
            'nwr["natural"~"^(wood|scrub|grassland|heath|bare_rock|cliff|scree|rock|stone|shrubbery)$"];'
            'nwr["landuse"~"^(forest|grass|meadow|orchard|farmland|cemetery|recreation_ground|village_green|plant_nursery|allotments|greenfield|flowerbed)$"];'
            'nwr["leisure"~"^(park|garden|golf_course|pitch|playground|nature_reserve)$"];'
            'way["barrier"~"^(retaining_wall|wall|hedge)$"];way["man_made"="embankment"];'
            'nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|bank|pharmacy|ice_cream|food_court)$"];'
            'nwr["shop"];'
            ");out geom qt;")     # relations need `out geom`: `out tags` drops their member outlines


def main():
    q = query()
    part = OUT.with_suffix(".part")
    subprocess.run(["curl", "-fS", "--compressed", "--retry", "3", "--retry-delay", "60", "-A", UA,
                    "--data-urlencode", f"data={q}", "-o", str(part), API], check=True)
    doc = json.loads(part.read_text())
    if doc.get("remark"):
        raise SystemExit(f"Overpass remark (timeout or size limit?): {doc['remark']}")
    os.replace(part, OUT)
    sources = load_sources()
    sources["osm-landscape"] = {
        "url": API, "query": q, "file": str(OUT.relative_to(ROOT)),
        "retrieved": datetime.date.today().isoformat(),
        "osm_data_until": doc.get("osm3s", {}).get("timestamp_osm_base", ""),
        "elements": len(doc["elements"]), "bytes": OUT.stat().st_size, "md5": file_hash(OUT, "md5"),
        "licence": "Open Database License 1.0, https://www.openstreetmap.org/copyright",
        "attribution": "© OpenStreetMap contributors",
    }
    save_sources(sources)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(doc['elements']):,} elements, {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
