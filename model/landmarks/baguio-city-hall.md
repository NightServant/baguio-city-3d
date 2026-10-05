# baguio-city-hall

## Scope
- The City Hall building on its OSM outline: white walls in two storeys with dark-green window bands; dark-green hip roofs.
- The tall four-column portico with its pediment and front stair.
- The white clock tower with its pyramidal cap.
- Pines.

City Hall Park and the forecourt are left to the basemap.

OSM: `way/43615687` ("Baguio City Hall", `amenity=townhall`, `historic=heritage`), 3,766 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.6005, 16.4095) is about 1.1 km from City Hall. The registry's `osm_center` is the OSM way. Moving the pin is the owner's call.

## Sources
- [S1] Wikipedia, "Baguio City Hall", read 2026-10-05: https://en.wikipedia.org/wiki/Baguio_City_Hall.
  - First built of wood in 1910, under the city's first mayor, E. W. Reynolds.
  - Destroyed in the Second World War and rebuilt in concrete; renovated in the 1990s.
  - No building dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/43615687`, about 129 m long in a frame along bearing 45°.
  - A main bar 57.6 × 23.5 m, an end block 21 × 39 m and west wings.
  - A front projection 14 × 5 m with the portico bump, 6 × 4.5 m, on the north-west side.
  - The map's terrain falls about 10 m along the outline.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Baguio City Hall front facade](https://commons.wikimedia.org/wiki/File:Baguio_City_Hall_front_facade.JPG)
  - [Baguio City Hall, Dec 2023](https://commons.wikimedia.org/wiki/File:Baguio_City_Hall,_Dec_2023.jpg)
  - [Baguio City Hall (2018-02-25)](https://commons.wikimedia.org/wiki/File:Baguio_City_Hall_(Baguio,_Benguet)(2018-02-25).jpg)

  Licences: front façade CC BY-SA 3.0 (Iloilo Wanderer); Dec 2023 CC BY-SA 4.0 (Ralff Nestor Nacor); 2018-02-25 CC BY-SA 4.0 (Patrick Roque). What they show: white walls with dark-green bands and window frames; dark-green hip roofs with small gablets; a tall portico of four square columns under a pediment lettered "CITY HALL BAGUIO"; a broad front stair; a white clock tower with a pyramidal cap and finial.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 20 m and `tree_pineTallA_detailed` at 16 m.

## Estimates
Every height is an ESTIMATE, scaled from S3. Confidence: medium (±25%).
- **Floor:** 0.3 m above the highest map terrain under the outline (contract C2, ground fitting). The downhill end shows a lower storey, as a building on a 10 m fall would.
- **Storeys:** two of 3.6 m. The eave is 7.2 m above the floor.
- **Roofs:** 20° hip roofs over seven rectangles read off S2.
- **Portico:**
  - four 0.7 m columns 3 m in front of the wall, rising 9.2 m from the top of the stair;
  - a 22° pediment gable;
  - a stair of six 0.2 m risers.
- **Tower:** 4.6 m square to 6.5 m above the eave; an upper stage 3.4 m square with a 1.8 m clock; a cap to 12.4 m above the eave.
- **Facade texture:** one window 2.2 × 2.0 m per 3.6 m bay.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/baguio-city-hall-{m6,close}.png`, on the map's terrain.
- Triangles: 1,606 in the scene, 742 in the exported file.
- Packed: 12.7 KB.

Compared with S3, these match: the white, green-banded walls; the dark-green hips; the four-column portico with its pediment and stair; the clock tower.

The first pass hid the columns inside the wall, because OSM's outline includes the portico. They now stand 3 m in front of a shaded loggia wall.
