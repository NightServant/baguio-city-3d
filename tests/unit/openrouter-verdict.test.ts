import { describe, expect, it } from "vitest";
import { openrouterVerdicter } from "@/lib/corrections/openrouter";

// The free checker on OpenRouter (owner, 2026-10-20): no web search on free models, so it reads only the page the reader
// linked, fetched by the site. Scripted OpenRouter replies stand in for the API.
const QUOTE = "We are open daily from 8:00 am to 9:00 pm.";
const report = { page: "/eat-stay", message: "Cafe by the Ruins opens at 8 now.", link: "https://example.org/cafe" };
const VERDICT = { outcome: "proposed", note: "", table: "venues", slug: "cafe-by-the-ruins", field: "hours", open: "08:00",
  close: "21:00", price_range: null, source_url: "https://elsewhere.example/other", quote: QUOTE };
const call = (name: string, args: unknown, id = name) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const reply = (toolCalls: unknown[]) => new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: null, tool_calls: toolCalls } }] }), { status: 200 });

function api(responses: Response[]) {
  const bodies: { messages: { role: string; content: string | null; tool_call_id?: string }[] }[] = [];
  const headers: Headers[] = [];
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    headers.push(new Headers(init?.headers));
    return responses.shift()!;
  };
  return { bodies, headers, fetchImpl: fetchImpl as typeof fetch };
}
const page = async () => `<p>${QUOTE}</p>`;

describe("openrouterVerdicter", () => {
  it("sends a report with no link to a person without calling a model", async () => {
    const a = api([]);
    const v = await openrouterVerdicter("google/gemma-4-31b-it:free", "key", { fetchImpl: a.fetchImpl, readPage: page })({ ...report, link: null }, async () => []);
    expect(v.outcome).toBe("held");
    expect(a.bodies).toHaveLength(0);
  });
  it("holds when the linked page can't be read, without calling a model", async () => {
    const a = api([]);
    const v = await openrouterVerdicter("m", "key", { fetchImpl: a.fetchImpl, readPage: async () => null })(report, async () => []);
    expect(v.outcome).toBe("held");
    expect(a.bodies).toHaveLength(0);
  });
  it("hands the page to the model as data and keeps the source to the reader's link", async () => {
    const a = api([reply([call("find_venue", { name: "Cafe by the Ruins" })]), reply([call("submit_verdict", VERDICT)])]);
    const v = await openrouterVerdicter("google/gemma-4-31b-it:free", "key", { fetchImpl: a.fetchImpl, readPage: page })(report,
      async (name) => [{ slug: "cafe-by-the-ruins", name }]);
    expect(v).toMatchObject({ outcome: "proposed", slug: "cafe-by-the-ruins", sourceUrl: report.link, value: { open: "08:00", close: "21:00" } });
    // the chosen model first, then free backups OpenRouter tries when it is rate-limited or down; all free, so no charge
    const models = (a.bodies[0] as unknown as { models: string[] }).models;
    expect(models[0]).toBe("google/gemma-4-31b-it:free");
    expect(models.length).toBeGreaterThan(1);
    expect(models.length).toBeLessThanOrEqual(3); // a longer list drew a 400 on the live test, 2026-10-22
    expect(new Set(models).size).toBe(models.length);
    for (const m of models) expect(m.endsWith(":free"), m).toBe(true);
    expect(a.headers[0].get("authorization")).toBe("Bearer key");
    expect(a.bodies[0].messages.at(-1)!.content).toContain(QUOTE);
    expect(a.bodies[1].messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "find_venue" });
  });
  it("holds on a refused request (bad key, no credit) and throws on a rate limit, for the sweep to retry", async () => {
    const refused = await openrouterVerdicter("m", "key", { fetchImpl: api([new Response("{}", { status: 401 })]).fetchImpl, readPage: page })(report, async () => []);
    expect(refused.outcome).toBe("held");
    await expect(openrouterVerdicter("m", "key", { fetchImpl: api([new Response("{}", { status: 429 })]).fetchImpl, readPage: page })(report, async () => []))
      .rejects.toThrow(/429/);
  });
  it("holds when the model answers without a verdict", async () => {
    const a = api([new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Looks right to me." } }] }), { status: 200 })]);
    expect((await openrouterVerdicter("m", "key", { fetchImpl: a.fetchImpl, readPage: page })(report, async () => [])).outcome).toBe("held");
  });
});
