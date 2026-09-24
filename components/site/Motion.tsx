"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-driven motion, without a dependency.
 *
 * IntersectionObserver for reveals and a single rAF-throttled scroll listener
 * for parallax — rather than a library, because the whole motion vocabulary
 * here is four keyframes and a transform. Both honour prefers-reduced-motion
 * via the CSS in globals.css, and the observer disconnects once revealed so
 * it costs nothing after first paint.
 */

export function ScrollReveal({
  children,
  className,
  delay,
  variant = "fade",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: 1 | 2 | 3;
  variant?: "fade" | "weave";
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target); // one-shot: no cost after reveal
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(
        variant === "weave" ? "reveal-weave" : "reveal",
        delay === 1 && "reveal-delay-1",
        delay === 2 && "reveal-delay-2",
        delay === 3 && "reveal-delay-3",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Parallax layer. `speed` is a multiplier on scroll offset: negative rises,
 * positive sinks. Distant ridges should move less than near ones.
 */
export function ParallaxLayer({
  children,
  className,
  speed = -0.12,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      const rect = el.getBoundingClientRect();
      // Offset from viewport centre, so the layer is neutral when centred.
      const fromCentre = rect.top + rect.height / 2 - window.innerHeight / 2;
      el.style.setProperty("--p", String(fromCentre * speed));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed]);

  return (
    <div ref={ref} className={cn("parallax-layer", className)}>
      {children}
    </div>
  );
}
