// The database side of a correction check (server only): every call goes through the definer functions of
// *_correction_checks.sql, so the app role still can't list reports or touch columns outside the allow-list.
import { Prisma } from "@prisma/client";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/db";
import { SITE_NAME } from "@/lib/site";
import { DAILY_CHECK_CAP, MAX_ATTEMPTS, type CheckDeps, type Verdicter } from "./check";
import { claudeVerdicter } from "./claude";
import { routedVerdicter } from "./route";
import type { ReplyDeps, ReplyRow } from "./reply";
import { fetchSourceText } from "./source-check";

export const dbDeps: CheckDeps = {
  async claim(id) {
    const [r] = await prisma.$queryRaw<[{ ok: boolean | null }]>(Prisma.sql`SELECT claim_correction(${id}, ${DAILY_CHECK_CAP}) AS ok`);
    return r?.ok === true;
  },
  async report(id) {
    const [r] = await prisma.$queryRaw<{ page_path: string; message: string }[]>(Prisma.sql`SELECT * FROM correction_for_check(${id})`);
    return r ? { page: r.page_path, message: r.message } : null;
  },
  findVenue: (name) => prisma.$queryRaw<{ slug: string; name: string }[]>(
    Prisma.sql`SELECT slug, name FROM venues WHERE name ILIKE ${"%" + name.replace(/[%_]/g, "") + "%"} ORDER BY name LIMIT 5`),
  source: fetchSourceText,
  async apply(id, p) {
    const [r] = await prisma.$queryRaw<[{ out: string }]>(Prisma.sql`
      SELECT apply_correction(${id}, ${p.table}, ${p.slug}, ${p.field}, ${JSON.stringify(p.value)}::jsonb, ${p.sourceUrl}, ${p.quote}) AS out`);
    return r.out;
  },
  async hold(id, note) { await prisma.$executeRaw(Prisma.sql`SELECT hold_correction(${id}, ${note})`); },
  async fail(id, error) { await prisma.$executeRaw(Prisma.sql`SELECT fail_correction(${id}, ${error}, ${MAX_ATTEMPTS})`); },
};

/** The checker: the decision node (lib/corrections/route.ts) over two Anthropic models, the cheap one from
 *  CORRECTIONS_MODEL (claude-haiku-5-5) and the strong one from CORRECTIONS_MODEL_HARD (default claude-sonnet-5-5).
 *  Null while CORRECTIONS_MODEL or ANTHROPIC_API_KEY is unset: reports then wait for the owner. Each decision is
 *  logged, so the Vercel function logs show which model decided and why. */
export function correctionsVerdicter(): Verdicter | null {
  const cheap = process.env.CORRECTIONS_MODEL?.trim();
  if (!cheap || !process.env.ANTHROPIC_API_KEY?.trim()) return null;
  const strong = process.env.CORRECTIONS_MODEL_HARD?.trim() || "claude-sonnet-5-5";
  return routedVerdicter(claudeVerdicter(cheap), claudeVerdicter(strong), (route) => console.info(`corrections route: ${route}`));
}

// The reply goes out from the owner's Gmail (owner, 2026-10-20), over Gmail's SMTP with an app password. Unset (local
// runs): no reply is claimed, so the sweep sends it once both are set.
let mailer: Transporter | null = null;
export function dbReplyDeps(): ReplyDeps | null {
  const user = process.env.GMAIL_USER?.trim(), pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  mailer ??= nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  const from = { name: SITE_NAME, address: user };
  return {
    async claim(id) {
      const [r] = await prisma.$queryRaw<ReplyRow[]>(Prisma.sql`SELECT * FROM claim_correction_reply(${id})`);
      return r ? { ...r, token: String(r.token) } : null;
    },
    async release(id) { await prisma.$executeRaw(Prisma.sql`SELECT release_correction_reply(${id})`); },
    async send(to, subject, text) { await mailer!.sendMail({ from, to, replyTo: user, subject, text }); },
  };
}

/** Replies still waiting: reports held after their last failed check, or whose send failed. */
export const pendingReplies = (limit: number) =>
  prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`SELECT pending_correction_replies(${limit}) AS id`);
