// Lazy Redis singleton + cache-aside helper.
//
// Redis is an optional accelerator, never a hard dependency: if it is down or
// absent (e.g. Docker not running locally) every helper here must degrade to a
// direct fetcher call. We use `lazyConnect` so importing this module never
// opens a socket, and an `error` listener so a dropped/refused connection can
// never crash the process.
import Redis from "ioredis";

function createClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    lazyConnect: true,
    // Fail fast rather than queueing commands forever when Redis is unreachable.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // Back off, but cap so a permanently-down Redis stops hammering.
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });
  // Swallow connection errors — a down Redis must never take down a request.
  client.on("error", () => {
    /* intentionally ignored; callers fall through to the fetcher */
  });
  return client;
}

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis: Redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/** Stable cache key from a path and a params bag (sorted for determinism). */
export function cacheKey(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): string {
  const parts = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`);
  return parts.length ? `${path}?${parts.join("&")}` : path;
}

/**
 * Cache-aside read-through helper. Tries Redis first; on a miss or ANY Redis
 * error it runs `fetcher` and best-effort populates the cache. A Redis failure
 * is always swallowed so it can never fail the request.
 */
export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable — fall through to the fetcher.
  }

  const fresh = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  } catch {
    // Best-effort write; ignore failures.
  }

  return fresh;
}
