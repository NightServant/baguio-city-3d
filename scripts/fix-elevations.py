"""Resample every destination's elevation_m from the AWS Terrarium DEM (the
terrain the map renders) and write a matching Supabase migration.

The seed values clustered in 1,400-1,540 m while real terrain across the map
spans roughly 910-1,667 m; BenCab Museum was 441 m too high.

Usage: python3 scripts/fix-elevations.py
"""
import importlib.util
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("probe", ROOT / "scripts" / "baguio-dem-probe.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

GEO = ROOT / "data" / "geojson" / "landmarks.geojson"
MIGRATION = ROOT / "supabase" / "migrations" / "20260924090000_correct_destination_elevations.sql"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

text = GEO.read_text()
sql = [
    "-- elevation_m resampled from the AWS Terrarium DEM at z15 by scripts/fix-elevations.py.",
]
doc = json.loads(text)
for feature in doc["features"]:
    slug = feature["properties"]["slug"]
    assert SLUG.fullmatch(slug), f"unexpected slug {slug!r}"
    lng, lat = feature["geometry"]["coordinates"]
    new = round(probe.elevation(lng, lat, z=15)[0])
    old = feature["properties"].get("elevation_m")
    print(f"{slug:32} {old!s:>6} -> {new:>5}")
    # Rewrite in place so the file keeps its hand formatting. elevation_m
    # follows slug inside each feature's properties.
    text, n = re.subn(
        rf'("slug": "{slug}"[\s\S]*?"elevation_m": )(null|-?\d+(?:\.\d+)?)',
        rf"\g<1>{new}",
        text,
        count=1,
    )
    assert n == 1, f"elevation_m not found for {slug}"
    sql.append(f"update destinations set elevation_m = {new} where slug = '{slug}';")

GEO.write_text(text)
MIGRATION.write_text("\n".join(sql) + "\n")
