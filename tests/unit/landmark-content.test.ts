import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Landmark copy checked against its sources (finishes plan Task 8, 2026-10-20): Wikipedia's The Mansion (Baguio) and
// Baguio Botanical Garden, the OSM roads around Igorot Stone Kingdom, and BCDA's news release of 14 May 2025 on Mile Hi.
type F = { properties: { slug: string; description: string; category: string } };
const features = (JSON.parse(readFileSync("data/geojson/landmarks.geojson", "utf8")) as { features: F[] }).features;
const bySlug = Object.fromEntries(features.map((f) => [f.properties.slug, f.properties]));

describe("landmark copy matches its sources", () => {
  it("drops claims the sources contradict or don't support", () => {
    expect(bySlug["the-mansion"].description).not.toMatch(/Buckingham/);
    expect(bySlug["botanical-garden"].description).not.toMatch(/Once called/);
    expect(bySlug["botanical-garden"].description).toMatch(/Imelda Park/);
    expect(bySlug["igorot-stone-kingdom"].description).not.toMatch(/Gibraltar Road/);
    expect(bySlug["igorot-stone-kingdom"].description).toMatch(/Longlong Road/);
    expect(bySlug["mile-hi-cjh-viewdeck"].description).not.toMatch(/August 2025|six years/);
  });
  it("tells Mile Hi's redevelopment as BCDA announced it", () => {
    expect(bySlug["mile-hi-cjh-viewdeck"].description).toMatch(/Bases Conversion and Development Authority/);
    expect(bySlug["mile-hi-cjh-viewdeck"].description).toMatch(/eco-hostel/);
    expect(bySlug["mile-hi-cjh-viewdeck"].category).toBe("MARKET");
  });
});
