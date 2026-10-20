import { describe, expect, it } from "vitest";
import { bearerOk } from "@/lib/corrections/bearer";

const T = "a".repeat(64);
describe("bearerOk (the sweep's cron token)", () => {
  it("accepts the token, trimmed on both sides", () => {
    expect(bearerOk(`Bearer ${T}`, T)).toBe(true);
    expect(bearerOk(`Bearer ${T}`, `${T}\n`)).toBe(true); // a pasted trailing newline (Clover's first 401)
  });
  it("refuses a wrong, missing or short token", () => {
    expect(bearerOk(`Bearer ${"b".repeat(64)}`, T)).toBe(false);
    expect(bearerOk(null, T)).toBe(false);
    expect(bearerOk("Bearer short", "short")).toBe(false);
    expect(bearerOk(`Bearer ${T}`, undefined)).toBe(false);
  });
});
