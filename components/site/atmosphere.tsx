// Ambient SVG scenery: topographic contours and a pine treeline.
// Pure currentColor SVG — no external images. Decorative only (aria-hidden).
import { cn } from "@/lib/utils";

/**
 * Concentric survey contours around a summit point — the cartographic
 * signature of the site. Stroke inherits currentColor; size via className.
 */
export function Contours({ className }: { className?: string }) {
  // One irregular closed loop, rendered at shrinking scales like a
  // topographic hill. Path is centered on (0,0).
  const blob =
    "M -180 -10 C -170 -80 -95 -120 -10 -118 C 80 -116 165 -80 178 -12 C 190 52 120 108 8 112 C -100 116 -190 60 -180 -10 Z";
  const scales = [1, 0.82, 0.65, 0.49, 0.34, 0.2];
  return (
    <svg
      viewBox="-220 -160 440 320"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      {scales.map((s) => (
        <path
          key={s}
          d={blob}
          transform={`scale(${s})`}
          stroke="currentColor"
          strokeWidth={1 / s}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <circle cx="0" cy="-2" r="2.5" fill="currentColor" />
      <text
        x="10"
        y="-8"
        fontSize="11"
        fill="currentColor"
        fontFamily="var(--font-geist-mono)"
        letterSpacing="2"
      >
        1500 M
      </text>
    </svg>
  );
}

/** Deterministic stepped-pine ridge path across `width`, baseline at `base`. */
function treelinePath(width: number, base: number, seedOffset = 0): string {
  const heights = [38, 52, 30, 58, 44, 34, 56, 40, 50, 28, 54, 46, 36, 60, 42, 32, 48, 55, 39, 51];
  const parts = [`M0 ${base + 4}`, `L0 ${base}`];
  let x = 0;
  let i = seedOffset;
  while (x < width) {
    const h = heights[i % heights.length];
    const w = h * 0.66;
    const cx = x + w / 2;
    parts.push(
      `L${(cx - w * 0.5).toFixed(1)} ${base}`,
      `L${(cx - w * 0.2).toFixed(1)} ${(base - h * 0.42).toFixed(1)}`,
      `L${(cx - w * 0.3).toFixed(1)} ${(base - h * 0.42).toFixed(1)}`,
      `L${(cx - w * 0.12).toFixed(1)} ${(base - h * 0.72).toFixed(1)}`,
      `L${(cx - w * 0.2).toFixed(1)} ${(base - h * 0.72).toFixed(1)}`,
      `L${cx.toFixed(1)} ${(base - h).toFixed(1)}`,
      `L${(cx + w * 0.2).toFixed(1)} ${(base - h * 0.72).toFixed(1)}`,
      `L${(cx + w * 0.12).toFixed(1)} ${(base - h * 0.72).toFixed(1)}`,
      `L${(cx + w * 0.3).toFixed(1)} ${(base - h * 0.42).toFixed(1)}`,
      `L${(cx + w * 0.2).toFixed(1)} ${(base - h * 0.42).toFixed(1)}`,
      `L${(cx + w * 0.5).toFixed(1)} ${base}`,
    );
    x += w * 0.8;
    i++;
  }
  parts.push(`L${width} ${base}`, `L${width} ${base + 4}`, "Z");
  return parts.join(" ");
}

/**
 * Two overlapping rows of stepped pines — the ridge that closes sections.
 * Colors inherit currentColor at two opacities for depth.
 */
export function Treeline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 68"
      preserveAspectRatio="none"
      className={cn("block h-10 w-full sm:h-14", className)}
      aria-hidden="true"
    >
      <path d={treelinePath(1440, 66, 7)} fill="currentColor" opacity="0.28" transform="translate(14 0)" />
      <path d={treelinePath(1440, 66)} fill="currentColor" opacity="0.75" />
    </svg>
  );
}

/**
 * Soft drifting fog bands layered over hero/section backgrounds.
 * Uses the theme background color so it works in light and dark.
 */
export function FogBank({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="animate-fog absolute top-1/4 -left-[10%] h-40 w-[120%] rounded-full bg-background/50 blur-3xl" />
      <div
        className="animate-fog absolute top-1/2 -left-[10%] h-48 w-[120%] rounded-full bg-background/40 blur-3xl"
        style={{ animationDelay: "-13s", animationDuration: "34s" }}
      />
    </div>
  );
}
