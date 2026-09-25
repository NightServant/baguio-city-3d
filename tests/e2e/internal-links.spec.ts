import { expect, test } from "@playwright/test";

test("a destination links to nearby places and its jeepney", async ({ page }) => {
  await page.goto("/destinations/burnham-park");
  const nearby = page.locator("section", { has: page.getByRole("heading", { name: "Nearby places" }) });
  await expect(nearby.locator('a[href^="/destinations/"]')).toHaveCount(3);
  await expect(page.locator('a[href^="/map?route="]')).toHaveCount(1);
});
