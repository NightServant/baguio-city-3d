import { timingSafeEqual } from "node:crypto";

/** The cron's `Authorization: Bearer <token>`: a token of at least 32 characters, both sides trimmed (a pasted
 *  trailing newline cost Clover its first run), compared in constant time. */
export function bearerOk(header: string | null, token: string | undefined): boolean {
  const t = (token ?? "").trim();
  if (t.length < 32 || !header) return false;
  const a = Buffer.from(header.trim()), b = Buffer.from(`Bearer ${t}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
