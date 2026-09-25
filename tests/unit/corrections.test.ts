import { describe, expect, it } from "vitest";
import { MIN_FILL_MS, parseCorrection } from "@/lib/corrections";

const NOW = 1_000_000;
function form(fields: Record<string, string>) {
  const fd = new FormData();
  const base = { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: "", website: "", startedAt: String(NOW - MIN_FILL_MS - 1) };
  for (const [k, v] of Object.entries({ ...base, ...fields })) fd.set(k, v);
  return fd;
}

describe("parseCorrection", () => {
  it("accepts a real report", () => {
    expect(parseCorrection(form({}), NOW)).toEqual({
      kind: "valid",
      data: { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: null },
    });
  });
  it("asks for a longer message and keeps what was typed", () => {
    const out = parseCorrection(form({ message: "wrong" }), NOW);
    expect(out.kind).toBe("invalid");
    if (out.kind === "invalid") {
      expect(out.state.errors?.message).toMatch(/at least 10/);
      expect(out.state.fields?.message).toBe("wrong");
    }
  });
  it("rejects an incomplete email", () => {
    const out = parseCorrection(form({ email: "someone@" }), NOW);
    expect(out.kind === "invalid" && out.state.errors?.email).toBeTruthy();
  });
  it("treats a filled honeypot as spam", () => {
    expect(parseCorrection(form({ website: "http://spam" }), NOW).kind).toBe("spam");
  });
  it("treats an instant submission as spam", () => {
    expect(parseCorrection(form({ startedAt: String(NOW - 100) }), NOW).kind).toBe("spam");
  });
});
