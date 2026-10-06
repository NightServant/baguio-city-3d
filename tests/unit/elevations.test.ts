import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Feature = { properties: { slug: string; elevation_m: number | null } };
const features: Feature[] = JSON.parse(readFileSync("data/geojson/landmarks.geojson", "utf8")).features;
const elevation = (slug: string) => features.find((f) => f.properties.slug === slug)?.properties.elevation_m;

// Terrain DEM at z15 at each pin, measured 2026-09-22 (docs/baguio-3d-model-plan.md §3c) and re-measured
// 2026-10-06 after the pins moved onto their 3D models (model/scripts/move_pins.py; BenCab's moved 3.2 km).
const MEASURED: Record<string, number> = {
  "bencab-museum": 1052,
  "burnham-park": 1440,
  "good-shepherd-convent": 1575,
  "session-road": 1463,
  "camp-john-hay": 1520,
  "mines-view-park": 1546,
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
