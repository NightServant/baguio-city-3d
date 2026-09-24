import { expect, test } from "@playwright/test";

test("the transit page says where fares come from and when they were checked", async ({ page }) => {
  await page.goto("/transit");
  // "checked" if the figures were confirmed on an official LTFRB page,
  // "follow" (the LTFRB structure, unconfirmed) otherwise — see FARE_SOURCE.
  await expect(page.getByText(/Fares (checked|follow)/)).toBeVisible();
  await expect(page.getByText(/Route lines are approximate/)).toBeVisible();
});

for (const width of [360, 375, 414]) {
  test(`a route name never overlaps its fare readout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/transit", { waitUntil: "domcontentloaded" });
    const overlap = await page.evaluate(() =>
      Array.from(document.querySelectorAll("article")).some((card) => {
        const name = card.querySelector("h2")?.getBoundingClientRect();
        const fare = card.querySelector("span.readout")?.getBoundingClientRect();
        if (!name || !fare) return false;
        return !(
          name.right <= fare.left ||
          fare.right <= name.left ||
          name.bottom <= fare.top ||
          fare.bottom <= name.top
        );
      }),
    );
    expect(overlap).toBe(false);
  });
}
