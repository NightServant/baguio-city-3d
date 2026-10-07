# hotels

## Scope
Baguio's hotels in 3D (owner request, 2026-10-07: "add 3d models of current hotels in Baguio City").

Every OSM `tourism=hotel` or `resort` with a name inside the map's city bounds is modelled, using:
- its own outline when it is mapped as a building;
- otherwise the buildings it covers;
- for a point, the building it stands in or beside (within 15 m).

That gives 150 hotels on 172 buildings, grouped by z15 tile into 31 map-only models, `hotels-<x>-<y>`.

Each hotel building gets:
- painted walls in hotel bays (paired windows);
- balconies on the side facing its street;
- a canopy on two posts over the entrance;
- its name on a board on the parapet;
- a flat roof behind a parapet with water tanks. In the app the roof shows the satellite photograph.

Hotels inside another model are left to it, among them Session Road's (`session-road-buildings`) and Camp John Hay's. The massing drops exactly the modelled buildings (`exclusion_parts`).

Built by `model/scripts/district_osm.py hotels`, then `district_textures.py` and `model/blender/landmarks/district.py`.

## Sources
- [S1] OpenStreetMap, Overpass 2026-10-07 (`model/data/osm/landscape.json`): `tourism=hotel|resort`, `name`, `stars`.
- [S2] OpenStreetMap, M1's extract (2026-10-02): the building outlines, `building:levels`, `height`.

## Estimates
Each item is an ESTIMATE unless it is cited.
- **Heights:**
  - 21 of the 172 buildings have OSM's `building:levels` [S2].
  - The other 151 get 3 to 7 storeys of 3.2 m, by footprint size (50 m² up to 2,000 m²) and a hash.
  - Several famous hotels are taller or lower than this; their OSM outlines need levels.
- **Fronts:** the side facing the nearest street within 40 m, or else the longest side.
- **Paint:** the district palette, by a hash of the OSM id. The real hotels' colours are not checked one by one.
- **Board:** the hotel's name in dark blue on white, up to 16 m wide, as a quarter of its width high.
- **Canopy:** 5 × 2.8 m at 3 m.

## Review (2026-10-07)
See the ledger for renders and budgets.
