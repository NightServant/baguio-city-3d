import { cn } from "@/lib/utils";
import type { Era, LandmarkCategory } from "@/types/geo";
import type { PriceRange } from "@/types/venue";
import { CATEGORY_LABELS, ERA_LABELS } from "@/components/site/labels";

/** Base pill used by the concrete badges below. */
export function Pill({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CategoryBadge({ category }: { category: LandmarkCategory }) {
  return (
    <Pill className="border-primary/25 bg-primary/8 text-primary">
      {CATEGORY_LABELS[category]}
    </Pill>
  );
}

export function EraBadge({ era }: { era: Era }) {
  return (
    <Pill className="border-accent-foreground/20 bg-accent text-accent-foreground">
      {ERA_LABELS[era]}
    </Pill>
  );
}

/** ₱-glyph price scale: earned glyphs solid, remainder ghosted. */
export function PriceGlyphs({ priceRange }: { priceRange: PriceRange }) {
  return (
    <span
      className="font-mono text-xs tracking-widest"
      aria-label={`Price range ${priceRange} of 4`}
      title={["Budget", "Moderate", "Upscale", "Premium"][priceRange - 1]}
    >
      <span className="text-foreground">{"₱".repeat(priceRange)}</span>
      <span className="text-muted-foreground">{"₱".repeat(4 - priceRange)}</span>
    </span>
  );
}
