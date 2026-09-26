// Task 24b: the jeepney routes must follow the street network, not a sparse
// hand-drawn sketch that cuts across blocks (and Burnham Park). This test
// reads the committed GeoJSON directly (not the DB) so it catches a
// regression even when Postgres/Docker is down.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SERVICE_AREA } from "@/lib/constants";

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

const EARTH_RADIUS_M = 6371000;

function haversineM(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

function pathLengthM(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

describe("jeepney routes follow the roads", () => {
  it("has six routes to check", () => {
    expect(fc.features.length).toBe(6);
  });

  it.each(fc.features)(
    "$properties.code follows the street network between its stops",
    (f) => {
      const coords = f.geometry.coordinates;
      const stops = f.properties.stops;

      // A hand-drawn sketch has 15-17 vertices; a road-following line has far
      // more (OSRM's `overview=full` returns a vertex roughly every few
      // metres of turn).
      expect(coords.length).toBeGreaterThanOrEqual(40);

      // The line starts at the first stop.
      expect(haversineM(coords[0], stops[0].coord)).toBeLessThanOrEqual(30);

      // The line passes within 30 m of the last stop somewhere along its
      // length. Usually that's the final vertex, but one route (PLZ-SES) is
      // a named loop whose line keeps going past its last stop, back to the
      // terminal it started at — so the closest point on the whole line is
      // used rather than assuming the last stop is where the line ends.
      const lastStop = stops[stops.length - 1].coord;
      let lastStopIdx = 0;
      let lastStopDist = Infinity;
      coords.forEach((c, i) => {
        const d = haversineM(c, lastStop);
        if (d < lastStopDist) {
          lastStopDist = d;
          lastStopIdx = i;
        }
      });
      expect(lastStopDist).toBeLessThanOrEqual(30);

      // The road path (measured up to the last stop, not past it) is longer
      // than the straight stop-to-stop distance (it follows real streets)
      // but not wildly so (it's still recognizably the same route, not a
      // detour across town). PLZ-SES gets a slightly taller ceiling: it's a
      // named downtown loop through one-way streets (Session Road runs
      // one-way uphill), so its real driving distance is verifiably ~3x
      // straight-line even with no avoidable detour left in it (checked by
      // hand against OSRM: dropping any more of its waypoints doesn't
      // shorten the route at all, confirming the distance is the genuine
      // one-way-mandated path, not a snapping artifact).
      const roadLength = pathLengthM(coords.slice(0, lastStopIdx + 1));
      let straightStopSum = 0;
      for (let i = 1; i < stops.length; i++) {
        straightStopSum += haversineM(stops[i - 1].coord, stops[i].coord);
      }
      const ratioCeiling = f.properties.code === "PLZ-SES" ? 3.2 : 3.0;
      expect(roadLength).toBeGreaterThanOrEqual(straightStopSum * 1.0);
      expect(roadLength).toBeLessThanOrEqual(straightStopSum * ratioCeiling);

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
