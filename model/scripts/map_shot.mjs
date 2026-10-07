// Review helper: a screenshot of the running map at a camera, after its tiles and 3D models load (software WebGL).
// Run (dev server up): node model/scripts/map_shot.mjs <out.png> <lng> <lat> <zoom> <pitch> <bearing> [width] [height] [theme]
// Env: BASE (default http://localhost:3000), WAIT (ms after idle, default 12000). Prints page errors and, in dev, the
// flora layer's counts.
import { chromium } from "playwright";

const [out, lng, lat, zoom, pitch, bearing, w = "1280", h = "800", theme = "light"] = process.argv.slice(2);
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(`${base}/map`, { timeout: 120_000 });
await page.waitForSelector('[data-map-idle="true"]', { timeout: 120_000 });
await page.evaluate(([lng, lat, zoom, pitch, bearing]) => {
  // the MapLibre instance, from the React fiber of the map's container
  const el = document.querySelector(".maplibregl-map");
  let f = el[Object.keys(el).find((k) => k.startsWith("__reactFiber"))], map = null;
  const seen = new Set();
  const scan = (v, d = 0) => {
    if (!v || typeof v !== "object" || seen.has(v) || d > 4) return null;
    seen.add(v);
    if (typeof v.jumpTo === "function" && typeof v.getStyle === "function") return v;
    for (const k of Object.keys(v)) { const r = scan(v[k], d + 1); if (r) return r; }
    return null;
  };
  for (let i = 0; f && !map && i < 60; i++, f = f.return) map = scan(f.memoizedState) || scan(f.memoizedProps);
  window.__map = map;
  map.jumpTo({ center: [lng, lat], zoom, pitch, bearing });
}, [+lng, +lat, +zoom, +pitch, +bearing]);
await page.waitForFunction(() => window.__map.loaded() && window.__map.areTilesLoaded(), null, { timeout: 120_000 }).catch(() => {});
await page.waitForTimeout(+(process.env.WAIT ?? 12000));
await page.waitForFunction(() => window.__map.areTilesLoaded(), null, { timeout: 60_000 }).catch(() => {});
await page.screenshot({ path: out, timeout: 120_000 });
console.log(JSON.stringify({ errors: errors.slice(0, 5), flora: await page.evaluate(() => window.__floraInfo ?? null), render: await page.evaluate(() => window.__renderInfo ?? null) }));
await browser.close();
