# diplomat-hotel-ruins

## Scope
The Diplomat Hotel ruins on Dominican Hill, built from OpenStreetMap's Simple 3D Buildings model of the building:
- the weathered two-storey walls with their window openings;
- the crenellated roof parapets;
- the two open courtyards;
- the centre block with its stone crosses;
- the entrance porch's arches;
- the metal roofs.

Pines stand on the hilltop. The Heritage and Nature Park around the building is left to the basemap.

OSM: `relation/18175733` ("main roof", `building:part`), 1,081 m², anchors the model. Exclusion ring = that outline grown by 5 m.

The geometry is every `building:part` within 150 m: 715 polygons with `height` and `min_height`, exported by `uv run model/scripts/landmark_osm.py parts diplomat-hotel-ruins`. It is OpenStreetMap data (ODbL), credited with the site's existing "© OpenStreetMap contributors".

Location: the destination pin (120.58, 16.409) is about 850 m from the building. The registry's `osm_center` is the NHCP marker, `node/12260358283`. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] Wikipedia, "Diplomat Hotel", read 2026-10-05: https://en.wikipedia.org/wiki/Diplomat_Hotel.
  - Built from 1913 to May 1915 as a Dominican vacation house, designed by Fr. Roque Ruaño.
  - The Japanese headquarters in the Second World War; partly damaged by American bombing in April 1945.
  - The Diplomat Hotel from 1973 to 1987.
  - Now the Dominican Heritage Hill and Nature Park, and a national historical site since 2014.
- [S2] OpenStreetMap Simple 3D Buildings parts round `node/12260358283`, via Overpass on 2026-10-05.
  - Examples: "main wall" (to 9.3 m, in 51 pieces between the windows), "main roof railing" (9.5 to 10.6 m), "center building wall" (9.5 to 13.0 m), "cross main" (11.0 to 14.3 m), and the "gantry bow" and "main entry bow" arches.
  - Heights are metres above the ground.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Diplomat Hotel – facade (2018-11-27)](https://commons.wikimedia.org/wiki/File:Diplomat_Hotel_-_facade_(Dominican_Hill,_Baguio,_Benguet)(2018-11-27).jpg) (CC BY-SA 4.0, patrickroque01)
  - [Diplomat Hotel – front (2018-11-27)](https://commons.wikimedia.org/wiki/File:Diplomat_Hotel_-_front_(Dominican_Hill,_Baguio,_Benguet)(2018-11-27).JPG) (CC BY-SA 4.0, patrickroque01)
  - [Old Diplomat Hotel, Jan 2024 (4)](https://commons.wikimedia.org/wiki/File:Old_Diplomat_Hotel,_Baguio_City,_Jan_2024_(4).jpg) (CC BY-SA 4.0, Ralffralff)

  What they show: off-white walls streaked dark by the weather; a rusticated ground floor with round-arched windows; tall upper windows; crenellated parapets; a central gable topped by a stone cross; an arched entrance porch.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 20 m and `tree_pineTallA_detailed` at 16 m.

## Estimates
S2 gives the heights. The rest:
- **Base:** the highest map terrain under the main roof's outline (contract C2). Parts with `min_height` 0 run down to 1 m below the lowest ground.
- **Materials:** off-white weathered wall (one texture: block joints, rain streaks and a darker lower band), grey metal roofs (S2 `roof:colour` #696969) and pale trim. These come from S3 rather than S2's `building:colour` #7A7D80; the photos are newer and show the walls lighter.
- **Left out for tier 2's 10,000 triangles:** the thin string-course bands ("bar"), the survey station on the roof (RTK base) and the roof-access steps.
- **Simplified:** part outlines lose collinear points within 2 cm.
- **Pines:** eight, on a 34 to 40 m ring (ESTIMATE).

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/diplomat-hotel-ruins-{m6,back}.png`, on the map's terrain.
- Triangles: 9,675 in the scene, 8,811 in the exported file.
- Packed: 76.1 KB, of which geometry is 73.7 KB. That is within tier 2's 150 KiB file; there is no geometry cap for tier 2.

Compared with S3, these match: the window rhythm in two storeys, the crenellated parapets, the courtyards, the centre block and the arched porch.
