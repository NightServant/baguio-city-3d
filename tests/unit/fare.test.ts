import { describe, expect, it } from "vitest";
import { haversineKm, jeepneyFare, modernJeepneyFare } from "@/lib/geo/fare";

describe("jeepneyFare", () => {
  it("charges only the base fare inside the first 4 km", () => {
    expect(jeepneyFare(3.2, 13, 1.8).fare).toBe(13);
  });
  it("adds the per-km rate beyond 4 km", () => {
    expect(jeepneyFare(6, 13, 1.8).fare).toBe(16.6);
  });
});

// Worked examples from the LTFRB Non-Aircon Modern and Electric PUJ General
// Fare Guide, effective 2026-03-19 (FARE_SOURCE.modern).
describe("modernJeepneyFare", () => {
  it("matches the guide's regular worked examples", () => {
    expect(modernJeepneyFare(5).fare).toBe(19);
    expect(modernJeepneyFare(10).fare).toBe(29);
    expect(modernJeepneyFare(26).fare).toBe(61);
  });
  it("charges only the base fare inside the first 4 km", () => {
    expect(modernJeepneyFare(3.2).fare).toBe(17);
  });
  it("rounds the discounted base fare to the nearest 25 centavos", () => {
    // Guide: student/elderly/PWD first 4 km = P13.60, rounded to P13.50.
    expect(modernJeepneyFare(3.2, true).fare).toBe(13.5);
  });
  it("rounds discounted longer trips to the nearest 25 centavos too", () => {
    // Guide's discounted column at these distances: 15.25, 23.25, 48.75.
    expect(modernJeepneyFare(5, true).fare).toBe(15.25);
    expect(modernJeepneyFare(10, true).fare).toBe(23.25);
    expect(modernJeepneyFare(26, true).fare).toBe(48.75);
  });
});

describe("haversineKm", () => {
  it("puts Burnham Park about 3.8 km from Mines View Park", () => {
    expect(haversineKm([120.5936, 16.4116], [120.628, 16.4201])).toBeCloseTo(3.79, 1);
  });
});
