import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}

/**
 * Section header. The eyebrow is a woven warp rule rather than a tracked mono
 * label — the band encodes "new section" structurally instead of decorating it.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
  align = "left",
  as: Heading = "h2",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl space-y-3",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <div className={cn("flex items-center gap-3", align === "center" && "justify-center")}>
          <span className="warp-rule w-10 shrink-0" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
        </div>
      ) : null}
      <Heading className="font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
        {title}
      </Heading>
      {lede ? (
        <p className="text-base leading-7 text-muted-foreground text-pretty">{lede}</p>
      ) : null}
    </div>
  );
}
