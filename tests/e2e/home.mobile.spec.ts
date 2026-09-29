import { expect, test } from "@playwright/test";

// The map button moved to the closing section (owner, 2026-09-29); the hero's
// one action, "See how it works", must still be reachable without scrolling.
test("the hero's action is above the fold on a phone", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("main").getByRole("link", { name: "See how it works" });
  const box = await cta.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("the wireframe fits its box on a retina phone", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "A flat map hides the hills." });
  await heading.scrollIntoViewIfNeeded();
  const problem = page.locator("section", { has: heading });
  const canvas = problem.locator("canvas");
  await expect(canvas).toBeAttached();
  // Let the heightmap fetch resolve and the renderer size itself.
  await page.waitForTimeout(500);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  const host = problem.locator("div.size-full");
  const canvasBox = await canvas.boundingBox();
  const hostBox = await host.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(hostBox).not.toBeNull();
  expect(canvasBox!.width).toBeLessThanOrEqual(hostBox!.width + 1);
  expect(canvasBox!.height).toBeLessThanOrEqual(hostBox!.height + 1);
});
