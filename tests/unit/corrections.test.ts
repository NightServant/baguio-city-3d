import { describe, expect, it } from "vitest";
import { MIN_FILL_MS, parseCorrection } from "@/lib/corrections";

const NOW = 1_000_000;
function form(fields: Record<string, string>) {
  const fd = new FormData();
  const base = { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: "reader@example.test", name: "", link: "", website: "", startedAt: String(NOW - MIN_FILL_MS - 1) };
  for (const [k, v] of Object.entries({ ...base, ...fields })) fd.set(k, v);
  return fd;
}

describe("parseCorrection", () => {
  it("accepts a real report", () => {
    expect(parseCorrection(form({}), NOW)).toEqual({
      kind: "valid",
      data: { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: "reader@example.test", name: null, link: null },
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
  // The form asks for an optional name, not an email (owner, 2026-10-20): no reply is ever emailed.
  it("keeps an optional name, trimmed", () => {
    const out = parseCorrection(form({ name: "  Ana Dela Cruz  " }), NOW);
    expect(out.kind === "valid" && out.data.name).toBe("Ana Dela Cruz");
  });
  it("refuses a name over 80 characters and keeps what was typed", () => {
    const out = parseCorrection(form({ name: "x".repeat(81) }), NOW);
    expect(out.kind === "invalid" && out.state.errors?.name).toBeTruthy();
  });
  // The email is required again (owner, 2026-10-20): the check's result is emailed to the reader.
  it("asks for an email and keeps what was typed", () => {
    const out = parseCorrection(form({ email: "" }), NOW);
    expect(out.kind === "invalid" && out.state.errors?.email).toMatch(/email/i);
    expect(out.kind === "invalid" && out.state.fields?.message).toBe("The boat rental closes at 5 pm now.");
  });
  // An optional source link (owner, 2026-10-20): the free checker reads only the page the reader points to.
  it("keeps an optional https source link", () => {
    const out = parseCorrection(form({ link: " https://example.org/hours " }), NOW);
    expect(out.kind === "valid" && out.data.link).toBe("https://example.org/hours");
  });
  it("refuses a link that isn't an https page address", () => {
    for (const link of ["example.org/hours", "http://example.org/hours", "javascript:alert(1)", `https://example.org/${"x".repeat(2000)}`]) {
      const out = parseCorrection(form({ link }), NOW);
      expect(out.kind === "invalid" && out.state.errors?.link, link).toBeTruthy();
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
