import { expect, test } from "@playwright/test";

test("the transit page shows both the traditional and modern jeepney fares", async ({ page }) => {
  await page.goto("/transit");
  await expect(page.getByText(/Traditional jeepney/)).toBeVisible();
  await expect(page.getByText(/Modern jeepney/)).toBeVisible();
  await expect(page.getByText(/Route lines are approximate/)).toBeVisible();
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
