import { expect, test } from "@playwright/test";

test("without WebGL, /map shows a still and links to the text pages", async ({ page }) => {
  // Every WebGL context request fails, as on a blocklisted GPU or with hardware acceleration off.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof getContext;
  });
  await page.goto("/map");

  await expect(page.getByRole("heading", { name: "Your browser can't show the 3D map" })).toBeVisible();
  for (const name of ["Destinations", "Jeepney routes and fares", "Places to eat and stay", "History"]) {
    await expect(page.getByRole("main").getByRole("link", { name })).toBeVisible();
  }
  // The HUD drives a map that isn't there, so it stays out.
  await expect(page.getByRole("button", { name: "Explore" })).toHaveCount(0);
  await expect(page.getByText("The trail washed out")).toHaveCount(0);
});
