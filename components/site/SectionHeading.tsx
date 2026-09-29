import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  lede?: string;
  className?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
}

/** Section header: a display title with an optional lede. */
export function SectionHeading({
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
      <Heading className="font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
        {title}
      </Heading>
      {lede ? (
        <p className="text-base leading-7 text-muted-foreground text-pretty">{lede}</p>
      ) : null}
    </div>
  );
}
