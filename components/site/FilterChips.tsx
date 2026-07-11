import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ChipOption {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

/** Link-based filter chips (server-rendered; state lives in the URL). */
export function FilterChips({
  options,
  label,
}: {
  options: ChipOption[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Link
          key={opt.href}
          href={opt.href}
          aria-current={opt.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
            opt.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {opt.label}
          {opt.count != null && (
            <span
              className={cn(
                "font-mono text-[11px]",
                opt.active ? "text-primary-foreground/80" : "text-muted-foreground/70",
              )}
            >
              {opt.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
