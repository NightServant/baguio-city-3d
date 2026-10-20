// The database side of a correction check (server only): every call goes through the definer functions of
// *_correction_checks.sql, so the app role still can't list reports or touch columns outside the allow-list.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DAILY_CHECK_CAP, MAX_ATTEMPTS, type CheckDeps } from "./check";
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

/** The model from CORRECTIONS_MODEL (a gateway "provider/model" id), or null when unset: reports then wait for the owner. */
export const correctionsModel = () => process.env.CORRECTIONS_MODEL?.trim() || null;
