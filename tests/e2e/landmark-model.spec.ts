import { expect, test } from "@playwright/test";

test("the cathedral's model loads once with its sheet, on satellite imagery that never asks past z18", async ({ page }) => {
  // Models load only after the map's first idle (contract C5); on a slow link idle took 55 s (2026-10-02).
  test.setTimeout(180_000);
  const errors: string[] = [];
  const glb: string[] = [];
  const imagery: number[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/models\/landmarks\/baguio-cathedral\.[0-9a-f]{8}\.glb$/.test(r.url())) glb.push(r.url());
    const m = /World_Imagery\/MapServer\/tile\/(\d+)\//.exec(r.url());
    if (m) imagery.push(Number(m[1]));
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => glb.length, { timeout: 120_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(4_000);
  expect(glb.length, "the model is fetched once per session").toBe(1);
  expect(imagery.length, "the ground is Esri World Imagery").toBeGreaterThan(0);
  // Esri's z19 tiles over Baguio are all the "Map data not yet available" placeholder (lib/map/sources.ts IMAGERY_SOURCE)
  expect(Math.max(...imagery), "no imagery request past z18").toBeLessThanOrEqual(18);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m3-cathedral.png" });
});
