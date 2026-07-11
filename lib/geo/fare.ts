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
