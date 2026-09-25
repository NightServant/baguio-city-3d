import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PINE =
  "M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#8C2318" }}>
        <svg width="118" height="118" viewBox="0 0 24 24">
          <path d={PINE} fill="#F5F0E6" />
        </svg>
      </div>
    ),
    size,
  );
}
