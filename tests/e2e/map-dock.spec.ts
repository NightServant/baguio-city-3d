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

// The top of the map holds the mode dock (left) and the preset chips. Under xl the two did not fit one row and the
// dock lay over the first chips; nothing at the top may overlap, with or without a panel or a destination open.
type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
const PRESETS = ["Burnham", "Session Rd", "Mines View", "Camp John Hay", "Kennon Rd"];

for (const [width, height] of [[640, 800], [768, 1024], [1024, 768], [1280, 800]]) {
  test(`the dock, the preset chips and an open panel or destination stay apart at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/map?dest=burnham-park");
    const sheet = page.locator('[aria-label="Destination details"]');
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(400);
    const chips = await Promise.all(PRESETS.map(async (name) => (await page.getByRole("button", { name, exact: true }).boundingBox())!));
    const s = (await sheet.boundingBox())!;
    for (const [i, c] of chips.entries()) {
      expect(c.x + c.width <= width, `${PRESETS[i]} on screen`).toBe(true);
      expect(apart(c, s), `${PRESETS[i]} vs destination`).toBe(true);
      for (const name of ["Explore", "Jeepneys", "Through time"]) {
        expect(apart(c, (await page.getByRole("button", { name }).boundingBox())!), `${PRESETS[i]} vs ${name}`).toBe(true);
      }
    }
    await page.getByRole("button", { name: "Explore" }).click();
    const panel = page.locator("div", { has: page.getByRole("heading", { name: "Explore Baguio" }) }).last();
    await expect(panel).toBeVisible();
    const p = (await panel.boundingBox())!;
    for (const [i, c] of chips.entries()) expect(apart(c, p), `${PRESETS[i]} vs panel`).toBe(true);
  });
}
