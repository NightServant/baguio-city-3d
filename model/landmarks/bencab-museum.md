# bencab-museum

## Scope
The BenCab Museum building on Asin Road:
- dark slate-clad, with glazed bands, stepping down the hillside in terraces on its OSM outline;
- white roof slabs;
- the white cantilevered entrance canopy and upper slab toward the road;
- the red "bencab" sign;
- pines on the slope.

The farm, garden, pond and eco-trail below are left to the basemap.

OSM: `way/112289880` ("BenCab Museum", `tourism=museum`), 736 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.549, 16.382) is about 3.2 km from the museum. S1's coordinates (16°24′37.9″N, 120°33′01.6″E) agree with OSM. The registry's `osm_center` is the OSM way. Moving the pin is the owner's call; this one matters, because the pin is in another barangay.

## Sources
- [S1] Wikipedia, "BenCab Museum", read 2026-10-05: https://en.wikipedia.org/wiki/BenCab_Museum.
  - Established in 2009 by National Artist Benedicto Cabrera; building began in 2006.
  - In Tuba, Benguet.
  - A four-storey building with nine sections.
  - Grounds include the BenCab Farm & Garden, an eco-trail, Café Sabel, coffee and bonsai gardens.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/112289880`: an irregular outline of two blocks.
  - Asin Road (`highway=secondary`) runs past its north side.
  - On the map's terrain the ground falls about 18 m from the road to the outline's south end.
- [S3] Reference photos `ref1` to `ref3` in `model/data/refs/bencab-museum/`.
  - `ref1`: the entrance, with dark slate cladding, white cantilevered slabs and canopy, glazing and the red "bencab" sign.
  - `ref2`: a Cordilleran carved figure inside.
  - `ref3`: fog over the garden, seen from a white-walled terrace.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 20 m and `tree_pineTallA_detailed` at 16 m.

## Estimates
Every height is an ESTIMATE, scaled from S3. Confidence: medium (±25%).
- **Terraces:**
  - the outline is cut into 8 m strips across the slope (away from the road, bearing 220°);
  - each strip rises two levels (7 m) above its own highest ground, never above the street-side roof;
  - S1's four storeys come out of the stepping.
- **Cladding:** one texture: dark slate 0.6 × 0.3 m in running bond, with a 1 m glazed band per 3.4 m level and mullions every 1.2 m.
- **Canopy:** 7 × 3.4 m at 3 m above the street. The upper slab reaches 1.8 m out at the roof.
- **Sign:** 4 × 1 m.

## Review (2026-10-05)
Render: `model/data/renders/landmarks/bencab-museum-m6.png`, on the map's terrain.
- Triangles: 1,582 in the scene, 564 in the exported file.
- Packed: 13.0 KB.

The first pass extruded the whole outline from the lowest ground to the street level plus 7 m, which made an 18 m block. It now steps down the slope.
