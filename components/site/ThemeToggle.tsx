"use client";

import { useColorScheme } from "@mui/material/styles";

/**
 * Light or dark. The first visit follows the system setting; a choice made
 * here is remembered in localStorage by MUI, which also sets
 * `data-theme` on <html> before first paint (InitColorSchemeScript in the
 * root layout), so the page never flashes the wrong theme.
 */
export function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  // `mode` is undefined until MUI has read the stored choice on the client;
  // hold the space so the header doesn't shift.
  if (!mode) return <span className="size-10" aria-hidden="true" />;

  const current = mode === "system" ? systemMode : mode;
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      aria-label={`Switch to ${next} theme`}
      className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
    >
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        {current === "dark" ? (
          // Sun: the day cloth.
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M4.3 15.7l1.8-1.8M13.9 6.1l1.8-1.8" />
          </>
        ) : (
          // Moon: the indigo night.
          <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" />
        )}
      </svg>
    </button>
  );
}
