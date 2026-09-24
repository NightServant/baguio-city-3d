"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll indicator as an altimeter.
 *
 * A generic progress bar says "you are 40% down a page", which is a fact about
 * a document. This maps scroll onto Baguio's real elevation range instead —
 * 910 m at the bottom of the city to 1,667 m at its highest point (the figures
 * the plan verified) — so descending the page reads as descending the
 * mountain. The tick marks are the same 100 m contour intervals a topographic
 * sheet would use.
 */

const MIN_M = 910;
const MAX_M = 1667;

export function ElevationRail() {
  const [pct, setPct] = useState(0);
  const raf = useRef(0);
  const queued = useRef(false);

  useEffect(() => {
    const update = () => {
      queued.current = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (queued.current) return;
      queued.current = true;
      raf.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Top of page = summit, bottom = valley floor.
  const metres = Math.round(MAX_M - (MAX_M - MIN_M) * pct);

  return (
    <div
      className="pointer-events-none fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2 xl:flex"
      aria-hidden="true"
    >
      <span className="readout tabular-nums text-muted-foreground">{metres} m</span>
      <div className="relative h-56 w-px bg-border">
        {/* 100 m contour ticks */}
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="absolute -left-1 h-px w-2 bg-border"
            style={{ top: `${(i / 7) * 100}%` }}
          />
        ))}
        {/* Current altitude */}
        <span
          className="absolute -left-[3px] h-1.5 w-1.5 rounded-full bg-primary transition-[top] duration-150 ease-out"
          style={{ top: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
