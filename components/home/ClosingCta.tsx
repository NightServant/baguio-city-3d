import { LinkButton } from "@/components/ui/LinkButton";
import { Ridgelines } from "./Ridgelines";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t-2 border-primary bg-secondary text-foreground dark:bg-card">
      <Ridgelines />
      {/* One column: the actions sit under the line they answer, not across an
          empty gap. These are the homepage's only buttons, one per action
          (owner, 2026-09-29): the map, then trust (sources), then repair. */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-40 pt-16 sm:px-6 sm:pb-48 sm:pt-20">
        <h2 className="max-w-[16ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
          See the hills before you climb them.
        </h2>
        <p className="mt-4 max-w-[46ch] leading-7 text-muted-foreground">
          Free, no account, and it works on your phone. Every source is listed, and anything wrong can be
          corrected.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LinkButton href="/map" size="large">
            Open the 3D map
          </LinkButton>
          <LinkButton href="/about#sources" size="large" variant="outlined">
            Read the sources
          </LinkButton>
          <LinkButton href="/corrections" size="large" variant="outlined">
            Suggest a correction
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
