import Link from "next/link";
import { Treeline } from "@/components/site/atmosphere";
import { PineMark } from "@/components/site/PineMark";
import { CONTACT_EMAIL } from "@/lib/site";

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
            <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
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
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Contact</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/corrections" className={link}>Suggest a correction</Link>
              </li>
              {CONTACT_EMAIL ? (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <p>© {new Date().getFullYear()} Baguio 3D</p>
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
