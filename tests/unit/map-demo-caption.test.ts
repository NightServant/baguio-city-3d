import { expect, it } from "vitest";
import { captionKind, type DemoTarget } from "@/components/home/MapDemo";

const target: DemoTarget = { slug: "burnham-park", name: "Burnham Park", lng: 120.59, lat: 16.41 };

it("static stage always wins, even with a target picked", () => {
  expect(captionKind("static", target)).toBe("static");
  expect(captionKind("static", null)).toBe("static");
});

it("a picked target names itself once the map can show it", () => {
  expect(captionKind("poster", target)).toBe("target");
  expect(captionKind("loading", target)).toBe("target");
  expect(captionKind("live", target)).toBe("target");
});

it("falls back to loading/idle copy with no target", () => {
  expect(captionKind("loading", null)).toBe("loading");
  expect(captionKind("poster", null)).toBe("idle");
  expect(captionKind("live", null)).toBe("idle");
});
