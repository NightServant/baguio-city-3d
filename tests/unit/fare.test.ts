import { describe, expect, it } from "vitest";
import {
  formatLongDate,
  haversineKm,
  jeepneyFare,
  modernJeepneyFare,
  taxiFare,
} from "@/lib/geo/fare";
import { moneyEntries } from "@/components/panels/RoutePlanner";

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
  it("matches the guide's regular worked examples (whole-km distances)", () => {
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
  // The guide's table is keyed by whole kilometres and says nothing about
  // part-kilometres, so distances are rounded UP to the next whole km before
  // pricing — every returned fare is therefore a value the guide actually
  // prints (R-5b-1).
  describe("part-kilometre distances round up to a whole-km guide value", () => {
    it("0.4 km rounds up to 1 km (still inside the 4 km base)", () => {
      expect(modernJeepneyFare(0.4).fare).toBe(17);
    });
    it("4.3 km rounds up to 5 km", () => {
      expect(modernJeepneyFare(4.3).fare).toBe(19);
    });
    it("7.2 km rounds up to 8 km", () => {
      expect(modernJeepneyFare(7.2).fare).toBe(25);
    });
    it("discounted 4.3 km rounds up to 5 km too", () => {
      expect(modernJeepneyFare(4.3, true).fare).toBe(15.25);
    });
  });
});

// Uses the map fare tool's own moneyEntries() (exported from RoutePlanner,
// not reimplemented here) so this can't silently drift from what the UI
// actually renders. It filters a breakdown down to the peso-amount keys the
// tool displays (dropping non-monetary keys like baseCoversKm/extraKm and
// rate-not-charge keys like perKm) — summed, those displayed rows must equal
// the displayed fare, for every fare type the tool shows.
describe("displayed breakdown parts sum to the displayed fare", () => {
  const sumShownParts = (breakdown: Record<string, number>) =>
    moneyEntries(breakdown).reduce((total, [, v]) => total + v, 0);

  it("for a traditional jeepney fare", () => {
    const r = jeepneyFare(6, 13, 1.8);
    expect(sumShownParts(r.breakdown)).toBeCloseTo(r.fare, 2);
  });
  it("for a modern jeepney fare", () => {
    const r = modernJeepneyFare(7.2);
    expect(sumShownParts(r.breakdown)).toBeCloseTo(r.fare, 2);
  });
  it("for a taxi fare", () => {
    const r = taxiFare(3.5);
    expect(sumShownParts(r.breakdown)).toBeCloseTo(r.fare, 2);
  });
});

describe("formatLongDate", () => {
  it("formats in UTC regardless of the host's local timezone", () => {
    const originalTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(formatLongDate("2026-06-30")).toBe("30 June 2026");
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

describe("haversineKm", () => {
  it("puts Burnham Park about 3.8 km from Mines View Park", () => {
    expect(haversineKm([120.5936, 16.4116], [120.628, 16.4201])).toBeCloseTo(3.79, 1);
  });
});
