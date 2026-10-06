# wright-park

## Scope
The Pool of Pines:
- the long reflecting pool, stepping down toward The Mansion in basins with low weirs;
- its concrete rim;
- the red-brick promenades and grass verges either side;
- potted shrubs along the water;
- a row of tall pines each side.

The riding circle at the park's upper end, about 200 m north-west, is left to the basemap.

OSM: `way/331614609` (`natural=water`, `water=pond`), 1,166 m². Exclusion ring = that outline grown by 5 m (`model/landmarks.json`).

Location: the destination pin (120.6215, 16.409) is about 750 m from the park. The registry's `osm_center` is OSM `relation/12714120` "Wright Park", from the Overpass name search on 2026-10-05. The model is anchored on the pool's outline. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] Wikipedia, "Wright Park (Baguio)", read 2026-10-05: https://en.wikipedia.org/wiki/Wright_Park_(Baguio).
  - Named after American Governor Luke E. Wright.
  - Known for horseback riding led by "pony boys".
  - Near The Mansion.
  - No dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/331614609`, a rectangle 177.0 × 6.6 m whose long axis runs at bearing 139.4°, toward The Mansion (`relation/7918303`).
- [S3] Wikimedia Commons photos by Ralff Nestor Nacor (CC BY-SA 4.0), read 2026-10-05:
  - [Wright Park Lake, Feb 2025 (4)](https://commons.wikimedia.org/wiki/File:Wright_Park_Lake,_Baguio_City,_Feb_2025_(4).jpg), looking along the pool toward The Mansion;
  - [Trees along Wright Park Lake](https://commons.wikimedia.org/wiki/File:Trees_along_Wright_Park_Lake,_Baguio_City.jpg);
  - [Wright Park Kiosk, Feb 2025](https://commons.wikimedia.org/wiki/File:Wright_Park_Kiosk,_Baguio,_Feb_2025.jpg), the souvenir stalls by the road;
  - [Welcome to Wright Park](https://commons.wikimedia.org/wiki/File:Welcome_to_Wright_Park,_Baguio_City.jpg).

  What they show: a still, green pool with a pale concrete rim; red brick paving each side; grass verges; dark potted plants along the water; tall Benguet pines in rows; The Mansion's white façade at the far end.
- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, fetched by `model/scripts/fetch_assets.py`, with sha256 and provenance in `model/sources.json`. Used: `tree_pineTallC_detailed` at 24 m, `tree_pineTallA_detailed` at 20 m, and `tree_default` at 12 m.

## Estimates
Every number beyond S2's outline is an ESTIMATE, scaled from the people in S3 (1.6 to 1.7 m). Confidence: medium (±25%).
- **Basins:** eight. Each is level 0.05 m above the highest map terrain under it (contract C2, ground fitting).
- **Rim and weirs:** 0.45 m wide, 0.3 m above the water.
- **Promenades and verges:** 4 m of brick each side, then a 3 m grass verge, draped on the ground in 6 m pieces.
- **Potted shrubs:** one every 6 m along both edges of the water.
- **Pines:** one row each side, 14 m from the axis and 10 m apart. One tree in six is broadleaf. S3 shows more rows behind them; one row keeps tier 2's 10,000-triangle budget.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/wright-park-{m6,close}.png`, on the map's terrain.
- Triangles: 8,328 in the scene, 3,378 in the exported file.
- Packed: 35.8 KB, of which geometry is 30.6 KB. There is one texture, the brick paving.

Compared with S3, these match: the long stepped pool, the brick promenades, the potted shrubs and the pine rows.

The first pass had two pine rows and Kenney bushes in the pots, which came to 19,364 triangles. That was cut to one row of pines and simple shrub cones.
