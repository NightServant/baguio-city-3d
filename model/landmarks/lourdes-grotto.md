# lourdes-grotto

## Scope
- The pilgrims' stairway up the hill, with white posts and blue handrails.
- The twin flights flanking the grotto.
- The rock grotto: its arched niche, the white statue of Our Lady with a blue sash, the arched sign frame, flower beds and the blue candle altar.
- The plaza in front of the grotto.
- The Chapel of Jesus and Maria.
- A few trees.

OSM: `way/1153950697` (the chapel, `building=chapel`), 226 m², anchors the model. The grotto is OSM `node/384119717`, about 26 m west-north-west of the chapel.

Location: the destination pin (120.585, 16.411) is about 490 m from the grotto. The registry's `osm_center` is that node, from the Overpass name search on 2026-10-05. The pin was moved onto the model on 2026-10-06 (owner decision, `model/scripts/move_pins.py`).

## Sources
- [S1] City of Baguio and Tourism Promotions Board welcome sign at the grotto, photographed as [File:Lourdes Grotto Marker, Baguio City.jpg](https://commons.wikimedia.org/wiki/File:Lourdes_Grotto_Marker,_Baguio_City.jpg) (CC BY-SA 4.0, Ralffralff), read 2026-10-05.
  - Fr. Jose Algue, director of the Manila Observatory, started building the grotto along Dominican Hill Road in 1913.
  - It is reached up "a flight of stairs comprising of 252 steps".
- [S2] OpenStreetMap, Overpass 2026-10-05, measured from the grotto node:
  - **The climb:** steps `way/1148366531` (45 steps), `way/1148366530` (30), `way/1153950698` (29) and links, from (+36, +49) up to the plaza at (+7, +9). The map's terrain rises 23 m along it.
  - **The twin flights:** `way/1153950694` and `way/1153950695` (34 steps each), from the plaza past the grotto to (0, −5) and (−6, +1). They run at bearing about 42°.
  - **The chapel:** `way/1153950697`, a square about 15 m a side set at 45°, with a porch on its north-west side.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Lourdes Grotto, Jan 2024 (1)](https://commons.wikimedia.org/wiki/File:Lourdes_Grotto,_Baguio_City,_Jan_2024_(1).jpg) (CC BY-SA 4.0, Ralffralff)
  - [Lourdes Grotto Chapel, Jan 2024](https://commons.wikimedia.org/wiki/File:Lourdes_Grotto_Chapel,_Baguio_City,_Jan_2024.jpg) (CC BY-SA 4.0, Ralffralff)
  - [Lourdes Grotto Baguio City](https://commons.wikimedia.org/wiki/File:Lourdes_Grotto_Baguio_City.jpg) (public domain)
  - [Lourdes Grotto in Baguio city 01](https://commons.wikimedia.org/wiki/File:Lourdes_Grotto_in_Baguio_city_01.jpg) (CC BY-SA 3.0, Jhloucal)

  What they show:
  - **The grotto:** a mossy rock face with an arched niche framed in pale stone, a white statue with a blue sash, and the arched "Tota Pulchra es Maria" sign; a blue-and-white candle altar; red flowers.
  - **Stairs:** on both sides, with white posts and blue rails.
  - **Chapel:** white walls, a grey gable roof, stone porch pillars and a wood-panelled porch gable.
- [Assets] Ready-made CC0 models from Kenney (www.kenney.nl): Nature Kit, fetched by `model/scripts/fetch_assets.py`. Used: `tree_default` at 11 m and `tree_pineTallA_detailed` at 16 m.

## Estimates
Every number below is an ESTIMATE, scaled from the people in S3 (1.6 to 1.7 m). Confidence: medium (±25%).
- **Stairs:**
  - main flight 2.6 m wide, twin flights 1.8 m;
  - 1 m treads, each on the highest map terrain under it (contract C2, ground fitting);
  - posts every 2 m, with the rail at 1 m.
- **Grotto rock:** 4.8 × 7.6 m, rising 6 m above the plaza.
  - Niche: 1.8 m wide, from 0.9 to 4.1 m, inside a 2.6 m stone frame.
  - Statue: 1.7 m, plus a 0.3 m head.
  - Altar: 3 × 0.8 × 1.1 m.
- **Plaza:** 5 × 7 m, level.
- **Chapel:**
  - walls 4 m on the OSM square, inset 0.3 m;
  - gable roof at 28°;
  - porch 3.3 m deep with two stone pillars.

## Review (2026-10-05)
Renders: `model/data/renders/landmarks/lourdes-grotto-{m6,close}.png`, on the map's terrain.
- Triangles: 4,604 in the scene, 3,860 in the exported file.
- Packed: 47.3 KB, of which geometry is 36.5 KB.

Compared with S3, these match:
- the stairway with blue rails;
- the twin flights either side of the grotto;
- the mossy rock with its framed niche, white statue, blue sash, sign arch, red flowers and blue altar;
- the white chapel with its grey roof and pillared porch.

Simplified:
- The niche frame is pointed, but the real one is round.
- Only the top 34 + 29 + 30 + 45 steps that OSM maps near the grotto are modelled, not all 252.
