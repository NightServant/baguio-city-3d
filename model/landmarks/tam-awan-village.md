# tam-awan-village

## Scope
Tam-awan Village, the Chanum Foundation's reconstructed Cordillera village on a wooded slope:
- seven Ifugao huts: a raised room on four posts with round rat-guards, a ladder, and a steep pyramidal cogon roof hanging low;
- the village's mapped buildings as thatched houses on posts, one of them the octagonal Kalinga binayon;
- trees through the village.

OSM: `way/209022152` ("Tam-Awan Village", `leisure=park`), 24,497 m². Exclusion ring = that outline grown by 5 m. Five buildings (48 to 89 m²) are mapped inside it; the huts are not.

Location: the destination pin (120.576, 16.431) is about 130 m from the village's centre.

## Sources
- [S1] Web search on 2026-10-05: Cordillera News Agency, "Tam-awan Village at 25: A Journey into Cordilleran Culture" (https://cordilleranewsagency.com/tam-awan-village-at-25-a-journey-into-cordilleran-culture/), and https://www.gobaguio.com/tam-awan-village.html.
  - The Chanum Foundation began in 1996 to reconstruct Ifugao houses in Baguio, starting with three huts brought from Bangaan, Ifugao.
  - The village has seven Ifugao huts and two Kalinga houses, one of them a binayon, the octagonal Southern Kalinga house.
  - The huts were rebuilt with their original materials and new cogon roofs.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/209022152` and the five buildings inside it, exported by `uv run model/scripts/landmark_osm.py buildings tam-awan-village`.
- [S3] Owner-collected photos `ref1` to `ref3` in `model/data/refs/tam-awan-village/`.
  - `ref1`: the "Kinakin" hut, with its thick cogon roof low over a raised room on posts, a ladder and stone paving.
  - `ref2`: a hut's interior with carved figures.
  - `ref3`: a mossy path.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_default` at 12 m, `tree_pineTallA_detailed` at 18 m and `tree_oak` at 9 m.

## Estimates
- **Hut places:** OSM doesn't map the huts, so their positions are an ESTIMATE. They are seeded inside the village, 7 m apart, within 45 m of the mapped houses.
- **Ifugao hut:** a 3.2 m square room on posts 1.9 m high, with rat-guards at 1.5 m. The roof is a 55° pyramid 6 m across, coming down to 1.6 m. A stone yard surrounds it.
- **Mapped houses:**
  - posts to 1.6 m and a room to 3.4 m;
  - a 50° hip over their rectangle, overhanging 1 m.
- **Binayon:** the smallest mapped outline is taken as the binayon (an ESTIMATE): eight posts, an octagonal room and an eight-sided cone roof.
- **Thatch:** one texture, combed cogon.
- **Trees:** a jittered 26 m grid.

## Review (2026-10-05)
Render: `model/data/renders/landmarks/tam-awan-village-m6.png`, on the map's terrain.
- Triangles: 6,300 in the scene, 2,056 in the exported file.
- Packed: 32.3 KB.

Compared with S3, these match: thatched roofs low over rooms on posts, rat-guards, ladders and stone yards.

The first pass placed trees on a 16 m grid, 93 in all and 15,376 triangles, so the grid is now 26 m.
