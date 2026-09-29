"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

// GA4 in basic consent mode (ruling R7): the tag isn't loaded at all until the
// visitor allows it. The choice lives in localStorage, not a cookie.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "b3d-analytics-consent";
const EVENT = "b3d:consent-change";
type Choice = "granted" | "denied" | "unset";

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
function write(choice: Choice) {
  try {
    if (choice === "unset") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the banner simply asks again next visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function Analytics() {
  const choice = useSyncExternalStore(subscribe, read, () => "ssr" as const);
  if (!GA_ID || choice === "ssr" || choice === "denied") return null;
  if (choice === "granted") return <GoogleAnalytics gaId={GA_ID} />;

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 max-w-md border border-border bg-background p-4 md:bottom-6 md:left-6 md:right-auto"
    >
      <p className="text-sm leading-6">
        Can we count your visit with Google Analytics? It sets cookies, and nothing loads unless you say yes.{" "}
        <Link href="/privacy#analytics" className="text-primary underline underline-offset-4">What it records</Link>
      </p>
      <div className="mt-3 flex gap-3">
        <button type="button" onClick={() => write("granted")} className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Allow analytics
        </button>
        <button type="button" onClick={() => write("denied")} className="border border-border px-4 py-2 text-sm font-medium">
          No thanks
        </button>
      </div>
    </div>
  );
}

/**
 * Footer control to change the choice. If analytics had been allowed, its
 * cookies are cleared and the page reloads, so the tag is gone, not just hidden.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!GA_ID) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const wasGranted = read() === "granted";
        write("unset");
        if (!wasGranted) return;
        for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
          if (!name.startsWith("_ga")) continue;
          document.cookie = `${name}=; Max-Age=0; path=/`;
          document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
        }
        location.reload();
      }}
    >
      Cookie settings
    </button>
  );
}
