// Next.js 16 proxy (formerly middleware). Minimal pass-through stub.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Run on all paths except Next internals and common static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
