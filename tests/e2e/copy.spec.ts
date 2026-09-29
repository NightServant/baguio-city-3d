import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

for (const path of PAGES) {
  test(`${path}: copy follows the house rules`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    expect(text, "em dash").not.toMatch(/—/);
    expect(text, "middot meta string").not.toMatch(/·/);
    expect(text, "arrow glyph").not.toMatch(/[→←]/);
  });

  test(`${path}: every image has alt text or is marked decorative`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const missing = await page.$$eval("img", (imgs) =>
      imgs.filter((i) => !i.hasAttribute("alt") && i.getAttribute("aria-hidden") !== "true").map((i) => i.src),
    );
    expect(missing).toEqual([]);
  });
}
