// Shared styling for panel interactives so every chip, row, input, close button,
// and pill speaks with one focus-ring + pressed-feedback voice. MapControls owns
// the map-canvas HUD; these mirror its `focus-visible:ring-2` and
// `active:translate-y-px` so keyboard focus and touch presses read the same
// everywhere in the app.
import { cn } from "@/lib/utils";

/** One focus-visible ring for every panel control. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Rounded chip/pill base — shared focus ring plus the `active:translate-y-px`
 * pressed feedback the map controls use. Callers layer on their own height,
 * padding, shape (rounded-full vs rounded-lg), and active/idle colors.
 */
export const chipControl = cn("text-xs transition-colors active:translate-y-px", focusRing);

/** Icon-only close button for panels/sheets — size-9 (36px) touch target. */
export const iconButton = cn(
  "flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  focusRing,
);
