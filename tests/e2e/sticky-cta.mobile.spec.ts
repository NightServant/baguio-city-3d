import { expect, test } from "@playwright/test";

test("after the first screen, a map button stays pinned to the bottom", async ({ page }) => {
  await page.goto("/destinations");
  const bar = page.getByTestId("sticky-cta");
  await expect(bar).not.toBeInViewport();
  await page.mouse.wheel(0, 1200);
  await expect(bar.getByRole("link", { name: "Open the 3D map" })).toBeInViewport();
  await bar.getByRole("link", { name: "Open the 3D map" }).click();
  await expect(page).toHaveURL("/map");
  await expect(page.getByTestId("sticky-cta")).toHaveCount(0);
});
