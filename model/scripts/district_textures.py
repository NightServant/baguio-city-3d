# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["numpy==2.3.3", "pillow==11.3.0"]
# ///
"""Textures for the district models (district_osm.py, model/blender/landmarks/district.py), deterministic:
- model/data/district/facade_<kind>.png: one bay (3.4 m) by one storey (3.2 m), 256 x 256, the wall near-white so the
  building's paint (a vertex colour) tints it; apartment (a window and a balcony door), commercial (ribbon glazing),
  hotel (paired windows);
- model/data/district/shopfront.png: one bay of a ground-floor shop, 3.4 by 3.6 m: glazing, mullions, a door, the
  shutter box and the kick plate;
- model/data/landmarks/<slug>/signs.png and signs.json: every sign of a district in a 1024 x 1024 atlas of 256 x 64
  cells, its name in its colours (district.json: plain lettering, no logos).
Run: uv run model/scripts/district_textures.py [slug ...] (default: every district in model/landmarks.json)"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from common import DATA, LANDMARKS, LM_DATA

OUT = DATA / "district"
S = 256
CELL_W, CELL_H, COLS, ROWS = 256, 64, 4, 16


def wall(seed):
    rng = np.random.default_rng(seed)
    a = 236 + rng.normal(0, 4, (S, S, 1)).clip(-12, 12)
    return np.repeat(a, 3, axis=2)


def glass(d, box, tone=(46, 56, 70)):
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        k = (y - y0) / max(1, y1 - y0)
        c = tuple(int(v * (1.25 - 0.45 * k)) for v in tone)           # sky reflection fading down the pane
        d.line([(x0, y), (x1 - 1, y)], fill=c)


def facade(kind):
    img = Image.fromarray(wall(len(kind)).astype(np.uint8))
    d = ImageDraw.Draw(img)
    floor = S - 10                                                     # the slab line at the storey's floor (bottom)
    d.rectangle([0, floor, S, S], fill=(206, 204, 198))
    d.rectangle([0, 0, S, 6], fill=(220, 218, 212))
    if kind == "apartment":                                            # a window and a balcony door
        d.rectangle([22, 70, 118, 182], fill=(250, 250, 248))
        glass(d, (28, 76, 112, 176))
        d.line([(70, 76), (70, 176)], fill=(240, 240, 236), width=4)
        d.rectangle([18, 182, 122, 190], fill=(214, 212, 206))         # sill
        d.rectangle([148, 40, 230, floor], fill=(250, 250, 248))
        glass(d, (154, 46, 224, floor - 2), (52, 60, 72))
        d.line([(189, 46), (189, floor - 2)], fill=(240, 240, 236), width=4)
    elif kind == "commercial":                                         # ribbon glazing
        d.rectangle([0, 64, S, 196], fill=(160, 168, 176))
        glass(d, (0, 70, S, 190), (58, 70, 86))
        for x in (0, 64, 128, 192):
            d.line([(x, 70), (x, 190)], fill=(176, 182, 188), width=5)
    else:                                                              # hotel: paired windows with sills
        for x0 in (26, 140):
            d.rectangle([x0 - 4, 60, x0 + 94, 186], fill=(250, 250, 248))
            glass(d, (x0, 66, x0 + 90, 180), (48, 58, 74))
            d.line([(x0 + 45, 66), (x0 + 45, 180)], fill=(240, 240, 236), width=3)
            d.rectangle([x0 - 8, 186, x0 + 98, 193], fill=(214, 212, 206))
    img.save(OUT / f"facade_{kind}.png", optimize=True)


def shopfront():
    img = Image.new("RGB", (S, S), (210, 212, 214))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, S, 36], fill=(170, 172, 176))                  # the shutter box
    for y in range(4, 34, 6):
        d.line([(0, y), (S, y)], fill=(150, 152, 156))
    glass(d, (8, 44, S - 8, S - 26), (40, 50, 62))                     # glazing, lit inside
    for x in (8, 92, 164, S - 8):
        d.line([(x, 44), (x, S - 26)], fill=(196, 200, 204), width=6)
    d.rectangle([100, 70, 156, S - 26], fill=(30, 36, 44))            # the door
    d.rectangle([0, S - 26, S, S], fill=(120, 116, 110))               # kick plate
    img.save(OUT / "shopfront.png", optimize=True)


def fit(d, text, w, h):
    size = h - 18
    while size > 10:
        f = ImageFont.load_default(size=size)
        if d.textlength(text, font=f) <= w - 20:
            return f
        size -= 2
    return ImageFont.load_default(size=10)


def signs(slug):
    dist = json.loads((LM_DATA / slug / "district.json").read_text())
    atlas = Image.new("RGB", (COLS * CELL_W, ROWS * CELL_H), (240, 240, 236))
    d = ImageDraw.Draw(atlas)
    cells, k = {}, 0
    for b in dist["buildings"]:
        for j, s in enumerate(b["signs"]):
            if k >= COLS * ROWS:
                break
            x, y = (k % COLS) * CELL_W, (k // COLS) * CELL_H
            d.rectangle([x, y, x + CELL_W - 1, y + CELL_H - 1], fill=tuple(s["bg"]))
            d.rectangle([x + 3, y + 3, x + CELL_W - 4, y + CELL_H - 4], outline=tuple(s["fg"]), width=2)
            text = s["text"].upper() if len(s["text"]) <= 14 else s["text"]
            d.text((x + CELL_W / 2, y + CELL_H / 2), text, fill=tuple(s["fg"]), font=fit(d, text, CELL_W, CELL_H), anchor="mm")
            cells[f"{b['id']}#{j}"] = k
            k += 1
    atlas.save(LM_DATA / slug / "signs.png", optimize=True)
    (LM_DATA / slug / "signs.json").write_text(json.dumps({"cols": COLS, "rows": ROWS, "cells": cells}) + "\n")
    return k


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for kind in ("apartment", "commercial", "hotel"):
        facade(kind)
    shopfront()
    slugs = sys.argv[1:] or [s for s, e in json.loads(LANDMARKS.read_text()).items() if e.get("district")]
    for slug in slugs:
        print(f"{slug}: {signs(slug)} signs")


if __name__ == "__main__":
    main()
