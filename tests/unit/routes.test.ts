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
  detectStopUturns,
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
//
// Pinned by location (R-24b4), not by a blanket per-route count: any OTHER
// backtrack on PLZ-MVP still fails this test. An episode counts as "the
// Pacdal one" only if it starts within PACDAL_MAX_START_DIST_M of the
// Pacdal Rotunda stop itself and its path gap is at most
// PACDAL_MAX_PATH_GAP_M.
const PACDAL_ROUTE = "PLZ-MVP";
const PACDAL_STOP_NAME = "Pacdal Rotunda";
const PACDAL_MAX_START_DIST_M = 20; // observed 14.6 m
const PACDAL_MAX_PATH_GAP_M = 460; // observed 459.6 m

// Stop-tip U-turn pins: [route code, stop name, max spur length in metres].
// A route/stop pair not listed here must have zero stop-tip U-turns of 50 m or
// more (detectStopUturns' own flag threshold), and every pin below must match
// a U-turn that is really detected (a pin cannot outlive its U-turn).
//
// R-24b5 ("move stops onto the main road"): scripts/snap-routes.mjs
// (moveStopsToTrunk) routes each still-flagged stop's stretch without the
// stop, projects the stop's raw sketch coordinate onto that trunk stretch, and
// re-routes, verifying the result. Moves are capped at 400 m; six stops moved
// and are no longer pinned. Km 4 (PLZ-LTR) would have had to move 690.5 m; the
// owner had it removed instead (2026-09-29), so no exceptions remain.
const PINNED_STOP_UTURNS: { code: string; stopName: string; maxM: number }[] = [];

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
      // detectBacktracks itself never flags an episode bounded by a
      // mandatory stop as a bug to fix (see its reachesNewStop guard) — so
      // anything it still returns here is, by construction, exactly that
      // "a mandatory stop forces a detour" case. The only one pinned is
      // Pacdal Rotunda, and only by location (below); anything else fails.
      const backtracks = detectBacktracks(coords, stopGeomIdx);
      const unexplainedBacktracks = backtracks.filter((bt) => {
        if (f.properties.code !== PACDAL_ROUTE) return true;
        const pacdal = stops.find((s) => s.name === PACDAL_STOP_NAME);
        if (!pacdal) return true;
        const nearPacdal = haversineM(coords[bt.i], pacdal.coord) <= PACDAL_MAX_START_DIST_M;
        return !(nearPacdal && bt.pathGapM <= PACDAL_MAX_PATH_GAP_M);
      });
      expect(unexplainedBacktracks.length).toBe(0);

      // No stop-tip U-turn: the line running up to a mid-route stop and
      // straight back the way it came (round 2's defect — detectBacktracks
      // above doesn't catch this shape at all, on purpose, since it treats
      // reaching a mandatory stop as progress). Checked separately, per
      // route/stop, against the explicit pin list.
      const stopUturns = detectStopUturns(coords, stopGeomIdx);
      for (const u of stopUturns) {
        const stopName = stops[u.stopIdx].name;
        const pin = PINNED_STOP_UTURNS.find(
          (p) => p.code === f.properties.code && p.stopName === stopName,
        );
        expect(
          pin,
          `${f.properties.code} ${stopName}: unpinned stop-tip U-turn of ${Math.round(u.spurM)} m`,
        ).toBeTruthy();
        expect(u.spurM).toBeLessThanOrEqual(pin!.maxM);
      }
      // No stale pins: every pin for this route matches a detected U-turn.
      for (const pin of PINNED_STOP_UTURNS.filter((x) => x.code === f.properties.code)) {
        expect(
          stopUturns.some((u) => stops[u.stopIdx].name === pin.stopName),
          `${pin.code} ${pin.stopName}: pinned but no longer U-turns; remove the pin`,
        ).toBe(true);
      }

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
