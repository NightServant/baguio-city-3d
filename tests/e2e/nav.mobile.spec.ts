import { expect, test } from "@playwright/test";

test("the mobile menu opens and lists the primary pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile" });
  await expect(menu.getByRole("link", { name: "Destinations" })).toBeVisible();
});
