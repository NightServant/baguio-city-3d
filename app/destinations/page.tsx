import type { Metadata } from "next";
import { getDestinations } from "@/lib/content";
import { SectionHeading } from "@/components/site/SectionHeading";
import { DestinationCard } from "@/components/site/DestinationCard";
import { FilterChips } from "@/components/site/FilterChips";
import { CATEGORY_LABELS } from "@/components/site/labels";
import type { LandmarkCategory } from "@/types/geo";

export const metadata: Metadata = {
  title: "Destinations",
  description:
    "Every landmark in the Baguio 3D field guide — parks, viewpoints, heritage sites, museums, and markets across the City of Pines.",
};

const CATEGORY_ORDER: LandmarkCategory[] = [
  "PARK",
  "VIEWPOINT",
  "HERITAGE",
  "NATURE",
  "MUSEUM",
  "CHURCH",
  "MARKET",
  "RECREATION",
];

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : undefined;
  const category = CATEGORY_ORDER.includes(rawCategory as LandmarkCategory)
    ? (rawCategory as LandmarkCategory)
    : null;

  const all = await getDestinations();
  const shown = category ? all.filter((d) => d.category === category) : all;

  const chips = [
    { label: "All", href: "/destinations", active: category === null, count: all.length },
    ...CATEGORY_ORDER.map((cat) => ({
      label: CATEGORY_LABELS[cat],
      href: `/destinations?category=${cat}`,
      active: category === cat,
      count: all.filter((d) => d.category === cat).length,
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="The directory"
        title="Destinations"
        lede="Every landmark in the guide, from Burnham's lagoon to the ridge viewpoints. Filter by kind, then jump to its spot on the 3D map."
      />

      <div className="mt-8">
        <FilterChips options={chips} label="Filter destinations by category" />
      </div>

      {shown.length > 0 ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <DestinationCard key={d.slug} destination={d} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-sm text-muted-foreground">
          No destinations in this category yet. Choose another filter above.
        </p>
      )}
    </div>
  );
}
