import { expect, test } from "@playwright/test";

test("the transit page says where fares come from and when they were checked", async ({ page }) => {
  await page.goto("/transit");
  // "checked" if the figures were confirmed on an official LTFRB page,
  // "follow" (the LTFRB structure, unconfirmed) otherwise — see FARE_SOURCE.
  await expect(page.getByText(/Fares (checked|follow)/)).toBeVisible();
  await expect(page.getByText(/Route lines are approximate/)).toBeVisible();
});
