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

it("every building tile in the index exists, fits 100 KiB, and nothing else is shipped", () => {
  const D = "public/models/buildings";
  if (!existsSync(`${D}/index.json`)) return;
  const { near, far } = JSON.parse(readFileSync(`${D}/index.json`, "utf8")) as Record<"near" | "far", { url: string }[]>;
  const urls = [...near, ...far].map((t) => t.url);
  for (const url of urls) expect(readFileSync(`public${url}`).length, url).toBeLessThanOrEqual(100 * KiB);
  const listed = new Set(urls.map((u) => u.split("/").pop()));
  expect(readdirSync(D).filter((f) => f !== "index.json" && !listed.has(f)), "orphan files").toEqual([]);
});

it("every road tile in the index exists, fits 100 KiB, and nothing else is shipped", () => {
  const D = "public/models/roads";
  if (!existsSync(`${D}/index.json`)) return;
  const { tiles } = JSON.parse(readFileSync(`${D}/index.json`, "utf8")) as { tiles: { url: string }[] };
  for (const { url } of tiles) expect(readFileSync(`public${url}`).length, url).toBeLessThanOrEqual(100 * KiB);
  const listed = new Set(tiles.map((t) => t.url.split("/").pop()));
  expect(readdirSync(D).filter((f) => f !== "index.json" && !listed.has(f)), "orphan files").toEqual([]);
});

it("every flora tile in the index exists, is whole records, fits 100 KiB, and nothing else is shipped", () => {
  const D = "public/models/flora";
  if (!existsSync(`${D}/index.json`)) return;
  const idx = JSON.parse(readFileSync(`${D}/index.json`, "utf8")) as { archetypes: string; species: unknown[]; tiles: [number, number, number, number, string][] };
  const species = idx.species.length;
  for (const [, , count, , file] of idx.tiles) {
    const buf = readFileSync(`${D}/${file}`);
    expect(buf.length, file).toBe(count * 8); // build_flora.py: 8-byte records
    expect(buf.length, file).toBeLessThanOrEqual(100 * KiB);
    for (let r = 6; r < buf.length; r += 8) if (buf[r] >= species) throw new Error(`${file}: species ${buf[r]} of ${species}`);
  }
  const listed = new Set([...idx.tiles.map((t) => t[4]), idx.archetypes.split("/").pop()]);
  expect(readdirSync(D).filter((f) => f !== "index.json" && !listed.has(f)), "orphan files").toEqual([]);
});
