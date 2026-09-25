import type { Metadata } from "next";
import Link from "next/link";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";

export const metadata: Metadata = { title: "Report received", robots: { index: false } };

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <h1 className="font-display text-4xl leading-[1.02] sm:text-5xl">Thanks, your report is in.</h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-8 text-muted-foreground">
        We read every report within {CORRECTIONS_RESPONSE_DAYS} days. If you left an email, we&apos;ll write back once the guide is fixed.
      </p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-medium">
        <Link href="/map" className="text-primary underline-offset-4 hover:underline">Back to the map</Link>
        <Link href="/corrections" className="text-primary underline-offset-4 hover:underline">Report something else</Link>
      </div>
    </div>
  );
}
