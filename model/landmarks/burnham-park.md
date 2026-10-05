# burnham-park

## Scope
Burnham Lake, the park's defining feature: the water surface, its concrete rim, and the rental rowboats on it. The rest of the 32.84 ha park (gardens, playground, skating rink, grandstand) is left to the basemap's park area, and its few buildings stay in the building massing.

OSM: `way/330642119` "Burnham Park Lake", 15,875 m², 28 vertices, about 180 m across on a north-west to south-east axis. Exclusion ring = the lake grown by 5 m (`model/landmarks.json`).

## Sources
- [S1] Spec §2 (Wikipedia "Burnham Park", verified 2026-09-22): 32.84 ha; designed by Daniel Burnham, plan dated 1905, park established 1925; Burnham Lake at the centre, average depth 3.04 m, about 34,000 m³; 12 clusters.
- [S2] OpenStreetMap `way/330642119` (Overpass, 2026-10-02): the lake outline and area above; the park polygon `way/330642136` is 278,373 m² (`leisure=park`, `historic=heritage`).
- [S3] `data/geojson/landmarks.geojson` description: "laid out to Daniel Burnham's 1905 city plan around a man-made lagoon where visitors paddle rented boats".
- [S4] Spec §1A (street-level, Aug 2019): patterned paving, a tiered stone monument, stone gate piers.
- [S5] Owner's aerial reference photo (watermark "elisicam", supplied 2026-10-02 in chat; not stored in the repo):
  - turquoise-teal water;
  - about 40 to 60 boats: white swan boats, yellow pedal boats with red-orange canopies, some rowboats;
  - a line of rental stalls under green roofs along the north shore, and a blue-roofed pavilion at the north-west corner;
  - a dense ring of pines and broadleaf trees; an open lake with no island.

- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, City Kit (Roads) and Watercraft Kit, fetched by `model/scripts/fetch_assets.py` with sha256 and provenance in `model/sources.json`. Owner request, 2026-10-05.
  Its trees (Kenney pines at 15 to 18 m, broadleaf at 11 m, recoloured toward S5's greens) and its wooden rowboats (`boat-row-small`) replace the hand-built ones. The swan and pedal boats stay hand-built; no kit has them.

## Estimates
- Water level 0.3 m above the highest terrain sample under the lake. Copernicus is not a water surface, and the offset avoids z-fighting with the map's terrain (M4 plan).
- Rim: concrete, 1.2 m wide, 0.6 m above the water.
- Water level: above every terrain sample on the shore and on a 5 m grid inside the lake, plus 0.3 m. The 30 m DEM bulges above the water in the lake's middle, while S5 shows open water there. Result: 3.1 m above the centroid's ground.
- Boats (S5 mix; count and sizes ESTIMATE): 40 in total.
  - Swan boats (2.6 × 1.6 m), about 35%.
  - Yellow pedal boats with red canopies (2.4 × 1.5 m), about 45%.
  - Rowboats in the rental colours, about 20%.
- Stalls along north-facing shore edges, 3 m deep, 2.6 m tall, green gable roofs. Pavilion 10 × 8 m deck with a blue hip roof at the north-west corner (positions ESTIMATE from S5).
- Trees every 11 m, 7 m out from the rim: two pines (*Pinus kesiya*, about 16 m) to one broadleaf (about 11 m). ESTIMATE from S5's dense ring.
- Water colour: turquoise-teal (sRGB 26, 120, 128), from S5.

## Review (2026-10-02)
Renders: `model/data/renders/landmarks/burnham-park-{front,aerial,side,preset-burnham-park}.png` (close views at 2.2× distance). 4,486 triangles; 59.7 KB packed (geometry 57.4 KB, under the 60 KiB tier-1 limit).

Compared with S5, these match:
- a near-rectangular turquoise lake full of swan and pedal boats;
- the blue pavilion at the north-west corner;
- green-roofed stalls along the north shore;
- the ring of trees.

The first render showed a white patch mid-lake. That was the DEM rising above the water there, not a shoreline inlet; the interior sampling fixed it. From the burnham-park preset the lake sits west-south-west of the cathedral, as on the map.

## Ground fit (2026-10-05)
The water level now comes from the map's own terrain, and the tree bases from the lower of the two DEMs (contract C2, ground fitting).
- The map's own terrain tilts about 7 m across the lake, so the water now sits 3.77 m above the centroid's ground, clear of it everywhere.
- On the low (south-west) side the rim shows a few metres of wall.
