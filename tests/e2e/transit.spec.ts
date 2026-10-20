import { expect, test } from "@playwright/test";

test("the transit page shows both the traditional and modern jeepney fares", async ({ page }) => {
  await page.goto("/transit");
  // The truth lines: traditional cites the guide it was read from (the live database's rate, LTFRB PUJ General Fare
  // Guide effective 28 September 2026), and the modern guide's stated validity window doesn't mean it's still in force.
  await expect(
    page.getByText(/^Traditional jeepney: ₱14\.00 for the first 4 km, then ₱2\.00 per km, per the LTFRB PUJ General Fare Guide effective 28 September 2026\.$/),
  ).toBeVisible();
  await expect(page.getByText(/^Modern jeepney:/)).toBeVisible();
  await expect(page.getByText(/valid until 30 June 2026/)).toBeVisible();
  await expect(page.getByText(/Lines follow the roads between stops/)).toBeVisible();
});

for (const width of [360, 375, 414]) {
  test(`a route name's text never overflows its box at ${width}px`, async ({ page }) => {
    // A flex sibling's own layout box never intersects another sibling's box
    // (that's what flexbox guarantees), so comparing h2 vs. readout
    // getBoundingClientRect()s can't catch the real bug: rendered text
    // spilling past its own element's box and painting over the sibling.
    // scrollWidth > clientWidth on the element itself is what actually shows
    // the text is wider than the box that's supposed to contain it.
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/transit", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const overflowing = await page.evaluate(() =>
      Array.from(document.querySelectorAll("article h2")).some(
        (h2) => h2.scrollWidth > h2.clientWidth,
      ),
    );
    expect(overflowing).toBe(false);
  });
}
