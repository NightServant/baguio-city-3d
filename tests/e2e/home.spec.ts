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

test("the wireframe loads only as the problem section nears, and every height is listed", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  expect(requests.some((u) => u.includes("baguio-heightmap.json"))).toBe(false);

  const heading = page.getByRole("heading", { name: "A flat map hides the hills." });
  await heading.scrollIntoViewIfNeeded();
  await expect.poll(() => requests.some((u) => u.includes("baguio-heightmap.json"))).toBe(true);
  const problem = page.locator("section", { has: heading });
  await expect(problem.locator("canvas")).toBeAttached();
  await expect(problem.locator("table.sr-only tbody tr")).toHaveCount(22);
});
