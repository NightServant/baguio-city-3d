# sm-city-baguio

## Scope
SM City Baguio on Luneta Hill (owner request, 2026-10-06), and Sky Ranch beside it:
- the mall in three terrace tiers on its OSM outline, in sage-green tiled cladding;
- dark-grey floor bands, terrace railings, glazed shopfronts and the covered walkways of the terraces;
- the main entrance on Luneta Hill Drive: the curved glazed bay with three bands, the canopy, and the SM sign;
- the roof's Sky Park: membrane tents, lawns, planters, and the stair core with its sign;
- Sky Ranch: the Baguio Eye, a drop tower, a carousel and a Viking ride;
- pines on the hill's slopes.

The Cyberzone, Fiesta Strip, carpark annex and power station stay in the city's building massing.

OSM: `relation/15871764` (the mall, `building=retail`, `building:levels=9`, 30,327 m²) and `way/570550425` (`tourism=theme_park`, Sky Ranch Baguio, 6,866 m²). Exclusion ring = those grown by 5 m (`model/landmarks.json`). The registry's `osm_center` is Wikipedia's coordinate.

Not a destination yet: the model shows on the map by view (zoom 15 and up). Adding it to the guide (pin, sheet, description) is the owner's call.

## Sources
- [S1] Wikipedia, "SM City Baguio", read 2026-10-06: https://en.wikipedia.org/wiki/SM_City_Baguio
  - Opened 2003 on Luneta Hill, on the site of the Pines Hotel. The lot is 79,763 m².
  - Floor area 196,000 m². Six levels at opening.
  - Open-air design with natural lighting and ventilation; "the veranda modelled after the Banaue Rice Terraces".
  - Sky Ranch (opened 2018, 5,500 m² lot on Rambakan Drive): a Viking ride, a carousel, a drop tower, and the Baguio Eye, a 45 m Ferris wheel 50 m tall with 24 gondolas.
  - Also the North Terrace (2019), the Sunset Terraces (2019 to 2020) and the Sky Terrace (2020).
  - The 2012 protests over cutting the pines on Luneta Hill.
- [S2] OpenStreetMap, Overpass 2026-10-06: the outlines above. Luneta Hill Drive runs along the east side (the main entrance), Rambakan Drive to the south and Governor Pack Road to the west.
- [S3] Wikimedia Commons photos, read 2026-10-06:
  - "SM City Baguio (Pictured 02-25-2023).jpg", CC BY-SA 4.0
  - "SM City Baguio, Feb 2025.jpg", CC BY-SA 4.0
  - "SM City Baguio Roof, Feb 2025.jpg", CC BY-SA 4.0
  - "SM City Baguio Roof deck 7.jpg", CC0
  - "Façade SM City Baguio.jpg", CC BY 4.0
  - "Sunset Terraces - SM City Baguio 3.jpg", CC0

  They show:
  - pale sage-green tiled cladding;
  - dark-grey curved bands round a glazed corner at the entrance;
  - a white sign panel with the blue SM circle and "CITY BAGUIO";
  - white tensile-membrane tents with peaked caps on steel columns over the roof terrace;
  - roof lawns and planters;
  - a covered walkway with railings and shopfronts on the Sunset Terraces.
- [S4] The owner's aerial photos (supplied 2026-10-06 in chat; not stored in the repo). They show:
  - **Walls:** bright lime-green panels.
  - **Terraces:** about five curved terraces stepping back down the long west side. Each has a white canopy over its walkway, glazed shopfronts and a lime slab edge, on a grey parking podium with columns.
  - **Roof (the sky garden):**
    - a cluster of large white membrane tents and medium ones;
    - round lawn beds with trees;
    - white umbrellas.
  - **North end:** a white block whose roof carries a large SM logo in a blue oval, with blue plant on it.
  - **East:** a lime hall with a pale flat roof.
- [Assets] Kenney CC0 pines and bushes (`model/sources.json`). The sign is drawn by `model/scripts/sm_sign.py`.

## Estimates
Every height is an ESTIMATE (none is published), scaled from people and doors in S3 and S4. Confidence: medium.
- **Hill (the map's terrain, stretched ×1.35):** it falls from +2 m at the entrance drive to −31 m on the west side and −18 m on the north.
- **Levels:** entrance floor on the drive's ground (+0.3 m); three 4.5 m storeys to the roof.
- **Terraces (S1, S4):**
  - Five terrace floors, one storey apart below the roof. Each tier steps back 7 m on the downhill side only: the outline is intersected with itself shifted uphill, uphill direction (0.975, −0.22) from the relief (`landmark_osm.py insets ... dir= tol=1.0`).
  - Below the lowest terrace is the parking podium.
  - Bands go only along edges where a tier steps back, so the entrance face rises straight in lime.
  - Each terrace has a lime slab edge 0.9 m deep, a 0.9 m hedge, shopfronts 3.2 m tall, and a white canopy 3.3 m deep at 3.5 m.
- **Entrance (S3):**
  - glazed bay radius 9 m, with grey bands 10.6 m out at each floor;
  - canopy 22 × 9 m at 4 m;
  - sign 21 × 4.4 m under the roof edge.
- **Roof (S4):**
  - **North block:** the roof's last 48 m to the north, 9 m tall, white, with a 44 × 22 m logo and six blue units.
  - **East hall:** the roof east of its centre plus 14 m, 8 m tall, lime, with a pale roof.
  - **Sky garden:**
    - four 18 m tents (peaks at 15 m) in a cluster;
    - four 12 m tents;
    - twelve round lawn beds (radius 6.5 m), each with a 5 m tree;
    - white umbrellas;
    - a hedge inside the lime parapet.
- **Sky Ranch:**
  - The Baguio Eye's hub is 27.5 m up (S1: 45 m wheel, 50 m tall), with 24 gondolas. It stands along the lot's long side.
  - Drop tower 32 m. Carousel radius 7 m. Viking frame 12 m.
- **Pines:** a jittered 13 m grid, 6 to 30 m from the outline on the slopes, not on the entrance side.

## Review (2026-10-06)
Renders: `model/data/renders/landmarks/sm-city-baguio-{front,aerial,side}.png`, from the west. 15,738 triangles in the scene; packed 80.6 KB, geometry 55.7 KB (tier 1).
- **Owner feedback 1:** "SM must have green accents especially the sky garden". Hedges went onto every terrace edge and the parapet, plus round lawn beds with trees on the roof.
- **Owner feedback 2:** the aerial photos (S4). The model was reworked:
  - from pale sage to lime green;
  - from two terraces to five, with white canopies;
  - the parking podium added;
  - the north logo block and the east hall added;
  - the sky garden laid out as S4 shows.
- **Owner feedback 3:** the city massing collided with the model. The massing tiles were rebuilt with SM's exclusion ring.
- **First pass:** the bands, parapet and railings were solid prisms, and their tops capped the roof and terraces in dark grey. They are now open rings (`band()`).
- **Compared with S3:**
  - the green tiled walls, the dark bands and the glazed bay at the entrance;
  - the membrane tents along the roof terrace and the roof lawns;
  - the terraces stepping down toward Burnham Park;
  - the Baguio Eye beside the mall.
