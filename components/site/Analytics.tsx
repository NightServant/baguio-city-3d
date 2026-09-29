"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

// GA4 in basic consent mode (ruling R7): the tag isn't loaded at all until the
// visitor allows it. The choice lives in localStorage, not a cookie.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "b3d-analytics-consent";
const EVENT = "b3d:consent-change";
type Choice = "granted" | "denied" | "unset";

// When storage throws (blocked, private window) the choice lives here for the
// rest of the page's life, so the banner can still be dismissed.
let memory: Choice | null = null;
// True once the tag has been mounted in this tab.
let gaLoaded = false;

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    memory = null;
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return memory ?? "unset";
  }
}

/** Tells gtag.js to stop sending hits from this page, even if it is already loaded. */
function disableGa() {
  if (GA_ID) (window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = true;
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    // key is null when storage was cleared wholesale.
    if (e.key !== null && e.key !== KEY) return;
    if (e.newValue !== "granted") {
      // Withdrawn in another tab: stop this tab's tag too.
      disableGa();
      if (gaLoaded) {
        location.reload();
        return;
      }
    }
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}
function write(choice: Choice) {
  try {
    if (choice === "unset") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
    memory = null;
  } catch {
    memory = choice;
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Expires every _ga* cookie on the host and on each parent domain, since gtag may have set it on any of them. */
function clearGaCookies() {
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);
  for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
    if (!name.startsWith("_ga")) continue;
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d}`;
  }
}

// Consent Mode defaults, queued before the tag's own config runs. gtag reads
// the dataLayer in order and needs an arguments object, hence the function.
const CONSENT_DEFAULTS = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});`;

function Tag({ id }: { id: string }) {
  useEffect(() => {
    gaLoaded = true;
  }, []);
  return (
    <>
      <Script id="ga-consent-default" strategy="afterInteractive">{CONSENT_DEFAULTS}</Script>
      <GoogleAnalytics gaId={id} />
    </>
  );
}

export function Analytics() {
  const choice = useSyncExternalStore(subscribe, read, () => "ssr" as const);
  if (!GA_ID || choice === "ssr" || choice === "denied") return null;
  if (choice === "granted") return <Tag id={GA_ID} />;

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
        // Before anything else, so no hit fires between here and the reload.
        if (wasGranted) disableGa();
        write("unset");
        if (!wasGranted) return;
        clearGaCookies();
        location.reload();
      }}
    >
      Cookie settings
    </button>
  );
}
