import { expect, test } from "@playwright/test";

test("a too-short report shows an error and keeps the text", async ({ page }) => {
  await page.goto("/corrections?page=/destinations/burnham-park");
  await expect(page.getByLabel("Which page?")).toHaveValue("/destinations/burnham-park");
  await page.waitForTimeout(3200); // past the minimum fill time
  await page.getByLabel("What's wrong?").fill("closed");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Tell us what's wrong in at least 10 characters.")).toBeVisible();
  await expect(page.getByText("Add your email so we can tell you what happened to your report.")).toBeVisible();
  await expect(page.getByLabel("What's wrong?")).toHaveValue("closed");
});

test("a repeated page parameter doesn't crash the page", async ({ page }) => {
  const response = await page.goto("/corrections?page=/a&page=/b");
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel("Which page?")).toHaveValue("");
});

test("the thanks page names the real response window", async ({ page }) => {
  // Navigated to directly, not via a real report submission: that would
  // write to the live Supabase project, which is off-limits for a test. The
  // page itself reads no session or query state, so a direct GET is a cheap,
  // DB-free way to check its rendered text (R-T23d: the same JSX-whitespace
  // quirk as /terms was rendering "within 7days.").
  await page.goto("/corrections/thanks");
  await expect(page.getByText(/7 days\./)).toBeVisible();
});

test("a valid report lands on its private status page", async ({ page }) => {
  test.skip(!process.env.E2E_DB, "needs a reachable database: set E2E_DB=1");
  await page.goto("/corrections");
  await page.waitForTimeout(3200);
  await page.getByLabel("What's wrong?").fill("E2E check: please delete this row.");
  await page.getByLabel("Your email").fill("e2e@example.test");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page).toHaveURL(/\/corrections\/status\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Your report" })).toBeVisible();
});

test("an unknown or malformed status link is a 404", async ({ page }) => {
  // Reads only (correction_status by token), so it runs against the live database too.
  expect((await page.goto("/corrections/status/not-a-token"))?.status()).toBe(404);
  expect((await page.goto("/corrections/status/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
});
