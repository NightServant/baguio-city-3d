import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/jsonld";

describe("serializeJsonLd", () => {
  it("escapes < so data can't close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from 1 with absolute URLs", () => {
    const data = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }]);
    expect(data.itemListElement[1]).toMatchObject({ position: 2, name: "Destinations" });
    expect(data.itemListElement[1].item).toMatch(/^https?:\/\/.+\/destinations$/);
  });
});
