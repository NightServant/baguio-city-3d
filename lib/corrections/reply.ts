// The reply to a reporter (owner, 2026-10-20): once a report is fixed or held, its result is emailed once, from the
// owner's Gmail. Fixed wording only: a held report's note can carry the model's words, which came from the report and
// the pages it read, so it never goes into an email. The database side (claim, release) is injected, like the check.
import { CORRECTIONS_RESPONSE_DAYS, SITE_NAME } from "@/lib/site";

export interface ReplyRow { email: string; status: string; status_note: string | null; token: string; page_path: string }

export interface ReplyDeps {
  claim(id: bigint): Promise<ReplyRow | null>;
  release(id: bigint): Promise<void>;
  send(to: string, subject: string, text: string): Promise<void>;
}

export function replyMessage(r: ReplyRow, siteUrl: string): { subject: string; text: string } {
  const status = `Your report's status page: ${siteUrl}/corrections/status/${r.token}`;
  if (r.status === "applied") {
    return {
      subject: `Your ${SITE_NAME} report: fixed`,
      text: `Thanks for your report about ${r.page_path}.\n\nWe checked it against a public source, and the guide now shows the change.\n` +
        `${r.status_note ?? ""}\n\n${status}\n\n${SITE_NAME}\n`,
    };
  }
  return {
    subject: `Your ${SITE_NAME} report: a person will read it`,
    text: `Thanks for your report about ${r.page_path}.\n\nOur automatic check couldn't confirm it from a public source, so a ` +
      `person will read it within ${CORRECTIONS_RESPONSE_DAYS} days.\n\n${status}\n\n${SITE_NAME}\n`,
  };
}

/** Sends a finished report's reply once: claim it, send it, and give the claim back if sending fails (the sweep retries). */
export async function sendReply(id: bigint, deps: ReplyDeps, siteUrl: string): Promise<"sent" | "none" | "failed"> {
  const r = await deps.claim(id);
  if (!r) return "none";
  const { subject, text } = replyMessage(r, siteUrl);
  try {
    await deps.send(r.email, subject, text);
    return "sent";
  } catch {
    await deps.release(id);
    return "failed";
  }
}
