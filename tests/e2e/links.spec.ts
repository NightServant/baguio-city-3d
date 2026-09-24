import { expect, test } from "@playwright/test";

test("every internal link resolves", async ({ request }) => {
  const seen = new Set<string>();
  const queue = ["/"];
  const broken: string[] = [];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await request.get(path);
    if (res.status() >= 400) {
      broken.push(`${res.status()} ${path}`);
      continue;
    }
    if (!(res.headers()["content-type"] ?? "").includes("text/html")) continue;
    for (const [, href] of (await res.text()).matchAll(/href="(\/[^"#]*)"/g)) {
      const clean = href.replaceAll("&amp;", "&");
      if (!clean.startsWith("/_next") && !seen.has(clean)) queue.push(clean);
    }
  }
  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(50);
});
