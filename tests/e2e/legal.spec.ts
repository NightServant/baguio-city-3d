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

test("hostnames in the privacy policy render in the body font, not mono", async ({ page }) => {
  await page.goto("/privacy");
  const fontFamily = await page
    .getByText("tiles.openfreemap.org")
    .evaluate((el) => getComputedStyle(el).fontFamily);
  const lower = fontFamily.toLowerCase();
  expect(lower).not.toContain("geist mono");
  expect(lower).not.toContain("geist-mono");
  expect(lower).not.toContain("geist");
});
