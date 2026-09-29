// Snaps data/geojson/jeepney-routes.sketch.geojson to the road network,
// writing data/geojson/jeepney-routes.geojson.
//
// Task 24b (owner bug), fix round 1. The six routes are hand-drawn sketches
// of 15-17 vertices, straight between them, so they cut across blocks (and
// Burnham Park). Each route's stops are snapped first via OSRM `nearest` and
// become MANDATORY waypoints — they are never dropped, so the drawn line
// always passes through every stop in order. The sketch's other vertices are
// OPTIONAL shape points, passed through to OSRM's `route` as ordering hints;
// at most one is dropped per round, and only when the route's own returned
// geometry shows it causes a real out-and-back (the path comes back close to
// somewhere it already was, well after leaving it — see detectBacktracks).
// If a detour turns out to be bounded only by mandatory stops (no optional
// point to blame), it is left alone and reported as a finding, not routed
// around silently.
//
// The sketch is a separate, untouched source file: this script never writes
// to it, so it's always safe to re-run from scratch.
//
// One-off dev script — never called at runtime. Polite to the OSRM demo:
// descriptive User-Agent, >=1s between requests.
//
// Run: node scripts/snap-routes.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const SKETCH_FILE = path.join(ROOT, "data", "geojson", "jeepney-routes.sketch.geojson");
const OUT_FILE = path.join(ROOT, "data", "geojson", "jeepney-routes.geojson");

const OSRM = "https://router.project-osrm.org";
const USER_AGENT =
  "baguio-city-3d-dev-script/1.0 (one-off route-snap tool for a hobby project; " +
  "routes over OpenStreetMap data; polite: <=1 req/s)";
const MIN_INTERVAL_MS = 1000;

// A sketch line is a hand-drawn guess of a few shape points, never a
// road-following path. Refusing anything denser than this catches the
// script accidentally being pointed at its own (already-snapped) output.
const MAX_SKETCH_VERTICES = 50;

// Backtrack/out-and-back detection, applied to the route's own returned
// geometry: flagged when the path comes back within BACKTRACK_STRAIGHT_M of
// a point it already passed more than BACKTRACK_PATH_GAP_M of path-distance
// earlier. The upper bound excludes a route's own legitimate start/end
// (PLZ-SES is a named loop that closes back at its terminal — that's by
// design, not a bug).
const BACKTRACK_STRAIGHT_M = 10;
const BACKTRACK_PATH_GAP_M = 150;
const BACKTRACK_MAX_FRACTION_OF_ROUTE = 0.9;

// Secondary "disproportionate detour" signal (excessCandidates): brief's
// "out-and-back spur longer than about 150 m", applied to how much more an
// optional waypoint's two legs cost than simply routing around it entirely.
const SPUR_THRESHOLD_M = 150;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversineM([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pathLengthM(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

/** Initial compass bearing in degrees from a to b. */
function bearingDeg([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest angle (0-180) between two bearings. */
function bearingDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Local direction of travel at geometry index i, looking a few points ahead. */
function localBearing(geometry, i, lookahead = 5) {
  const j = Math.min(geometry.length - 1, i + lookahead);
  if (j === i) return bearingDeg(geometry[Math.max(0, i - lookahead)], geometry[i]);
  return bearingDeg(geometry[i], geometry[j]);
}

export function cumulativeArc(coords) {
  const arc = [0];
  for (let i = 1; i < coords.length; i++) arc.push(arc[i - 1] + haversineM(coords[i - 1], coords[i]));
  return arc;
}

/** Quantize to 5 decimals, matching OSRM's own coordinate precision (~1.1 m). */
function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

function coordsEqual(a, b, eps = 1e-7) {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
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

async function osrmRoute(coords) {
  const path_ = coords.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `${OSRM}/route/v1/driving/${path_}?overview=full&geometries=geojson&continue_straight=false`;
  const body = await throttledFetchJson(url);
  return body.routes[0];
}

async function osrmNearest([lng, lat]) {
  const url = `${OSRM}/nearest/v1/driving/${lng},${lat}`;
  const body = await throttledFetchJson(url);
  return body.waypoints[0];
}

// ---------------------------------------------------------------------------
// Backtrack detection on the route's own returned geometry
// ---------------------------------------------------------------------------

/**
 * Finds stretches where the route comes back within BACKTRACK_STRAIGHT_M of
 * somewhere it already was, more than BACKTRACK_PATH_GAP_M of path-distance
 * earlier (and not simply the whole route's own start/end). Proximity alone
 * isn't enough signal on a geographically compact route (a tight downtown
 * loop can have many points within 10 m of each other just because it
 * covers a small area, all while still making steady forward progress) — a
 * real U-turn/out-and-back also travels in a near-opposite direction when
 * it comes back, so that's required too. Nor is proximity+reversal alone
 * enough on a route that's itself a loop: its outbound and return legs can
 * legitimately run close together in opposite directions along a dense
 * one-way grid without wasting any distance. So a candidate pair is only a
 * real backtrack if the route reaches no NEW mandatory stop strictly
 * between the two points — i.e. it's a side trip that goes nowhere the
 * route wasn't already required to go, not the shape of the loop itself.
 * `mandatoryGeomIndices` are the current route's mandatory-waypoint
 * positions in `geometry` (see waypointGeomIndices). Overlapping raw pairs
 * are merged into distinct episodes.
 */
export function detectBacktracks(geometry, mandatoryGeomIndices) {
  const arc = cumulativeArc(geometry);
  const total = arc[arc.length - 1];
  const maxGap = total * BACKTRACK_MAX_FRACTION_OF_ROUTE;
  const raw = [];

  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const gap = arc[j] - arc[i];
      if (gap <= BACKTRACK_PATH_GAP_M) continue;
      if (gap > maxGap) break; // arc is monotonic; nothing closer follows
      if (haversineM(geometry[i], geometry[j]) > BACKTRACK_STRAIGHT_M) continue;
      const reachesNewStop = mandatoryGeomIndices.some((idx) => idx > i && idx < j);
      if (reachesNewStop) continue;
      const reversed = bearingDiff(localBearing(geometry, i), localBearing(geometry, j)) > 120;
      if (reversed) {
        raw.push({ i, j, pathGapM: gap });
        break; // first (shortest) qualifying pair from this i is enough
      }
    }
  }

  // Merge overlapping [i, j] intervals into single episodes.
  raw.sort((a, b) => a.i - b.i);
  const episodes = [];
  for (const r of raw) {
    const last = episodes[episodes.length - 1];
    if (last && r.i <= last.j) {
      last.j = Math.max(last.j, r.j);
      last.pathGapM = Math.max(last.pathGapM, r.pathGapM);
    } else {
      episodes.push({ ...r });
    }
  }
  return episodes;
}

/**
 * Maps each waypoint to the index of its closest point on the route's
 * geometry, searching forward only (waypoints occur in order along it).
 */
export function waypointGeomIndices(geometry, waypointCoords) {
  const indices = [];
  let searchStart = 0;
  for (const wp of waypointCoords) {
    let best = searchStart;
    let bestD = Infinity;
    for (let k = searchStart; k < geometry.length; k++) {
      const d = haversineM(geometry[k], wp);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    indices.push(best);
    searchStart = best;
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Waypoint planning: mandatory stops (snapped) + optional shape points
// ---------------------------------------------------------------------------

/**
 * Snaps every stop via OSRM `nearest` (mandatory), then rebuilds the
 * sketch's vertex order with each stop's raw coordinate replaced by its
 * snapped one. Every other sketch vertex becomes an optional shape point.
 * Returns the plan plus the snapped stop coordinates/road names, so callers
 * don't need to re-snap stops separately.
 */
async function buildWaypointPlan(feature) {
  const p = feature.properties;
  const sketchCoords = feature.geometry.coordinates;

  const snappedStops = [];
  for (const s of p.stops) {
    const nearest = await osrmNearest(s.coord);
    snappedStops.push({
      seq: s.seq,
      name: s.name,
      rawCoord: s.coord,
      coord: [round5(nearest.location[0]), round5(nearest.location[1])],
      moveM: nearest.distance,
      roadName: nearest.name || null,
    });
  }

  const plan = sketchCoords.map((raw) => {
    const stop = snappedStops.find((s) => coordsEqual(s.rawCoord, raw));
    return stop ? { coord: stop.coord, mandatory: true, stop } : { coord: raw, mandatory: false };
  });

  return { plan, snappedStops };
}

// ---------------------------------------------------------------------------
// Route snapping: drop at most one optional waypoint per round, only when a
// detected backtrack points to it.
// ---------------------------------------------------------------------------

/**
 * How much extra road distance routing via this waypoint costs, versus the
 * straight-line distance if it were skipped entirely (previous waypoint
 * direct to next). Larger = worse waypoint to keep.
 */
function detourScore(active, legs, wi) {
  const viaCost = legs[wi - 1].distance + legs[wi].distance;
  const directSkip = haversineM(active[wi - 1].coord, active[wi + 1].coord);
  return viaCost - directSkip;
}

/**
 * A second, complementary signal to the backtrack detector: an optional
 * waypoint whose own two legs cost real, meaningful extra road distance
 * over just routing directly from the waypoint before it to the one after,
 * skipping it — even though the path never technically "comes back" near
 * itself (a long, one-way-mandated way around still counts as a bad shape
 * point, not just a literal U-turn). Unlike a straight-line estimate, this
 * asks OSRM directly what skipping the point would actually cost by road,
 * which is what catches a point that's individually unremarkable (its own
 * ratio isn't the route's worst) but is nonetheless pure waste — the rest
 * of the route needs no detour to route around it at all.
 */
async function excessCandidates(active, legs) {
  const out = [];
  for (let wi = 1; wi < active.length - 1; wi++) {
    if (active[wi].mandatory) continue;
    const viaCost = legs[wi - 1].distance + legs[wi].distance;
    const skip = await osrmRoute([active[wi - 1].coord, active[wi + 1].coord]);
    const excess = viaCost - skip.distance;
    if (excess > SPUR_THRESHOLD_M) out.push({ wi, score: excess });
  }
  return out;
}

async function snapRoute(code, planIn) {
  let active = planIn.slice();
  const droppedOptional = [];
  const mandatoryDetourFindings = [];
  const maxRounds = active.filter((w) => !w.mandatory).length + 1;

  for (let round = 0; round < maxRounds; round++) {
    const route = await osrmRoute(active.map((w) => w.coord));
    const geomIdx = waypointGeomIndices(route.geometry.coordinates, active.map((w) => w.coord));
    const mandatoryGeomIdx = geomIdx.filter((_, wi) => active[wi].mandatory);

    const backtracks = detectBacktracks(route.geometry.coordinates, mandatoryGeomIdx);

    // Signal 1: waypoints implicated in a detected backtrack episode.
    let worst = null; // { wi, score, why }
    const unresolved = [];
    for (const bt of backtracks) {
      // Bounding waypoints: last waypoint at/before bt.i, first waypoint at/after bt.j.
      let loW = 0;
      while (loW + 1 < geomIdx.length && geomIdx[loW + 1] <= bt.i) loW++;
      let hiW = geomIdx.length - 1;
      while (hiW - 1 >= 0 && geomIdx[hiW - 1] >= bt.j) hiW--;

      const candidates = [];
      for (let wi = loW; wi <= hiW; wi++) {
        if (active[wi] && !active[wi].mandatory) candidates.push(wi);
      }
      if (candidates.length === 0) {
        unresolved.push(bt);
        continue;
      }
      for (const wi of candidates) {
        const score = detourScore(active, route.legs, wi);
        if (!worst || score > worst.score) {
          worst = {
            wi,
            score,
            why:
              `out-and-back: this route's own geometry backtracks within ${BACKTRACK_STRAIGHT_M} m of an ` +
              `earlier point (>${BACKTRACK_PATH_GAP_M} m of path back)`,
          };
        }
      }
    }

    // Signal 2: waypoints that cost real extra road distance versus simply
    // routing around them, whether or not they show up as a literal
    // backtrack (a one-way-mandated long way around still needs fixing).
    for (const c of await excessCandidates(active, route.legs)) {
      if (!worst || c.score > worst.score) {
        worst = {
          wi: c.wi,
          score: c.score,
          why: `disproportionate detour: skipping this waypoint entirely would cost less by road`,
        };
      }
    }

    if (!worst) {
      for (const bt of unresolved) {
        mandatoryDetourFindings.push({
          code,
          pathGapM: Math.round(bt.pathGapM),
          nearCoord: route.geometry.coordinates[bt.i],
        });
      }
      return { route, active, droppedOptional, mandatoryDetourFindings };
    }

    droppedOptional.push({
      code,
      coord: active[worst.wi].coord,
      excessM: Math.round(worst.score),
      reason: `${worst.why} (detour cost +${Math.round(worst.score)} m > ${SPUR_THRESHOLD_M} m threshold)`,
    });
    active.splice(worst.wi, 1);
  }

  // Exhausted rounds (shouldn't happen: each round removes one optional
  // waypoint) — return whatever the last request produced.
  const route = await osrmRoute(active.map((w) => w.coord));
  return { route, active, droppedOptional, mandatoryDetourFindings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fc = JSON.parse(readFileSync(SKETCH_FILE, "utf8"));
  const report = [];

  for (const f of fc.features) {
    const p = f.properties;
    const sketchCoords = f.geometry.coordinates;
    if (sketchCoords.length > MAX_SKETCH_VERTICES) {
      throw new Error(
        `${p.code}: ${sketchCoords.length} vertices exceeds the ${MAX_SKETCH_VERTICES}-vertex sketch limit ` +
          `(this looks like an already-snapped file, not a hand-drawn sketch)`,
      );
    }
    const straightBeforeM = pathLengthM(sketchCoords);

    const { plan, snappedStops } = await buildWaypointPlan(f);
    const { route, active, droppedOptional, mandatoryDetourFindings } = await snapRoute(p.code, plan);

    const snappedCoords = route.geometry.coordinates.map(([lng, lat]) => [round5(lng), round5(lat)]);
    f.geometry.coordinates = snappedCoords;
    f.properties.stops = snappedStops.map((s) => ({ name: s.name, seq: s.seq, coord: s.coord }));

    // Max distance from any stop to the final line (closest-approach point).
    let maxStopToLineM = 0;
    const stopToLine = [];
    for (const s of snappedStops) {
      let best = Infinity;
      for (const c of snappedCoords) best = Math.min(best, haversineM(c, s.coord));
      stopToLine.push({ name: s.name, distM: best });
      if (best > maxStopToLineM) maxStopToLineM = best;
    }

    report.push({
      code: p.code,
      waypointCountBefore: sketchCoords.length,
      waypointCountAfter: active.length,
      droppedOptional,
      mandatoryDetourFindings,
      snappedVertexCount: snappedCoords.length,
      lengthBeforeKm: straightBeforeM / 1000,
      lengthAfterKm: route.distance / 1000,
      maxStopToLineM,
      stopToLine,
      stopMoves: snappedStops.map((s) => ({ name: s.name, moveM: s.moveM, roadName: s.roadName })),
    });
  }

  // Serialize, then collapse each 2-number coordinate pair back onto one
  // line (JSON.stringify's own indenting would put every lng/lat on its own
  // line, which is correct JSON but blows up the diff and is unreadable for
  // a ~100+-vertex line). Coordinate pairs are the only 2-number arrays in
  // this file, so the collapse is unambiguous.
  const pretty = JSON.stringify(fc, null, 2).replace(
    /\[\s*\n\s*(-?\d+(?:\.\d+)?),\s*\n\s*(-?\d+(?:\.\d+)?)\s*\n\s*\]/g,
    "[$1, $2]",
  );
  writeFileSync(OUT_FILE, pretty + "\n");

  for (const r of report) {
    console.log(`\n${r.code}`);
    console.log(
      `  waypoints: ${r.waypointCountBefore} -> ${r.waypointCountAfter}` +
        (r.droppedOptional.length ? ` (${r.droppedOptional.length} optional dropped)` : " (none dropped)"),
    );
    for (const d of r.droppedOptional) {
      console.log(`    dropped [${d.coord}]: ${d.reason}`);
    }
    for (const m of r.mandatoryDetourFindings) {
      console.log(
        `    FINDING: a mandatory stop forces a detour near [${m.nearCoord}] (path-gap ${m.pathGapM} m) — left as-is, not routed around`,
      );
    }
    console.log(`  snapped vertex count: ${r.snappedVertexCount}`);
    console.log(
      `  length: ${r.lengthBeforeKm.toFixed(2)} km straight -> ${r.lengthAfterKm.toFixed(2)} km road`,
    );
    console.log(`  max stop-to-line distance: ${r.maxStopToLineM.toFixed(1)} m`);
    for (const s of r.stopToLine) {
      console.log(`    ${s.name}: ${s.distM.toFixed(1)} m${s.distM > 30 ? "  <-- over 30 m" : ""}`);
    }
    console.log(`  stop moves (sketch -> snapped):`);
    for (const sm of r.stopMoves) {
      console.log(
        `    ${sm.name}: ${sm.moveM.toFixed(1)} m` +
          (sm.roadName ? ` (${sm.roadName})` : "") +
          (sm.moveM > 60 ? "  <-- over 60 m" : ""),
      );
    }
  }
}

// Only run when executed directly (`node scripts/snap-routes.mjs`), not when
// imported — tests/unit/routes.test.ts imports this module's exported
// geometry helpers (haversineM, detectBacktracks, etc.) to check the
// committed output against the exact same rule the script used to produce
// it, and must not trigger a live OSRM run / file rewrite just by doing so.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[snap-routes] failed:", e);
    process.exitCode = 1;
  });
}
