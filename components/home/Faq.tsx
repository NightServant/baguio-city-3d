import Link from "next/link";
import { FARE_SOURCE, fareAccuracyNote } from "@/lib/geo/fare";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";

const a = "text-primary underline underline-offset-4";

// What we can honestly say about fares depends on what has been verified, so
// the answer reads FARE_SOURCE rather than repeating a fixed claim.
const fareAnswer = FARE_SOURCE.modern.verified
  ? `${fareAccuracyNote()} Fares change, so confirm with the driver before you pay.`
  : "The fares are estimates that we haven’t checked against a current LTFRB issuance. Confirm with the driver before you pay.";

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  { q: "Is it free?", a: <>Yes. The whole site is free and there’s no account to create.</> },
  {
    q: "Where does the map data come from?",
    a: (
      <>
        Terrain from AWS Terrain Tiles, streets and buildings from OpenStreetMap, satellite imagery from Esri. The
        places, routes and hours are curated for this guide. The full list is on the{" "}
        <Link href="/about#sources" className={a}>
          about page
        </Link>
        .
      </>
    ),
  },
  { q: "How accurate are the jeepney fares?", a: fareAnswer },
  {
    q: "Are the opening hours up to date?",
    a: (
      <>
        They can go out of date. If you spot a wrong one,{" "}
        <Link href="/corrections" className={a}>
          send a correction
        </Link>
        .
      </>
    ),
  },
  {
    q: "Does it work on my phone?",
    a: <>Yes, in any recent mobile browser. The 3D view needs a data connection because the terrain streams in as you move, so it doesn’t work offline.</>,
  },
  {
    q: "How do I report a mistake?",
    a: (
      <>
        Use the{" "}
        <Link href="/corrections" className={a}>
          correction form
        </Link>
        . We read every report within {CORRECTIONS_RESPONSE_DAYS} days.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
        <h2 className="font-display text-4xl leading-[1.02] sm:text-5xl">Questions</h2>
        <div className="min-w-0 border-t border-border">
          {QUESTIONS.map(({ q, a: answer }) => (
            <details key={q} className="group border-b border-border py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="mt-0.5 font-mono text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
              </summary>
              <p className="mt-3 max-w-[62ch] leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
