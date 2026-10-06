# the-mansion

## Scope
- **The Mansion House:**
  - a white two-storey H plan;
  - the recessed central block, with its six-arched ground-floor arcade and green hip roof;
  - flat-roofed wings with parapets and corner urns;
  - windows;
  - the front lawn with flower beds and a flagpole.
- **The main gate:** its brick-and-stone piers with white cornices and urns, and the wrought-iron arch and leaves. It stands about 183 m up the axis toward Wright Park.
- Pines.

The guesthouse and the back gardens are left to the basemap.

OSM: `way/43615594` ("Mansion House", `historic=manor`), 1,220 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.623, 16.4085) is about 455 m from the house. The registry's `osm_center` is the OSM way. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] Wikipedia, "The Mansion (Baguio)", read 2026-10-05: https://en.wikipedia.org/wiki/The_Mansion_(Baguio).
  - Built in 1908 to William E. Parsons' design, after preliminary work by Daniel H. Burnham.
  - It is the official summer residence of the President of the Philippines.
  - Damaged in World War II and rebuilt in 1947.
  - The front gate "was once rumoured to be a replica of the main gate of Buckingham Palace", which has been disproven. The destination's description says the gate is "said to echo Buckingham Palace"; worth a look against S1.
  - No dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/43615594`, an H in a frame along bearing 49°:
    - wings 8.5 × 37 m;
    - a central block 27.4 × 21.4 m, its front recessed 4.7 m behind the wings on the north-west side.
  - The "Mansion House" marker nodes `node/7692329151`, `node/14156356636` and `node/14156356637` stand together about 183 m north-west of the house, on its axis. The gate is placed there, ±5 m.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Facade of The Mansion, Baguio](https://commons.wikimedia.org/wiki/File:Facade_of_The_Mansion,_Baguio.jpg) (public domain, Presidential Communications Development and Strategic Planning Office)
  - [The Mansion, Feb 2025](https://commons.wikimedia.org/wiki/File:The_Mansion,_Baguio_City,_Feb_2025.jpg) (CC BY-SA 4.0, Ralff Nestor Nacor)
  - [Mansion House Gate, Feb 2025 (2)](https://commons.wikimedia.org/wiki/File:Mansion_House_Gate,_Baguio_City,_Feb_2025_(2).jpg) (CC BY-SA 4.0, Ralff Nestor Nacor)

  What they show:
  - **House:** white walls; the central block's round-arched ground-floor arcade; a green hip roof; flat-roofed side pavilions with parapets and urns; red flower beds; a flagpole on the lawn.
  - **Gate:** stone-and-brick piers with white cornices and urns, and a black wrought-iron arch and gates.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 22 m and `tree_pineTallA_detailed` at 18 m.

## Estimates
Every height is an ESTIMATE, scaled from S3's façade (a two-storey front about three arch heights tall). Confidence: medium (±25%).
- **House:**
  - floor 0.4 m above the highest map terrain under the outline;
  - two 4 m storeys;
  - a 24° hip roof over the centre;
  - 0.9 m parapets on the wings.
- **Openings:**
  - arches 2.6 m wide and 3.6 m high;
  - windows 1.1 to 1.2 m wide and 2 m high.
- **Gate:**
  - piers 1.5 m square and 5.2 m tall, with 0.6 m caps and 1.1 m urns;
  - the opening is 5.3 m, with an iron arch rising 2 m above the piers' 5 m line;
  - side piers 3.6 m.
- **Flagpole:** 14 m.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/the-mansion-{m6,gate}.png`, on the map's terrain.
- Triangles: 3,906 in the scene, 2,312 in the exported file.
- Packed: 19.2 KB, of which geometry is 18.0 KB.

Compared with S3, these match: the H plan; the arcade's six round arches with the windows above; the green hip roof; the parapeted wings; the lawn with its red beds and flagpole; the gate's piers, caps, urns and iron arch.

Simplified: the iron scrollwork (shown as plain bars), the "THE MANSION" lawn letters, and the driveway.
