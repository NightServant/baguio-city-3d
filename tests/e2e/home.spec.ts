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
  await expect(problem.locator("table tbody tr")).toHaveCount(22);
});

test("the carousel steers the live map", async ({ page }) => {
  await page.goto("/");
  const how = page.locator("#how-it-works");
  await how.scrollIntoViewIfNeeded();
  await expect(how.locator("canvas.maplibregl-canvas")).toBeAttached({ timeout: 20_000 });
  await how.getByRole("button", { name: "Next destination" }).click();
  await expect(how.locator("figure").getByRole("status")).toHaveText(/^Showing .+ on the map$/);
  for (const href of ["/map", "/transit", "/eat-stay", "/history"]) {
    await expect(how.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
});

test("carousel arrows sit below the slides, never over their text", async ({ page }) => {
  await page.goto("/");
  const how = page.locator("#how-it-works");
  await how.scrollIntoViewIfNeeded();
  const next = await how.getByRole("button", { name: "Next destination" }).boundingBox();
  const slide = await how.locator(".swiper-slide-active article").boundingBox();
  expect(next!.y).toBeGreaterThanOrEqual(slide!.y + slide!.height);
});
