import { expect, test } from "@playwright/test";

test("the 3D runtime and a landmark visit stay within budget", async ({ page }) => {
  const js = new Map<string, number>();
  const models = new Map<string, number>();
  page.on("response", async (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(page.url() || "http://localhost").origin) return;
    const body = await r.body().catch(() => null);
    if (!body) return;
    if (url.pathname.endsWith(".js") && /THREE\.WebGLRenderer:|THREE\.GLTFLoader:|MeshoptDecoder/.test(body.toString("latin1"))) js.set(url.pathname, body.length); // three's own chunks (its warning strings), not the map's mentions
    if (url.pathname.startsWith("/models/")) models.set(url.pathname, body.length);
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => [...models.keys()].some((p) => p.includes("baguio-cathedral.")), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(5_000);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`3D runtime chunks: ${[...js.keys()].join(", ")} = ${sum(js)} bytes; models ${models.size} files = ${sum(models)} bytes`);
  // C6: the runtime is <= 180 KiB gzip. Measured 2026-10-06 (named imports, lib/map/threeKit.ts): 669,642 bytes decoded =
  // 167,202 gzip -9, a ratio of 4.0, so 180 KiB gzip is about 180 KiB x 4.0 decoded.
  expect(sum(js), "3D runtime, decoded bytes (x4.0 of gzip)").toBeLessThanOrEqual(180 * 1024 * 4.0);
  // C6 session: 10 MiB (the owner raised it from 6 MiB on 2026-10-08, performance budgets unchanged). Measured then on this
  // visit: 8.6 to 9.4 MB decoded (massing 4.3, roads 2.7 with their index, landmarks 2.0, flora and textures 0.4).
  expect(sum(models), "session bytes for this visit").toBeLessThanOrEqual(10 * 1024 * 1024);
});
