import { expect, test } from "@playwright/test";

test("the main CTA is above the fold on a phone", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("main").getByRole("link", { name: "Open the 3D map" }).first();
  const box = await cta.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
