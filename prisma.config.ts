// Prisma 7 configuration. Prisma 7 no longer auto-loads `.env`, so we load it
// here before `env()` is evaluated. See node_modules/prisma/config.d.ts.
import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    // Seed runs the TypeScript file directly via Node's native type stripping.
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection: Supabase's PgBouncer in
    // transaction mode can't run the DDL Migrate emits. Falls back to
    // DATABASE_URL for local Docker, where there is no pooler.
    url: env(process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"),
  },
});
