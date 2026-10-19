import { describe, expect, it } from "vitest";
import { landmarksInReach } from "@/lib/map/landmarks";

const E = [
  { slug: "near", lng: 120.598, lat: 16.412 },
  { slug: "edge", lng: 120.6035, lat: 16.412 }, // 0.0035° east of the view: inside the 0.004° pad
  { slug: "far", lng: 120.62, lat: 16.39 },
];
const VIEW = { west: 120.59, south: 16.405, east: 120.6, north: 16.42 };

describe("landmarksInReach (drawn landmarks; the rest leave the draw list)", () => {
  it("keeps landmarks in the padded view and drops the far ones", () => {
    expect([...landmarksInReach(E, VIEW, null, 0.004)].sort()).toEqual(["edge", "near"]);
  });
  it("keeps only the selected landmark when zoomed out", () => {
    expect([...landmarksInReach(E, null, "far", 0.004)]).toEqual(["far"]);
    expect([...landmarksInReach(E, null, null, 0.004)]).toEqual([]);
  });
  it("always keeps the selected landmark", () => {
    expect([...landmarksInReach(E, VIEW, "far", 0.004)].sort()).toEqual(["edge", "far", "near"]);
  });
});
