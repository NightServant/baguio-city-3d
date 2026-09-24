import { describe, expect, it } from "vitest";
import { haversineKm, jeepneyFare } from "@/lib/geo/fare";

describe("jeepneyFare", () => {
  it("charges only the base fare inside the first 4 km", () => {
    expect(jeepneyFare(3.2, 13, 1.8).fare).toBe(13);
  });
  it("adds the per-km rate beyond 4 km", () => {
    expect(jeepneyFare(6, 13, 1.8).fare).toBe(16.6);
  });
});

describe("haversineKm", () => {
  it("puts Burnham Park about 3.8 km from Mines View Park", () => {
    expect(haversineKm([120.5936, 16.4116], [120.628, 16.4201])).toBeCloseTo(3.79, 1);
  });
});
