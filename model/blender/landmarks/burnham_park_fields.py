"""burnham-park-fields: Burnham Park's fields between the lake and the Athletic Bowl: the open football field by the Melvin Jones Grandstand, the roofed skating rink, the Children's Playground, the bike and pedal-kart areas, lawns, walks and trees, at 1:1 from OSM
(landmark_osm.py park, model/data/landmarks/burnham-park-fields/park.json) on the map's terrain; owner 2026-10-06: "the complete
3d-model of Burnham Park including the other sections such as the football field, bike sections, grass landscapes,
trees, walkways". Dimensions: model/landmarks/burnham-park.md.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b model/data/blend/baguio.blend --python model/blender/landmarks/burnham_park_fields.py"""
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import lm_common as lm  # noqa: E402

SLUG = "burnham-park-fields"
coll, fp = lm.begin(SLUG)
PK = json.loads((lm.ROOT / "model" / "data" / "landmarks" / SLUG / "park.json").read_text())
lowest = lm.park(coll, fp, PK, SLUG.replace("-", "_"))
x, y = PK["region"][0]
lm.human_reference(coll, x * 0.9, y * 0.9)
lm.report(SLUG, coll, -lowest)
lm.context_instance(SLUG, fp)
bpy.ops.wm.save_mainfile()
