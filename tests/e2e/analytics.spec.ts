import { expect, test } from "@playwright/test";

// Vercel Web Analytics (owner, 2026-10-20) replaced Google Analytics: it is cookieless, so there is no consent
// banner, no Google tag and no cookie. The script only sends page views from a Vercel deployment.
test("analytics is Vercel's cookieless script: no banner, no Google tag, no cookies", async ({ page, context }) => {
  const google: string[] = [];
  page.on("request", (r) => /googletagmanager|google-analytics/.test(r.url()) && google.push(r.url()));
  await page.goto("/");
  await expect(page.locator('script[data-sdkn^="@vercel/analytics"]')).toHaveCount(1);
  await page.waitForTimeout(1000);
  expect(google).toEqual([]);
  await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cookie settings" })).toHaveCount(0);
  expect(await context.cookies()).toEqual([]);
});

test("the privacy page says what Vercel Web Analytics records", async ({ page }) => {
  await page.goto("/privacy");
  const section = page.locator("h2#analytics + p");
  await expect(section).toContainText("Vercel Web Analytics");
  await expect(section).toContainText("no cookies");
  await expect(page.getByText(/Google Analytics/)).toHaveCount(0);
});
