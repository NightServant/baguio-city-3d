# igorot-stone-kingdom

## Scope
The Igorot Stone Kingdom, a hillside of fieldstone terraces in a gully:
- stone tiers stepping down the slope;
- the perimeter walls with pointed stone pinnacles, crenellated along the upper wall;
- the tower of the Gatan and Bangan legend;
- the round arena with its green rings and fountain;
- trees on the slopes outside.

OSM: `way/1034070960` ("Igorot Stone Kingdom", `tourism=theme_park`), 8,738 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.621, 16.418) is about 5.1 km from the park, near Mines View. The registry's `osm_center` is the OSM way. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] City of Baguio and Tourism Promotions Board sign at the park, photographed as [File:Igorot Stone Kingdom Marker, Baguio City.jpg](https://commons.wikimedia.org/wiki/File:Igorot_Stone_Kingdom_Marker,_Baguio_City.jpg) (CC BY-SA 4.0, Ralff Nestor Nacor), read 2026-10-05.
  - A theme park of massive stone walls built in the Cordillera's traditional stonewalling, *kabite* (riprap).
  - The vision of its owner, the engineer Pio Velasco, blending castles and fortresses with Cordillera folklore.
  - Its tower tells the legend of Gatan and Bangan, who survived the great flood in Kabunyan's fertility stone tower.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/1034070960`.
  - The map's terrain falls about 22 m from the outline's north end to its south tail, and the ground rises east and west: a gully.
- [S3] Wikimedia Commons photos by Ralff Nestor Nacor (CC BY-SA 4.0), read 2026-10-05:
  - [Igorot Stone Kingdom, Dec 2023](https://commons.wikimedia.org/wiki/File:Igorot_Stone_Kingdom,_Baguio_City,_Dec_2023.jpg), an aerial over the bowl;
  - [Igorot Stone Kingdom](https://commons.wikimedia.org/wiki/File:Igorot_Stone_Kingdom,_Baguio_City.jpg), the entrance;
  - [Igorot Stone Kingdom (3)](https://commons.wikimedia.org/wiki/File:Igorot_Stone_Kingdom,_Baguio_City_(3).jpg), the terraces.

  What they show: pale grey fieldstone tiers stepping round a bowl; crenellated walls; rows of pointed stone pinnacles; green grass strips; a round arena with green rings and a central fountain; a tall tower at the top; trees all round.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_default` at 12 m and `tree_pineTallA_detailed` at 18 m.

## Estimates
Every number below is an ESTIMATE, from S3. Confidence: low to medium; the complex's inner layout isn't mapped.
- **Tiers:** one stone block per 6 m cell inside the outline. Each top is the highest map terrain under the cell plus 0.2 m, rounded up to a 1.5 m step, so the tiers follow the slope (contract C2).
- **Arena:** 22 m across, mid-bowl in the main block, level on a 1.5 m step, with two green rings and a 4 m fountain with a 1.9 m spire.
- **Walls:** 0.8 m thick, 2.5 m above their own ground along the outline.
  - 0.8 m merlons every 1.5 m on the upper 30 m of the outline.
  - Four-sided stone pinnacles 1.8 to 3.2 m tall on about 85% of the 6 m wall pieces.
- **Tower:** 5.2 m square and 12 m high, with merlons and a 3.5 m spire, at the top of the bowl.
- **Texture:** one, pale fieldstone (`lm.flagstones`).

## Review (2026-10-05)
Render: `model/data/renders/landmarks/igorot-stone-kingdom-m6.png`, on the map's terrain.
- Triangles: 8,964 in the scene, 5,740 in the exported file.
- Packed: 70.6 KB, of which geometry is 58.9 KB.

The first pass put the arena on the outline's south edge; S3's aerial has it mid-bowl, so it moved.
