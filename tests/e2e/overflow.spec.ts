import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

for (const width of [360, 375, 414]) {
  for (const path of PAGES) {
    test(`${path} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800); // let fonts and client layout settle
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }
}
