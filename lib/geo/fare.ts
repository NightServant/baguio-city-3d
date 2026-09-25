// Pure fare math. No I/O — route handlers pass in DB-sourced route fares.

/** Jeepney fare structure. Base covers the first `JEEPNEY_BASE_KM` km. */
export const JEEPNEY_BASE_KM = 4;

/** Taxi simulation constants (Baguio LTFRB-style estimate). */
export const TAXI_FLAGDOWN_PHP = 45;
export const TAXI_PER_METER_UNIT_M = 250; // charged per 250 m
export const TAXI_PER_UNIT_PHP = 3.5; // ₱3.50 per 250 m
export const TAXI_PER_MINUTE_WAIT_PHP = 2; // ₱2 per minute of waiting/traffic
/** Rough average speed used to estimate waiting/travel minutes from distance. */
export const TAXI_AVG_SPEED_KMH = 20;

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres between two [lng, lat] points. */
export function haversineKm(
  from: [number, number],
  to: [number, number],
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface FareBreakdown {
  [component: string]: number;
}

export interface FareResult {
  distanceKm: number;
  fare: number;
  breakdown: FareBreakdown;
}

/**
 * Jeepney fare: `fareBase` for the first 4 km, then `farePerKm` for each km
 * beyond. Fares come from the transit route row.
 */
export function jeepneyFare(
  distanceKm: number,
  fareBase: number,
  farePerKm: number,
): FareResult {
  const extraKm = Math.max(0, distanceKm - JEEPNEY_BASE_KM);
  const distanceCharge = round2(extraKm * farePerKm);
  const fare = round2(fareBase + distanceCharge);
  return {
    distanceKm: round2(distanceKm),
    fare,
    breakdown: {
      base: round2(fareBase),
      baseCoversKm: JEEPNEY_BASE_KM,
      extraKm: round2(extraKm),
      perKm: round2(farePerKm),
      distanceCharge,
    },
  };
}

/**
 * Taxi simulation: flagdown + per-250m distance charge + a waiting estimate
 * derived from an assumed average speed. Pure estimate — no metering data.
 */
export function taxiFare(distanceKm: number): FareResult {
  const meters = distanceKm * 1000;
  const distanceUnits = Math.ceil(meters / TAXI_PER_METER_UNIT_M);
  const distanceCharge = round2(distanceUnits * TAXI_PER_UNIT_PHP);
  const estMinutes = Math.round((distanceKm / TAXI_AVG_SPEED_KMH) * 60);
  const waitingCharge = round2(estMinutes * TAXI_PER_MINUTE_WAIT_PHP);
  const fare = round2(TAXI_FLAGDOWN_PHP + distanceCharge + waitingCharge);
  return {
    distanceKm: round2(distanceKm),
    fare,
    breakdown: {
      flagdown: TAXI_FLAGDOWN_PHP,
      distanceUnits,
      perUnit: TAXI_PER_UNIT_PHP,
      distanceCharge,
      estMinutes,
      perMinute: TAXI_PER_MINUTE_WAIT_PHP,
      waitingCharge,
    },
  };
}

// Modern/electric jeepney fare (national LTFRB rate, not per-route — the DB's
// per-route fareBase/farePerKm columns hold the traditional rate only).
// Source: FARE_SOURCE.modern, the LTFRB Non-Aircon Modern and Electric PUJ
// General Fare Guide the owner supplied (2026-09-24).
export const MODERN_JEEPNEY_BASE_PHP = 17.0;
export const MODERN_JEEPNEY_PER_KM_PHP = 2.0;
export const MODERN_JEEPNEY_DISCOUNTED_BASE_PHP = 13.6; // student/elderly/PWD, 20% off
export const MODERN_JEEPNEY_DISCOUNTED_PER_KM_PHP = 1.6;
const MODERN_JEEPNEY_ROUNDING_PHP = 0.25; // the guide: "rounded off to the nearest 25 centavos"

function roundToQuarterPeso(n: number): number {
  return Math.round(n / MODERN_JEEPNEY_ROUNDING_PHP) * MODERN_JEEPNEY_ROUNDING_PHP;
}

/**
 * Modern/electric jeepney fare per the LTFRB guide: `MODERN_JEEPNEY_BASE_PHP`
 * for the first `JEEPNEY_BASE_KM` km, then `MODERN_JEEPNEY_PER_KM_PHP` per km
 * (or the `discounted` student/elderly/PWD rate), the whole fare rounded to
 * the nearest 25 centavos as the guide states — rounding the total once
 * (not each component) is what reproduces the guide's own worked table
 * exactly, including its discounted-fare rounding (e.g. 13.60 -> 13.50).
 *
 * The guide's table is keyed by whole kilometres; it says nothing about how
 * part-kilometres are charged. Rounding the distance UP to the next whole km
 * before pricing it means every fare this function returns is a value that's
 * actually printed in the guide, and it never under-quotes a rider.
 */
export function modernJeepneyFare(distanceKm: number, discounted = false): FareResult {
  const base = discounted ? MODERN_JEEPNEY_DISCOUNTED_BASE_PHP : MODERN_JEEPNEY_BASE_PHP;
  const perKm = discounted ? MODERN_JEEPNEY_DISCOUNTED_PER_KM_PHP : MODERN_JEEPNEY_PER_KM_PHP;
  const wholeKm = Math.max(1, Math.ceil(distanceKm));
  const extraKm = Math.max(0, wholeKm - JEEPNEY_BASE_KM);
  const roundedBase = roundToQuarterPeso(base);
  const fare = roundToQuarterPeso(base + extraKm * perKm);
  return {
    distanceKm: round2(distanceKm),
    fare,
    breakdown: {
      base: roundedBase,
      distanceCharge: round2(fare - roundedBase),
    },
  };
}

/**
 * "30 June 2026" — day, then month name, then year, in UTC. FARE_SOURCE
 * stores plain ISO dates ("2026-06-30"), which `new Date(...)` parses as UTC
 * midnight; without pinning `timeZone: "UTC"` here, formatting that same
 * instant in a zone west of UTC (e.g. America/New_York) renders it as the
 * day before ("29 June 2026").
 */
export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Where the fare figures come from. Update the figures, the date/URLs and
 * `verified` together — `verified` stays false unless the figures were read
 * directly on an official LTFRB page (or, for `modern`, an official LTFRB
 * document) on `checkedOn` — a news report or a memory of an announced rate
 * doesn't count.
 *
 * `traditional` (the six routes' generic ₱13/₱1.80 DB rate): 2026-09-24
 * check — ltfrb.gov.ph (home, /fare-rates/, /car/, and the www. variant)
 * returned Cloudflare's "Performing security verification" 403 to automated
 * access on every attempt, so this figure could not be confirmed on an
 * official page. Kept as-is rather than adopting unverified numbers from
 * news coverage of a reported March 2026 fare order. See task-5-report.md
 * for the full research ledger.
 *
 * `modern`: verified 2026-09-24 against the LTFRB Non-Aircon Modern and
 * Electric PUJ General Fare Guide the owner supplied directly (PDF), which
 * states it is valid until 2026-06-30 and advises operators to secure an
 * individual fare matrix — so this is a time-boxed interim rate, not a
 * standing one. It has no `url`: the guessed ltfrb.gov.ph link 403'd during
 * research (see task-5-report.md) and isn't actually where this came from —
 * `source` records the real provenance instead of a page nobody fetched it
 * from.
 */
export const FARE_SOURCE = {
  checkedOn: "2026-09-24",
  traditional: {
    label: "LTFRB fare matrix",
    url: "https://ltfrb.gov.ph/fare-rates/",
    verified: false,
  },
  modern: {
    label: "LTFRB Non-Aircon Modern and Electric PUJ General Fare Guide",
    source: "PDF supplied directly by the site owner (no confirmed public LTFRB URL)",
    verified: true,
    effective: "2026-03-19",
    validUntil: "2026-06-30",
  },
  taxi: { label: "LTFRB taxi fares", url: "https://ltfrb.gov.ph/fare-rates/", verified: false },
} as const;

/** The subset of FARE_SOURCE's shape that fareAccuracyNote reads. */
interface FareVerificationSource {
  modern: { verified: boolean; label: string; effective: string; validUntil: string };
  traditional: { verified: boolean };
  taxi: { verified: boolean };
}

/** "a" -> "a"; "a", "b" -> "a and b"; "a", "b", "c" -> "a, b and c". */
function joinFareNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * One or two plain-text sentences summarising which fare figures are backed
 * by a verified LTFRB issuance, built from `source.*.verified` rather than
 * hardcoded, so the legal and about pages can't drift out of sync with the
 * data the way a copy-pasted sentence did (R-T16b). Takes `source` as a
 * parameter (defaulting to `FARE_SOURCE`) so a test can pin behaviour for
 * verification states other than today's without mutating the real
 * constant. If `modern.verified` is ever false, modern jeepney fares are
 * named among the unchecked ones instead of just disappearing (R-T16h).
 */
export function fareAccuracyNote(source: FareVerificationSource = FARE_SOURCE): string {
  const sentences: string[] = [];
  if (source.modern.verified) {
    sentences.push(
      `Modern jeepney fares follow the ${source.modern.label}, effective ` +
        `${formatLongDate(source.modern.effective)}, which was issued as valid until ` +
        `${formatLongDate(source.modern.validUntil)}.`,
    );
  }
  const unverified = [
    !source.modern.verified && "modern jeepney",
    !source.traditional.verified && "traditional jeepney",
    !source.taxi.verified && "taxi",
  ].filter((name): name is string => Boolean(name));
  if (unverified.length > 0) {
    const names = joinFareNames(unverified);
    sentences.push(
      `${names.charAt(0).toUpperCase()}${names.slice(1)} fares haven't been checked against a current LTFRB issuance.`,
    );
  }
  return sentences.join(" ");
}
