"""Shared by the model's data scripts: the area, file locations, and the source ledger."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "model" / "data"
SOURCES = ROOT / "model" / "sources.json"

# (minLng, minLat, maxLng, maxLat). Must equal BAGUIO_BOUNDS in lib/constants.ts; check_m1.py enforces it.
EXACT = (120.5, 16.3, 120.7, 16.5)
# Must equal expandBounds()'s default pad in components/map/MapView.tsx (the camera's maxBounds).
PAD = 0.03
PADDED = tuple(round(v, 6) for v in (EXACT[0] - PAD, EXACT[1] - PAD, EXACT[2] + PAD, EXACT[3] + PAD))

DEM = DATA / "dem" / "copernicus-glo30-baguio.tif"
OSM = DATA / "osm" / "baguio-padded.json"  # Overpass JSON (`out tags geom`): buildings + highways


def bbox_arg(b):
    """osmium's --bbox form: minLng,minLat,maxLng,maxLat."""
    return ",".join(f"{v:g}" for v in b)


def file_hash(path, algo):
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_sources():
    return json.loads(SOURCES.read_text()) if SOURCES.exists() else {}


def save_sources(sources):
    SOURCES.write_text(json.dumps(sources, indent=2, ensure_ascii=False) + "\n")

# Contract C1: the model frame. Local transverse Mercator centred on BAGUIO_CENTER
# (lib/constants.ts). +X east, +Y true north at the centre, metres.
LOCAL_TM = "+proj=tmerc +lat_0=16.4023 +lon_0=120.596 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs"
TERRAIN = DATA / "terrain"
BLEND = DATA / "blend" / "baguio.blend"
RENDERS = DATA / "renders"

LANDMARKS = ROOT / "model" / "landmarks.json"
LM_DATA = DATA / "landmarks"
