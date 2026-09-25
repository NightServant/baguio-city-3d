import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

test("every page has a unique title, a description and an absolute canonical URL", async ({ page }) => {
  const titles = new Map<string, string>();
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
    expect(title, path).not.toBe("");
    expect(titles.get(title), `${path} repeats the title of ${titles.get(title)}`).toBeUndefined();
    titles.set(title, path);
    expect(description.length, `${path} description`).toBeGreaterThanOrEqual(50);
    expect(description.length, `${path} description`).toBeLessThanOrEqual(160);
    expect(canonical, `${path} canonical`).toMatch(/^https?:\/\//);
  }
});
