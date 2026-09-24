"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import { cn } from "@/lib/utils";
import { PineMark } from "@/components/site/PineMark";

const NAV_LINKS = [
  { href: "/map", label: "Map" },
  { href: "/destinations", label: "Destinations" },
  { href: "/history", label: "History" },
  { href: "/transit", label: "Transit" },
  { href: "/eat-stay", label: "Eat & Stay" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Baguio 3D home">
          <PineMark className="size-5 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Baguio<span className="text-primary"> 3D</span>
          </span>
          <span className="readout mt-0.5 hidden text-muted-foreground lg:inline">
            1,500 m
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Button component={Link} href="/map" size="small" className="ml-2">
            Open the map
          </Button>
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden">
          <IconButton onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </IconButton>
          <Drawer
            anchor="right"
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            slotProps={{ paper: { sx: { width: 288 } } }}
          >
            <div className="flex items-center gap-2 px-4 py-4 font-display text-lg">
              <PineMark className="size-4 text-primary" />
              Baguio 3D
            </div>
            <div className="weave-band" aria-hidden="true" />
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "px-3 py-2.5 text-base font-medium transition-colors hover:bg-muted",
                      active ? "bg-muted text-foreground" : "text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <Button
                component={Link}
                href="/map"
                onClick={() => setMenuOpen(false)}
                className="mt-3"
              >
                Open the map
              </Button>
            </nav>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
