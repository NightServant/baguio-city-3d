import { statSync } from "node:fs";
import { expect, it } from "vitest";

it("homepage posters stay under 250 KB", () => {
  for (const file of ["public/home/hero-map.jpg", "public/home/demo-map.jpg"]) {
    expect(statSync(file).size, file).toBeLessThan(250_000);
  }
});
