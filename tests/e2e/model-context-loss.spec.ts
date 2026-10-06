import { expect, test } from "@playwright/test";

test("the 3D layer survives a WebGL context loss and restore without refetching", async ({ page }) => {
  const errors: string[] = [];
  const glb: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (/baguio-cathedral\.[0-9a-f]{8}\.glb$/.test(r.url())) glb.push(r.url()); });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => glb.length, { timeout: 30_000 }).toBe(1);
  await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement;
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext;
    const ext = gl.getExtension("WEBGL_lose_context")!;
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 1_000));
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 3_000));
  });
  expect(glb.length, "the model is reused, not refetched").toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m8-after-context-restore.png" });
});
