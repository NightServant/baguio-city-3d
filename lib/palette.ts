/**
 * The Cordillera Weave hex values, for code that can't read CSS tokens: MUI's
 * palette (app/theme.ts) and three.js materials. The light tokens in
 * globals.css are oklch equivalents of these; keep the two in step.
 */
export const WEAVE = {
  light: { ground: "#F5F0E6", warp: "#16130F", madder: "#8C2318" },
  dark: { ground: "#2b221c", warp: "#f3ece1", madder: "#a8402f", madderLight: "#d98a7b" },
} as const;
