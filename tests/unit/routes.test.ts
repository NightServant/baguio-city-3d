// Task 24b: the jeepney routes must follow the street network, pass through
// every one of their own stops in order, and never double back on
// themselves. This test reads the committed GeoJSON directly (not the DB) so
// it catches a regression even when Postgres/Docker is down, and reuses the
// script's own geometry helpers (haversineM, detectBacktracks,
// waypointGeomIndices) so "no backtrack" here means the exact same rule
// scripts/snap-routes.mjs used to produce the file, not a second,
// independently-drifting copy of it.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SERVICE_AREA } from "@/lib/constants";
import {
  haversineM,
  pathLengthM,
  detectBacktracks,
  waypointGeomIndices,
} from "../../scripts/snap-routes.mjs";

interface Stop {
  name: string;
  seq: number;
  coord: [number, number];
}

interface RouteFeature {
  geometry: { type: string; coordinates: [number, number][] };
  properties: { code: string; name: string; stops: Stop[] };
}

const fc = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "data/geojson/jeepney-routes.geojson"),
    "utf8",
  ),
) as { features: RouteFeature[] };

// PLZ-SES ("Cathedral Loop") is the one route whose line closes back at its
// starting terminal after its last named stop, rather than ending there —
// true to the sketch, which draws it as a loop. Two things follow: the
// line's own end anchors to the FIRST stop, not the last; and the straight
// stop-to-stop reference distance for the length-ratio check needs the
// closing stop-to-start segment added, to compare against the same closed
// shape the road length measures (fix round 1: without this, an already-
// optimal loop reads as a worse ratio than it is, purely from comparing a
// 5-segment road distance against a 4-segment straight one).
const LOOP_ROUTES = new Set(["PLZ-SES"]);

// A backtrack the script's own detector still finds after snapping can only
// be one bounded between two directly-adjacent mandatory stops (its
// "reaches no new stop in between" rule guarantees that — see
// detectBacktracks in scripts/snap-routes.mjs), i.e. exactly the "a
// mandatory stop forces a detour" case the script reports rather than
// routes around. PLZ-MVP has one: reaching Pacdal Rotunda (a real traffic
// circle) costs a genuine ~460 m loop. Verified by hand that no available
// shape point removes it (dropping every optional waypoint near it changes
// the route by 0-49 m, not 460) — see task-24b-report.md, fix round 1.
const KNOWN_MANDATORY_DETOURS: Record<string, number> = { "PLZ-MVP": 1 };

describe("jeepney routes follow the roads", () => {
  it("has six routes to check", () => {
    expect(fc.features.length).toBe(6);
  });

  it.each(fc.features)(
    "$properties.code follows the street network through every stop, in order, without doubling back",
    (f) => {
      const coords = f.geometry.coordinates;
      const stops = f.properties.stops;
      const isLoop = LOOP_ROUTES.has(f.properties.code);

      // A hand-drawn sketch has 15-17 vertices; a road-following line has far
      // more (OSRM's `overview=full` returns a vertex roughly every few
      // metres of turn).
      expect(coords.length).toBeGreaterThanOrEqual(40);

      // The line starts at the first stop, and ends at the last stop — or,
      // for the one loop route, back at the first (its terminal).
      expect(haversineM(coords[0], stops[0].coord)).toBeLessThanOrEqual(30);
      const endAnchor = isLoop ? stops[0].coord : stops[stops.length - 1].coord;
      expect(haversineM(coords[coords.length - 1], endAnchor)).toBeLessThanOrEqual(30);

      // Every stop actually lies on the line (within 30 m), and the stops
      // are encountered in seq order as you walk the line — not just the
      // first and last. waypointGeomIndices searches forward only (the same
      // assumption the snapping script makes), so a later stop can never
      // match a point the search already walked past.
      const stopGeomIdx = waypointGeomIndices(coords, stops.map((s) => s.coord));
      for (let k = 0; k < stops.length; k++) {
        const distToLine = haversineM(coords[stopGeomIdx[k]], stops[k].coord);
        expect(distToLine).toBeLessThanOrEqual(30);
        if (k > 0) expect(stopGeomIdx[k]).toBeGreaterThan(stopGeomIdx[k - 1]);
      }

      // The road path is longer than the straight stop-to-stop distance (it
      // follows real streets) but not wildly so (it's still recognizably the
      // same route, not a detour across town).
      const roadLength = pathLengthM(coords);
      let straightStopSum = 0;
      for (let i = 1; i < stops.length; i++) {
        straightStopSum += haversineM(stops[i - 1].coord, stops[i].coord);
      }
      if (isLoop) {
        straightStopSum += haversineM(stops[stops.length - 1].coord, stops[0].coord);
      }
      expect(roadLength).toBeGreaterThanOrEqual(straightStopSum * 1.0);
      expect(roadLength).toBeLessThanOrEqual(straightStopSum * 3.0);

      // No U-turn / out-and-back anywhere on the line: the same rule the
      // snapping script enforces while building it (scripts/snap-routes.mjs
      // detectBacktracks), re-run here against the committed output. Stops
      // are this check's "mandatory" positions — reaching one is genuine
      // progress, not a wasted side trip, exactly as the script treats them.
      const backtracks = detectBacktracks(coords, stopGeomIdx);
      expect(backtracks.length).toBe(KNOWN_MANDATORY_DETOURS[f.properties.code] ?? 0);

      // Every stop has a name and a finite coordinate inside the service area.
      for (const s of stops) {
        expect(s.name.length).toBeGreaterThan(0);
        const [lng, lat] = s.coord;
        expect(Number.isFinite(lng)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        expect(lng).toBeGreaterThanOrEqual(SERVICE_AREA[0]);
        expect(lng).toBeLessThanOrEqual(SERVICE_AREA[2]);
        expect(lat).toBeGreaterThanOrEqual(SERVICE_AREA[1]);
        expect(lat).toBeLessThanOrEqual(SERVICE_AREA[3]);
      }
    },
  );
});
