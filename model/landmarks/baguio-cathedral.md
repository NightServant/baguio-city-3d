# baguio-cathedral

## Scope
The cathedral building itself: twin front towers with spires, the nave, the transept, the apse and the entrance porch. The forecourt and the 104-step stairway from Session Road are left to the terrain and basemap.

OSM: `way/42936372` (`building=cathedral`, `building:levels=2`, `amenity=place_of_worship`), 888 m². Exclusion ring = that footprint grown by 5 m (`model/landmarks.json`).

## Sources
- [S1] Wikipedia, "Baguio Cathedral", read 2026-10-02: https://en.wikipedia.org/wiki/Baguio_Cathedral. Official name "Baguio Cathedral and Diocesan Shrine of Our Lady of the Atonement"; groundbreaking 1920; completed and consecrated 9 July 1936; Neo-Romanesque; twin square belfries with pyramidal roofs; rose window; 104-step stone staircase from Session Road; the façade overlooks Session Road. No dimensions published.
- [S2] OpenStreetMap `way/42936372`, Overpass 2026-10-02. Measured in the model frame along the building axis (bearing −26.3°, the façade at the south-south-east end, apse to the north-north-west):
  - nave body 38.1 m long (axis −23.1 to +15.0) × 18.0 m wide (−8.8 to +9.2);
  - front towers: two flanks 4.6 m wide (−8.8 to −4.2 and +4.6 to +9.2);
  - central porch projection 2.4 m deep (−25.5 to −23.1) × 8.8 m wide (−4.3 to +4.5);
  - transept 9.9 m deep (+5.1 to +15.0) × 25.2 m across (−12.9 to +12.3);
  - apse 10.4 m wide, rounded, to +27.8.
- [S3] Owner's reference photo (aerial, oblique, watermark "URBEX PH PLAKADO TV", supplied 2026-10-02 in chat; not stored in the repo).
  - Walls: white to light grey; trim: darker grey.
  - Roofs: red throughout (nave, transept, porch). Tower spires: steep four-sided, red, scale-patterned.
  - White balustrade at the top of each tower shaft, with small corner pinnacles carrying blue-grey caps.
  - Pointed-arch louvred openings on the towers; a clock on the front of the left tower (as seen facing the façade, so the west tower); round rose windows on the other faces.
  - Central gable with a white cross at its apex, a statue niche (blue robe) above the porch, and a central rose window.
- [S4] Spec §1, drone caption: "built 1936", twin spires on a hilltop with a forecourt plaza. Its "rose/cream" walls predate the current white paint shown in S3; S3 wins as the newer reference.

## Estimates
All heights are ESTIMATE: none is published (S1). Method: proportions read from S3 against S2's measured tower flank width (4.6 m). Confidence: medium (±20%).
- Tower square side 5.0 m: between S2's 4.6 m flank and S3's visibly broader towers.
- Tower shaft to the balustrade: 20 m (S3: shaft ≈ 4 × the tower width).
- Balustrade 1.2 m. Spire 12 m above the balustrade (S3: spire ≈ 2.5 × the width). Top of spire ≈ 33 m.
- Nave eave 11 m (OSM `building:levels=2`, church storeys about 5.5 m). Ridge 18 m (S3: a steep roof, about 38°, over the 18 m width).
- Transept: same eave and the same 38° pitch, so its ridge is about 14.9 m (its depth is only 9.9 m); it reads as a lower cross-gable, as in S3.
- Apse wall 9 m with a half-cone roof to 14 m. Porch 5 m with a red lean-to roof.

## Review (2026-10-02)
Renders: `model/data/renders/landmarks/baguio-cathedral-{front,aerial,side,preset-session-road}.png`. 1,693 triangles; foundation 2.8 m to the lowest ground under the footprint.
Compared with S3, these match:
- twin square white towers with steep red four-sided spires, white balustrades and blue-grey corner caps;
- the clock on the west tower's front and a rose window on the east tower's;
- the central gable with its white cross and grey rose window, and the statue niche over the red-roofed porch;
- the red nave, transept and apse; white walls with grey trim.

Simplified: the spires' scale pattern, the tower trim bands and louvre detail, and the stained-glass tracery. From the session-road preset (z16) the cathedral reads as a red mark on the hill, as expected at that range.
