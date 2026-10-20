// One correction check (owner decisions 2026-09-25): a model with web search proposes an allow-listed change with its
// source and exact quote, or holds; the site re-fetches the source and finds the quote before the database applies it.
// The database calls and the model's side are injected (lib/corrections/db.ts, lib/corrections/claude.ts), so the
// decision path is tested without either.
import { z } from "zod";
import { quoteFound } from "./source-check";

export const DAILY_CHECK_CAP = 60; // ESTIMATE: reports checked a day at most (spend cap, with the gateway's own control)
export const MAX_ATTEMPTS = 3;

const Hours = z.object({ open: z.string().regex(/^\d\d:\d\d$/), close: z.string().regex(/^\d\d:\d\d$/) });
export const Verdict = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("held"), note: z.string().max(300) }),
  z.object({
    outcome: z.literal("proposed"),
    table: z.enum(["venues", "destinations"]),
    slug: z.string().max(120),
    field: z.enum(["hours", "price_range"]),
    value: z.union([Hours, z.number().int().min(1).max(4)]),
    sourceUrl: z.string().url().max(2000),
    quote: z.string().min(20).max(1000),
  }),
]);
export type Verdict = z.infer<typeof Verdict>;
export type Proposal = Extract<Verdict, { outcome: "proposed" }>;

/** The model's side of a check: read one report (looking venues up as needed) and return a verdict. */
export type Verdicter = (report: Report, findVenue: CheckDeps["findVenue"]) => Promise<Verdict>;
/** One report as the checker sees it: never the reporter's email or name. */
export interface Report { page: string; message: string; link?: string | null }

export interface CheckDeps {
  claim(id: bigint): Promise<boolean>;
  report(id: bigint): Promise<Report | null>;
  findVenue(name: string): Promise<{ slug: string; name: string }[]>;
  source(url: string): Promise<string | null>;
  apply(id: bigint, p: Proposal): Promise<string>;
  hold(id: bigint, note: string): Promise<void>;
  fail(id: bigint, error: string): Promise<void>;
}

export async function checkCorrection(id: bigint, deps: CheckDeps, verdicter: Verdicter): Promise<string> {
  if (!(await deps.claim(id))) return "not claimed";
  try {
    const r = await deps.report(id);
    if (!r) return "no report";
    const v = await verdicter(r, deps.findVenue);
    if (v.outcome === "held") { await deps.hold(id, v.note); return "held"; }
    const page = await deps.source(v.sourceUrl);
    if (!page || !quoteFound(page, v.quote)) { await deps.hold(id, "The cited page does not show the quote"); return "held: quote"; }
    return await deps.apply(id, v);
  } catch (err) {
    await deps.fail(id, (err instanceof Error ? err.message : String(err)).slice(0, 300));
    return "failed";
  }
}
