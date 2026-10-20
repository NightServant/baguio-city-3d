import { expect, it } from "vitest";
import { redactUrl } from "@/lib/analytics";

// A report's status page address is its private key (app/corrections/status/[token]); analytics gets the route only.
it("page views of a status page carry the route, not the token", () => {
  const t = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
  expect(redactUrl(`https://baguio.example/corrections/status/${t}`)).toBe("https://baguio.example/corrections/status/[token]");
  expect(redactUrl(`https://baguio.example/corrections/status/${t}?x=1#y`)).toBe("https://baguio.example/corrections/status/[token]?x=1#y");
  expect(redactUrl("https://baguio.example/map?dest=burnham-park")).toBe("https://baguio.example/map?dest=burnham-park");
});
