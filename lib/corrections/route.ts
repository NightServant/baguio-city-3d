// The decision node (owner, 2026-10-20: "the system will decide what model must be used ... depends on the task
// difficulty"). Rules on the report itself, no model call: a hard report goes straight to the strong model (Claude
// Sonnet 5.5); a simple one goes to the cheap model (Claude Haiku 5.5), and if that holds a report about hours or
// prices, the strong model gets a second try. Out-of-scope reports never reach the strong model.
// ponytail: keyword rules; if the logs show them misrouting often, swap difficulty() for a cheap-model classifier.
import type { Verdicter } from "./check";

const TIME = /\b\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)|\b\d{1,2}:\d{2}\b/gi;
const HOURS = /\b(open|opens|opening|close|closes|closed|closing|hours?|schedule|daily|weekdays?|weekends?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/i;
const PRICE = /₱|\bphp\b|\bpesos?\b|\bprices?\b|\bpricey\b|\bexpensive\b|\bcheap(er)?\b|\bcosts?\b|\bfees?\b/i;
const LONG = 400;

export function difficulty(r: { page: string; message: string }): { hard: boolean; inScope: boolean; reasons: string[] } {
  const times = r.message.match(TIME)?.length ?? 0;
  const hours = HOURS.test(r.message) || times > 0, price = PRICE.test(r.message);
  const reasons: string[] = [];
  if (!/^\/destinations\/[a-z0-9-]+$/.test(r.page) && r.page !== "/eat-stay") reasons.push("not one place's page");
  if (r.message.length > LONG) reasons.push("long report");
  if (times > 2) reasons.push("several times");
  if (hours && price) reasons.push("hours and prices");
  return { hard: reasons.length > 0, inScope: hours || price, reasons };
}

export function routedVerdicter(cheap: Verdicter, strong: Verdicter, log: (route: string) => void = () => {}): Verdicter {
  return async (report, findVenue) => {
    const d = difficulty(report);
    if (d.hard) {
      log(`strong: ${d.reasons.join(", ")}`);
      return strong(report, findVenue);
    }
    const v = await cheap(report, findVenue);
    if (v.outcome === "held" && d.inScope) {
      log("cheap held an hours or price report; strong second try");
      return strong(report, findVenue);
    }
    log(`cheap: ${v.outcome}`);
    return v;
  };
}
