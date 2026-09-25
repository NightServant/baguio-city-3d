// Captures two stills of the running app's map for the homepage.
// Usage: npm run dev (or start), then: node scripts/capture-map-posters.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Hide everything but the map canvas: HUD panels, header, attribution. The
// homepage prints the attribution under each image instead.
const MAP_ONLY =
  "body * { visibility: hidden !important; } .maplibregl-map, .maplibregl-canvas-container, .maplibregl-canvas { visibility: visible !important; }";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

async function capture(path, preset) {
  await page.goto(`${BASE}/map`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  if (preset) {
    await page.getByRole("button", { name: preset }).click();
    await page.waitForTimeout(9000);
  }
  await page.addStyleTag({ content: MAP_ONLY });
  await page.locator(".maplibregl-map").screenshot({ path, type: "jpeg", quality: 40 });
}

await capture("public/home/hero-map.jpg", "Burnham");
await capture("public/home/demo-map.jpg", null);
await browser.close();
