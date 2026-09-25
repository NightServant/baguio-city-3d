import { expect, test } from "@playwright/test";

test("the footer carries legal and contact links, not a page list", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  for (const [name, href] of [
    ["Privacy policy", "/privacy"],
    ["Terms of use", "/terms"],
    ["Data sources", "/about#sources"],
    ["Suggest a correction", "/corrections"],
  ]) {
    await expect(footer.getByRole("link", { name })).toHaveAttribute("href", href);
  }
  await expect(footer.getByRole("link", { name: "hello@example.test" })).toHaveAttribute("href", "mailto:hello@example.test");
  await expect(footer.getByRole("link", { name: "Destinations" })).toHaveCount(0);
});
