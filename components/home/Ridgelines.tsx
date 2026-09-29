import { ParallaxLayer } from "@/components/site/Motion";

// Far to near. The far ridge moves least, which is how depth reads across a
// valley. Each layer carries a solid block under its ridge so rising never
// opens a gap at the section's bottom edge. Muted, so the band stays quiet.
const RIDGES = [
  { speed: -0.05, height: 220, opacity: 0.06, d: "M0 200 L120 120 L260 168 L420 88 L560 150 L700 96 L860 160 L1010 110 L1200 170 V220 H0 Z" },
  { speed: -0.11, height: 180, opacity: 0.1, d: "M0 170 L160 104 L320 150 L480 76 L640 138 L820 92 L980 146 L1200 104 V180 H0 Z" },
  { speed: -0.19, height: 140, opacity: 0.16, d: "M0 130 L140 78 L300 120 L470 60 L620 112 L790 70 L960 118 L1200 82 V140 H0 Z" },
];

export function Ridgelines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 text-muted-foreground">
      {RIDGES.map((r) => (
        <ParallaxLayer key={r.d} speed={r.speed} className="absolute inset-x-0 -bottom-24">
          <div style={{ opacity: r.opacity }}>
            <svg viewBox={`0 0 1200 ${r.height}`} preserveAspectRatio="none" className="block w-full" style={{ height: r.height }}>
              <path d={r.d} fill="currentColor" />
            </svg>
            <div className="h-24 bg-current" />
          </div>
        </ParallaxLayer>
      ))}
    </div>
  );
}
