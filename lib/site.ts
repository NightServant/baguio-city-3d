// Site identity, and the one place the canonical origin is decided.

type Env = Partial<Record<string, string>>;

export function resolveSiteUrl(env: Env = process.env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  // Vercel sets this at build and run time to the project's production domain.
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Baguio 3D";

/** Empty until the owner provides one. The UI hides the link rather than show a fake. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

/** The promise printed next to the corrections form (Phase 0, D4). */
export const CORRECTIONS_RESPONSE_DAYS = 7;

/** Shorten text for meta descriptions at a word boundary. */
export function clip(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}
