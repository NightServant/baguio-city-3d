// GET /api/geo/transit/fare?routeCode=&fromLng=&fromLat=&toLng=&toLat=&mode=
// Fare estimate between two points. jeepney uses DB route fares; taxi is a
// pure simulation. No caching — cheap pure math keyed on continuous coords.
import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { haversineKm, jeepneyFare, taxiFare } from "@/lib/geo/fare";
import { errorResponse } from "@/lib/http";
import type { FareResponse } from "@/types/api";

export const dynamic = "force-dynamic";

function num(sp: URLSearchParams, key: string): number | null {
  const raw = sp.get(key);
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = (sp.get("mode") ?? "jeepney").toLowerCase();
  if (mode !== "jeepney" && mode !== "taxi") {
    return errorResponse("mode must be jeepney or taxi", 400);
  }

  const fromLng = num(sp, "fromLng");
  const fromLat = num(sp, "fromLat");
  const toLng = num(sp, "toLng");
  const toLat = num(sp, "toLat");
  if (
    fromLng === null || fromLat === null || toLng === null || toLat === null ||
    Number.isNaN(fromLng) || Number.isNaN(fromLat) || Number.isNaN(toLng) || Number.isNaN(toLat)
  ) {
    return errorResponse("fromLng, fromLat, toLng, toLat are required numbers", 400);
  }

  const distanceKm = haversineKm([fromLng, fromLat], [toLng, toLat]);

  try {
    if (mode === "taxi") {
      const result = taxiFare(distanceKm);
      const body: FareResponse = {
        mode: "taxi",
        distanceKm: result.distanceKm,
        fare: result.fare,
        breakdown: result.breakdown,
      };
      return Response.json(body);
    }

    // jeepney
    const routeCode = sp.get("routeCode");
    if (!routeCode) {
      return errorResponse("routeCode is required for jeepney mode", 400);
    }

    const rows = await prisma.$queryRaw<Array<{ fareBase: number; farePerKm: number }>>(Prisma.sql`
      SELECT fare_base::float8 AS "fareBase", fare_per_km::float8 AS "farePerKm"
      FROM transit_routes
      WHERE code = ${routeCode}
      LIMIT 1
    `);
    const route = rows[0];
    if (!route) return errorResponse("route not found", 404);

    const result = jeepneyFare(distanceKm, Number(route.fareBase), Number(route.farePerKm));
    const body: FareResponse = {
      mode: "jeepney",
      distanceKm: result.distanceKm,
      fare: result.fare,
      breakdown: result.breakdown,
    };
    return Response.json(body);
  } catch {
    return errorResponse("failed to compute fare", 500);
  }
}
