# session-road

## Scope
The Session Road corridor within 220 m of the destination: both one-way carriageways with lane markings, the planted median with trees and lamp posts, the sidewalks, and runs of awnings over them. The frontage buildings stay in the city's building massing: the exclusion ring covers the carriageways only (a 4 m corridor around the centrelines, no extra buffer).

OSM: five `highway=primary`, `oneway=yes` centreline parts within 220 m. The main pair is `way/79386888` (305 m, 2 lanes) and `way/333000200` (310 m, 2 lanes); the connectors are `way/940671846`, `way/940671847` and `way/956652532` (3 lanes). The pair's centrelines run 6 to 8 m apart.

## Sources
- [S1] OpenStreetMap (Overpass, 2026-10-02): the centrelines, `lanes`, and `oneway` above.
- [S2] Spec §1B (street-level, Harrison Rd, CBD): continuous corrugated-metal awnings on steel posts, blue and galvanized; sidewalks about 1.5 to 2 m; carriageway 7 to 9 m.
- [S3] Owner's reference photo "Session, Baguio City, July 31, 2026" (supplied 2026-10-02 in chat; not stored in the repo):
  - a divided road with a planted central median: trees, shrubs, lamp posts carrying star lanterns;
  - several lanes each way; sidewalks with shop fronts and blue signage;
  - buildings of 4 to 8 storeys.
- [S4] `data/geojson/landmarks.geojson`: "Baguio's sloping main artery … climb toward the cathedral steps."

- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, City Kit (Roads) and Watercraft Kit, fetched by `model/scripts/fetch_assets.py` with sha256 and provenance in `model/sources.json`. Owner request, 2026-10-05.
  Median trees (`tree_default`, `tree_oak`, about 6.5 m) and curved street lights (`light-curved`, 7.5 m, arms over each carriageway).

## 1:1 rebuild (owner request 2026-10-06: real size, with intersections)
The first model drew 3 m lanes on each OSM centreline, 2 m sidewalks, 6.5 m trees and 7.5 m lamps (Kenney assets), and it ran straight over the side streets: too big for the map and without its junctions. It is now built from the map data by `landmark_osm.py streets session-road` (`model/data/landmarks/session-road/streets.json`):
- **Axis and widths (from S1 measurements):** the pair's centrelines are 7.27 m apart (median over the pair). With a 1.0 m planted median (ESTIMATE from S3), that leaves 3.13 m lanes. The kerb is 6.76 m from the midline.
- **Sidewalks:** OSM's buildings stand a median 12.33 m from the midline (rays every 5 m, n=100). The sidewalk runs 5.57 m from the kerb to that line, cut back to the actual fronts.
- **Intersections [S1]:** Mabini Street, Assumption Road, Felipe Calderon Street and Father Carlu Street, plus Session Road's own approaches.
  - Each runs 35 m from the corridor at its OSM lane count × the same lane width (min 3.5 m).
  - The asphalt is joined into one surface with 2 m kerb radii.
  - The median breaks where a street crosses it.
- **Crossings [S1]:** zebra bars (0.5 m on, 0.5 m off, 3 m long) on every OSM `footway=crossing`. Lane dashes are 3 m per 8 m (ESTIMATE), kept clear of junctions and crossings.
- **Furniture at real size (ESTIMATEs from S3):**
  - median trees 4.2 to 4.5 m;
  - 7 m lamp posts (0.16 m pole) with one arm over each carriageway;
  - awnings 3.0 m up and 1.8 m deep, along about 70% of the building fronts (seeded runs, blue or galvanized, S2).
- **Ground fit:** every surface lies vertex by vertex on the map's terrain, on a 6 m grid (9 m for sidewalks and median):
  - asphalt 0.12 m above it;
  - kerbs 0.15 m above the asphalt;
  - the planter 0.55 m above the ground;
  - skirts to 1 m under the lowest ground.
- **Budget:** 7,341 triangles in the scene; packed 72.7 KB (geometry 60.6 KB, tier-1 cap 60 KiB). The outlines are simplified at 0.2 m.
- **Checked live:** the Felipe Calderon junction shows its kerb radii, zebra crossings, dashes and median break; the road sits at street level between the frontage buildings.

## Estimates (first model, 2026-10-02; superseded above)
- Lanes 3.0 m each (S1 gives the count, not the width). Each carriageway builds its half of the median, 0.6 m, 0.4 m high, so the halves meet even where the centrelines are 6 m apart.
- Sidewalks 1.85 m plus a 0.15 m kerb (S2). Awnings 3.2 m high, 1.9 m deep, over about 65% of the frontage in seeded runs of blue or galvanized (S2: "much, not all"). Posts at the kerb.
- Trees in the median about every 30 m, lamps between them (S3). Lane marking: dashed centre line, 6 m dash per 12 m, solid edges.
- The street follows the terrain sampled every 15 m along each centreline. Slabs reach 1 m below it.

## Review (2026-10-02)
Renders: `model/data/renders/landmarks/session-road-{front,aerial,side,preset-session-road}.png` (2× distance). 4,576 triangles; 27.5 KB packed without normals.
- Compared with S3: the divided road, the tree-lined planted median with lamps, the sidewalks and the awning runs read as Session Road from the street view.
- First pass: each 1 m median half spilled onto the opposite carriageway where the centrelines are 6 m apart; narrowed to 0.6 m.
- Simplified: crosswalks, traffic lights, the star lanterns (seasonal), and individual shop signs.

Fix (owner report, 2026-10-05: "Asphalt is not fully rendered"):
- The terrain showed through the road. Cross-sections sat on the centreline height, while the 30 m terrain between them rose higher. Each cross-section now takes the highest terrain over a patch spanning its neighbouring segments and the full width, plus 0.15 m.
- Each carriageway's median now reaches the midline to the opposite carriageway, so no bare strip is left where the OSM centrelines are more than 7 m apart.

## Ground fit (2026-10-05)
The cross-sections now sit 0.15 m above the map's own terrain (contract C2, ground fitting), which differs from Copernicus by up to about 2 m along the road. Checked in the live map: the road is continuous.
