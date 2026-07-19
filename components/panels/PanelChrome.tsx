"use client";

// The HUD chrome overlaying the map: a dock of mode buttons and a single
// floating panel whose content follows ui.activeSheet. Non-modal by design —
// the map must stay interactive while a panel is open (fare picking, flying).
// Desktop: dock top-left, panel below it. Mobile: dock bottom bar, panel as a
// bottom snap container.
import { useEffect } from "react";
import { Bus, Hourglass, SlidersHorizontal, X } from "lucide-react";
import { useActiveSheet, useMapActions } from "@/stores/useMapStore";
import { cn } from "@/lib/utils";
import { FilterPanel } from "./FilterPanel";
import { TimelineScrubber } from "./TimelineScrubber";
import { RoutePlanner } from "./RoutePlanner";
import { DestinationSheet } from "./DestinationSheet";
import { iconButton } from "./controlStyles";
import type { SheetKind } from "@/stores/useMapStore";

const MODES: Array<{ key: Exclude<SheetKind, "destination" | null>; label: string; icon: typeof Bus }> = [
  { key: "filters", label: "Explore", icon: SlidersHorizontal },
  { key: "transit", label: "Jeepneys", icon: Bus },
  { key: "timeline", label: "Through time", icon: Hourglass },
];

const PANEL_TITLES: Record<string, string> = {
  filters: "Explore Baguio",
  transit: "Ride a jeepney",
  timeline: "Baguio through time",
};

export function PanelChrome() {
  const activeSheet = useActiveSheet();
  const { openSheet, closeSheet, setSelectedSlug } = useMapActions();

  const panelOpen = activeSheet === "filters" || activeSheet === "transit" || activeSheet === "timeline";

  // Escape closes whatever HUD surface is open. Only one is ever open at a time
  // (activeSheet is single-valued), but a destination sheet also owns the
  // selected slug, so clear that too when it's the one closing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeSheet === "destination") {
        setSelectedSlug(null);
        closeSheet();
      } else if (panelOpen) {
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSheet, panelOpen, closeSheet, setSelectedSlug]);

  return (
    <>
      {/* Mode dock */}
      <div
        className={cn(
          "absolute z-panel flex gap-1.5",
          "max-sm:inset-x-3 max-sm:bottom-3 max-sm:justify-center",
          "sm:left-3 sm:top-3 sm:flex-col",
        )}
      >
        {MODES.map(({ key, label, icon: Icon }) => {
          const active = activeSheet === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => (active ? closeSheet() : openSheet(key))}
              className={cn(
                "flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium shadow-sm ring-1 backdrop-blur transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground ring-primary/30"
                  : "bg-card/90 text-foreground ring-foreground/10 hover:bg-card",
              )}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Floating panel / bottom snap container */}
      {panelOpen && (
        <div
          className={cn(
            "absolute z-panel flex flex-col overflow-hidden bg-card/95 shadow-xl ring-1 ring-foreground/10 backdrop-blur",
            "max-sm:inset-x-0 max-sm:bottom-16 max-sm:mx-2 max-sm:max-h-[55dvh] max-sm:rounded-3xl",
            "sm:left-3 sm:top-16 sm:bottom-3 sm:w-[21rem] sm:rounded-3xl",
            "animate-in fade-in duration-200 ease-out motion-reduce:animate-none",
            "max-sm:slide-in-from-bottom-4 sm:slide-in-from-left-4",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-heading text-sm font-medium text-foreground">
              {PANEL_TITLES[activeSheet as string]}
            </h2>
            <button type="button" aria-label="Close panel" onClick={closeSheet} className={iconButton}>
              <X className="size-4" />
            </button>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {activeSheet === "filters" && <FilterPanel />}
            {activeSheet === "transit" && <RoutePlanner />}
            {activeSheet === "timeline" && <TimelineScrubber />}
          </div>
        </div>
      )}

      <DestinationSheet />
    </>
  );
}
