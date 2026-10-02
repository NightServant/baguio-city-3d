# burnham-park

## Scope
Burnham Lake, the park's defining feature: the water surface, its concrete rim, and the rental rowboats on it. The rest of the 32.84 ha park (gardens, playground, skating rink, grandstand) is left to the basemap's park area, and its few buildings stay in the building massing.

OSM: `way/330642119` "Burnham Park Lake", 15,875 m², 28 vertices, about 180 m across on a north-west to south-east axis. Exclusion ring = the lake grown by 5 m (`model/landmarks.json`).

## Sources
- [S1] Spec §2 (Wikipedia "Burnham Park", verified 2026-09-22): 32.84 ha; designed by Daniel Burnham, plan dated 1905, park established 1925; Burnham Lake at the centre, average depth 3.04 m, about 34,000 m³; 12 clusters.
- [S2] OpenStreetMap `way/330642119` (Overpass, 2026-10-02): the lake outline and area above; the park polygon `way/330642136` is 278,373 m² (`leisure=park`, `historic=heritage`).
- [S3] `data/geojson/landmarks.geojson` description: "laid out to Daniel Burnham's 1905 city plan around a man-made lagoon where visitors paddle rented boats".
- [S4] Spec §1A (street-level, Aug 2019): patterned paving, a tiered stone monument, stone gate piers.

## Estimates
- Water level 0.3 m above the highest terrain sample under the lake. Copernicus is not a water surface, and the offset avoids z-fighting with the map's terrain (M4 plan).
- Rim: concrete, 1.2 m wide, 0.6 m above the water.
- Boats: 14 rowboats (2.6 × 1.0 m at the waterline, 3.0 × 1.3 m at the gunwale), colours red, blue, yellow, white and orange. Count and colours are an ESTIMATE of the rental fleet for a plausible look; S3 confirms rental boats.
- Water colour: muted grey-green (sRGB 72, 104, 100), ESTIMATE.

## Review (2026-10-02)
Renders: `model/data/renders/landmarks/burnham-park-{front,aerial,side,preset-burnham-park}.png`. 888 triangles; 20.2 KB packed; water 1.36 m above the centroid's ground.
- From the burnham-park preset, the lake reads as a dark patch west-south-west of the cathedral, matching their real relative positions.
- Up close, the rim follows the OSM shoreline, including its inlet, and 14 coloured rowboats sit on the water.
- The shared review cameras frame buildings, so they show only part of a 180 m lake. The preset view is the one that matters on the map.
