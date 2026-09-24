import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Feature = { properties: { slug: string; elevation_m: number | null } };
const features: Feature[] = JSON.parse(readFileSync("data/geojson/landmarks.geojson", "utf8")).features;
const elevation = (slug: string) => features.find((f) => f.properties.slug === slug)?.properties.elevation_m;

// Terrain DEM at z15, measured 2026-09-22 (docs/baguio-3d-model-plan.md §3c).
const MEASURED: Record<string, number> = {
  "bencab-museum": 979,
  "burnham-park": 1442,
  "good-shepherd-convent": 1550,
  "session-road": 1449,
  "camp-john-hay": 1503,
  "mines-view-park": 1523,
};

describe("destination elevations", () => {
  for (const [slug, dem] of Object.entries(MEASURED)) {
    it(`${slug} is within 20 m of the terrain model`, () => {
      expect(Math.abs((elevation(slug) ?? Infinity) - dem)).toBeLessThanOrEqual(20);
    });
  }
  it("every destination has an elevation inside Baguio's real range", () => {
    for (const f of features) {
      expect(f.properties.elevation_m, f.properties.slug).toBeGreaterThan(850);
      expect(f.properties.elevation_m, f.properties.slug).toBeLessThan(1700);
    }
  });
});
