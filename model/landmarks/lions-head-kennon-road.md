# lions-head-kennon-road

## Scope
The Lion's Head on Kennon Road, a 12 m limestone lion's head facing the road on its stone plinth:
- the lumpy gold mane;
- the brown face with its white eyes, the muzzle and nose;
- the open mouth with white fangs;
- the forepaw with white claws;
- trees on the slope behind.

OSM: `way/109582851` ("Lion's Head", `height=12`, `material=limestone`, `start_date=1972`), 110 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.606, 16.341) is about 2.9 km south of the sculpture, further down Kennon Road. The registry's `osm_center` is the OSM way. Moving the pin is the owner's call.

## Sources
- [S1] Wikipedia, "Lion's Head (Benguet)", read 2026-10-05: https://en.wikipedia.org/wiki/Lion%27s_Head_(Benguet).
  - 40 ft (12 m) tall.
  - Begun in 1968 for the Lions Club of Baguio and unveiled in 1972. The Ifugao artist Reynaldo Lopez Nanyac carved the initial form; the sculptor Anselmo B. Day-ag carved the face.
  - Limestone. Painted at times white and brown or yellow, and since restored to its traditional gold and black.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/109582851`, about 14 × 11 m, `height=12`. Kennon Road runs past its east side, so the lion faces east.
- [S3] The infobox photo [File:Lion's Head in Kennon Road.jpg](https://commons.wikimedia.org/wiki/File:Lion%27s_Head_in_Kennon_Road.jpg) (2015; licence on its file page), and `s1-enwiki.jpg` in `model/data/refs/lions-head-kennon-road/`. They show a gold mane with combed carving, a darker brown face, white eyes with dark pupils, an open mouth with white fangs, and a forepaw with white claws at the lion's left, on a stone base by the road.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_default` at 10 m and `tree_pineTallA_detailed` at 15 m.

## Estimates
S2 and S1 give the height (12 m). The carving's proportions are an ESTIMATE from S3. Confidence: medium.
- **Plinth:** 0.8 m above the highest map terrain under the outline (contract C2).
- **Mane:** a seeded lumpy dome 7 m deep and 10 m wide, cut flat at the front. One texture: combed gold.
- **Face:** 5.4 m wide and 7.6 m tall, tapered.
  - Eyes are 1.1 m across.
  - The muzzle stands 1.6 m proud, with a 1.4 m nose.
  - The mouth is 3 × 1.2 m with four 0.7 m fangs.
- **Paw:** 3.2 × 2.2 m with four claws.

## Review (2026-10-05)
Render: `model/data/renders/landmarks/lions-head-kennon-road-front.png`, on the map's terrain.
- Triangles: 1,372 in the scene, 876 in the exported file.
- Packed: 17.9 KB.

The first pass put the paw on the lion's right; S3 has it on the lion's left.

Simplified: a carved-in-the-round head is approximated by blocks. It reads at map range as S3's lion, but not up close.
