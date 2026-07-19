import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  className?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}

/** Editorial section header: mono eyebrow, Fraunces title, optional lede. */
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
      {eyebrow ? <p className="readout text-primary">{eyebrow}</p> : null}
      <Heading className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </Heading>
      {lede ? (
        <p className="text-base leading-7 text-muted-foreground text-pretty">{lede}</p>
      ) : null}
    </div>
  );
}
