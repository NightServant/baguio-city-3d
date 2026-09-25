import { expect, test } from "@playwright/test";

test("the theme toggle switches to dark, remembers it, and switches back", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  // The test browser reports a light system setting.
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bg()).toBe("rgb(15, 23, 38)");

  // Set before first paint on the next load, not after hydration.
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await bg()).toBe("rgb(15, 23, 38)");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("a dark system setting is followed until the visitor chooses", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await context.close();
});
