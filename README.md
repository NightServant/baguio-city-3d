# Baguio 3D

An interactive 3D map and field guide to Baguio City — the Summer Capital of the Philippines. Fly over pine-forest terrain rendered from real elevation data, trace jeepney routes from the City Plaza terminal, walk four eras of hill-station history on a timeline, and browse where to eat and stay, all pinned to one 3D map.

## Overview

Baguio sits a mile up in the Cordilleras, and flat maps don't do it justice. This project renders the city's actual terrain in the browser (MapLibre GL over AWS Terrarium elevation tiles), then layers the city's story on top: 22 destinations with elevations and coordinates, 6 jeepney lines with a fare calculator, a four-era history timeline from Ibaloi Kafagway to today's Creative City, and 30 restaurants, cafés, and lodges with hours and price ranges.

Geospatial data lives in PostgreSQL/PostGIS and is served through Next.js route handlers with Redis caching; the content pages are statically rendered from curated GeoJSON. No map API keys or paid accounts are required — tiles come from OpenFreeMap and terrain from the AWS Open Data Terrarium set.

## Features

- **3D terrain map** — real elevation, tilt and rotation controls, camera presets for Burnham Park, Session Road, Mines View, Camp John Hay, and Kennon Road, plus a satellite imagery toggle
- **Destinations layer** — viewport-driven markers with clustering, category and era filters, and a detail sheet with elevation readouts and deep links (`/map?dest=...`)
- **Jeepney transit** — 6 routes with stops drawn on the map, route highlighting, and a fare calculator using the ₱13 first-4-km flag-down rules (taxi estimates included)
- **History timeline** — four eras (Ibaloi pasture → American hill station → wartime → Creative City) with a scrubber that flies the camera to each event's location
- **Eat & stay directory** — carinderias to heritage hotels, with open-now badges, price-range glyphs, amenities, and map pins
- **Field-notes design system** — Fraunces display type, Geist Mono "survey readout" labels, an oklch pine-and-fog palette, and custom contour/treeline/fog atmosphere art
- **Finished-state UX** — skeleton loaders that mirror layout, composed empty and error states, keyboard navigation with visible focus rings, Escape-to-close panels, reduced-motion-aware camera and animations, skip-to-content link
- **Shareable** — branded Open Graph card, SVG favicon and apple icon generated from the pine mark

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) · React 19 · TypeScript 5 |
| Map engine | [MapLibre GL JS 5](https://maplibre.org) · [OpenFreeMap](https://openfreemap.org) vector tiles · AWS Terrarium terrain DEM |
| Styling | Tailwind CSS v4 · shadcn/ui on Base UI · tw-animate-css |
| Database | PostgreSQL 16 + [PostGIS](https://postgis.net) 3.4 · Prisma 7 (`@prisma/adapter-pg`, raw SQL for spatial queries) |
| Cache | Redis 7 via ioredis |
| Geospatial | Turf.js · curated GeoJSON in `data/geojson` |
| State | zustand |
| Fonts | Fraunces · Inter · Geist Mono (via `next/font`) |

## Local setup

**Prerequisites:** Node.js 20+, Docker Desktop (for PostGIS and Redis), npm.

```bash
# 1. Clone and install
git clone https://github.com/<your-username>/baguio-city-3d.git
cd baguio-city-3d
npm install

# 2. Environment — defaults match docker-compose.yml, no API keys needed
cp .env.example .env

# 3. Start PostGIS + Redis
docker compose up -d

# 4. Create the schema and seed destinations, routes, venues, and history
npx prisma migrate dev
npx prisma db seed

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the 3D map lives at [/map](http://localhost:3000/map).

> **Note:** the content pages render without the database, but the map's data layers (`/api/geo/*`, `/api/venues`) return 500s if Docker isn't running. If markers or routes fail to load, check `docker compose ps` first.

### Useful commands

```bash
npm run build      # production build
npm run lint       # eslint
npx prisma studio  # inspect the database
```

## Data notes

Destination, route, venue, and history content is curated for this project from public sources; fares reflect the LTFRB flag-down rates at the time of writing. Terrain © Mapzen/Tilezen via AWS Open Data; basemap © OpenMapTiles/OpenStreetMap contributors.
