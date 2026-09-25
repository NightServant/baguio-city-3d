import { expect, it } from "vitest";
import { nearest } from "@/lib/nearby";

const burnham = { lng: 120.5936, lat: 16.4116 };
const places = [
  { slug: "mines-view", lng: 120.628, lat: 16.4201 },
  { slug: "session-road", lng: 120.5967, lat: 16.4118 },
  { slug: "bencab", lng: 120.549, lat: 16.382 },
];

it("orders by distance and keeps n", () => {
  const out = nearest(burnham, places, 2);
  expect(out.map((o) => o.item.slug)).toEqual(["session-road", "mines-view"]);
  expect(out[0].km).toBeLessThan(0.5);
});
