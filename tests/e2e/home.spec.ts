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
  // Attached isn't enough: MapLibre's CSS once collapsed the container to 0 px
  // tall, clipping a live canvas out of sight. It must fill the frame.
  const frameBox = await how.locator("figure > div").first().boundingBox();
  const mapBox = await how.locator(".maplibregl-map").boundingBox();
  expect(mapBox!.height).toBeGreaterThan(0);
  expect(mapBox!.height).toBeCloseTo(frameBox!.height, 0);
  // Nothing steers the map until the visitor does (Swiper's loop init and
  // resizes used to fire a slide change on their own).
  const status = how.locator("figure").getByRole("status");
  await expect(status).toHaveText("Pick a place below and the map flies there", { timeout: 20_000 });
  await how.getByRole("button", { name: "Next destination" }).click();
  const picked = await how.locator(".swiper-slide-active h4").innerText();
  await expect(status).toHaveText(`Showing ${picked} on the map`);
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

test("the homepage runs hero, proof, problem, solution, FAQ, CTA in that order", async ({ page }) => {
  await page.goto("/");
  const headings = await page.locator("main h1, main h2").allTextContents();
  expect(headings).toEqual([
    "Baguio City, mapped in 3D.",
    "What the map is made of",
    "A flat map hides the hills.",
    "One map for the climb, the ride and the table.",
    "Questions",
    "See the hills before you climb them.",
  ]);
});

test("FAQ answers open natively", async ({ page }) => {
  await page.goto("/");
  await page.getByText("How accurate are the jeepney fares?").click();
  await expect(page.getByText(/confirm with the driver/i).first()).toBeVisible();
});

test("the ridgelines behind the closing CTA drift with scroll", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("section", { has: page.getByRole("heading", { name: "See the hills before you climb them." }) });
  await cta.scrollIntoViewIfNeeded();
  const layer = cta.locator(".parallax-layer").last();
  const before = await layer.evaluate((el) => getComputedStyle(el).transform);
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(250);
  const after = await layer.evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);
});

test("the ridgelines hold still for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const cta = page.locator("section", { has: page.getByRole("heading", { name: "See the hills before you climb them." }) });
  await cta.scrollIntoViewIfNeeded();
  const transforms = await cta.locator(".parallax-layer").evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
  expect(transforms.every((t) => t === "none")).toBe(true);
});
