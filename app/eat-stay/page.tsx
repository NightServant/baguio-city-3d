import type { Metadata } from "next";
import { getVenues } from "@/lib/content";
import { SectionHeading } from "@/components/site/SectionHeading";
import { VenueCard } from "@/components/site/VenueCard";
import { FilterChips } from "@/components/site/FilterChips";
import { VENUE_CATEGORY_LABELS } from "@/components/site/labels";
import type { VenueCategory } from "@/types/venue";

export const metadata: Metadata = {
  title: "Eat & Stay",
  description:
    "Where to eat, snack, shop, and sleep in Baguio — restaurants, ube-jam counters, pine-side hotels, and budget transient houses with hours and price ranges.",
};

const CATEGORY_ORDER: VenueCategory[] = [
  "RESTAURANT",
  "FOOD_SHOP",
  "HOTEL",
  "TRANSIENT",
  "SOUVENIR",
];

export default async function EatStayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCat = typeof sp.cat === "string" ? sp.cat : undefined;
  const category = CATEGORY_ORDER.includes(rawCat as VenueCategory)
    ? (rawCat as VenueCategory)
    : null;

  const all = await getVenues();
  const shown = category ? all.filter((v) => v.category === category) : all;

  const chips = [
    { label: "All", href: "/eat-stay", active: category === null, count: all.length },
    ...CATEGORY_ORDER.map((cat) => ({
      label: VENUE_CATEGORY_LABELS[cat],
      href: `/eat-stay?cat=${cat}`,
      active: category === cat,
      count: all.filter((v) => v.category === cat).length,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Eat & stay"
        title="The pasalubong economy"
        lede="Strawberry shortcake on Session Road, the nuns' ube jam by Mines View, fireplace lodges under the pines — with hours, price range, and a spot on the map."
      />

      <div className="mt-8">
        <FilterChips options={chips} label="Filter venues by category" />
      </div>

      {category ? (
        // Filtered: single grid
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => (
            <VenueCard key={v.slug} venue={v} />
          ))}
        </div>
      ) : (
        // All: grouped by category
        <div className="mt-12 space-y-14">
          {CATEGORY_ORDER.map((cat) => {
            const group = all.filter((v) => v.category === cat);
            if (group.length === 0) return null;
            return (
              <section key={cat}>
                <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
                  <h2 className="font-display text-2xl font-semibold tracking-tight">
                    {VENUE_CATEGORY_LABELS[cat]}
                  </h2>
                  <p className="readout text-muted-foreground">{group.length} listed</p>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((v) => (
                    <VenueCard key={v.slug} venue={v} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
