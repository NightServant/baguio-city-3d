// Task 24b visual check (dev-only, not committed to app code paths).
// Screenshots the /map page against `next start -p 3100` to confirm the
// snapped PLZ-MVP jeepney line runs along Harrison/Session Road near Burnham
// Park, not through it, and to capture the whole route at a wider zoom.
//
// Run: node scripts/screenshot-routes.mjs   (server must already be running
// on :3100, e.g. `npx next start -p 3100`)
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3100";
const OUT_DIR = process.argv[2] ?? ".";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // --- Shot 1: whole route, wide zoom (via the UI, which fitBounds()s to it) ---
  await page.goto(`${BASE}/map`, { waitUntil: "load" });
  await page.waitForTimeout(8000);
  await page.getByRole("button", { name: /jeepneys/i }).click();
  await page.waitForTimeout(500);
  await page.getByText("Plaza - Mines View Park", { exact: true }).click();
  await page.waitForTimeout(8000); // fitBounds animation (1.5s) + tiles settling
  await page.screenshot({ path: `${OUT_DIR}/plz-mvp-full-route.png` });
  console.log("wrote plz-mvp-full-route.png");

  // Numeric evidence: fetch the exact GeoJSON TransitLayer is drawing (the
  // same endpoint the map calls, at the zoom tier used at close range) and
  // print a few of PLZ-MVP's vertices near Burnham for a by-hand sanity
  // check against Harrison/Session Road's real coordinates.
  const routesResp = await page.request.get(`${BASE}/api/geo/transit/routes?zoom=16`);
  const routesJson = await routesResp.json();
  const mvp = routesJson.features.find((f) => f.properties.code === "PLZ-MVP");
  const nearBurnham = mvp.geometry.coordinates.filter(
    ([lng, lat]) => lng > 120.593 && lng < 120.598 && lat > 16.409 && lat < 16.413,
  );
  console.log(`PLZ-MVP: ${mvp.geometry.coordinates.length} live vertices; ${nearBurnham.length} within the Burnham/Session/Harrison box:`);
  for (const c of nearBurnham) console.log("  ", c);

  // --- Shot 2: close on Burnham (Session/Harrison Road area) ---
  // Deep-link ?focus= flies the camera straight there; a fresh navigation
  // keeps this independent of shot 1's fitted view. All routes still draw
  // (TransitLayer always renders every line at reduced opacity), so PLZ-MVP's
  // segment through this area is visible even unselected.
  await page.goto(`${BASE}/map?focus=120.5936,16.4116`, { waitUntil: "load" });
  await page.waitForTimeout(8000); // initial load
  await page.waitForTimeout(8000); // flyTo (2s) + tiles settling, generous margin
  await page.screenshot({ path: `${OUT_DIR}/burnham-closeup.png` });
  console.log("wrote burnham-closeup.png");

  await browser.close();
}

main().catch((e) => {
  console.error("[screenshot-routes] failed:", e);
  process.exitCode = 1;
});
