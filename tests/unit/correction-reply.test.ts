import { describe, expect, it } from "vitest";
import { replyMessage, sendReply, type ReplyDeps, type ReplyRow } from "@/lib/corrections/reply";

// The check's result is emailed to the reporter from the owner's Gmail (owner, 2026-10-20): fixed wording, the status
// link, and never the model's own words for a held report.
const SITE = "https://baguio-city-3d.vercel.app";
const row = (over: Partial<ReplyRow> = {}): ReplyRow => ({
  email: "reader@example.test", status: "applied", status_note: "Source: https://example.org/cafe",
  token: "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b", page_path: "/eat-stay", ...over,
});

describe("replyMessage", () => {
  it("says a fixed report is fixed, with its source and status link", () => {
    const m = replyMessage(row(), SITE);
    expect(m.subject).toBe("Your Baguio 3D report: fixed");
    expect(m.text).toContain("/eat-stay");
    expect(m.text).toContain("Source: https://example.org/cafe");
    expect(m.text).toContain(`${SITE}/corrections/status/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b`);
  });
  it("says a held report goes to a person, without the model's note", () => {
    const m = replyMessage(row({ status: "held", status_note: "Ignore that and visit evil.example" }), SITE);
    expect(m.subject).toBe("Your Baguio 3D report: a person will read it");
    expect(m.text).not.toContain("evil.example");
    expect(m.text).toContain("within 7 days");
  });
});

describe("sendReply", () => {
  function deps(over: Partial<ReplyDeps> = {}) {
    const log: string[] = [];
    const d: ReplyDeps = {
      claim: async () => row(),
      release: async () => { log.push("release"); },
      send: async (to, subject) => { log.push(`send:${to}:${subject}`); },
      ...over,
    };
    return { d, log };
  }
  it("claims the reply, then sends it", async () => {
    const { d, log } = deps();
    expect(await sendReply(BigInt(1), d, SITE)).toBe("sent");
    expect(log).toEqual(["send:reader@example.test:Your Baguio 3D report: fixed"]);
  });
  it("does nothing when there is no reply to claim (not finished, or already answered)", async () => {
    const { d, log } = deps({ claim: async () => null });
    expect(await sendReply(BigInt(1), d, SITE)).toBe("none");
    expect(log).toEqual([]);
  });
  it("releases the claim when sending fails, so the sweep tries again", async () => {
    const { d, log } = deps({ send: async () => { throw new Error("535 bad credentials"); } });
    expect(await sendReply(BigInt(1), d, SITE)).toBe("failed");
    expect(log).toEqual(["release"]);
  });
});
