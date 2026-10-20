// The verdict as a tool call, shared by the Claude (claude.ts) and OpenRouter (openrouter.ts) checkers: a flat schema
// every provider's strict tool mode accepts, mapped back to Verdict (check.ts) and validated there.
import { Verdict } from "./check";

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });

export const VERDICT_TOOL_DESCRIPTION = "Your one answer for this report. For held, fill outcome and note and set the rest to " +
  "null. For proposed, fill every field except note (empty) and the value fields that don't apply (null).";

export const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outcome", "note", "table", "slug", "field", "open", "close", "price_range", "source_url", "quote"],
  properties: {
    outcome: { type: "string", enum: ["held", "proposed"] },
    note: { type: "string", description: "Held: one line saying why. Proposed: empty." },
    table: nullable({ type: "string", enum: ["venues", "destinations"] }),
    slug: nullable({ type: "string" }),
    field: nullable({ type: "string", enum: ["hours", "price_range"] }),
    open: nullable({ type: "string", description: "HH:MM, 24-hour" }),
    close: nullable({ type: "string", description: "HH:MM, 24-hour" }),
    price_range: nullable({ type: "integer", description: "1 to 4" }),
    source_url: nullable({ type: "string", description: "The https page that states the new value" }),
    quote: nullable({ type: "string", description: "That page's exact words, at least 20 characters" }),
  },
} as const;

export const FIND_VENUE_DESCRIPTION = "Look up a venue in the guide by name; returns its slug and name.";
export const FIND_VENUE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string" } },
} as const;

export function toVerdict(i: Record<string, unknown>): Verdict {
  const raw = i.outcome === "proposed"
    ? { outcome: "proposed", table: i.table, slug: i.slug, field: i.field,
        value: i.field === "hours" ? { open: i.open, close: i.close } : i.price_range, sourceUrl: i.source_url, quote: i.quote }
    : { outcome: "held", note: String(i.note ?? "").slice(0, 300) || "No public page confirms it." };
  const parsed = Verdict.safeParse(raw);
  return parsed.success ? parsed.data : { outcome: "held", note: "The check's answer was incomplete." };
}
