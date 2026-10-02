import { expect, test } from "@playwright/test";

test("the cathedral's model loads with its sheet and survives a basemap swap", async ({ page }) => {
  // Models load only after the map's first idle (contract C5); on a slow link idle took 55 s (2026-10-02).
  test.setTimeout(180_000);
  const errors: string[] = [];
  const glb: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/models\/landmarks\/baguio-cathedral\.[0-9a-f]{8}\.glb$/.test(r.url())) glb.push(r.url());
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => glb.length, { timeout: 120_000 }).toBeGreaterThan(0);
  const satellite = page.getByRole("button", { name: "Toggle satellite imagery" });
  await satellite.click();
  await page.waitForTimeout(2_000);
  await satellite.click();
  await page.waitForTimeout(2_000);
  expect(glb.length, "the model is fetched once per session").toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m3-cathedral.png" });
});
