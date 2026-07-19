"use client";

// Explore panel: destination category toggles + era filter for the map pins,
// then venue filters (category, price ceiling, open-now, text search) driving
// the VenueList below.
import { useState } from "react";
import { Search } from "lucide-react";
import { useFilters, useMapActions } from "@/stores/useMapStore";
import type { Era, PriceRange, VenueCategory } from "@/types/api";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  ERA_LABELS,
  LANDMARK_CATEGORIES,
  PRICE_GLYPHS,
  VENUE_CATEGORY_LABELS,
} from "@/components/map/categoryStyle";
import { VenueList } from "./VenueList";
import { chipControl, focusRing } from "./controlStyles";

const ERAS = Object.keys(ERA_LABELS) as Era[];
const VENUE_CATEGORIES = Object.keys(VENUE_CATEGORY_LABELS) as VenueCategory[];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

export function FilterPanel() {
  const filters = useFilters();
  const { toggleCategory, setEra, setPriceMax, setOpenNow, setQ, resetFilters } = useMapActions();
  const [venueCategory, setVenueCategory] = useState<VenueCategory | null>(null);

  const anyActive =
    filters.categories.length > 0 ||
    filters.era !== null ||
    filters.priceMax !== null ||
    filters.openNow ||
    filters.q !== "";

  return (
    <div className="flex flex-col gap-5">
      {/* Destination categories */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel>Places on the map</SectionLabel>
          {anyActive && (
            <button
              type="button"
              onClick={() => {
                resetFilters();
                setVenueCategory(null);
              }}
              className={cn("rounded text-xs font-medium text-primary hover:underline", focusRing)}
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LANDMARK_CATEGORIES.map((cat) => {
            const active = filters.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  chipControl,
                  "flex h-9 items-center gap-1.5 rounded-full px-2.5",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Era */}
      <section className="flex flex-col gap-2">
        <SectionLabel>Era</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setEra(null)}
            aria-pressed={filters.era === null}
            className={cn(
              chipControl,
              "h-9 rounded-full px-3",
              filters.era === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            Any
          </button>
          {ERAS.map((era) => (
            <button
              key={era}
              type="button"
              onClick={() => setEra(filters.era === era ? null : era)}
              aria-pressed={filters.era === era}
              className={cn(
                chipControl,
                "h-9 rounded-full px-3",
                filters.era === era
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {ERA_LABELS[era]}
            </button>
          ))}
        </div>
      </section>

      <hr className="border-border" />

      {/* Venue filters */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Eat, stay &amp; shop</SectionLabel>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Strawberry taho, ukay-ukay, silog…"
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setVenueCategory(null)}
            aria-pressed={venueCategory === null}
            className={cn(
              chipControl,
              "h-9 rounded-full px-3",
              venueCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {VENUE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setVenueCategory(venueCategory === cat ? null : cat)}
              aria-pressed={venueCategory === cat}
              className={cn(
                chipControl,
                "h-9 rounded-full px-3",
                venueCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {VENUE_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={filters.priceMax === p}
                onClick={() => setPriceMax(filters.priceMax === p ? null : (p as PriceRange))}
                className={cn(
                  chipControl,
                  "h-9 flex-1 rounded-lg",
                  filters.priceMax !== null && p <= filters.priceMax
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                title={`Up to ${PRICE_GLYPHS[p]}`}
              >
                {PRICE_GLYPHS[p]}
              </button>
            ))}
          </div>
          <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-muted px-2.5 text-xs text-muted-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
              className="sr-only"
            />
            Open now
          </label>
        </div>
      </section>

      <VenueList venueCategory={venueCategory} />
    </div>
  );
}
