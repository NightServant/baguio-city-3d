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

test("consent defaults are queued before the tag's config", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Allow analytics" }).click();
  await page.waitForFunction(() => Boolean(document.querySelector("script#_next-ga")));
  const order = await page.evaluate(() =>
    ((window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer ?? []).map((e) => Array.from(e).slice(0, 2).join(":")),
  );
  const consent = order.indexOf("consent:default");
  const config = order.findIndex((e) => e.startsWith("js:") || e.startsWith("config:"));
  expect(consent).toBeGreaterThanOrEqual(0);
  expect(config).toBeGreaterThan(consent);
});

test("withdrawing in one tab stops analytics in the other open tab", async ({ context }) => {
  const a = await context.newPage();
  await a.goto("/");
  await a.getByRole("button", { name: "Allow analytics" }).click();
  const b = await context.newPage();
  await b.goto("/");
  await b.waitForFunction(() => Boolean(document.querySelector("script#_next-ga")));
  await b.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

  const reloaded = b.waitForEvent("load");
  await a.locator("footer").getByRole("button", { name: "Cookie settings" }).click();
  await reloaded;

  await expect(b.getByRole("region", { name: "Analytics choice" })).toBeVisible();
  expect(await b.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBeUndefined();
  expect(await b.locator("script#_next-ga").count()).toBe(0);
});
