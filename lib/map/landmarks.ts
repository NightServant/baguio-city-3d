// Which landmark models to draw (ModelLayer.ts): those whose anchor is within `padDeg` of the view at near zoom (a
// landmark spans up to a few hundred metres, so its anchor can sit just off screen), plus the selected one at any
// zoom. Everything else leaves the draw list; its parsed model stays cached, so coming back is free.
export function landmarksInReach(
  entries: readonly { slug: string; lng: number; lat: number }[],
  view: { west: number; south: number; east: number; north: number } | null,
  selected: string | null,
  padDeg: number,
): Set<string> {
  const out = new Set<string>();
  for (const e of entries) {
    const inView = view !== null && e.lng >= view.west - padDeg && e.lng <= view.east + padDeg
      && e.lat >= view.south - padDeg && e.lat <= view.north + padDeg;
    if (inView || e.slug === selected) out.add(e.slug);
  }
  return out;
}
