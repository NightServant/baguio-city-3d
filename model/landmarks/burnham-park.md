# burnham-park

## Scope (owner request 2026-10-06: "the complete 3d-model of Burnham Park including the other sections such as the football field, bike sections, grass landscapes, trees, walkways")
The whole 27.8 ha park (OSM `way/330642136`), at 1:1 from OSM. It ships as six tier-1 models, so that each fits the per-file budget (contract C6). All six are built by `landmark_osm.py park <slug> way/330642136 <S:N,W:E>` and `lm_common.park`:

| Model | Area | Box (degrees) |
|---|---|---|
| `burnham-park` (keeps the destination's pin) | the lake and its surrounds, between the west and east cuts | 16.40987:16.411644, 120.593728:120.595583 |
| `burnham-park-north` | Igorot Garden, the Rose Garden, the lawns north of the lake | 16.411644:, 120.593728:120.595583 |
| `burnham-park-west` | the Orchidarium and greenhouses, Ibaloi Park, the gardens | 16.40987:, :120.593728 |
| `burnham-park-east` | the open football field and the Melvin Jones Grandstand | 16.40987:, 120.595583: (`stand=relation/17091613`) |
| `burnham-park-fields` | the skating rink, the Children's Playground, the bike and pedal-kart areas, the woods | 16.40880:16.40987 |
| `baguio-athletic-bowl` | the Athletic Bowl's pitch, running track, grandstand, tennis courts and pool hall; the library; the Pine Trees of the World | :16.40880 |

Each model's exclusion ring is its box of the park grown by 5 m, so the massing drops the buildings inside the park, and the models carry them.

The map-only models (every part except `burnham-park`) have no destination row: `landmarks_sql.py` skips them, and the app loads them from `index.json` by view.

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

- [S6] OpenStreetMap, Overpass area query of `way/330642136`, 2026-10-06 (`model/data/landmarks/burnham-park/area-osm.json`):
  - **Ground cover:** the lake, the landuse grass and village greens, the woods and forest, the gardens (Orchidarium, Igorot Garden, Rose Garden), the Children's Playground, and the parking areas.
  - **Sports and tracks:** the tracks (Lake Drive Quadricycle Area, Pedal Kart Area, Skateboarding Area, the Athletic Bowl's running track) and the pitches (Athletic Bowl soccer, tennis).
  - **Buildings:** the skating rink, a ring building round its open floor; the Melvin Jones and Athletic Bowl grandstands; the greenhouses; and the rest.
  - **Walkways and boundaries:** 115 footways and the hedges and walls.
  - **Points:** bicycle rentals, memorials (the Burnham bust, the Japanese Peace Tower), fountains and lamps.
- [S7] Wikipedia, "Burnham Park", read 2026-10-06: "only the open field often used for football and the Melvin Jones Grandstand adhere to Burnham's original design". OSM doesn't map that field.
- [S8] Wikipedia, "Baguio Athletic Bowl", read 2026-10-06: a 7-hectare sports complex within Burnham Park, completed in 1945.

## Estimates (whole park, 2026-10-06)
- **Walkway widths:** footways and cycleways 3.2 m, paths 2.4 m, steps 2.8 m, pedestrian ways 6 m. Walkways under 40 m are left out, and so are the drives (the basemap draws them).
- **Ground:**
  - Cut on 8 to 12 m grids and simplified at 0.6 m.
  - Lifted 0.3 to 0.45 m above the map's terrain, whose mesh departs from the DEM by up to about 0.3 m on the slopes.
  - Paving is concrete grey.
- **Trees:** woods on a jittered 18 m grid; lawn trees every 22 m along the walks; the lake's edge every 18 m. They are Kenney's simple pines (78 triangles) and broadleaves.
- **Melvin Jones field (S7):** 100 × 64 m (regulation proportions), on the grandstand's open side, with FIFA-proportioned markings.
- **Buildings:**
  - The OSM height or levels (× 3.2 m) where tagged; otherwise 6.4 m.
  - Grandstands 9 m, as eight seating steps rising away from the nearest pitch under a sloping roof.
  - Greenhouses 4 m, glazed.
  - The skating rink: a ring roof 5 m up on posts round the open floor.
  - Shelters 4.2 m.
  - Windows every 8 m (12 m in the Athletic Bowl).
- **Play equipment:** slide towers and swing frames, at least 22 m apart.
- **Bike rentals:** a counter with a blue roof at each OSM `bicycle_rental`.

## Estimates (lake, 2026-10-02)
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

## Review (2026-10-06, whole park)
Five models, all within the tier-1 caps:
- `burnham-park`: 64.4 KB (geometry 56.0 KB);
- `burnham-park-west`: 48.8 KB;
- `burnham-park-east`: 36.7 KB;
- `burnham-park-fields`: 35.9 KB;
- `baguio-athletic-bowl`: 58.8 KB (geometry 55.0 KB).

Owner reports, in order:
1. The massing raised the skating rink as a three-storey ring. The park's exclusion rings now remove every building inside it.
2. The football markings sat around the rink: the grass there was the rink's lawn, not the field. The field now stands before the Melvin Jones Grandstand (S7).
3. The playground was solid orange. It is now lawn with play equipment.
4. Beige paving read as holes, and the terrain showed through the lawns. The paving is now grey, and the lifts are 0.3 to 0.45 m.
5. To fit the caps, ground skirts now run only along each model's outline; inside it the classes meet within centimetres.

Checked live: the park is continuous green with grey walks, the lake, the rink's ring roof, the Melvin Jones field and the Athletic Bowl's red track.
