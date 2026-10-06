import { expect, test } from "@playwright/test";

test("nothing 3D is requested before the map's first idle (or the 10 s fallback, contract C5)", async ({ page }) => {
  // On a fast link idle comes well inside 10 s; if this flakes on a slow one, the fallback fired first.
  const early: string[] = [];
  page.on("request", async (r) => {
    const path = new URL(r.url()).pathname;
    const idle = await page.locator("[data-map-idle='true']").count().catch(() => 0);
    if (idle) return;
    if (path.startsWith("/models/")) early.push(path);
  });
  page.on("response", async (r) => {
    const path = new URL(r.url()).pathname;
    if (!path.endsWith(".js")) return;
    const idle = await page.locator("[data-map-idle='true']").count().catch(() => 0);
    const body = await r.body().catch(() => null);
    if (!idle && body && /class WebGLRenderer\b|class GLTFLoader\b|WebGLRenderer\(\w+ ?= ?\{\}\)/.test(body.toString("latin1"))) early.push(path); // three's own code, not a mention of it
  });
  await page.goto("/map");
  await expect(page.locator("[data-map-idle='true']")).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(3_000);
  expect(early).toEqual([]);
});
