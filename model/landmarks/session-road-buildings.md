# session-road-buildings

## Scope
Every building along Session Road (owner request, 2026-10-07: "improve session Road Buildings ... It must have the colorful apartments, fine-dining and fast food-restaurants"; then "Add more buildings"), in five map-only models along the street (`session-road-buildings-1` to `-5`, from Magsaysay Avenue up to the Cathedral end, about 20 buildings each). It covers 82 OSM buildings whose centroid lies within 70 m of the street's centrelines (the frontage and the row behind it), with:
- walls on their OSM outlines, in apartment, commercial or hotel bays, painted;
- shopfronts on the street side of the ground storey;
- the signs of the shops, restaurants, cafes, banks, pharmacies and hotels mapped in or beside each building (157 assigned; those that fit on the street side are drawn);
- balconies on the flats over the shops;
- flat roofs behind parapets, with water tanks. In the app each roof shows the satellite photograph, as the massing's roofs do.

The street itself, its median, sidewalks and awnings stay in `session-road`. The massing drops exactly these buildings: each registry entry's `exclusion_parts` lists every footprint shrunk by 0.5 m.

Built by `model/scripts/district_osm.py street session-road-buildings "Session Road" 70 0`, then `district_textures.py` and `model/blender/landmarks/district.py`.

## Sources
- [S1] OpenStreetMap, M1's Overpass extract (2026-10-02): the building outlines, `building`, `building:levels` and `height`.
- [S2] OpenStreetMap, Overpass 2026-10-07 (`model/data/osm/landscape.json`): the named amenities, shops and hotels.
  - Fast food: Jollibee (Upper Session and Session-Mabini), McDonald's, KFC, Chowking, Mang Inasal, Greenwich, Pizza Hut, Dairy Queen, Tokyo Tokyo, Yellow Cab, Mister Donut, Army Navy.
  - Restaurants: Vizco's, Pizza Volante, Solibao, Max's, Don Henrico's, Luisa's Cafe, 50's Diner, Sizzling Plate, Tea House, Oh My Gulay, Steaks and Toppings, Bonchon.
  - Cafés: Starbucks, Goldilocks, Il Padrino.
  - Banks: BDO, BPI, PNB, RCBC, Metrobank.
  - Pharmacies: Mercury Drug, Southstar, Generika.
  - Hotels: Hotel Veniz, Hotel 45, La Brea Inn, Prime Hotel.
- [S3] `session-road.md` S3, the owner's photo of Session Road: buildings of 4 to 8 storeys, shop fronts, signage.
- [S4] Owner request 2026-10-07: colourful apartments, fine dining and fast food.

## Estimates
Each item is an ESTIMATE unless it is cited.
- **Heights:**
  - Most have OSM's `building:levels` (× 3.2 m) [S1].
  - The rest are given 3 to 7 storeys, by footprint size and a hash.
- **Storeys:** the shop storey is 3.6 m and the others 3.2 m, in bays of 3.4 m. Parapets are 0.9 m.
- **Paint:**
  - twelve colours, from white and cream to salmon, mint, sky blue, butter yellow, terracotta, lilac, sage, peach, grey and teal [S4];
  - each building's colour is a hash of its OSM id.
- **Signs:**
  - 3.8 × 0.95 m boards over the shopfronts, a third of a metre off the wall, up to four to a building, eateries first;
  - plain lettering in the chain's colours for about twenty chains (red and white for Jollibee, red and yellow for McDonald's, green and white for Starbucks, and so on), otherwise colours by kind;
  - no logos.
- **Flats:**
  - 55% of the commercial buildings carry flats above the shops (hash) [S3];
  - their street side gets a balcony every other bay, alternating by storey, at most 40 to a building.
- **Roofs:** one water tank on stands (two over 300 m²): blue, black or white.

## Review (2026-10-07)
See the ledger for renders and budgets.
