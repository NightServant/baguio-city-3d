# camp-john-hay

## Scope
The camp's historic core:
- the Bell Amphitheater: curved, hedged grass and flower terraces round a lawn; the octagonal gazebo on its stepped platform; the central stairway with urn planters; lamp posts;
- the Bell House: white clapboard walls, green hip roofs, the raised veranda with white columns and balustrade, a chimney;
- Benguet pines around both.

The rest of the 690 ha estate (golf course, hotels, trails) is left to the basemap and the building massing.

OSM:
- `way/109508305` (Bell Amphitheater, `tourism=attraction`), 1,663 m²;
- `way/109375754` (Bell House, `historic=yes`, `tourism=museum`), 905 m².

Exclusion ring = their union grown by 5 m (`model/landmarks.json`).

## Sources
- [S1] National Historical Commission of the Philippines marker "Bell House and Bell Amphitheater" (2023), photographed on Wikimedia Commons (public domain), read 2026-10-05: [File:Bell House and Bell Amphitheater historical marker - NHCP.jpg](https://commons.wikimedia.org/wiki/File:Bell_House_and_Bell_Amphitheater_historical_marker_-_NHCP.jpg).
  - The house was built as a vacation house for the Philippine commanding generals, 1906.
  - The amphitheater was built by Igorot labourers on General James Franklin Bell's orders, 1913. Both were named after him in 1929.
  - Restored in 2020.
  - No dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05, in the model frame around the union's centroid:
  - The amphitheater outline spans 59 × 44 m, with a south lobe about 25 m across.
  - `way/1358311047` (steps) runs north to south from (−17.6, 38.4) to (−19.6, −1.6), down the bowl's axis.
  - The house is an L: a 32.3 × 16.7 m wing along bearing 103.1° and a 17.6 × 21 m wing to its south-east, measured in the house frame (`camp_john_hay.py`).
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Bell House, Jul 2025 (3)](https://commons.wikimedia.org/wiki/File:Bell_House_Camp_John_Hay_Baguio_July_2025_3_.jpg)
  - [Bell House sides, Jul 2025](https://commons.wikimedia.org/wiki/File:Bell_House_sides_Camp_John_Hay_Baguio_Jul_2025.jpg)
  - [Bell Amphitheater, Jul 2025 (2)](https://commons.wikimedia.org/wiki/File:Bell_Amphitheater,_Camp_John_Hay,_Baguio_City,_Jul_2025_(2).jpg) (CC BY-SA 4.0, Ralffralff)
  - [Bell Amphitheater (Baguio)](https://commons.wikimedia.org/wiki/File:Bell_Amphitheater_(Baguio).jpg) (public domain, NHCP)
  - [Bell Amphitheater](https://commons.wikimedia.org/wiki/File:Bell_Amphitheater.JPG) (CC BY-SA 4.0, Nissip)

  What they show:
  - **House:** white horizontal clapboard; green roofs and window trim; a raised veranda with white columns, a white balustrade and a red-brown floor; a lower level where the ground falls away; a chimney.
  - **Amphitheater:** curved terraces of clipped hedges, grass and red, orange, yellow and pink flower beds round a lawn; a green-roofed octagonal gazebo with stone pillars on white curved steps; a straight stairway down the axis with white urn planters with teal rims; black lamp posts; tall pines.
- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, fetched by `model/scripts/fetch_assets.py`, with sha256 and provenance in `model/sources.json`.
  - Pines: `tree_pineTallC_detailed` at 24 m and `tree_pineTallA_detailed` at 20 m. S1's description in the app calls these "some of the tallest pine stands in the city".
  - Shrubs and urn plants: `plant_bushDetailed`.

## Estimates
Every height is an ESTIMATE, since none is published (S1). Method: scaled from the people in S3, taking 1.6 to 1.7 m as head height, and fitted to S2's outlines. Confidence: medium (±25%).
- **Lawn:** an ellipse 22 × 15 m, draped 0.2 m over the map's terrain (contract C2, ground fitting). The 30 m DEMs can't hold the real excavated bowl, so a level lawn either floated or sank on the slope.
- **Terraces:** five tiers of 2.3 m, each 0.35 m above the ground under it per tier from the lawn, and always at least 0.3 m above the tier inside it. They wrap from east-south-east round the north to west-south-west and leave a 14° gap for the stairway. Hedges are 0.6 m wide and 0.55 m high; alternate tiers are flower beds.
- **Gazebo:**
  - three 0.3 m white steps, at its own level (the highest ground under its platform), on octagons of radius 5.8, 5.2 and 4.6 m, over a stone base where the ground falls away;
  - eight 0.5 m stone pillars 3 m tall on a 3.9 m radius, with a white beam ring;
  - a green octagonal roof to 5.6 m with a lantern and finial to about 8 m above the floor.
- **Stairway:** 2.4 m wide, 1 m treads, each on the ground under it, so the terraces stand either side of it. Urn planters every 4 m on both sides.
- **Bell House:**
  - main floor 0.6 m above the highest ground under the outline;
  - walls 3.4 m, set 2.2 m in from the outline for the veranda;
  - the lower level filled to the ground;
  - hip roofs at 26°, overhanging the outline by 0.4 m;
  - window sills 0.9 m above each floor, one window per 3 m.

## Pin
The destination pin (120.618, 16.401) stands for the whole estate. It is about 230 m north of the Bell House. The model is anchored on the OSM outlines, per contract C2, and doesn't move the pin.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/camp-john-hay-{front,aerial,side,amph,house}.png`.
- Triangles: 11,012 in the scene and 5,552 in the exported file, because the pines and shrubs share meshes.
- Packed: 104.7 KB, of which geometry is 49.8 KB.

Compared with S3, these match:
- the hedged, flowered terraces round the lawn;
- the green octagonal gazebo on white steps with stone pillars;
- the urn-lined stairway;
- the lamp posts;
- the white clapboard house with green roofs and window frames;
- the raised veranda on white columns, with its lower level.

Two changes after the first pass:
- The terraces first rose 0.6 m a tier and read as a mound above the ground, so they now rise 0.35 m.
- The gazebo's lowest step first ran down to the ground in white, so there is now a stone base.

Simplified: the gazebo's arched lattice between the pillars, the house's gables and vents, and the paths round the house.

Ground fit (owner report, 2026-10-05: "the stairs are misplaced"):
- The first build fitted to the higher of two DEMs. Copernicus reads the pine canopy here at 5 to 10 m above the map's bare terrain, so the stairway rose as a ramp and the gazebo and house stood on tall bases in the map.
- Now:
  - everything sits on the map's terrain (contract C2, ground fitting);
  - the lawn drapes over it;
  - the stair treads follow it between the terraces;
  - the house floor is 0.85 m above the anchor's ground, down from 7 m.
- Checked in the live map (headless Playwright screenshot).
- Packed: 108.9 KB, of which geometry is 54.0 KB.
