// Skeleton shown while the history timeline streams in — mirrors the centered
// heading and the era-by-era timeline so the layout doesn't shift on load.
export default function HistoryLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20" aria-hidden>
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      </div>

      <div className="mt-14 space-y-16">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            {/* Era header */}
            <div className="flex flex-col gap-3 border-b border-border pb-6">
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-muted" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            </div>

            {/* Events on the rule */}
            <div className="mt-8 space-y-8 border-l border-border pl-6 sm:pl-8">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex flex-col gap-2">
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-52 max-w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
