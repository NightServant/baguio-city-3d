import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// M5: the building massing at the map's default view stays within contract C6 (1 MiB, 500k triangles,
// 100 draw calls: one per tile) and throws nothing.
type Tile = { url: string; triangles: number };
const index = JSON.parse(readFileSync("public/models/buildings/index.json", "utf8")) as Record<"near" | "far", Tile[]>;
const triangles = new Map([...index.near, ...index.far].map((t) => [t.url, t.triangles] as const));

test("the default view loads its buildings within 1 MiB and 500k triangles, with no page errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const got = new Map<string, number>();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/models/buildings/") && path.endsWith(".glb")) got.set(path, (await r.body()).length);
  });
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/map");
  let last = -1;
  await expect.poll(() => { const n = got.size; const settled = n > 0 && n === last; last = n; return settled; }, { timeout: 120_000, intervals: [5_000] }).toBe(true);
  const bytes = [...got.values()].reduce((a, b) => a + b, 0);
  const tris = [...got.keys()].reduce((a, u) => a + (triangles.get(u) ?? 0), 0);
  console.log(`default view: ${got.size} tiles, ${bytes} bytes, ${tris} triangles`);
  expect(bytes).toBeLessThanOrEqual(1024 * 1024);
  expect(tris).toBeLessThanOrEqual(500_000);
  expect(got.size, "draw calls (one per tile)").toBeLessThanOrEqual(100);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m5-default-view.png" });
});
