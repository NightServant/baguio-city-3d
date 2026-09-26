import { expect, test } from "@playwright/test";

test("the transit page shows both the traditional and modern jeepney fares", async ({ page }) => {
  await page.goto("/transit");
  await expect(page.getByText(/Traditional jeepney/)).toBeVisible();
  await expect(page.getByText(/Modern jeepney/)).toBeVisible();
  // The truth lines: traditional is unverified, and the modern guide's
  // stated validity window doesn't mean it's still in force.
  await expect(page.getByText(/not yet checked/)).toBeVisible();
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
