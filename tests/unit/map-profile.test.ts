import { describe, expect, it } from "vitest";
import { LngLat } from "maplibre-gl";
import { lazyUnproject, mapProfile } from "@/lib/map/profile";

describe("mapProfile (phones get a lighter map: owner's Realme 10 4G dropped frames, 2026-10-20)", () => {
  const phone = { coarsePointer: true, minScreenPx: 412, dpr: 2.625, quality: null };
  it("a touch phone draws at 1.5 device pixels and a 64-cell terrain mesh", () => {
    expect(mapProfile(phone)).toEqual({ light: true, pixelRatio: 1.5, terrainMesh: 64 });
  });
  it("a desktop keeps 2 device pixels at most and MapLibre's 128-cell mesh", () => {
    expect(mapProfile({ coarsePointer: false, minScreenPx: 1440, dpr: 2, quality: null })).toEqual({ light: false, pixelRatio: 2, terrainMesh: 128 });
    expect(mapProfile({ coarsePointer: false, minScreenPx: 1440, dpr: 1, quality: null }).pixelRatio).toBe(1);
  });
  it("?quality=high or low overrides the guess, for comparing on a phone", () => {
    expect(mapProfile({ ...phone, quality: "high" }).light).toBe(false);
    expect(mapProfile({ coarsePointer: false, minScreenPx: 1440, dpr: 2, quality: "low" }).light).toBe(true);
  });
});

describe("lazyUnproject (no GPU read-back per pointer event)", () => {
  it("computes a position only when something reads it, once, and stays a LngLat", () => {
    let calls = 0;
    const map = { unproject: () => { calls++; return new LngLat(120.6, 16.41); } };
    lazyUnproject(map as never);
    const ll = (map as unknown as { unproject: (p: unknown) => LngLat }).unproject([10, 20]);
    expect(calls).toBe(0);
    expect(ll).toBeInstanceOf(LngLat);
    expect(ll.lng).toBe(120.6);
    expect(ll.lat).toBe(16.41);
    expect(ll.toArray()).toEqual([120.6, 16.41]);
    expect(calls).toBe(1);
  });
});
