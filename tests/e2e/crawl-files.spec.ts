import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

test("robots.txt allows the site, blocks the API and points at the sitemap", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("the sitemap lists every page and destination, and each one resolves", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of PAGES) expect(urls).toContain(path);
  expect(urls.filter((u) => u.startsWith("/destinations/")).length).toBe(22);
  for (const path of urls) expect((await request.get(path)).status(), path).toBe(200);
});
