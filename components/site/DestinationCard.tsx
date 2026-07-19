import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Destination } from "@/lib/content";
import { CategoryBadge, EraBadge } from "@/components/site/badges";
import { formatCoord, formatElevation } from "@/components/site/labels";

export function DestinationCard({
  destination,
  featured = false,
  className,
}: {
  destination: Destination;
  featured?: boolean;
  className?: string;
}) {
  const d = destination;
  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 transition-shadow hover:shadow-md hover:shadow-primary/5 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring",
        featured && "lg:col-span-2 lg:p-7",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className={cn(
            "font-display font-semibold leading-snug tracking-tight",
            featured ? "text-2xl sm:text-3xl" : "text-lg",
          )}
        >
          <Link
            href={`/destinations/${d.slug}`}
            className="after:absolute after:inset-0 group-hover:text-primary focus-visible:outline-none"
          >
            {d.name}
          </Link>
        </h3>
        <ArrowUpRight
          className={cn(
            "mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary",
            featured ? "size-5" : "size-4",
          )}
          aria-hidden="true"
        />
      </div>

      <p className="readout mt-2 text-muted-foreground">
        {d.elevationM != null ? `ELEV ${formatElevation(d.elevationM)} · ` : ""}
        {formatCoord(d.lng, d.lat)}
      </p>

      <p
        className={cn(
          "mt-3 flex-1 text-muted-foreground",
          featured
            ? "max-w-xl text-base leading-7"
            : "line-clamp-3 text-sm leading-6",
        )}
      >
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
