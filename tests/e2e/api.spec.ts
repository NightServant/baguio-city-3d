import { expect, test } from "@playwright/test";

test("API rejects junk input", async ({ request }) => {
  expect((await request.get("/api/geo/destinations/%3Cscript%3E")).status()).toBe(404);
  expect((await request.get("/api/venues/1%20OR%201=1")).status()).toBe(404);
  expect((await request.get(`/api/venues?q=${"x".repeat(81)}`)).status()).toBe(400);
  expect((await request.get("/api/geo/transit/fare?mode=taxi&fromLng=0&fromLat=0&toLng=1&toLat=1")).status()).toBe(400);
});
