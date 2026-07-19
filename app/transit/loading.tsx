// Skeleton shown while the transit routes stream in — mirrors the heading, the
// route-card grid, and the taxi explainer so the layout doesn't shift on load.
export default function TransitLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20" aria-hidden>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <div className="h-9 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>

      {/* Route cards */}
      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-foreground/5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-6 w-14 animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="space-y-3 pl-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              ))}
            </div>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Taxi explainer */}
      <div className="mt-16 rounded-2xl border border-border bg-secondary/60">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            <div className="h-8 w-full max-w-md animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-10 w-56 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <div className="h-3 w-56 max-w-full animate-pulse rounded bg-muted" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between gap-4">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
