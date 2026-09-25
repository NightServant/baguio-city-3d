import { expect, test } from "@playwright/test";

test("unknown pages return 404 with their own title and a way back", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found | Baguio 3D");
  await expect(page.getByRole("link", { name: /^The 3D map/ })).toHaveAttribute("href", "/map");
});
