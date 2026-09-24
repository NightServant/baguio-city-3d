import { describe, expect, it } from "vitest";
import { clip, resolveSiteUrl } from "@/lib/site";

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL and trims trailing slashes", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://baguio.example/" })).toBe("https://baguio.example");
  });
  it("falls back to the Vercel production domain", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "baguio-3d.vercel.app" })).toBe("https://baguio-3d.vercel.app");
  });
  it("uses localhost when nothing is configured", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("clip", () => {
  it("leaves short text alone", () => {
    expect(clip("Pine trees.", 155)).toBe("Pine trees.");
  });
  it("cuts at a word boundary and marks the cut", () => {
    const out = clip("The green heart of Baguio, laid out around a man-made lagoon", 30);
    expect(out).toBe("The green heart of Baguio…");
    expect(out.length).toBeLessThanOrEqual(31);
  });
});
