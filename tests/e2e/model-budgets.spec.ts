import { expect, test } from "@playwright/test";

test("the 3D runtime and a landmark visit stay within budget", async ({ page }) => {
  const js = new Map<string, number>();
  const models = new Map<string, number>();
  page.on("response", async (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(page.url() || "http://localhost").origin) return;
    const body = await r.body().catch(() => null);
    if (!body) return;
    if (url.pathname.endsWith(".js") && /WebGLRenderer|GLTFLoader|MeshoptDecoder/.test(body.toString("latin1"))) js.set(url.pathname, body.length);
    if (url.pathname.startsWith("/models/")) models.set(url.pathname, body.length);
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => [...models.keys()].some((p) => p.includes("baguio-cathedral.")), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(5_000);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`3D runtime chunks: ${[...js.keys()].join(", ")} = ${sum(js)} bytes; models ${models.size} files = ${sum(models)} bytes`);
  expect(sum(js), "3D runtime, uncompressed bytes as received").toBeLessThanOrEqual(180 * 1024 * 4); // see Step 2
  expect(sum(models), "session bytes for this visit").toBeLessThanOrEqual(6 * 1024 * 1024);
});
