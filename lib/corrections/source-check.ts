// Re-fetches the page a model cites and checks its quote word for word, so a confident model can't change the guide on
// a page that doesn't say it. SSRF-guarded (Clover's advice): https only; the host's address is checked and the
// connection goes to that address (no DNS-rebinding window); every redirect is re-checked; bytes and time are capped.
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import https from "node:https";
import { isIP } from "node:net";

const PRIVATE = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^::1?$/, /^f[cd]/i, /^fe80:/i, /^::ffff:/i];
const MAX_BYTES = 2_000_000, TIMEOUT_MS = 10_000, MAX_HOPS = 3;

export function isPublicAddress(ip: string): boolean {
  return isIP(ip) !== 0 && !PRIVATE.some((r) => r.test(ip));
}

function guardedLookup(host: string, opts: LookupOptions,
  cb: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(host, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err, []);
    const ok = addresses.filter((a) => isPublicAddress(a.address));
    if (!ok.length) return cb(Object.assign(new Error(`${host}: no public address`), { code: "EBLOCKED" }), []);
    if (opts.all) cb(null, ok);
    else cb(null, ok[0].address, ok[0].family);
  });
}

function getOnce(url: URL): Promise<{ status: number; location?: string; body?: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { lookup: guardedLookup, headers: { "user-agent": "baguio-city-3d/1.0" }, timeout: TIMEOUT_MS }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location: res.headers.location }); }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_BYTES) { res.destroy(); resolve({ status, body: Buffer.concat(chunks).toString("utf8") }); return; }
        chunks.push(c);
      });
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export async function fetchSourceText(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (u.protocol !== "https:") return null;
    const literal = u.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !isPublicAddress(literal)) return null;   // an IP literal skips the lookup, so check it here
    const r = await getOnce(u).catch(() => null);
    if (!r) return null;
    if (r.location) {
      try { u = new URL(r.location, u); } catch { return null; }
      continue;                                                    // the next hop is checked from the top
    }
    if (r.status !== 200 || r.body === undefined) return null;
    return r.body.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&");
  }
  return null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export function quoteFound(page: string, quote: string): boolean {
  return norm(quote).length >= 20 && norm(page).includes(norm(quote));
}
