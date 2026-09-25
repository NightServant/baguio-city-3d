import { expect, test } from "@playwright/test";

test("the privacy policy names every service that sees a visitor's IP", async ({ page }) => {
  await page.goto("/privacy");
  for (const host of ["tiles.openfreemap.org", "s3.amazonaws.com", "server.arcgisonline.com"]) {
    await expect(page.getByText(host)).toBeVisible();
  }
  await expect(page.getByText(/Data Privacy Act of 2012/)).toBeVisible();
});

test("terms and about pages exist and credit the map data", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/OpenStreetMap contributors/).first()).toBeVisible();
  await page.goto("/about");
  await expect(page.locator("#sources")).toBeVisible();
});
