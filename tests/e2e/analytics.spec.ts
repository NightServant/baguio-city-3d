import { expect, test } from "@playwright/test";

// These specs are about the first-visit choice, so they start with none recorded
// (every other spec starts with "No thanks" already stored, see playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  // Never send test traffic to Google: count requests, answer them empty.
  await page.route("**/*googletagmanager.com/**", (route) => route.fulfill({ status: 200, body: "" }));
});

test("Google Analytics loads only after the visitor allows it", async ({ page }) => {
  const ga: string[] = [];
  page.on("request", (r) => r.url().includes("googletagmanager.com") && ga.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Analytics choice" })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(ga).toEqual([]);
  await page.getByRole("button", { name: "Allow analytics" }).click();
  await expect.poll(() => ga.length).toBeGreaterThan(0);
});

test("No thanks keeps analytics off after a reload", async ({ page }) => {
  const ga: string[] = [];
  page.on("request", (r) => r.url().includes("googletagmanager.com") && ga.push(r.url()));
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(ga).toEqual([]);
});

test("Cookie settings in the footer reopens the choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.locator("footer").getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("region", { name: "Analytics choice" })).toBeVisible();
});
