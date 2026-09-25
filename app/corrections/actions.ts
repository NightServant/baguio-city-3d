"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseCorrection, type CorrectionState } from "@/lib/corrections";

// ponytail: one global hourly cap instead of per-visitor limits, so no IP is
// stored. Switch to per-client limiting if the form gets abused.
const HOURLY_CAP = 30;

export async function submitCorrection(_prev: CorrectionState, form: FormData): Promise<CorrectionState> {
  const parsed = parseCorrection(form, Date.now());
  if (parsed.kind === "invalid") return parsed.state;

  if (parsed.kind === "valid") {
    const { page, message, email } = parsed.data;
    const fields = { page, message, email: email ?? "" };
    try {
      const [{ recent }] = await prisma.$queryRaw<[{ recent: number }]>(Prisma.sql`
        SELECT count(created_at)::int AS recent FROM corrections
        WHERE created_at > now() - interval '1 hour'`);
      if (recent >= HOURLY_CAP) {
        return {
          status: "error",
          fields,
          formError: "We've had a lot of reports this hour. Your text is still here; send it again in an hour.",
        };
      }
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO corrections (page_path, message, reply_email) VALUES (${page}, ${message}, ${email})`);
    } catch {
      return { status: "error", fields, formError: "Your report didn't save, and nothing was sent. Try again in a minute." };
    }
  }

  // Spam reaches here too: bots get the same thank-you page and learn nothing.
  // redirect() throws, so it stays outside the try above.
  redirect("/corrections/thanks");
}
