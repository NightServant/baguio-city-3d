import { expect, test } from "@playwright/test";

test("the hero says what the site is and shows the real map", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Baguio City, mapped in 3D.");
  await expect(page.locator('img[src*="hero-map"]')).toBeVisible();
  await expect(page.getByText(/Free, no account\./)).toBeVisible();
});

test("proof is sources and measurements, not testimonials", async ({ page }) => {
  await page.goto("/");
  const proof = page.locator("section", { has: page.getByRole("heading", { name: "What the map is made of" }) });
  await expect(proof.getByRole("link", { name: /OpenStreetMap contributors/ })).toBeVisible();
  await expect(proof.getByText("120,751")).toBeVisible();
});
