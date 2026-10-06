# baguio-public-market

## Scope
The Baguio City Market as a complex, built from every OSM building inside the market's outline: 88 blocks, sections and stalls. Each gets:
- concrete walls to its mapped or estimated storeys;
- low hip roofs in the market's corrugated colours where a block is near-rectangular, and flat roofs elsewhere.

The Hangar Market gets its barrel vault. The exclusion ring takes these buildings out of the massing, so this model carries them. The covered aisles and the stalls' tarps are left out; they are interiors.

OSM: `way/224613128` ("Baguio City Market", `amenity=marketplace`), 26,661 m². Exclusion ring = that outline grown by 5 m.

The buildings come from `uv run model/scripts/landmark_osm.py buildings baguio-public-market`: 88 outlines, 16,946 m², simplified within 5 cm.

Location: the destination pin (120.593, 16.4155) is about 180 m from Block 3. The registry's `osm_center` is OSM `way/299600081`, "Block 3 - Public Market".

## Sources
- [S1] The destination's own description in the app: a sprawling, labyrinthine market for highland produce and pasalubong. No published dimensions were found; there is no Wikipedia article ("Baguio City Market" returns 404, checked 2026-10-05).
- [S2] OpenStreetMap, Overpass 2026-10-05, inside `way/224613128`:
  - "Hangar Market/Vegetables section" (`building:levels=2`), "Fruits Proper Section" (1 level);
  - "Block 1 - Seafood", "Block 2 - Meat", "Block 3 - Public Market", "Old Market Building", "Sari-Sari Section", "City Market Building", "Rice Section", "Superintendent's Quarters";
  - 77 unnamed buildings.
- [S3] Owner-collected interior photos `ref1` to `ref3` in `model/data/refs/baguio-public-market/`. They show a green translucent-roofed hall with red, blue and teal tarps over the stalls, which informs the Hangar's green vault. No usable exterior photo was found on Wikimedia Commons (searched 2026-10-05).
- [Palette] The owner's varied city roof palette (2026-10-02): red, green, blue, grey and rust.

## Estimates
Every height is an ESTIMATE where S2 gives no `building:levels`. Confidence: low to medium.
- **Storeys:** 3.2 m. Buildings under 60 m² get one storey (stalls); larger blocks get two.
- **Walls:** from 1 m under the lowest map terrain to the storeys above the highest (contract C2).
- **Roofs:** a 16° hip over the minimum-area rectangle when the block fills 85% of it; a 0.3 m flat roof otherwise. Colours are seeded from the palette.
- **Hangar vault:** along its long side, rising a third of its span. It has the one texture, green corrugated metal.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/baguio-public-market-{m6,hangar}.png`, on the map's terrain.
- Triangles: 2,066.
- Packed: 17.4 KB.

The massing reads as the dense market of S1, with the Hangar's vault. It is the plainest tier-2 model: it was built from OSM alone because no exterior reference was found. A reference photo of the market's exterior would let the façades get detail.
