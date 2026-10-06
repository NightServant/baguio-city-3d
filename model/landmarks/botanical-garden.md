# botanical-garden

## Scope
The garden's entrance quarter and its landmarks:
- the dark bronze relief wall bearing the garden's name at the gate;
- the stone walk down to the round Centennial Garden plaza: a paved ring with a low stone wall, and a lawn island with a flower mound and a log tepee;
- the main walks;
- the round Orchidarium;
- the two round native huts;
- the greenhouse;
- the small green-roofed house by the plaza;
- pines across the garden.

OSM: `relation/14181288` ("Baguio Botanical Garden", `leisure=garden`), 33,843 m². Its outer ring is stitched from six member ways. Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.6178, 16.416) is about 470 m from the garden. The registry's `osm_center` is the OSM relation. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

Description check: the destination text says the garden was "Once called the Igorot Village". S1 gives its former names as the Botanical & Zoological Garden and Imelda Park. Worth a look against a source.

## Sources
- [S1] Wikipedia, "Baguio Botanical Garden", read 2026-10-05: https://en.wikipedia.org/wiki/Baguio_Botanical_Garden.
  - On Leonard Wood Road, between Wright Park and Teachers Camp.
  - Former names: the Botanical & Zoological Garden, and Imelda Park.
  - Features: Igorot culture sculptures, art galleries, flower gardens, a friendship garden, and a 150 m wartime tunnel.
  - No dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05, in the garden's frame:
  - the gate sign `node/4703956743` at (−97, 83);
  - walks `way/1134607015` and `way/1385115363` from the road down to the plaza;
  - the Centennial Garden island `way/1385115361` (r ≈ 7.5 m) and the ring walk `way/33613716` (r ≈ 11.5 m);
  - walks `way/1347296867`, `way/1385115359` and `way/33613718`;
  - the Orchidarium `way/1347296865`;
  - round shelters `way/1347301014` (r 5.8 m) and `way/1385115357` (r 3.4 m);
  - the greenhouse `way/1063563331`;
  - a building `way/1385115362`.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Baguio Botanical Garden](https://commons.wikimedia.org/wiki/File:Baguio_Botanical_Garden.jpg) (CC BY-SA 4.0, Zoilo699), the name wall;
  - [Baguio Botanical Garden, March 2023](https://commons.wikimedia.org/wiki/File:Baguio_Botanical_Garden,_March_2023.jpg) (CC BY-SA 4.0, Ralff Nestor Nacor), the round plaza from the steps;
  - [Botanical Garden Wall](https://commons.wikimedia.org/wiki/File:Botanical_Garden_Wall_-_Baguio_City.jpg) (CC BY-SA 4.0, Pogidawako1234), the relief.

  What they show:
  - **Gate:** a dark bronze relief wall with a wavy crest, the name in raised gold letters on two lines, and a sun disc.
  - **Plaza:** round and stone-paved, with a lawn island, a red and pink flower mound and a log structure, ringed by low stone walls.
  - **Around it:** green-roofed buildings and tall pines.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 22 m and `tree_pineTallA_detailed` at 18 m.

## Estimates
Every height is an ESTIMATE, scaled from the people in S3. Confidence: medium (±25%).
- **Relief wall:** 10 m long, with a crest of 2.7 to 3.5 m. The letter bands are 0.5 and 0.6 m tall, and the sun disc is 0.7 m.
- **Walks:** 3 m wide at the gate and 2.5 m elsewhere, laid on the map's terrain (contract C2).
- **Plaza:**
  - level, paved from r 7.5 to 12.5 m;
  - a 0.6 m wall with gaps for the north and east walks;
  - the island 0.3 m high, with a 1.3 m mound and a 3.1 m log tepee.
- **Orchidarium:** walls 3.2 m and a cone roof to 6.6 m.
- **Huts:** 0.5 m stone bases, posts to 2.4 m, and steep thatch cones 1.1 × the radius high.
- **Greenhouse:** 2.6 m, with a 25° glass gable.
- **Pines:** a jittered 26 m grid inside the outline, kept clear of the features.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/botanical-garden-{close,gate}.png`, on the map's terrain.
- Triangles: 9,118 in the scene, 2,494 in the exported file.
- Packed: 44.1 KB, of which geometry is 33.1 KB.

Compared with S3, these match: the bronze name wall with its gold letters and sun disc; the round paved plaza with its island, flower mound, log tepee and low wall; the green roofs; the pines.

Simplified: the relief carving (shown as a plain dark face), the flower gardens and the tunnel.
