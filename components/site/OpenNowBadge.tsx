"use client";

// Open-now indicator computed on the client so statically prerendered pages
// still show a live answer. Renders the hours text on the server; the
// open/closed state appears after mount (Asia/Manila clock — Baguio, UTC+8).
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { OpeningHours } from "@/types/geo";

function manilaMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function computeOpen(hours: OpeningHours | null): boolean {
  if (!hours) return true;
  const now = manilaMinutes();
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (open === close) return true;
  if (close > open) return now >= open && now < close;
  return now >= open || now < close;
}

/** Ticks every minute, so long-lived tabs stay honest. */
function subscribeMinute(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

export function OpenNowBadge({
  hours,
  className,
}: {
  hours: OpeningHours | null;
  className?: string;
}) {
  // null on the server: the open/closed state appears after hydration
  const open = useSyncExternalStore(subscribeMinute, () => computeOpen(hours), () => null);

  const label = hours ? `${hours.open} to ${hours.close}` : "24 hours";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      {open !== null && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              open ? "bg-chart-5" : "bg-destructive/70",
            )}
          />
          <span className={open ? "text-foreground" : "text-destructive"}>
            {open ? "Open now," : "Closed,"}
          </span>
        </>
      )}
      {label}
    </span>
  );
}
