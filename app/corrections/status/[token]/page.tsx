import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";

export const metadata: Metadata = { title: "Report status", robots: { index: false } };

const SAYS: Record<string, string> = {
  received: `Received. We check every report against public sources, and a person reads it within ${CORRECTIONS_RESPONSE_DAYS} days.`,
  checking: "We're checking it against public sources now. Come back to this page in a few minutes.",
  applied: "Fixed: a public source confirmed it, and the guide now shows the change.",
  held: `A person will look at it within ${CORRECTIONS_RESPONSE_DAYS} days: no public source confirmed it automatically.`,
};

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) notFound();
  const [row] = await prisma.$queryRaw<{ status: string; status_note: string | null }[]>(
    Prisma.sql`SELECT status, status_note FROM correction_status(${token}::uuid)`);
  if (!row) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <h1 className="font-display text-4xl leading-[1.02] sm:text-5xl">Your report</h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-8 text-muted-foreground">{SAYS[row.status] ?? SAYS.received}</p>
      {row.status === "applied" && row.status_note && <p className="mt-3 text-sm text-muted-foreground">{row.status_note}</p>}
      <p className="mt-6 text-sm text-muted-foreground">Keep this page&apos;s address to check back. It&apos;s private to you.</p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-medium">
        <Link href="/map" className="text-primary underline-offset-4 hover:underline">Back to the map</Link>
        <Link href="/corrections" className="text-primary underline-offset-4 hover:underline">Report something else</Link>
      </div>
    </div>
  );
}
