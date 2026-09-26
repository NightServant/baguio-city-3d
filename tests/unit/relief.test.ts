import { expect, it } from "vitest";
import { relief } from "@/lib/relief";

const origin = { lng: 120.5936, lat: 16.4116 };
const places = [
  { slug: "burnham-park", name: "Burnham Park", lng: 120.5936, lat: 16.4116, elevationM: 1442 },
  { slug: "mines-view-park", name: "Mines View Park", lng: 120.628, lat: 16.4201, elevationM: 1523 },
  { slug: "bencab-museum", name: "BenCab Museum", lng: 120.549, lat: 16.382, elevationM: 979 },
  { slug: "no-height", name: "No height", lng: 120.6, lat: 16.41, elevationM: null },
];

it("orders places by distance and finds the span", () => {
  const r = relief(origin, places);
  expect(r.points.map((p) => p.slug)).toEqual(["burnham-park", "mines-view-park", "bencab-museum"]);
  expect(r.lowest.slug).toBe("bencab-museum");
  expect(r.highest.slug).toBe("mines-view-park");
  expect(r.spanM).toBe(544);
});
