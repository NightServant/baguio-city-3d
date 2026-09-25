import { ImageResponse } from "next/og";

export const alt = "Baguio 3D, a 3D map of Baguio City with jeepney routes and places to eat and stay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BONE = "#F5F0E6";
const WARP = "#16130F";
const MADDER = "#8C2318";
const THREAD = "#6B6156";
const PINE =
  "M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BONE }}>
        {/* Warp edge: madder and warp threads, the site's structural motif. */}
        <div style={{ display: "flex", flexDirection: "column", width: 16, height: "100%" }}>
          {Array.from({ length: 21 }, (_, i) => (
            <div key={i} style={{ flex: 1, background: i % 3 === 1 ? WARP : MADDER }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "72px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path d={PINE} fill={MADDER} />
            </svg>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: WARP }}>
              Baguio<span style={{ color: MADDER, marginLeft: 10 }}>3D</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: WARP }}>Baguio City,</div>
            <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: WARP }}>mapped in 3D.</div>
            <div style={{ marginTop: 28, fontSize: 32, color: THREAD }}>
              Terrain, jeepney routes and places to eat and stay, on one map.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
