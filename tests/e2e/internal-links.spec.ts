import { expect, test } from "@playwright/test";

test("a destination links to nearby places and its jeepney", async ({ page }) => {
  await page.goto("/destinations/burnham-park");
  const nearby = page.locator("section", { has: page.getByRole("heading", { name: "Nearby places" }) });
  await expect(nearby.locator('a[href^="/destinations/"]')).toHaveCount(3);
  await expect(page.locator('a[href^="/map?route="]')).toHaveCount(1);
});

test("a stop that shares a landmark's coordinates doesn't claim a 0 m distance", async ({ page }) => {
  await page.goto("/destinations/mines-view-park");
  const gettingHere = page.locator("section", { has: page.getByRole("heading", { name: "Getting here" }) });
  await expect(gettingHere).toBeVisible();
  await expect(gettingHere).not.toContainText("0 m");
});
