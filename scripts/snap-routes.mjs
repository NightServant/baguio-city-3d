// Snaps data/geojson/jeepney-routes.geojson to the road network.
//
// Task 24b (owner bug): the six routes were hand-drawn LineStrings of 15-17
// vertices, straight between them, so they cut across blocks (and Burnham
// Park). Each route's existing vertices already encode which roads it takes,
// so they're used as ordered waypoints for the public OSRM demo
// (router.project-osrm.org), which fills in the road-following path between
// them. Stops are snapped independently via OSRM `nearest`.
//
// One-off dev script — never called at runtime. Re-runnable: run it again
// after editing the route sketches and it re-snaps from scratch. Polite to
// the demo server: descriptive User-Agent, >=1s between requests, one
// /route request per route (plus a bounded retry only if a waypoint forces
// an out-and-back detour).
//
// Run: node scripts/snap-routes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const FILE = path.join(ROOT, "data", "geojson", "jeepney-routes.geojson");

const OSRM = "https://router.project-osrm.org";
const USER_AGENT =
  "baguio-city-3d-dev-script/1.0 (one-off route-snap tool for a hobby project; " +
  "routes over OpenStreetMap data; polite: <=1 req/s)";
const MIN_INTERVAL_MS = 1000;
const SPUR_THRESHOLD_M = 150; // brief's "out-and-back spur longer than about 150 m"
const MAX_DROP_ROUNDS = 3;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres between two [lng, lat] points. */
function haversineM([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pathLengthM(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Quantize to 5 decimals, matching OSRM's own coordinate precision (~1.1 m). */
function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

// ---------------------------------------------------------------------------
// OSRM client (rate-limited to <=1 request/second)
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastCallAt = 0;
async function throttledFetchJson(url) {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status} for ${url}`);
  const body = await res.json();
  if (body.code !== "Ok") throw new Error(`OSRM responded ${body.code} for ${url}`);
  return body;
}

async function osrmRoute(waypoints) {
  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false`;
  const body = await throttledFetchJson(url);
  return body.routes[0];
}

async function osrmNearest([lng, lat]) {
  const url = `${OSRM}/nearest/v1/driving/${lng},${lat}`;
  const body = await throttledFetchJson(url);
  return body.waypoints[0];
}

// ---------------------------------------------------------------------------
// Route snapping, with detour-waypoint dropping
// ---------------------------------------------------------------------------

/**
 * Route a waypoint list through OSRM, dropping any interior waypoint whose
 * presence forces an out-and-back detour of more than SPUR_THRESHOLD_M, then
 * re-requesting. Repeats (bounded by MAX_DROP_ROUNDS) since dropping a
 * waypoint can reveal that its neighbour was also only needed to reach it.
 *
 * "Detour" is judged against this route's OWN typical road/straight-line
 * ratio, not a fixed multiple: Baguio's mountain roads legitimately switch
 * back a lot, so a fixed ratio (e.g. "road distance > 2x straight distance")
 * would flag most waypoints on every route. The baseline ratio is computed
 * ONCE, from the very first full request, and reused unchanged on every
 * round — recomputing it from an ever-shrinking waypoint set is unstable
 * (each drop lowers the median, which flags the next-worst waypoint,
 * cascading toward almost nothing left).
 */
async function snapRoute(code, waypointsIn) {
  let waypoints = waypointsIn.slice();
  let route = await osrmRoute(waypoints);
  const baselineRatio = median(
    route.legs.map((leg, k) => leg.distance / haversineM(waypoints[k], waypoints[k + 1])),
  );

  const dropped = [];
  for (let round = 0; round < MAX_DROP_ROUNDS; round++) {
    const legs = route.legs;
    const dropIndexes = [];
    for (let i = 1; i < waypoints.length - 1; i++) {
      const directIn = haversineM(waypoints[i - 1], waypoints[i]);
      const directOut = haversineM(waypoints[i], waypoints[i + 1]);
      const viaDetour = legs[i - 1].distance + legs[i].distance;
      const expected = baselineRatio * (directIn + directOut);
      const excess = viaDetour - expected;
      if (excess > SPUR_THRESHOLD_M) {
        dropIndexes.push(i);
        dropped.push({
          code,
          coord: waypoints[i],
          excessM: Math.round(excess),
          reason:
            `out-and-back detour: routing via this waypoint costs ${Math.round(viaDetour)} m, ` +
            `vs ${Math.round(expected)} m expected at this route's own typical ${baselineRatio.toFixed(1)}x ` +
            `road/straight ratio (+${Math.round(excess)} m > ${SPUR_THRESHOLD_M} m threshold)`,
        });
      }
    }

    if (dropIndexes.length === 0) break;
    const dropSet = new Set(dropIndexes);
    waypoints = waypoints.filter((_, i) => !dropSet.has(i));
    route = await osrmRoute(waypoints);
  }

  return { route, waypoints, dropped };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fc = JSON.parse(readFileSync(FILE, "utf8"));
  const report = [];

  for (const f of fc.features) {
    const p = f.properties;
    const originalCoords = f.geometry.coordinates;
    const straightBeforeM = pathLengthM(originalCoords);

    const { route, waypoints, dropped } = await snapRoute(p.code, originalCoords);
    const snappedCoords = route.geometry.coordinates.map(([lng, lat]) => [
      round5(lng),
      round5(lat),
    ]);
    f.geometry.coordinates = snappedCoords;

    // Snap each stop independently via `nearest`. OSRM's own `distance` field
    // on the matched waypoint IS the move distance (input coord -> matched
    // road location), so it's used directly rather than recomputed.
    const stopMoves = [];
    let maxStopMoveM = 0;
    for (const s of p.stops) {
      const nearest = await osrmNearest(s.coord);
      const moveM = nearest.distance;
      stopMoves.push({ name: s.name, moveM });
      if (moveM > maxStopMoveM) maxStopMoveM = moveM;
      s.coord = [round5(nearest.location[0]), round5(nearest.location[1])];
    }

    report.push({
      code: p.code,
      waypointCountBefore: originalCoords.length,
      waypointCountAfter: waypoints.length,
      dropped,
      snappedVertexCount: snappedCoords.length,
      lengthBeforeKm: straightBeforeM / 1000,
      lengthAfterKm: route.distance / 1000,
      maxStopMoveM,
      stopMoves,
    });
  }

  // Serialize, then collapse each 2-number coordinate pair back onto one
  // line (JSON.stringify's own indenting would put every lng/lat on its own
  // line, which is correct JSON but blows up the diff and is unreadable for
  // a ~100-vertex line). Coordinate pairs are the only 2-number arrays in
  // this file, so the collapse is unambiguous.
  const pretty = JSON.stringify(fc, null, 2).replace(
    /\[\s*\n\s*(-?\d+(?:\.\d+)?),\s*\n\s*(-?\d+(?:\.\d+)?)\s*\n\s*\]/g,
    "[$1, $2]",
  );
  writeFileSync(FILE, pretty + "\n");

  for (const r of report) {
    console.log(`\n${r.code}`);
    console.log(
      `  waypoints: ${r.waypointCountBefore} -> ${r.waypointCountAfter}` +
        (r.dropped.length ? ` (${r.dropped.length} dropped)` : " (none dropped)"),
    );
    for (const d of r.dropped) {
      console.log(`    dropped [${d.coord}]: ${d.reason}`);
    }
    console.log(`  snapped vertex count: ${r.snappedVertexCount}`);
    console.log(
      `  length: ${r.lengthBeforeKm.toFixed(2)} km straight -> ${r.lengthAfterKm.toFixed(2)} km road`,
    );
    console.log(`  max stop move: ${r.maxStopMoveM.toFixed(1)} m`);
    for (const sm of r.stopMoves) {
      console.log(
        `    ${sm.name}: ${sm.moveM.toFixed(1)} m${sm.moveM > 60 ? "  <-- over 60 m" : ""}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("[snap-routes] failed:", e);
  process.exitCode = 1;
});
