# good-shepherd-convent

## Scope
The Good Shepherd Convent's Mountain Maid Training Center:
- the white two-storey building with green trim, low green roofs and its name band;
- the green-and-white shop canopies along its front;
- the flowering vertical garden wall;
- the white statue of the Good Shepherd on its pedestal;
- the view deck over the city;
- trees on the hillside.

The convent's other buildings are left to the building massing.

OSM: `way/109351450` ("Mountain Maid Training Center"), 683 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.625, 16.4205) is about 220 m away. The registry's `osm_center` is OSM `node/1252077236`, "Good Shepherd Convent View Deck". Moving the pin is the owner's call.

## Sources
- [S1] Wikipedia, "Fidelis Atienza", and Inquirer, "Sharing the mission of Good Shepherd", via web search on 2026-10-05:
  - https://en.wikipedia.org/wiki/Fidelis_Atienza
  - https://newsinfo.inquirer.net/2015608/sharing-the-mission-of-good-shepherd

  What they say: the Religious of the Good Shepherd run the convent, set up in Baguio in 1952. Their Mountain Maid Training Center made strawberry jam, then from 1976 the ube jam that Sister Fidelis Atienza developed. No dimensions are given.
- [S2] OpenStreetMap, Overpass 2026-10-05:
  - `way/109351450`: a stepped plan along bearing 140.3°, 34.5 × 23.8 m.
  - The view deck node, about 34 m south of the building.
  - On the map's terrain the ground falls about 6 m along the building and 4 m across it.
- [S3] Photos:
  - owner-collected references `ref1` (the Training Center's front) and `ref3` (the view deck's outlook), in `model/data/refs/good-shepherd-convent/`;
  - [Good Shepherd Baguio City](https://commons.wikimedia.org/wiki/File:Good_Shepherd_Baguio_City.JPG) (CC BY-SA 4.0, Irvin Parco Sto. Tomas);
  - [Good Shepherd statue Baguio City](https://commons.wikimedia.org/wiki/File:Good_Shepherd_statue_Baguio_City.JPG) (CC BY-SA 4.0, Irvin Parco Sto. Tomas);
  - [Good Shepherd, Shepherd's Garden](https://commons.wikimedia.org/wiki/File:Good_Shepherd,_Shepherd%27s_Garden.jpg) (CC BY-SA 4.0, LeBarryBritish).

  What they show: a white two-storey front with green trim and a "MOUNTAIN MAID TRAINING CENTER" band; green-and-white shop canopies; a planted vertical wall with pink flowers; a white robed statue with a crook on a white pedestal; a view over the city's roofs to the mountains.
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 20 m and `tree_default` at 11 m.

## Estimates
Every height is an ESTIMATE, scaled from S3. Confidence: medium (±25%).
- **Building:**
  - two 3.4 m storeys above the shop front's level (map terrain, contract C2);
  - the uphill back is cut into the slope, and the downhill end shows a lower level;
  - roofs are 12° hips;
  - the facade texture has a 2.4 × 1.4 m window per 3.4 m bay and a green floor band.
- **Canopies:** three, 5.6 × 3.3 m, with a 2.7 m eave.
- **Garden wall:** 12 m long and 5 m high, with 24 blooms.
- **Statue:** a 1.1 m pedestal and a 2.2 m figure with a 2.4 m crook.
- **View deck:** 8 × 5 m, with a 1 m rail on the two outer sides.

## Review (2026-10-05)
Render: `model/data/renders/landmarks/good-shepherd-convent-m6.png`, on the map's terrain.
- Triangles: 1,748 in the scene, 930 in the exported file.
- Packed: 14.7 KB.

The first pass put the floor on the highest ground, which floated the canopies a storey up on the downhill front. The floor is now keyed to the shop front.
