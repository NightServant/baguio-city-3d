# teachers-camp

## Scope
The Teachers Camp Athletic Oval:
- the stadium-shaped track with white lane edges;
- the grass infield, draped over the map's terrain;
- pines ringing it on the camp's slopes.

The camp's historic halls stand 150 to 230 m from the oval (Albert, Roxas, Romulo, Magsaysay, White and C. M. Recto Halls, OSM). A footprint taking them in would sweep up everything between them, so they are left to the building massing.

OSM: `way/3495210` ("Teachers Camp Athletic Oval", `leisure=track`), 15,387 m². Exclusion ring = that outline grown by 5 m.

Location: the destination pin (120.6155, 16.4125) is about 770 m from the oval. The registry's `osm_center` is the OSM way. Moving the pin is the owner's call.

## Sources
- [S1] National Historical Commission marker "Baguio Teachers' Camp" (Filipino), photographed as [File:Baguio Teacher's Camp - NHCP Marker.jpg](https://commons.wikimedia.org/wiki/File:Baguio_Teacher%27s_Camp_-_NHCP_Marker.jpg) (CC0, Bap Flores), read 2026-10-05:
  - founded at Governor William F. Pack's proposal for American and Filipino teachers, on 11 December 1907;
  - opened as a training and vacation camp on 6 April 1908;
  - its first buildings went up in 1911;
  - used by the Philippine Military Academy from 1936 to 1941, and as a Japanese hospital from 1942 to 1945;
  - reopened in 1947.
- [S2] OpenStreetMap, Overpass 2026-10-05: `way/3495210`, a stadium shape 174.2 × 99.3 m along bearing 25.9°.
- [S3] Wikimedia Commons photos, read 2026-10-05:
  - [Baguio Teachers Camp – NHCP](https://commons.wikimedia.org/wiki/File:Baguio_Teachers_Camp_-_NHCP.jpg) (public domain, NHCP): white buildings with green roofs above terraced gardens and pines;
  - [Teacher's Camp](https://commons.wikimedia.org/wiki/File:Teacher%27s_Camp.JPG) (CC BY-SA 4.0, Nissip): the stone gate wall, "TEACHERS CAMP 1908".
- [Assets] Kenney Nature Kit (CC0), via `model/scripts/fetch_assets.py`: `tree_pineTallC_detailed` at 24 m and `tree_pineTallA_detailed` at 20 m.

## Estimates
- **Track:** 7 m wide, about six 1.2 m lanes, with 0.15 m white edges. The red-brown surface is an ESTIMATE; S3 doesn't show the track.
- **Draping:** the track and infield follow the map's terrain 0.15 m above it (contract C2). The draped mesh has a point every 6 m on the straights and rings every 6 m across the infield. A first pass with bare 75 m straights let the ground show through.
- **Pines:** about every 21 m on a ring 10 m outside the track.

## Review (2026-10-05)
Render: `model/data/renders/landmarks/teachers-camp-m6.png`, on the map's terrain.
- Triangles: 8,040 in the scene, 4,296 in the exported file.
- Packed: 31.1 KB.

Simplified: the gate's stone wall (its position isn't mapped), the halls (left to the massing), and any stands round the oval (not shown in S3).
