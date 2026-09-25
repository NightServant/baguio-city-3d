import { describe, expect, it } from "vitest";
import { inServiceArea, isId, isRouteCode, isSlug } from "@/lib/validate";

describe("validators", () => {
  it("accepts real slugs and rejects anything else", () => {
    expect(isSlug("burnham-park")).toBe(true);
    expect(isSlug("<script>")).toBe(false);
    expect(isSlug("a".repeat(81))).toBe(false);
  });
  it("accepts cuid and uuid ids", () => {
    expect(isId("clx2k9w0a0000qz8h3v1y2b3c")).toBe(true);
    expect(isId("5048ee8f-4b01-40ed-b334-11b497b35912")).toBe(true);
    expect(isId("1 OR 1=1")).toBe(false);
  });
  it("accepts route codes", () => {
    expect(isRouteCode("PLZ-MVP")).toBe(true);
    expect(isRouteCode("plz mvp")).toBe(false);
  });
  it("knows where Baguio is", () => {
    expect(inServiceArea(120.5936, 16.4116)).toBe(true);
    expect(inServiceArea(0, 0)).toBe(false);
  });
});
