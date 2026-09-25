import { expect, test } from "@playwright/test";

test("a destination page carries breadcrumbs and TouristAttraction data", async ({ page }) => {
  await page.goto("/destinations/burnham-park");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Destinations" })).toHaveAttribute("href", "/destinations");
  await expect(crumbs.getByText("Burnham Park")).toHaveAttribute("aria-current", "page");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.map((b) => JSON.parse(b)["@type"]);
  expect(types).toEqual(expect.arrayContaining(["TouristAttraction", "BreadcrumbList"]));
});
