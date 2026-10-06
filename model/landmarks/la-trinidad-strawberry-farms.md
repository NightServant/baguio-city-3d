# la-trinidad-strawberry-farms

## Scope
The La Trinidad strawberry farm's pick-your-own field by its parking:
- the field, draped over the valley floor in rows of black-mulched beds with strawberry plants;
- white plastic low tunnels over a block of rows;
- the green shade-net fence round it;
- the giant strawberry sculpture lying on its side by the parking.

La Trinidad is context only (owner answer 4), but this destination keeps its landmark (M6). The model is the visitor field, not the whole 112 ha farm relation: that relation as a footprint would remove the building massing across the valley.

OSM: `way/376934388` (`landuse=farmland`), 13,734 m², 9 m from the "Strawberry Farm" node. Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.587, 16.464) is about 600 m from the field. The registry's `osm_center` is OSM `node/8932902319`, "Strawberry Farm", the visitor farm by its parking. It replaces the farm relation `relation/7917267`, whose centre lies over 700 m away. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] Wikipedia, "La Trinidad, Benguet", read 2026-10-05: https://en.wikipedia.org/wiki/La_Trinidad,_Benguet.
  - Known as the "Strawberry Fields of the Philippines"; it supplies most of the country's strawberries.
  - The fields are in the La Trinidad Valley, with Benguet State University's agricultural research.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/376934388`, the field: 202 × 92 m, rows along bearing 168.5°;
  - `relation/7917267`, "La Trinidad Strawberry Farm", 1,118,316 m²;
  - "Strawberry Farm Parking" (`way/208744991`);
  - `way/949726775`, `tourism=artwork`, "A sculpture of a strawberry": 7.6 × 6.6 m, long axis at 202.2°.
- [S3] Reference photos `ref1` to `ref3` in `model/data/refs/la-trinidad-strawberry-farms/`.
  - `ref1`, `ref3`: rows of black-mulched beds with strawberry plants, wire hoops, white plastic low tunnels over some rows, and a green shade-net fence.
  - `ref2`: the giant strawberry lying on its side, red with yellow seeds and a green leaf cap.
- [Spec] The 1 October drone caption gives "about 80 ha of farmland" for the valley (spec §1), consistent with S2's relation.

## Estimates
Every number below is an ESTIMATE, from S3. Confidence: medium.
- **Beds:** one texture, 1.2 m spacing: 0.9 m of black mulch dotted with plants and 0.3 m soil paths. The field is draped on the map's terrain (lm_common.drape, 6 m points, 0.2 m lift, contract C2).
- **Low tunnels:** 1 m wide and 0.55 m high, over every second bed in a 24 m block, in 10 m pieces on the ground. There are 112 pieces.
- **Fence:** 1.5 m, in pieces of up to 8 m along the outline.
- **Giant strawberry:** 7.6 m long, 5.8 m wide and 2.9 m tall, tapering to its tip, with 28 seeds and five leaf blades.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/la-trinidad-strawberry-farms-{m6,berry}.png`, on the map's terrain.
- Triangles: 4,652 in the scene, 4,632 in the exported file.
- Packed: 24.3 KB.

Compared with S3, these match: the black-mulched rows, the white tunnels, the green net fence, and the red strawberry with its seeds and leaf cap.
