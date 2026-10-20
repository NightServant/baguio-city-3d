import { expect, test, type Locator } from "@playwright/test";

// The map's HUD on a phone: no control may sit under another.
type Box = { x: number; y: number; width: number; height: number };
const apart = (a: Box, b: Box) =>
  a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
const box = async (l: Locator) => (await l.boundingBox())!;
const DOCK = ["Explore", "Jeepneys", "Through time"];
const STACK = ["Zoom in", "Zoom out", "Reset tilt and rotation"];

test("the attribution stays clear of the mode dock, open or closed", async ({ page }) => {
  await page.goto("/map");
  const attrib = page.locator(".maplibregl-ctrl-attrib");
  await expect(attrib).toBeVisible();
  for (const open of [true, false]) {
    // MapLibre's compact attribution opens on load and closes on the first drag.
    await attrib.evaluate((el, o) => el.toggleAttribute("open", o), open);
    const a = await box(attrib);
    for (const name of DOCK) expect(apart(a, await box(page.getByRole("button", { name }))), `${name}, open ${open}`).toBe(true);
  }
});

test.describe("on a narrow phone", () => {
  // 360 px wide: the commonest budget Android width in the Philippines (ESTIMATE).
  test.use({ viewport: { width: 360, height: 800 } });

  test("every preset chip is whole and on screen", async ({ page }) => {
    await page.goto("/map");
    for (const name of ["Burnham", "Session Rd", "Mines View", "Camp John Hay", "Kennon Rd"]) {
      const chip = page.getByRole("button", { name, exact: true });
      const b = await box(chip);
      expect(b.x >= 0 && b.x + b.width <= 360, `${name} on screen`).toBe(true);
      expect(await chip.locator("..").evaluate((e) => e.scrollWidth <= e.clientWidth), `${name} not cut by a scrolling row`).toBe(true);
    }
  });
});

test.describe("on a short phone", () => {
  // About an iPhone SE's viewport in Safari with its toolbars showing (ESTIMATE).
  test.use({ viewport: { width: 375, height: 548 } });

  test("the zoom stack stays clear of an open destination and the preset chips", async ({ page }) => {
    await page.goto("/map?dest=burnham-park");
    const sheet = page.locator('[aria-label="Destination details"]');
    await expect(sheet).toBeVisible();
    const chips = page.getByRole("button", { name: "Burnham", exact: true }).locator("..");
    await page.waitForTimeout(400); // the stack's move is a 200 ms transition
    const s = await box(sheet), c = await box(chips);
    for (const name of STACK) {
      const b = await box(page.getByRole("button", { name }));
      expect(apart(b, s), `${name} vs sheet`).toBe(true);
      expect(apart(b, c), `${name} vs chips`).toBe(true);
    }
  });
});

// Fill rate on phones (owner, 2026-10-20: "optimize it for mobile"): the map and its 3D layer share one canvas, drawn at
// no more than 2 device pixels per CSS pixel. The Pixel 7 profile is 2.625; a Galaxy A51 is about 2.6.
test("the map draws at most 2 device pixels per CSS pixel", async ({ page }) => {
  await page.goto("/map");
  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();
  const ratio = await canvas.evaluate((c: HTMLCanvasElement) => c.width / c.clientWidth);
  expect(ratio).toBeLessThanOrEqual(2.01);
});
