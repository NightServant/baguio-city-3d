/** A report's status page address is private to its reporter (app/corrections/status/[token]), so page views sent to
 *  Vercel Web Analytics carry the route, not the token. */
export function redactUrl(url: string): string {
  return url.replace(/\/corrections\/status\/[^/?#]+/, "/corrections/status/[token]");
}
