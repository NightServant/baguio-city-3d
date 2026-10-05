# mines-view-park

## Scope
The observation deck on the cliff edge:
- its stone paving on a rock base, with log railings;
- the timber tepee frame with its red slat canopy and the black eagle on top;
- the rock face beside the deck;
- the stepped stone walkway down from the park;
- Benguet pines across the park.

The souvenir stalls and parking by the road are left to the basemap and the building massing.

OSM: `way/109351462` (`leisure=park`, `name=Mines View Park`), 3,574 m². Exclusion ring = that outline grown by 5 m (`model/landmarks.json`).

## Sources
- [S1] Wikipedia, "Mines View Park", read 2026-10-05: https://en.wikipedia.org/wiki/Mines_View_Park.
  - A park on a promontory 4 km from downtown that "overlooks the mining town of Itogon, particularly the abandoned gold and copper mines".
  - The observation deck sits below a winding, stone-covered stairway close to the parking area.
  - No dimensions are published.
- [S2] OpenStreetMap, Overpass 2026-10-05, in the model frame around the park's centroid:
  - `way/53619552`, a footway loop round the cliff-top (the deck): about 20 × 15 m, centred 50 m east and 4 m south of the centroid.
  - `way/53619551`, `natural=cliff`, along the park's east end below the deck.
  - `way/53619549`, the footway from the park down to the deck.
  - `way/328901191`, steps tagged "Entrance/Exit to Mines View Deck".
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [File:Mines View Park viewdeck Baguio City (12-04-2022).jpg](https://commons.wikimedia.org/wiki/File:Mines_View_Park_viewdeck_Baguio_City_12-04-2022_.jpg)
  - [File:Mines View Park Baguio City.jpg](https://commons.wikimedia.org/wiki/File:Mines_View_Park_Baguio_City.jpg)
  - [File:MinesView observation deck 4.jpg](https://commons.wikimedia.org/wiki/File:MinesView_observation_deck_4.jpg)

  What they show:
  - A tepee of pale timber poles leaning in to a crossing and fanning out above it.
  - A ring canopy of red-brown slats at head height plus about 1.5 m.
  - A black eagle sculpture with raised wings on top.
  - Grey irregular stone paving and rustic log railings.
  - A tall mossy rock face on the right when looking out east.
  - Benguet pines all around.
- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, fetched by `model/scripts/fetch_assets.py`, with sha256 and provenance in `model/sources.json`.
  - Pines: `tree_pineTallC_detailed` at 18 m and `tree_pineTallA_detailed` at 14 m.
  - Bushes: `plant_bushDetailed` at 1.4 m.
  - Both recoloured toward S3's greens.

## Estimates
Every height is an ESTIMATE, since none is published (S1). Method: scaled from the people in S3, taking 1.6 to 1.7 m as head height. Confidence: medium (±25%).
- **Tepee:** 12 poles from a 2.8 m base radius to a crossing 7 m up, running 32% past it. The canopy is 36 slats out to 5.4 m, at 3 m. The eagle has a 3.4 m wingspan and sits about 9.5 m up.
- **Deck size:** the S2 loop grown by 20%, so the railing stands outside the walking loop.
- **Deck level:** 0.3 m above the highest ground under it on the map's own terrain, so it is never buried there.
- **Rock base:** the Copernicus DEM (30 m) smooths the cliff into a slope (S2 puts the cliff here). The rock base therefore tapers 35% outward down to the lowest ground, so the slope reads as rock.
- **Railings:** posts every 2 m, rails at 0.7 and 1.1 m. The curb is 0.4 m.
- **Walkway:** 3 m wide, in 1 m treads, each level with the highest ground under it, so steps form where the ground drops.
- **Rock face:** 4 to 5.5 m above the deck.
- **Pines:** a jittered 12 m grid, kept clear of the deck and walkway.

## Open finding
The destination pin (120.628, 16.4201) sits at the road's turnaround, about 56 m north of the deck. The model is anchored on the OSM park, per contract C2, and doesn't move the pin. Moving the pin is the owner's call.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/mines-view-park-{front,aerial,side,close}.png`.
- Triangles: 5,964 in the scene, 3,636 in the exported file. The 16 pines share one mesh per kind.
- Packed: 49.9 KB, of which geometry is 30.3 KB.
- Ground fit (owner report, 2026-10-05: the stairs weren't fully rendered in the map).
  - The map's terrain sits 1.1 to 2.4 m above Copernicus along the walkway, which buried the treads.
  - The model is now fitted to the map's terrain (contract C2, ground fitting), which raises the deck to 10.1 m below the centroid.
  - Checked in the live map: the full walkway shows from the park to the deck.

Compared with S3, these match:
- the tepee's crossing and fanned tips;
- the red slat ring;
- the eagle;
- the grey paving;
- the log railings;
- the mossy rock face to the south;
- the stepped walkway.

The first pass hid the deck behind a 9 m pine grid, so the trees were thinned to 12 m and kept 16 m from the deck. Kenney's tall rock read as basalt columns, so the rock face is now a seeded, lumpy outcrop in a generated rock texture.
