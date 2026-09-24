"use client";

/**
 * Animated icons, drawn as inline SVG so they cost no dependency and inherit
 * currentColor from the weave palette.
 *
 * Each one animates the thing it depicts — the pine sways, the fog drifts, the
 * jeepney's route dashes travel, the contour rings breathe outward like
 * elevation being read off a map. Motion that describes the subject rather
 * than motion for its own sake. All of it stops under prefers-reduced-motion
 * (see the `motion-reduce` rules in globals.css).
 */

type IconProps = { className?: string };

export function PineIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <g className="icon-sway origin-bottom">
        <path d="M16 4 L21 13 H18.5 L23 21 H9 L13.5 13 H11 Z" fill="currentColor" />
      </g>
      <path d="M16 21 V28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function FogIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path className="icon-drift" style={{ animationDelay: "0s" }} d="M5 12h14" />
        <path className="icon-drift" style={{ animationDelay: "-1.1s" }} d="M8 17h16" />
        <path className="icon-drift" style={{ animationDelay: "-2.2s" }} d="M4 22h13" />
      </g>
    </svg>
  );
}

export function RouteIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        className="icon-route"
        d="M5 25 C 11 25, 9 15, 15 15 S 22 7, 27 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <circle cx="5" cy="25" r="2.5" fill="currentColor" />
      <circle cx="27" cy="7" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function ContourIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" fill="none" strokeWidth="1.6">
        <ellipse className="icon-ring" style={{ animationDelay: "0s" }} cx="16" cy="16" rx="12" ry="8" />
        <ellipse className="icon-ring" style={{ animationDelay: "-1.3s" }} cx="16" cy="16" rx="8" ry="5.2" />
        <ellipse className="icon-ring" style={{ animationDelay: "-2.6s" }} cx="16" cy="16" rx="4" ry="2.6" />
      </g>
      <circle cx="16" cy="16" r="1.4" fill="currentColor" />
    </svg>
  );
}
