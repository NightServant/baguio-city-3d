import Link from "next/link";
import { Treeline } from "@/components/site/atmosphere";

const EXPLORE_LINKS = [
  { href: "/map", label: "3D map" },
  { href: "/destinations", label: "Destinations" },
  { href: "/history", label: "History" },
  { href: "/transit", label: "Jeepneys & fares" },
  { href: "/eat-stay", label: "Eat & Stay" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-16">
      <Treeline className="text-primary/70" />
      <div className="border-t border-border bg-secondary/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div className="space-y-3">
            <p className="font-display text-lg font-semibold tracking-tight">
              Baguio<span className="text-primary"> 3D</span>
            </p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              A field guide to the Summer Capital of the Philippines — pine
              forests, fog, heritage, and jeepney routes, mapped in three
              dimensions.
            </p>
            <p className="readout text-muted-foreground">
              16.4023° N · 120.5960° E · 1500 M
            </p>
          </div>
          <nav aria-label="Footer" className="space-y-3">
            <p className="readout text-muted-foreground">Explore</p>
            <ul className="space-y-2">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-3">
            <p className="readout text-muted-foreground">About the data</p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Places, routes, and history are curated from public sources.
              Jeepney and taxi fares are estimates in the LTFRB style — always
              confirm on board. Opening hours follow Asia/Manila time.
            </p>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Baguio 3D
            </p>
            <p className="readout text-muted-foreground">City of Pines · Est. 1909</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
