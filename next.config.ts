import type { NextConfig } from "next";

const TILE_HOSTS = "https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com";
const GA_HOSTS = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

// Report-only until the browser console on /, /map and /corrections shows no
// violations across a week of normal use (Phase 10). MapLibre runs its
// workers from blob: URLs; Emotion and MapLibre inject inline styles.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_HOSTS} ${GA_HOSTS}`,
  "font-src 'self'",
  `connect-src 'self' ${TILE_HOSTS} ${GA_HOSTS}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // The site never asks for location, camera, microphone or payment.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  // The e2e build writes to its own folder so it never clobbers a running
  // `next dev` (which serves from .next/dev) with stale or missing files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      // 3D model files (GLBs, flora tiles, surface scans) are content-hashed, so they never change (contract C4); their
      // indexes do.
      { source: "/models/:file(.*\\.(?:glb|bin|webp))", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/models/:dir/index.json", headers: [{ key: "Cache-Control", value: "public, max-age=300" }] },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
