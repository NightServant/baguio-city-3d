import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";
import { CorrectionForm } from "./CorrectionForm";

export const metadata: Metadata = {
  title: "Suggest a correction",
  description: "Found a wrong opening time, fare or pin on Baguio 3D? Tell us what changed and we'll fix the guide.",
  alternates: { canonical: "/corrections" },
};

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const { page } = await searchParams;
  // Next passes a repeated query parameter (?page=/a&page=/b) as string[],
  // not string — only a single string value is a page path we'll accept.
  const fromPage = typeof page === "string" && page.startsWith("/") && page.length <= 200 ? page : "";
  // Rendered on the server so the time check works without JavaScript. This
  // is a Server Component (runs once per request, never memoized/replayed
  // by the React Compiler), so the timestamp is exactly what the compiler's
  // purity rule is protecting client render output from.
  // eslint-disable-next-line react-hooks/purity
  const startedAt = Date.now();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Breadcrumbs trail={[{ name: "Suggest a correction", path: "/corrections" }]} />
      <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Suggest a correction</h1>
      <p className="mt-4 max-w-[56ch] text-lg leading-8 text-muted-foreground">
        Hours change, shops close, fares go up. If something here is out of date, tell us and we&apos;ll fix it for the next visitor.
      </p>
      <CorrectionForm page={fromPage} startedAt={startedAt} responseDays={CORRECTIONS_RESPONSE_DAYS} />
    </div>
  );
}
