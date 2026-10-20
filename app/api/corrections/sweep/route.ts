// The backstop for the automated corrections (Clover's pattern): an external cron POSTs here every 15 minutes with
// Authorization: Bearer CORRECTIONS_SWEEP_TOKEN. Stuck checks go back to "received" (or are held after MAX_ATTEMPTS),
// then a few waiting reports are checked. The response carries counts only, never report text.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { bearerOk } from "@/lib/corrections/bearer";
import { checkCorrection, MAX_ATTEMPTS } from "@/lib/corrections/check";
import { correctionsModel, dbDeps, dbReplyDeps, pendingReplies } from "@/lib/corrections/db";
import { sendReply } from "@/lib/corrections/reply";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 300;
const PER_SWEEP = 3; // ESTIMATE: three checks of up to 90 s fit in 300 s

export async function POST(req: Request) {
  if (!bearerOk(req.headers.get("authorization"), process.env.CORRECTIONS_SWEEP_TOKEN)) return new Response(null, { status: 401 });
  const model = correctionsModel();
  let released = 0;
  const results: string[] = [];
  if (model) {
    [{ n: released }] = await prisma.$queryRaw<[{ n: number }]>(Prisma.sql`SELECT release_stuck_corrections(15, ${MAX_ATTEMPTS}) AS n`);
    const ids = await prisma.$queryRaw<{ id: bigint }[]>(Prisma.sql`SELECT received_corrections(${PER_SWEEP}) AS id`);
    for (const { id } of ids) results.push(await checkCorrection(id, dbDeps, model));
  }
  // then the replies still waiting (finished reports, sends that failed); a few per run, Gmail's limits being low
  const reply = dbReplyDeps();
  const replies: string[] = [];
  if (reply) for (const { id } of await pendingReplies(PER_SWEEP * 3)) replies.push(await sendReply(id, reply, SITE_URL));
  return Response.json({ released, checked: results.length, results, replies });
}
