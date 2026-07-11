// Route-level skeleton while the map page's server shell streams in.
export default function MapLoading() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-muted">
      {/* Preset chip bar */}
      <div className="absolute inset-x-0 top-3 flex justify-center px-3">
        <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-card/80" />
      </div>
      {/* Dock */}
      <div className="absolute left-3 top-3 hidden flex-col gap-1.5 sm:flex">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-xl bg-card/80" />
        ))}
      </div>
      {/* Canvas shimmer */}
      <div className="absolute inset-0 -z-10 animate-pulse bg-muted" />
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Raising the mountains…</p>
      </div>
    </main>
  );
}
