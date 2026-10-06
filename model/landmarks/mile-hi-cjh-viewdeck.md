# mile-hi-cjh-viewdeck

## Scope
The Mile Hi Center in Camp John Hay, the former US commissary turned into a shopping arcade and reopened in 2025:
- the long, single-storey U of shops on its OSM outline, stepping down the slope;
- cream wooden shopfronts under rust-red hip roofs;
- the covered walkway along the parking side, with white posts, its dark-green fascia and shop signs;
- a stone-walled flower bed;
- pines.

Owner decision (2026-10-06): no source shows a view deck here, so the landmark is the Mile Hi Center, and its name and description are corrected in the data migration. The slug stays the same, so links keep working.

OSM: `way/43615634` ("Camp John Hay Commissary", `building=commercial`), 3,112 m², inside "Mile Hi" (`way/1441662281`, `landuse=retail`, 6,229 m²). Exclusion ring = the building's outline grown by 5 m.

Location: the destination pin (120.613, 16.4045) is about 510 m from the building. The registry's `osm_center` is OSM `way/1441662281`.

## Sources
- [S1] Web search on 2026-10-06:
  - Rappler, "Camp John Hay's iconic Mile Hi to rise again": https://www.rappler.com/business/camp-john-hay-mile-hi-bidding-redevelopment-bcda-may-2025/
  - SPOT.ph, "Mile-Hi Center in Camp John Hay Is Reopening After a 6-Year Closure" (20 August 2025): https://www.spot.ph/things-to-do/the-latest-things-to-do/baguio-city-gem-mile-hi-center-is-back-after-a-6-year-closure-a5138-20250820-dyn

  What they say:
  - The former American military commissary, converted into shops and named for its elevation of about a mile.
  - Once home to bowling, billiards, an arcade and a snack bar.
  - Closed for about six years, then reopened in August 2025 after the BCDA bid out the redevelopment of its 6,647 m² site.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/43615634`, a U of three arms about 16 to 19 m wide, wrapped round "Mile Hi Center Parking" (`way/109375751`);
  - Ordonio Drive runs along the east side.
- [S3] Photos in S1's SPOT.ph article, viewed 2026-10-06 and not stored:
  - "The old Mile-Hi Center": a long single-storey row of shops with a covered walkway on posts, signboards on a dark fascia, and a stone-walled flower bed with red flowers by the road;
  - "Mile Hi Grill": cream wooden fronts, a dark-green fascia sign, rust-red roofing, green railings and pines.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 22 m and `tree_pineTallA_detailed` at 18 m.

## Estimates
Every height is an ESTIMATE, scaled from S3. Confidence: medium.
- **Segments:** each arm is cut into segments of about 16 m along its length. Each has its own floor, 0.3 m above the highest map terrain under it (contract C2), over a stone plinth, so the arcade stays one storey (4 m) as it steps down.
- **Roofs:** 20° hips per segment.
- **Walkway:** 3 m deep, with posts every 3.5 m, a lean-to roof and a 0.85 m green fascia. Signs are 2.8 m wide, every 7 m, in varied colours.
- **Facade:** one texture: cream boarding with a dark glazed shopfront 2.6 × 2.2 m per 4 m bay.
- **Flower bed:** 6 m across, with a 0.7 m stone wall.

## Review (2026-10-06)
Render: `model/data/renders/landmarks/mile-hi-cjh-viewdeck-m6.png`, on the map's terrain.
- Triangles: 3,386 in the scene, 2,368 in the exported file.
- Packed: 24.4 KB.

The first pass put the whole U on one floor level, which showed two extra storeys of shopfronts where the ground falls. It now steps in segments.
