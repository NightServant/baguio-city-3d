import { expect, test } from "@playwright/test";

test("the map's mode buttons sit in a row, clear of the open panel", async ({ page }) => {
  await page.goto("/map");
  const names = ["Explore", "Jeepneys", "Through time"];
  await page.getByRole("button", { name: "Explore" }).click();
  const panel = page.locator("div", { has: page.getByRole("heading", { name: "Explore Baguio" }) }).last();
  const p = (await panel.boundingBox())!;
  const ys = new Set<number>();
  for (const name of names) {
    const b = (await page.getByRole("button", { name }).boundingBox())!;
    ys.add(Math.round(b.y));
    // Every button stays reachable: none of it lies under the panel.
    expect(b.y + b.height <= p.y || b.x >= p.x + p.width).toBe(true);
  }
  expect(ys.size).toBe(1);
});
