import { describe, expect, it } from "vitest";
import { modelMatrix } from "@/lib/map/modelTransform";

// Apply a column-major 4x4 to a point.
const apply = (m: number[], [x, y, z]: number[]) => [0, 1, 2].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r]);
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));
const A = { x: 0.8, y: 0.45, z: 1e-5 };

describe("modelMatrix", () => {
  it("maps glTF east, up and south onto Mercator x, z and y at heading 0", () => {
    const m = modelMatrix(A, 2, 1, 0);
    close(apply(m, [1, 0, 0]), [0.8 + 2, 0.45, 1e-5]); // +X east
    close(apply(m, [0, 1, 0]), [0.8, 0.45, 1e-5 + 2]); // +Y up
    close(apply(m, [0, 0, 1]), [0.8, 0.45 + 2, 1e-5]); // +Z is south in glTF (north is -Z); Mercator y grows south
  });
  it("scales only height by the exaggeration", () => {
    const m = modelMatrix(A, 1, 1.35, 0);
    close(apply(m, [0, 10, 0]), [0.8, 0.45, 1e-5 + 13.5]);
    close(apply(m, [10, 0, 0]), [0.8 + 10, 0.45, 1e-5]);
  });
  it("turns clockwise from north by the heading", () => {
    const m = modelMatrix(A, 1, 1, 90);
    close(apply(m, [0, 0, -1]), [0.8 + 1, 0.45, 1e-5]); // the model's north now points east
  });
});
