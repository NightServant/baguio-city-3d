"use client";

import { useEffect } from "react";

// Belt-and-braces for not-found.tsx: React 19 hoists a rendered <title> into
// <head>, but on hydration the root layout's own metadata title lands in
// <head> AGAIN, after this component's effect runs, and ends up first in
// tree order -- which wins document.title (verified in a real browser: a
// mount-only `document.title = ...` gets set correctly, then reverted a
// moment later by that second insertion). A MutationObserver re-asserts the
// title whenever the layout's insertion changes it back.
export function SetDocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
    const observer = new MutationObserver(() => {
      if (document.title !== title) document.title = title;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
