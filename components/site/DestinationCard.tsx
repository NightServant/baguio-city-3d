import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Destination } from "@/lib/content";
import { CategoryBadge, EraBadge } from "@/components/site/badges";
import { formatCoord, formatElevation } from "@/components/site/labels";

export function DestinationCard({ destination }: { destination: Destination }) {
  const d = destination;
  return (
    <article className="group relative flex flex-col rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md hover:shadow-primary/5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight">
          <Link
            href={`/destinations/${d.slug}`}
            className="after:absolute after:inset-0 group-hover:text-primary"
          >
            {d.name}
          </Link>
        </h3>
        <ArrowUpRight
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>

      <p className="readout mt-2 text-muted-foreground">
        {d.elevationM != null ? `ELEV ${formatElevation(d.elevationM)} · ` : ""}
        {formatCoord(d.lng, d.lat)}
      </p>

      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
        {d.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryBadge category={d.category} />
        {d.era ? <EraBadge era={d.era} /> : null}
        <Link
          href={`/map?dest=${d.slug}`}
          className="relative z-10 ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View on map
        </Link>
      </div>
    </article>
  );
}
