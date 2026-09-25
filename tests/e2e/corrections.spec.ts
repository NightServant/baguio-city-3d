import { expect, test } from "@playwright/test";

test("a too-short report shows an error and keeps the text", async ({ page }) => {
  await page.goto("/corrections?page=/destinations/burnham-park");
  await expect(page.getByLabel("Which page?")).toHaveValue("/destinations/burnham-park");
  await page.waitForTimeout(3200); // past the minimum fill time
  await page.getByLabel("What's wrong?").fill("closed");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Tell us what's wrong in at least 10 characters.")).toBeVisible();
  await expect(page.getByLabel("What's wrong?")).toHaveValue("closed");
});

test("a valid report lands on the thank-you page", async ({ page }) => {
  test.skip(!process.env.E2E_DB, "needs a reachable database: set E2E_DB=1");
  await page.goto("/corrections");
  await page.waitForTimeout(3200);
  await page.getByLabel("What's wrong?").fill("E2E check: please delete this row.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page).toHaveURL("/corrections/thanks");
  await expect(page.getByRole("heading", { name: "Thanks, your report is in." })).toBeVisible();
});
