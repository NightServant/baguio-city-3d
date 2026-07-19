// Branded 404. Minimal, semantic tokens, a way back to the map.
import Link from "next/link";
import { PineMark } from "@/components/site/PineMark";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <PineMark className="size-7" />
      </div>
      <p className="readout text-muted-foreground">Error 404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
        Off the map
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This page isn&apos;t on any of our ridges. Head back to the map and pick a trail.
      </p>
      <p className="readout mt-6 text-muted-foreground">Off the trail</p>
      <Link
        href="/map"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <PineMark className="size-4" aria-hidden="true" />
        Open the map
      </Link>
    </div>
  );
}
