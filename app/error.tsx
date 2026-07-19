"use client";

// Branded route-level error boundary. Minimal by design: a pine mark, a calm
// message, and a retry that re-renders the segment.
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { PineMark } from "@/components/site/PineMark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for observability; the UI stays calm regardless.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <PineMark className="size-7" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        The trail washed out
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Something went wrong loading this view. Fog on the ridge — give it another try.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
