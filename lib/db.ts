// Prisma 7 client singleton.
//
// Prisma 7's runtime client REQUIRES a driver adapter — the datasource URL no
// longer lives in schema.prisma (see prisma.config.ts). We construct the client
// lazily via a globalThis singleton so Next.js HMR in dev does not spawn a new
// connection pool on every reload.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
