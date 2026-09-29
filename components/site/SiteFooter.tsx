import Link from "next/link";
import { Treeline } from "@/components/site/atmosphere";
import { PineMark } from "@/components/site/PineMark";
import { CONTACT_EMAIL } from "@/lib/site";
import { CookieSettingsLink } from "@/components/site/Analytics";

// Page links live in the nav, the homepage and the sitemap (ruling R2).
const LEGAL = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/about#sources", label: "Data sources" },
] as const;

const link = "text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline";

export function SiteFooter() {
  return (
    <footer>
      <Treeline className="text-primary/70" />
      {/* Bottom padding on phones leaves room for the sticky map button. */}
      <div className="border-t border-border bg-secondary/60 pb-20 md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-display text-lg">
              <PineMark className="size-4 text-primary" />
              <span>
                Baguio<span className="text-primary"> 3D</span>
              </span>
            </p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              A 3D map and field guide to Baguio City, free to use without an account.
            </p>
          </div>
          <nav aria-label="Legal" className="space-y-3">
            <h2 className="text-sm font-medium">Legal</h2>
            <ul className="space-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* "Suggest a correction" left the footer: its one button is in the
              homepage's closing section (owner, 2026-09-29). */}
          {CONTACT_EMAIL ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Contact</h2>
              <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>© {new Date().getFullYear()} Baguio 3D</span>
              <CookieSettingsLink className="underline underline-offset-4 hover:text-foreground" />
            </p>
            <p>
              Map data ©{" "}
              <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-4 hover:text-foreground">
                OpenStreetMap contributors
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
