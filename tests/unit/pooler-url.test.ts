import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Supabase's transaction pooler (port 6543) renames prepared statements; Prisma must not prepare them there, or a
// failed DEALLOCATE aborts the transaction and every later statement fails (Clover, 2026). The template the owner copies
// into Vercel must carry the flag.
it("the pooled DATABASE_URL template turns prepared statements off", () => {
  const pooled = readFileSync(".env.example", "utf8").split("\n").filter((l) => /DATABASE_URL=.*:6543\//.test(l));
  expect(pooled.length).toBeGreaterThan(0);
  for (const l of pooled) expect(l).toMatch(/[?&]pgbouncer=true/);
});
