import Link from "next/link";
import type { Venue } from "@/lib/content";
import { PriceGlyphs } from "@/components/site/badges";
import { OpenNowBadge } from "@/components/site/OpenNowBadge";
import { VENUE_CATEGORY_SINGULAR } from "@/components/site/labels";

const MAX_AMENITIES = 4;

export function VenueCard({ venue }: { venue: Venue }) {
  const v = venue;
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold leading-snug tracking-tight">
            {v.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {VENUE_CATEGORY_SINGULAR[v.category]}
          </p>
        </div>
        <PriceGlyphs priceRange={v.priceRange} />
      </div>

      <p className="mt-3 line-clamp-2 flex-1 text-sm leading-6 text-muted-foreground">
        {v.description}
      </p>

      {v.amenities.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Amenities">
          {v.amenities.slice(0, MAX_AMENITIES).map((a) => (
            <li
              key={a}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {a}
            </li>
          ))}
          {v.amenities.length > MAX_AMENITIES && (
            <li className="px-1 py-0.5 text-[11px] text-muted-foreground/70">
              +{v.amenities.length - MAX_AMENITIES} more
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
        <OpenNowBadge hours={v.hours} />
        <Link
          href={`/map?venue=${v.slug}`}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          View on map
        </Link>
      </div>
    </article>
  );
}
