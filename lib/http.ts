// Shared response helpers for API route handlers.
import { NextResponse } from "next/server";

/** CDN cache header: fresh for `ttl`, servable-while-revalidating for 2×ttl. */
export function cacheHeaders(ttl: number): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  };
}

/** 200 JSON response carrying the CDN cache header. */
export function jsonWithCache<T>(data: T, ttl: number): NextResponse {
  return NextResponse.json(data, { headers: cacheHeaders(ttl) });
}

/** Terse 4xx/5xx JSON error. */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
