import { ImageResponse } from "next/og";

// Image metadata
export const alt =
  "Baguio 3D — a 3D map field guide to Baguio City, the Summer Capital, in three dimensions.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Palette — oklch brand values converted to hex approximations.
const GROUND = "#14352a"; // dark pine-green ground
const GROUND_2 = "#0f281f"; // deeper pine for the vignette base
const PINE = "#2f6d52"; // pine mid — contour strokes
const AMBER = "#e0a84f"; // single amber accent
const FOG = "#eef4f0"; // fog-tinted near-white text
const FOG_MUTED = "#a9c1b5"; // muted fog for the tagline

// One irregular closed loop rendered at shrinking scales — the topographic
// summit motif borrowed from components/site/atmosphere.tsx.
const BLOB =
  "M -180 -10 C -170 -80 -95 -120 -10 -118 C 80 -116 165 -80 178 -12 C 190 52 120 108 8 112 C -100 116 -190 60 -180 -10 Z";
const SCALES = [1, 0.82, 0.65, 0.49, 0.34, 0.2];

const SERIF =
  'Georgia, "Times New Roman", "Iowan Old Style", "Palatino Linotype", serif';
const MONO = '"SFMono-Regular", "Courier New", ui-monospace, monospace';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: `radial-gradient(120% 120% at 78% 18%, ${GROUND} 0%, ${GROUND_2} 100%)`,
          color: FOG,
        }}
      >
        {/* Contour-line texture, anchored off the top-right corner */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -180,
            display: "flex",
          }}
        >
          <svg width="760" height="620" viewBox="-220 -160 440 320" fill="none">
            {SCALES.map((s, i) => (
              <path
                key={s}
                d={BLOB}
                transform={`scale(${s})`}
                stroke={i === SCALES.length - 1 ? AMBER : PINE}
                strokeWidth={1.6 / s}
                opacity={i === SCALES.length - 1 ? 0.9 : 0.34}
              />
            ))}
            <circle cx="0" cy="-2" r="6" fill={AMBER} />
          </svg>
        </div>

        {/* Brand eyebrow: pine mark + survey-readout label */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill={AMBER}>
            <path d="M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z" />
          </svg>
          <span
            style={{
              marginLeft: 16,
              fontFamily: MONO,
              fontSize: 20,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: FOG_MUTED,
            }}
          >
            Baguio 3D Field Guide
          </span>
        </div>

        {/* Headline + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              fontFamily: SERIF,
              fontSize: 168,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: -3,
            }}
          >
            <span>Baguio</span>
            <span style={{ color: AMBER, marginLeft: 28 }}>3D</span>
          </div>
          <span
            style={{
              marginTop: 28,
              fontFamily: SERIF,
              fontSize: 40,
              color: FOG_MUTED,
              letterSpacing: -0.5,
            }}
          >
            The Summer Capital, in three dimensions.
          </span>
        </div>

        {/* Survey readout row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: FOG,
          }}
        >
          <span>16.4023° N</span>
          <span style={{ color: AMBER, margin: "0 18px" }}>·</span>
          <span>120.5960° E</span>
          <span style={{ color: AMBER, margin: "0 18px" }}>·</span>
          <span>1,500 M</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
