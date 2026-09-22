"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Page transition.
 *
 * A cross-fade is the generic default and says nothing. This settles the
 * incoming page downward a few pixels as it arrives — the same easing the
 * scroll reveals use — so moving between pages reads as the same descending
 * motion the elevation rail tracks. Short (280ms) so navigation never feels
 * gated behind an animation.
 *
 * Implemented with a keyed remount rather than the View Transitions API:
 * support is uneven across the browsers this app targets, and a failed view
 * transition degrades to a hard cut mid-navigation.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [stage, setStage] = useState<"in" | "settled">("settled");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setStage("in");
    const t = setTimeout(() => setStage("settled"), 20);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div data-route-stage={stage} className="route-transition">
      {children}
    </div>
  );
}
