"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const HIDDEN_ON = [/^\/map(\/|$)/, /^\/corrections(\/|$)/];

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}
const pastFirstScreen = () => window.scrollY > window.innerHeight * 0.6;

/** Phones only: once the visitor scrolls past the first screen, keep the map one tap away. */
export function StickyCta() {
  const pathname = usePathname();
  const shown = useSyncExternalStore(subscribe, pastFirstScreen, () => false);
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <div
      data-testid="sticky-cta"
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 md:hidden motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link href="/map" className="flex h-12 w-full items-center justify-center bg-primary text-base font-medium text-primary-foreground">
        Open the 3D map
      </Link>
    </div>
  );
}
