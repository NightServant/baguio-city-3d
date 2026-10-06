# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["pillow==11.3.0"]
# ///
"""The SM City Baguio sign panel and roof logo as textures (model/data/landmarks/sm-city-baguio/sign.png, 1024 x 256;\nroof_logo.png): a white
panel, the blue SM circle with white letters, and "CITY BAGUIO" in blue, as on the mall's front (Commons photos,
model/landmarks/sm-city-baguio.md S3). Drawn with Pillow's bundled font; deterministic.
Run: uv run model/scripts/sm_sign.py"""
from PIL import Image, ImageDraw, ImageFont

from common import LM_DATA

BLUE, WHITE = (18, 64, 168), (244, 244, 240)
img = Image.new("RGB", (1024, 256), WHITE)
d = ImageDraw.Draw(img)
d.ellipse((40, 18, 260, 238), fill=BLUE)
d.ellipse((52, 30, 248, 226), outline=WHITE, width=6)
d.text((150, 128), "SM", fill=WHITE, font=ImageFont.load_default(size=110), anchor="mm")
d.text((300, 128), "CITY BAGUIO", fill=BLUE, font=ImageFont.load_default(size=92), anchor="lm")
img.save(LM_DATA / "sm-city-baguio" / "sign.png", optimize=True)
# The SM logo painted on the north block's white roof (owner's aerial photos, 2026-10-06): a blue oval ring round "SM"
roof = Image.new("RGB", (512, 256), WHITE)
r = ImageDraw.Draw(roof)
r.ellipse((24, 24, 488, 232), outline=BLUE, width=14)
r.text((256, 128), "SM", fill=BLUE, font=ImageFont.load_default(size=150), anchor="mm")
roof.save(LM_DATA / "sm-city-baguio" / "roof_logo.png", optimize=True)
print("wrote sign.png, roof_logo.png")
