import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Contract C6: per-file landmark budgets, measured on the raw file (stricter than over the wire).
const DIR = "public/models/landmarks";
const KiB = 1024;
const glbJson = (b: Buffer) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8"));

it("every landmark in the index exists, fits its budget, and nothing else is shipped", () => {
  if (!existsSync(`${DIR}/index.json`)) return;
  const { landmarks } = JSON.parse(readFileSync(`${DIR}/index.json`, "utf8")) as { landmarks: { slug: string; url: string }[] };
  const registry = JSON.parse(readFileSync("model/landmarks.json", "utf8")) as Record<string, { tier: number }>;
  for (const { slug, url } of landmarks) {
    const buf = readFileSync(`public${url}`);
    expect(buf.length, `${slug} file`).toBeLessThanOrEqual(150 * KiB);
    const j = glbJson(buf);
    const images = (j.images ?? []).reduce((s: number, im: { bufferView?: number }) =>
      s + (im.bufferView != null ? j.bufferViews[im.bufferView].byteLength : 0), 0);
    if (registry[slug].tier === 1) expect(buf.length - images, `${slug} geometry`).toBeLessThanOrEqual(60 * KiB);
  }
  const listed = new Set(landmarks.map((l) => l.url.split("/").pop()));
  const files = readdirSync(DIR).filter((f) => f.endsWith(".glb"));
  expect(files.filter((f) => !listed.has(f)), "orphan GLBs").toEqual([]);
});
