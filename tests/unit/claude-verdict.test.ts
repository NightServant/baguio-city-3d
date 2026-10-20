import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { claudeVerdicter } from "@/lib/corrections/claude";

// The checker's model on Anthropic's API (owner, 2026-10-20), against a scripted client: tool calls, the verdict, and
// the stop reasons the SDK docs say to handle (pause_turn, refusal).
type Reply = Partial<Anthropic.Message> & { content: Anthropic.ContentBlock[] };
function client(replies: Reply[]) {
  const calls: Anthropic.MessageCreateParams[] = [];
  return {
    calls,
    messages: { create: async (p: Anthropic.MessageCreateParams) => { calls.push(structuredClone(p)); return replies.shift() as Anthropic.Message; } },
  } as unknown as Pick<Anthropic, "messages"> & { calls: Anthropic.MessageCreateParams[] };
}
const use = (name: string, input: unknown, id = name) => ({ type: "tool_use", id, name, input, caller: { type: "direct" } }) as unknown as Anthropic.ContentBlock;
const VERDICT = { outcome: "proposed", note: "", table: "venues", slug: "cafe-by-the-ruins", field: "hours", open: "08:00", close: "21:00",
  price_range: null, source_url: "https://example.org/cafe", quote: "We are open daily from 8:00 am to 9:00 pm." };
const report = { page: "/eat-stay", message: "Cafe by the Ruins opens at 8 now." };

describe("claudeVerdicter", () => {
  it("looks a venue up, then returns the submitted verdict", async () => {
    const c = client([
      { stop_reason: "tool_use", content: [use("find_venue", { name: "Cafe by the Ruins" })] },
      { stop_reason: "tool_use", content: [use("submit_verdict", VERDICT)] },
    ]);
    const asked: string[] = [];
    const v = await claudeVerdicter("claude-haiku-5-5", c)(report, async (name) => { asked.push(name); return [{ slug: "cafe-by-the-ruins", name }]; });
    expect(v).toEqual({ outcome: "proposed", table: "venues", slug: "cafe-by-the-ruins", field: "hours",
      value: { open: "08:00", close: "21:00" }, sourceUrl: "https://example.org/cafe", quote: VERDICT.quote });
    expect(asked).toEqual(["Cafe by the Ruins"]);
    const second = c.calls[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    expect(second[0]).toMatchObject({ type: "tool_result", tool_use_id: "find_venue" });
  });
  it("uses the basic web search on Haiku and the newer one on Sonnet", async () => {
    for (const [model, type] of [["claude-haiku-5-5", "web_search_20250305"], ["claude-sonnet-5-5", "web_search_20260209"]]) {
      const c = client([{ stop_reason: "tool_use", content: [use("submit_verdict", { ...VERDICT, outcome: "held", note: "No page." })] }]);
      await claudeVerdicter(model, c)(report, async () => []);
      expect(c.calls[0].model).toBe(model);
      expect(c.calls[0].tools?.map((t) => ("type" in t ? t.type : t.name))).toContain(type);
    }
  });
  it("resumes a paused turn", async () => {
    const c = client([
      { stop_reason: "pause_turn", content: [] },
      { stop_reason: "tool_use", content: [use("submit_verdict", VERDICT)] },
    ]);
    expect((await claudeVerdicter("claude-haiku-5-5", c)(report, async () => [])).outcome).toBe("proposed");
    expect(c.calls).toHaveLength(2);
  });
  it("holds on a refusal, on no verdict, and on a malformed verdict", async () => {
    const r1 = await claudeVerdicter("claude-haiku-5-5", client([{ stop_reason: "refusal", content: [] }]))(report, async () => []);
    const r2 = await claudeVerdicter("claude-haiku-5-5", client([{ stop_reason: "end_turn", content: [{ type: "text", text: "Done.", citations: null } as Anthropic.ContentBlock] }]))(report, async () => []);
    const r3 = await claudeVerdicter("claude-haiku-5-5", client([{ stop_reason: "tool_use", content: [use("submit_verdict", { ...VERDICT, open: "8am" })] }]))(report, async () => []);
    for (const r of [r1, r2, r3]) expect(r.outcome).toBe("held");
  });
});
