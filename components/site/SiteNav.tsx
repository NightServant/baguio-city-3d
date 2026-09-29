"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Drawer from "@mui/material/Drawer";
import { cn } from "@/lib/utils";
import { PineMark } from "@/components/site/PineMark";
import { ThemeToggle } from "@/components/site/ThemeToggle";

// History left the nav (ruling R3): it's linked from the homepage, from every
// destination with an era, and from the sitemap. The map isn't in the nav
// either. Owner rule (2026-09-29): each action gets one way in on a page, and
// the map's is in the page itself (the homepage hero, "Fly there on the map",
// "Estimate a real trip on the map"), never repeated in the chrome.
const NAV_LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/transit", label: "Jeepneys" },
  { href: "/eat-stay", label: "Eat & stay" },
] as const;

/** Three threads of unequal length: the weave's own menu glyph. */
function MenuGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Baguio 3D home">
          <PineMark className="size-5 text-primary" />
          <span className="font-display text-lg">
            Baguio<span className="text-primary"> 3D</span>
          </span>
          <span className="readout mt-0.5 hidden text-muted-foreground lg:inline">1,500 m</span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  "after:absolute after:inset-x-3 after:-bottom-[9px] after:h-0.5 after:bg-primary after:transition-transform motion-reduce:after:transition-none",
                  active ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center md:ml-2">
          <ThemeToggle />
        </div>

        <div className="md:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="flex size-10 items-center justify-center">
            <MenuGlyph />
          </button>
          <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)} slotProps={{ paper: { "aria-label": "Menu", sx: { width: 288 } } }}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 font-display text-lg">
                <PineMark className="size-4 text-primary" /> Baguio 3D
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex size-10 items-center justify-center text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="weave-band" aria-hidden="true" />
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn("px-3 py-3 text-base font-medium hover:bg-muted", isActive(link.href) && "bg-muted")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
