# philippine-military-academy

## Scope
The Academy's ceremonial heart:
- Borromeo Field, the parade ground, draped over the map's terrain;
- the Tirso G. Fajardo Memorial Grandstand on its north side: the long grey stand with its blue band bearing COURAGE, INTEGRITY and LOYALTY between the two crests; the central arch; the raised roof canopy; the flags along the roof;
- the fence and flags along the field's edge;
- pines round the field.

Melchor Hall and the other halls stand 100 to 250 m north of the field and are left to the building massing. The Fort del Pilar gate is far off at the campus entrance.

OSM: `way/373844844` (Borromeo Field) and `way/346262101` (the grandstand), 27,031 m² together. Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.618, 16.362) is about 220 m from the field. The registry's `osm_center` is OSM `node/5350499243`, "Philippine Military Academy".

## Sources
- [S1] Wikipedia, "Philippine Military Academy", read 2026-10-05: https://en.wikipedia.org/wiki/Philippine_Military_Academy.
  - Founded on 17 February 1905 as the Philippine Constabulary Officers' School.
  - At Fort Gen. Gregorio H. del Pilar, Loakan, since it reopened after the war.
  - The campus is 373 ha, with Melchor Hall (1949), Borromeo Field (the parade ground) and the Fajardo Grandstand.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/373844844`, Borromeo Field: 25,968 m², about 212 × 157 m;
  - `way/346262101`, "Tirso G. Fajardo Memorial Grandstand" (`building=grandstand`): 94.1 × 11.3 m along the field's north edge.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [PMA Grandstand & Borromeo Field, Jul 2025](https://commons.wikimedia.org/wiki/File:PMA_Grandstand_%26_Borromeo_Field,_Baguio,_Jul_2025.jpg) (CC BY-SA 4.0, Ralff Nestor Nacor): looking across the field at the stand;
  - [Melchor Hall, Jul 2025 (1)](https://commons.wikimedia.org/wiki/File:Melchor_Hall,_PMA,_Baguio,_Jul_2025_(1).jpg) (CC BY-SA 4.0, Ralff Nestor Nacor), for reference.

  What they show: a long grey stand with a blue band lettered COURAGE · INTEGRITY · LOYALTY in white, two crests, a central arched entrance, a white raised canopy on the roof with a row of flags, and a black-and-white fence with flags along the field.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 22 m and `tree_pineTallA_detailed` at 18 m.

## Estimates
Every height is an ESTIMATE, scaled from S3. Confidence: medium (±25%).
- **Stand:** 9.5 m tall above its floor (0.3 m over the highest map terrain under it).
  - The blue band is 1.8 m, with a white edge, white word blocks and 1.8 m crests.
  - The arch is 5 × 5.5 m.
  - The roof canopy is 1.8 m high over the middle 62 m.
  - Twelve 3.2 m flag poles stand along the roof.
- **Fence:** 4 m in front of the stand, 1 m high, with a 4.5 m flag pole on every third post.
- **Field:** draped on the map's terrain with a point every 6 m, 0.25 m above it (lm_common.drape, contract C2).
- **Pines:** about every 24 m, 9 m outside the field's west, south and east edges.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/philippine-military-academy-{stand,m6}.png`, on the map's terrain.
- Triangles: 6,058 in the scene, 3,024 in the exported file.
- Packed: 22.9 KB.

At a 10 m drape step the terrain showed through the field in patches, so the step is now 6 m.
