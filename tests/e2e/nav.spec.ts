import { expect, test } from "@playwright/test";

test("the logo goes home", async ({ page }) => {
  await page.goto("/destinations");
  await page.getByRole("link", { name: "Baguio 3D home" }).click();
  await expect(page).toHaveURL("/");
});

test("the desktop nav has three page links and one call to action", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText(["Destinations", "Jeepneys", "Eat & stay", "Open the 3D map"]);
});

test("the header is solid, not frosted glass", async ({ page }) => {
  await page.goto("/");
  const blur = await page.locator("header").first().evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(blur === "none" || blur === "").toBe(true);
});
