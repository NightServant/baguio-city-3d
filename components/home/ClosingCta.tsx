import { LinkButton } from "@/components/ui/LinkButton";
import { Ridgelines } from "./Ridgelines";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t-2 border-primary bg-secondary text-foreground dark:bg-card">
      <Ridgelines />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-40 pt-16 sm:px-6 sm:pb-48 sm:pt-20 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="max-w-[16ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
            See the hills before you climb them.
          </h2>
          <p className="mt-4 text-muted-foreground">Free, no account, and it works on your phone.</p>
        </div>
        {/* The homepage's only buttons (owner, 2026-09-29): one per action, here at the close. */}
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/map" size="large">
            Open the 3D map
          </LinkButton>
          <LinkButton href="/about#sources" size="large" variant="outlined">
            Read the sources
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
