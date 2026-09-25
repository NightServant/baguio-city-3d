import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RETIRED = /#1e4d3a|#14352a|#0f281f|#2f6d52|#e0a84f|#eef4f0|#a9c1b5/i;

it("brand assets use the weave palette, not the retired green", () => {
  for (const file of ["app/icon.svg", "app/apple-icon.tsx", "app/opengraph-image.tsx"]) {
    const src = readFileSync(file, "utf8");
    expect(src, file).not.toMatch(RETIRED);
    expect(src, file).toMatch(/#8C2318/i);
  }
});

it("no create-next-app default favicon.ico remains (icon.svg + apple-icon.tsx cover current browsers)", () => {
  expect(existsSync("app/favicon.ico")).toBe(false);
});
