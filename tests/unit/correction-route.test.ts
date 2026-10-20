import { describe, expect, it } from "vitest";
import type { Verdict, Verdicter } from "@/lib/corrections/check";
import { difficulty, routedVerdicter } from "@/lib/corrections/route";

// The decision node (owner, 2026-10-20): the report's difficulty picks the model. Simple reports go to the cheap model
// first, hard ones straight to the strong one, and an in-scope report the cheap model holds gets a second try.
const simple = { page: "/eat-stay", message: "Cafe by the Ruins now opens at 8:00 am and closes at 9:00 pm." };

describe("difficulty", () => {
  it("calls one place's new hours simple", () => {
    expect(difficulty(simple)).toEqual({ hard: false, inScope: true, reasons: [] });
    expect(difficulty({ page: "/destinations/bencab-museum", message: "BenCab Museum is now closed on Mondays." }).hard).toBe(false);
  });
  it("calls a report hard when it isn't about one place's page, is long, lists several times, or mixes hours and prices", () => {
    expect(difficulty({ ...simple, page: "/map" }).reasons).toContain("not one place's page");
    expect(difficulty({ ...simple, message: simple.message + " ".repeat(10) + "x".repeat(400) }).reasons).toContain("long report");
    expect(difficulty({ ...simple, message: "Open 8:00 am to 5:00 pm on weekdays, 10:00 am to 9:00 pm on weekends." }).reasons).toContain("several times");
    expect(difficulty({ ...simple, message: "Opens at 9 am now, and a meal costs about ₱500." }).reasons).toContain("hours and prices");
  });
  it("knows when a report is about something the checker may not change", () => {
    expect(difficulty({ page: "/destinations/burnham-park", message: "Please rename Burnham Park to Burnham Lake Park." }).inScope).toBe(false);
  });
});

describe("routedVerdicter", () => {
  const held: Verdict = { outcome: "held", note: "No public page confirms it." };
  const proposed: Verdict = { outcome: "proposed", table: "venues", slug: "cafe-by-the-ruins", field: "hours",
    value: { open: "08:00", close: "21:00" }, sourceUrl: "https://example.org/cafe", quote: "We are open daily from 8:00 am to 9:00 pm." };
  function models(cheapSays: Verdict) {
    const used: string[] = [];
    const cheap: Verdicter = async () => { used.push("cheap"); return cheapSays; };
    const strong: Verdicter = async () => { used.push("strong"); return proposed; };
    return { used, cheap, strong };
  }
  const noVenues = async () => [];
  it("keeps the cheap model's confirmation", async () => {
    const m = models(proposed);
    expect(await routedVerdicter(m.cheap, m.strong)(simple, noVenues)).toBe(proposed);
    expect(m.used).toEqual(["cheap"]);
  });
  it("gives an in-scope report the cheap model held a second try on the strong one", async () => {
    const m = models(held);
    expect((await routedVerdicter(m.cheap, m.strong)(simple, noVenues)).outcome).toBe("proposed");
    expect(m.used).toEqual(["cheap", "strong"]);
  });
  it("doesn't spend the strong model on an out-of-scope report", async () => {
    const m = models(held);
    await routedVerdicter(m.cheap, m.strong)({ page: "/destinations/burnham-park", message: "Please rename Burnham Park." }, noVenues);
    expect(m.used).toEqual(["cheap"]);
  });
  it("sends a hard report straight to the strong model, and says why", async () => {
    const m = models(held), routes: string[] = [];
    await routedVerdicter(m.cheap, m.strong, (r) => routes.push(r))({ ...simple, page: "/map" }, noVenues);
    expect(m.used).toEqual(["strong"]);
    expect(routes).toEqual(["strong: not one place's page"]);
  });
});
