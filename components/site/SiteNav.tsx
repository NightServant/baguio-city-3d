import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/map", label: "Map" },
  { href: "/destinations", label: "Destinations" },
  { href: "/history", label: "History" },
  { href: "/transit", label: "Transit" },
  { href: "/eat-stay", label: "Eat & Stay" },
] as const;

/** Small pine mark used in the wordmark. */
function PineMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z" />
    </svg>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Baguio 3D home">
          <PineMark className="size-5 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Baguio<span className="text-primary"> 3D</span>
          </span>
          <span className="readout mt-0.5 hidden text-muted-foreground lg:inline">
            ELEV 1500 M
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/map"
            className={cn(buttonVariants({ size: "sm" }), "ml-2 rounded-full px-4")}
          >
            Open the map
          </Link>
        </nav>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <PineMark className="size-4 text-primary" />
                  Baguio 3D
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {NAV_LINKS.map((link) => (
                  <SheetClose
                    key={link.href}
                    render={
                      <Link
                        href={link.href}
                        className="rounded-md px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <SheetClose
                  render={
                    <Link
                      href="/map"
                      className={cn(buttonVariants(), "mt-3 rounded-full")}
                    />
                  }
                >
                  Open the map
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
