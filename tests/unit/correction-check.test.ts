import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { checkCorrection, type CheckDeps } from "@/lib/corrections/check";

const model = (verdict: unknown) => new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: "text", text: JSON.stringify({ verdict }) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
    warnings: [],
  }),
});
const QUOTE = "We are open daily from 8:00 am to 9:00 pm.";
const PROPOSED = { outcome: "proposed", table: "venues", slug: "cafe-by-the-ruins", field: "hours",
  value: { open: "08:00", close: "21:00" }, sourceUrl: "https://example.org/cafe", quote: QUOTE };

function deps(over: Partial<CheckDeps> = {}) {
  const log: string[] = [];
  const d: CheckDeps = {
    claim: async () => true,
    report: async () => ({ page: "/eat-stay", message: "Cafe by the Ruins opens at 8 now." }),
    findVenue: async () => [{ slug: "cafe-by-the-ruins", name: "Cafe by the Ruins" }],
    source: async () => `<p>${QUOTE}</p>`,
    apply: async () => { log.push("apply"); return "applied"; },
    hold: async (_id, note) => { log.push(`hold:${note}`); },
    fail: async (_id, err) => { log.push(`fail:${err}`); },
    ...over,
  };
  return { d, log };
}

describe("checkCorrection", () => {
  it("applies a proposal whose quote the re-fetched page shows", async () => {
    const { d, log } = deps();
    expect(await checkCorrection(BigInt(1), d, model(PROPOSED), false)).toBe("applied");
    expect(log).toEqual(["apply"]);
  });
  it("holds a proposal whose page doesn't show the quote", async () => {
    const { d, log } = deps({ source: async () => "<p>Closed for renovation.</p>" });
    expect(await checkCorrection(BigInt(1), d, model(PROPOSED), false)).toBe("held: quote");
    expect(log).toEqual(["hold:The cited page does not show the quote"]);
  });
  it("holds when the model finds no source", async () => {
    const { d, log } = deps();
    expect(await checkCorrection(BigInt(1), d, model({ outcome: "held", note: "No public page confirms it." }), false)).toBe("held");
    expect(log).toEqual(["hold:No public page confirms it."]);
  });
  it("does nothing when another run holds the claim", async () => {
    const { d, log } = deps({ claim: async () => false });
    expect(await checkCorrection(BigInt(1), d, model(PROPOSED), false)).toBe("not claimed");
    expect(log).toEqual([]);
  });
  it("records a failure for the sweep to retry", async () => {
    const { d, log } = deps();
    const broken = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("gateway timeout"); } });
    expect(await checkCorrection(BigInt(1), d, broken, false)).toBe("failed");
    expect(log[0]).toMatch(/^fail:/);
  });
});
