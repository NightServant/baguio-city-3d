import Link from "next/link";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";

export interface Crumb {
  name: string;
  path: string;
}

/** Trail from Home to the current page. The last crumb is the page itself, not a link. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const items: Crumb[] = [{ name: "Home", path: "/" }, ...trail];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {last ? (
                <span aria-current="page" className="text-foreground">{c.name}</span>
              ) : (
                <Link href={c.path} className="underline-offset-4 hover:text-foreground hover:underline">{c.name}</Link>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </nav>
  );
}
