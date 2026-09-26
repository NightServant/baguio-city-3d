"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const TerrainCanvas = dynamic(
  () => import("@/components/site/TerrainCanvas").then((m) => m.TerrainCanvas),
  { ssr: false },
);

/**
 * Mounts the three.js wireframe, and fetches its heightmap, only when the
 * Problem section is about to scroll into view. Nothing loads for visitors
 * who never scroll that far.
 */
export function LazyTerrain({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {near ? <TerrainCanvas riseOnScroll className="size-full" /> : null}
    </div>
  );
}
