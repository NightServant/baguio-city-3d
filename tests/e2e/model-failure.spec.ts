import { expect, test } from "@playwright/test";

test("when every model request fails, the map and its panels still work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/models/**", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/map?dest=baguio-cathedral");
  await page.waitForTimeout(8_000);
  await page.getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: "Explore Baguio" })).toBeVisible();
  expect(errors).toEqual([]);
});
