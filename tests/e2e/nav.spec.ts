import { expect, test } from "@playwright/test";

test("the logo goes home", async ({ page }) => {
  await page.goto("/destinations");
  await page.getByRole("link", { name: "Baguio 3D home" }).click();
  await expect(page).toHaveURL("/");
});
