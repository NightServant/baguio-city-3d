import { globSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// The weave identity is square (radius token 0.125rem). rounded-full stays
// allowed for dots and circles.
it("no rounded-lg/xl/2xl/3xl surfaces remain", () => {
  const files = globSync("{app,components}/**/*.tsx");
  const offenders = files.filter((f) => /\brounded-(lg|xl|2xl|3xl)\b/.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
