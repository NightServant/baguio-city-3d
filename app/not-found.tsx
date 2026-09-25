import Link from "next/link";
import { SetDocumentTitle } from "@/components/site/SetDocumentTitle";

const WAYS_BACK = [
  { href: "/map", name: "The 3D map", note: "Tilt the terrain and find a place." },
  { href: "/destinations", name: "Destinations", note: "Every landmark in the guide, by kind." },
  { href: "/eat-stay", name: "Eat and stay", note: "Food, lodging and pasalubong." },
] as const;

const TITLE = "Page not found | Baguio 3D";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
      <title>{TITLE}</title>
      <SetDocumentTitle title={TITLE} />
      <h1 className="max-w-[16ch] font-display text-4xl leading-[1.02] text-balance sm:text-6xl">
        This page isn&apos;t on the map.
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg leading-8 text-muted-foreground">
        The link may be old, or the address has a typo. Everything in the guide starts from one of these.
      </p>
      <ul className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-3">
        {WAYS_BACK.map((w) => (
          <li key={w.href} className="bg-card">
            <Link href={w.href} className="block h-full p-6 transition-colors hover:bg-secondary">
              <span className="font-display text-xl">{w.name}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{w.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
