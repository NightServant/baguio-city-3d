# baguio-museum

## Scope
The Baguio Museum building:
- dark vertical-plank walls on a stone base;
- the broad, low grey hip roof;
- the north-west entrance pavilion: two tapered stone-clad poles, the stair up between them, and the glazed upper box with the cream name band and its own small hip roof.

The DOT complex around it is left to the basemap.

OSM: `way/209340226` ("Baguio Museum", `tourism=museum`), 605 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.6035, 16.4078) is about 550 m from the museum. The registry's `osm_center` is the OSM way. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] Primer, "Baguio Museum: Home of Baguio's Cultural and Historical Heritage" (2018), via web search on 2026-10-05: https://primer.com.ph/travel/2018/07/01/baguio-museum/.
  - Built in 1975 at the corner of Governor Pack Road and Harrison Road by the Philippine Tourism Authority, and opened in May 1977.
  - Damaged by the 1990 earthquake; rebuilding started in 1998.
  - Inspired by Ifugao architecture: stone and wood, a pyramid roof, and two huge poles at the stair entrance, like an Ifugao house's elevated floor on posts.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/209340226`. The main body is 25.1 × 23.0 m in a frame along bearing 43.5°, with the entrance projection (4.6 × 4.4 m) on the north-west side.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Baguio Museum, March 2022](https://commons.wikimedia.org/wiki/File:Baguio_Museum,_March_2022.jpg) (CC BY-SA 4.0, Ralff Nestor Nacor)
  - [Baguio Museum (2018-02-25)](https://commons.wikimedia.org/wiki/File:Baguio_Museum_(Gov._Pack_Road,_Baguio,_Benguet)(2018-02-25).jpg) (CC BY-SA 4.0, Patrick Roque)

  What they show: dark vertical-plank walls; a low, wide grey metal hip roof; two tapered rough-stone pillars flanking a dark stair; a cream "BAGUIO MUSEUM" band under a glazed upper box with a small hip roof.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 18 m and `tree_default` at 11 m.

## Estimates
Every height is an ESTIMATE, scaled from the people and stair risers in S3. Confidence: medium (±25%).
- **Floor:** 1.6 m above the street at the stair's foot (map terrain, contract C2). The back is cut into the rising ground.
- **Walls:** 4.4 m, set 1.2 m in from the outline.
- **Roof:** a 22° hip with a 0.8 m overhang.
- **Poles:** 1.4 m at the foot, tapering to 0.8 m.
- **Upper box:** a 0.7 m name band and 1.9 m of glazing, under a 34° hip.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/baguio-museum-{m6,close}.png`, on the map's terrain.
- Triangles: 886 in the scene, 464 in the exported file.
- Packed: 12.5 KB.

Compared with S3, these match: the broad grey hip roof, the dark plank walls, the two stone poles, the stair, and the name band and glazed box with its small roof.

The first pass keyed the floor to the uphill back of the outline, which left a 4 m stone base at the front. The floor is now keyed to the street at the entrance.
