# Baguio 3D Site Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage as six sections (hero, proof, problem, solution, FAQ, CTA), slim the nav and footer, close every broken-link, mobile, SEO, security, legal and credibility gap found in the 2026-09-24 audit, then hand off to the photoreal 3D city build.

**Architecture:** Next.js 16 App Router, Server Components by default, client components only where the browser is needed (map, form state, consent, sticky CTA). Every requirement gets a test that fails first: Vitest for pure logic, Playwright for the rendered site (overflow, links, metadata, copy rules, consent). Data stays where it is: PostGIS on Supabase through the `baguio_app` role, with the committed GeoJSON as fallback.

**Tech Stack:** Next.js 16.2.10, React 19.2, TypeScript 5, Tailwind CSS 4, MUI 9, MapLibre GL 5.24, Prisma 7 + PostGIS (Supabase), Vitest, Playwright, `@next/third-parties` (GA4).

**Spec:** The user's brief of 2026-09-24 (homepage sections, nav/footer, and the broken-stuff / pages / SEO / trust / conversion / security / legal / design-tells checklist) plus the **Audit** and **Rulings** sections below, which turn that brief into findings against this repo. The 3D city spec is `docs/baguio-3d-model-plan.md` (Phase 9).

## Global Constraints

- **Next.js 16.2.10.** Before using any Next API, read the matching guide in `node_modules/next/dist/docs/` (AGENTS.md rule). Middleware is `proxy.ts` in this version. `robots.ts`, `sitemap.ts`, `opengraph-image.tsx`, `icon.svg`, `apple-icon.tsx` are metadata file conventions (`01-app/03-api-reference/03-file-conventions/01-metadata/`).
- **New dependencies allowed:** `vitest` (dev), `@playwright/test` (dev), `@next/third-parties`. Nothing else without a new ruling. `swiper` and `three` stay: the carousel and the wireframe are kept with new jobs (R4, R5).
- **Palette:** bone `#F5F0E6`, warp `#16130F`, madder `#8C2318`, ecru `#E8DFD0`, thread `#6B6156`. **No green anywhere** (user rule, 2026-09-22). Radius token `0.125rem`. No `rounded-lg/xl/2xl/3xl` on any surface; `rounded-full` only on dots and circles.
- **Type:** Archivo (display at `wdth` 125 via `.font-display`, body at 100). Geist Mono only for measured values: m, °, ₱, km, times.
- **Copy:** sentence case. No em dashes, no ` · ` meta strings, no arrow glyphs (→ ←) and no arrow icons on CTAs, no eyebrow label above headings. Enforced by the copy gate (Task 27).
- **Motion:** the weave band draws once under the hero. Two scroll-linked effects stay because they carry meaning (R5, R10): the Problem wireframe rises from flat to real relief, and the ridgelines behind the closing CTA drift at depth-true rates. Everything else answers a user action. All of it holds still under `prefers-reduced-motion`; WebGL stops drawing when offscreen.
- **Truth rule:** every number, claim, review, photo, phone number or email on the site traces to data in this repo, a cited source, or the user. Never invent any of them. If it can't be sourced, it doesn't ship.
- **Mobile floor:** 360 px wide, no horizontal page scroll (gate: Task 2).
- **Supabase free tier pauses when idle.** Before any task that touches the database, run the Supabase MCP `get_project` for the project and `restore_project` if `status` isn't `ACTIVE_HEALTHY`.
- **Pre-existing lint:** `components/map/MapView.tsx` has 3 `react-hooks/refs` errors on the `MapLayers` mount expression. Out of scope; don't count them against a task, don't add new ones.

---

## Phase 0: decisions only the owner can make

Each has a default so no task blocks. Record answers in the ledger (see Execution notes).

| # | Decision | Default if unanswered | Used by |
|---|---|---|---|
| D1 | Production URL | `VERCEL_PROJECT_PRODUCTION_URL` (Vercel system variable), `http://localhost:3000` in dev | Tasks 3, 11, 12, 17 |
| D2 | Contact email | Contact link hidden until `NEXT_PUBLIC_CONTACT_EMAIL` is set | Tasks 16, 19 |
| D3 | GA4 measurement ID | Analytics code ships dormant until `NEXT_PUBLIC_GA_ID` is set | Task 28 |
| D4 | Response time you'll commit to for correction reports | 7 days | Tasks 15, 26 |
| D5 | Is `github.com/NightServant/baguio-city-3d` public? | Don't link it | Task 16 (about page) |
| D6 | Were place descriptions drafted with AI help? | Ask. If yes, the privacy and about pages say so; if no, the sentence is removed | Task 16 |
| D7 | Hosting provider named in the privacy policy | Vercel | Task 16 |

---

## Audit: what's actually there (measured 2026-09-24)

Everything below was checked in this repo, the running app, or the live Supabase project. "Pass" rows need no task.

### Broken stuff and basic function

| ID | Finding | Evidence | Task |
|---|---|---|---|
| A1 | **Horizontal scroll on the homepage on phones.** At 375 px, `scrollWidth` is 407 against a 360 px viewport. Root cause: the Transit + Eat grid (`app/page.tsx`, `grid gap-12 lg:grid-cols-2`) keeps the default `min-width: auto` on its items, and route rows use `truncate`, so the longest route name sets the track width. | Playwright offender scan, unclipped ancestors only | 2 |
| A2 | Internal links: 114 URLs crawled from `/`, **0 non-200**. `/map?dest=`, `?route=`, `?venue=` return 200 by design (resolved client-side). | stdlib crawler | gate in 2 |
| A3 | Buttons: every `<button>`, `<Button>`, `<IconButton>` in `app/` and `components/` has `onClick`, `type="submit"` or is a link. **No dead buttons.** | JSX tag scan | Pass |
| A4 | Mobile menu exists (MUI Drawer) and works. It lists both "Map" and "Open the map", which go to the same place. | Playwright | 18 |
| A5 | Logo links home (`aria-label="Baguio 3D home"`). | source + Playwright | gate in 2 |
| A6 | **No phone numbers or email addresses exist** anywhere: not in the UI, not in the venue data (`VenueProperties` has no contact fields). Venue phones would need real sourcing and are out of scope; none will be invented. | grep `tel:`/`mailto:`, `types/venue.ts` | 19 (site email only) |
| A7 | Placeholder: `metadataBase: new URL("https://baguio3d.example")` (`app/layout.tsx:32`) makes every absolute OG and canonical URL point at a fake domain. Five unused create-next-app SVGs sit in `public/`. No lorem ipsum. | grep | 3 |
| A8 | **Unsupported claims in UI copy:** "live routes" (`app/page.tsx:304`; routes are static seed data). "The whole plateau" (same line; contradicts the product's own premise). Taxi flag-down ₱45 (`lib/geo/fare.ts:7`) unverified. Jeepney ₱13 + ₱1.80/km shown with no source or date. Route codes `PLZ-*` look official and are internal IDs. Burnham Park description says "1904 city plan"; the 3D spec's source gives 1905. | grep, data | 3, 5, 27 |
| A9 | **Destination elevations are wrong.** Against the terrain DEM: mean error 53 m, worst 441 m (BenCab Museum shows 1,420 m, terrain says 979 m), 7 of 22 off by more than 50 m. Shown on cards, detail pages and the map sheet. | `scripts/baguio-dem-probe.py`, 3D spec §3c | 4 |

### Pages and structure

| ID | Finding | Task |
|---|---|---|
| B1 | A branded 404 exists, but its `<title>` is the homepage's title, and it still uses the pre-weave styling (`rounded-2xl`, `rounded-full`). | 14 |
| B2 | No form of any kind, so no thank-you page. | 15 |
| B3 | No breadcrumbs. The detail page has an "All destinations" back link only. | 12 |
| B4 | Detail pages link nearby venues and the history page. Nothing links nearby destinations or the jeepney that serves the place. | 13 |
| B5 | `/privacy`, `/terms`, `/about` all return 404. | 16 |

### SEO

| ID | Finding | Task |
|---|---|---|
| C1 | Titles are unique except 404 (duplicates home). Home has no page-level description. No canonical URL anywhere. Title template and default use an em dash. | 11, 14 |
| C2 | `/robots.txt` and `/sitemap.xml` return 404. | 17 |
| C3 | Favicon exists, but `app/icon.svg` and `app/apple-icon.tsx` use `#1e4d3a` pine green, the retired palette. `app/opengraph-image.tsx` uses `#14352a` green, amber `#e0a84f` and Georgia. Every share preview shows the old brand. | 10 |
| C4 | No structured data. **LocalBusiness doesn't apply:** Baguio 3D isn't a business with premises. Use WebSite, TouristAttraction and BreadcrumbList. | 12 |
| C5 | Images: one `<img>` in the whole app (map sheet media, alt from the DB; the media table has 0 rows). Nothing raster to compress yet. The homepage ships three.js and a 62 KB heightmap on first paint for a decorative hero wireframe; Task 24 moves the wireframe to the Problem section and loads both only when that section nears the viewport. New posters (Task 22) are budgeted at 250 KB each. | 22, 24 |

### Security

| ID | Finding | Task |
|---|---|---|
| D1 | Secrets: the full git history was scanned. The only credential is the local docker default `baguio:baguio@localhost` in `.env.example`, which is dev-only. `.env`, `.env.local-docker.bak` and `supabase/roles.sql` are gitignored and were never committed. No secrets in `NEXT_PUBLIC_*`. | Pass |
| D2 | **Supabase:** app tables have RLS on and a single SELECT policy for `baguio_app`, so `anon` is blocked. **But `public.spatial_ref_sys` has RLS off and `anon` holds INSERT, UPDATE and DELETE on it**, and three SECURITY DEFINER `st_estimatedextent` overloads are executable by `anon` (advisor lints 0013, 0028, 0029). Anyone with the project's anon key could rewrite SRID definitions through the Data API and break every spatial transform. The app never uses the Data API. | 7 |
| D3 | 0 storage buckets, 0 auth users, no auth code. All API routes are public GETs of public data, which is correct: nothing should require auth. | Pass |
| D4 | SQL is parameterized everywhere (`Prisma.sql`). Gaps: no length or shape checks on `q`, `cursor`, `slug`, `id`, `routeCode`; fare coordinates unbounded; `cacheAside` caches `null`, so requests for random slugs grow Redis without limit. | 8 |
| D5 | No security headers. `proxy.ts` is a no-op that runs on every page request. | 3, 9 |

### Legal and compliance

| ID | Finding | Task |
|---|---|---|
| E1 | No privacy policy. Real data flows today (from code): map tiles load from the visitor's browser straight to `tiles.openfreemap.org`, `s3.amazonaws.com` (terrain) and, in satellite mode, `server.arcgisonline.com`, so each receives the visitor's IP address. Fonts are self-hosted by `next/font`. No cookies, no localStorage, no geolocation. | 16 |
| E2 | No AI runs on the site. Content authorship is D6. | 16 |
| E3 | Uploads, accounts, subscriptions, auto-renewal, AI chat: **none exist** (0 buckets, 0 auth users, no billing code, no chat). Not applicable. Standing rule for later: an AI chat, if ever added, must answer self-harm messages with a safe-messaging response and Philippine crisis contacts (NCMH Crisis Hotline 1553; verify current numbers at launch) before anything else. | none |
| E4 | GA4 will be the first thing on the site that sets cookies. Needs consent and disclosure. | 28 |

### Trust and content

| ID | Finding | Task |
|---|---|---|
| F1 | No reviews or testimonials exist, so none look fake. **None will be written** (R1). | 23 |
| F2 | Case studies: not a services business. Not applicable. | none |
| F3 | No about page, no photos, no named team. The about page ships without a photo; a real one slots in if provided. | 16 |
| F4 | Copyright renders `© 2026` from `new Date().getFullYear()`. Pass (the year refreshes on every deploy). | Pass |
| F5 | No FAQ. | 26 |

### Conversion

| ID | Finding | Task |
|---|---|---|
| G1 | Main CTA is above the fold on desktop. Mobile checked by a gate. | 23 |
| G2 | No sticky CTA on mobile. | 20 |
| G3 | No forms, so no silent failures yet. The one new form gets explicit success and error states. | 15 |
| G4 | No analytics. | 28 |

### Design tells (verdicts)

| ID | Tell | Verdict | Task |
|---|---|---|---|
| H1 | Gradients | Hero wash (`bg-gradient-to-b`, `app/page.tsx:77`) and blurred fog blobs (`FogBank`). Remove. | 23, 26 |
| H2 | Glassmorphism | Nav is `bg-background/80 backdrop-blur-md`. Remove. Map HUD panels keep translucency: they sit over a live map, where seeing through is the point. | 18 |
| H3 | "Pill" labels above headlines | `SectionHeading` puts a warp rule + label above every section heading. This is the tell. Remove the `eyebrow` prop. | 27 |
| H4 | Generic rounded cards | Leftovers on the home transit/eat lists, transit page, detail page (`rounded-xl`), 404, error page, loading skeletons, map sheet. Square them. | 14, 26, 27 |
| H5 | Bento grid | Hero four-cell stat grid. Goes with the hero rewrite. | 23 |
| H6 | Lucide defaults | 14 files. Map HUD keeps them (functional). Marketing pages lose the arrow icons on CTAs (3 places) and the menu icon. | 18, 27 |
| H7 | Fade-up on scroll | 17 `ScrollReveal`/`ParallaxLayer` uses on the homepage. Fade-ups: keep one (weave band). Parallax: kept by owner decision, moved behind the closing CTA (R10). | 23–26 |
| H8 | Hover with nothing behind it | `VenueCard` highlights on hover but the card isn't a link. `DestinationCard` already uses a stretched link (pass). | 6 |
| H9 | Space Grotesk as the only font | Not used. Archivo + Geist Mono. Pass. | none |
| H10 | Vague hero | "The Summer Capital, in three dimensions." is atmosphere, not a statement of what the site does. | 23 |
| H11 | No live product demo | The hero wireframe is decorative. Nothing on the homepage is the product. The fix: the live map in Solution, steered by the carousel. | 22, 25 |
| H12 | Text-only logo | Pine mark + wordmark. Pass. Favicon in the retired green: Task 10. | 10 |
| H13 | Default Vercel/Lovable URL or badge | No badge. Unused create-next-app SVGs in `public/`. | 3 |
| H14 | Fake-looking numbers | Hero counts (22, 6, 30, 4) are real but read as vanity metrics. Wrong elevations (A9). Unsourced fares (A8). Five of six routes have exactly 5 stops, which looks templated: label routes approximate. | 4, 5, 23 |
| H15 | Em dashes / cursive fonts | Em dashes in homepage copy (6), footer (2), metadata; ` · ` in 6 UI strings; "→" in transit copy. No cursive fonts. | 11, 19, 27 |

---

## Rulings (with the cost if wrong)

- **R1 Proof is sources and measurements, not testimonials.** None exist; inventing them is forbidden. *Cost if wrong:* none. Real ones can be added when they exist.
- **R2 Footer drops the page list** (per the brief). Pages stay reachable through the nav, the homepage sections, in-page links and `sitemap.xml`. *Cost:* restore one array.
- **R3 Nav = Destinations, Jeepneys, Eat & stay, plus "Open the 3D map".** "Map" duplicated the CTA. History leaves the nav; it's linked from the homepage Solution section, every destination page with an era, and the sitemap. *Cost:* one line.
- **R4 The coverflow carousel stays, as the live map's controller** (owner decision, 2026-09-24). In Solution, each place a visitor lands on, the map flies to. Its legibility problems (screenshot 4) are fixed at the cause: slides carry only a name and a measured height, and the arrows move below the slides. It also gains the Swiper `A11y` module it was missing, which is what gives its arrows a button role and a label. *Cost if wrong:* none; it's opt-in motion driven by the visitor.
- **R5 The hero shows a real still of the map; the wireframe moves to the Problem section** (owner decision, 2026-09-24, to keep it). There it starts as a flat grid, "a flat map", and rises into Baguio's real relief as the section scrolls in. It's no longer decoration; it's the section's argument. The hero's largest paint stays an image rather than WebGL, and the wireframe with its 62 KB heightmap loads only when the Problem section is about to scroll into view, then stops drawing when offscreen. *Cost if wrong:* two WebGL contexts can be alive at once (wireframe + live map) on phones; Task 26 checks for context loss.
- **R10 Parallax stays, behind the closing CTA** (owner decision, 2026-09-24). The three ridgelines that sat behind the history teaser now rise behind "See the hills before you climb them.", far ridge slowest. This overrides the audit's fade-up/parallax tell (H7) for this one use; the fade-up reveals still go. *Cost if wrong:* none; it holds still under reduced motion.
- **R11 The Problem visual is the rising wireframe, not a separate relief chart.** The earlier draft drew a 2D relief strip; with the wireframe carrying the argument, a second chart would repeat it. The destination heights stay available to screen readers as a table in the same figure. *Cost if wrong:* the strip can be added back under the wireframe from `lib/relief.ts`.
- **R6 A corrections form, not a mailto link.** The brief asks for a thank-you page, success and error states, and a response-time promise; a form is the only way to have them. Stored in Supabase (no email service, no new dependency). Rate limiting is one global hourly cap, so **no IP addresses are stored**. *Cost:* a spammer can exhaust the hourly cap; upgrade to per-client limits if that happens.
- **R7 GA4 in basic consent mode.** The tag doesn't load at all until the visitor allows it: the most privacy-preserving way to meet "set up Google Analytics". Cookieless alternative with no banner: Vercel Web Analytics, a one-component swap. *Cost:* fewer counted visits than an always-on tag.
- **R8 CSP ships report-only.** Enforcing it without checking reports risks blanking the map (MapLibre `blob:` workers, three tile hosts, inline styles from Emotion and MapLibre). *Cost:* no XSS protection from CSP until promoted.
- **R9 FAQ uses native `<details>`; no FAQPage JSON-LD.** Google limits FAQ rich results to government and health sites, so the markup would do nothing here. *Cost:* none.

---

## Execution notes

- **Branch:** create `feat/site-overhaul` from `design/cordillera-weave` (which carries the weave identity and is ahead of `main`). Merge to `main` only after Phase 10.
- **Ledger:** keep `docs/superpowers/plans/2026-09-24-ledger.md`, append-only: decisions (D1–D7), rulings made during execution with their cost if wrong, deferred findings, and each task's commit range.
- **Order:** Phase 1 gates first, so every later change is checked. Dependencies: Task 4 before 24 (the Problem section's numbers come from corrected elevations); Task 5 before 16 and 23 (fare source); Tasks 15–16 before 19 (footer links to them); Task 21 before 22; Task 12 before 13.
- **Running e2e:** `npm run test:e2e` builds and starts production with test env values (see `playwright.config.ts`). To iterate against a running dev server instead: `E2E_BASE_URL=http://localhost:3000 npm run test:e2e`. The GA and contact-email tests need the default production run.
- **Commit messages** end with the attribution line the harness supplies.

---

## File map

**Create**

| Path | Responsibility |
|---|---|
| `vitest.config.mts`, `playwright.config.ts` | Test runners |
| `tests/unit/*.test.ts` | Pure-logic tests |
| `tests/e2e/routes.ts`, `tests/e2e/*.spec.ts` | Rendered-site gates; `*.mobile.spec.ts` run on the phone profile |
| `lib/site.ts` | Canonical origin, site name, contact email, response-time promise, `clip()` |
| `lib/validate.ts` | API input validators |
| `lib/nearby.ts` | Nearest-N by distance |
| `lib/jsonld.ts`, `components/site/JsonLd.tsx` | Structured data, safely serialized |
| `components/site/Breadcrumbs.tsx` | Breadcrumb trail + BreadcrumbList |
| `lib/corrections.ts` | Pure parsing and validation for the corrections form |
| `lib/sources.ts` | Data sources and the measured OSM building count |
| `lib/relief.ts` | Heights and distances for the Problem section |
| `lib/map/sources.ts` | Basemap styles, DEM source, terrain setup (extracted from `MapView`) |
| `components/home/*.tsx` | `Hero`, `Proof`, `Problem`, `LazyTerrain` (wireframe, loaded near view), `Solution`, `TerrainTour` (carousel steering the map), `MapDemo`, `Faq`, `Ridgelines` (parallax), `ClosingCta` |
| `components/site/StickyCta.tsx`, `components/site/Analytics.tsx` | Mobile CTA bar; GA4 consent |
| `app/robots.ts`, `app/sitemap.ts` | Crawler files |
| `app/(legal)/layout.tsx`, `app/(legal)/privacy/page.tsx`, `app/(legal)/terms/page.tsx`, `app/about/page.tsx` | Legal and about pages |
| `app/corrections/page.tsx`, `CorrectionForm.tsx`, `actions.ts`, `thanks/page.tsx` | Corrections flow |
| `scripts/fix-elevations.py`, `scripts/capture-map-posters.mjs` | One-off data and asset scripts |
| `supabase/migrations/20260924090000_correct_destination_elevations.sql` | Elevation fix |
| `supabase/migrations/20260924090100_revoke_data_api_roles.sql` | Data API lockdown |
| `supabase/migrations/20260924090200_corrections.sql`, `prisma/migrations/20260924090200_corrections/migration.sql` | Corrections table |
| `public/home/hero-map.jpg`, `public/home/demo-map.jpg` | Map posters |

**Modify (kept with new jobs):** `components/site/TerrainCanvas.tsx` (rise on scroll, pause offscreen), `components/site/DestinationCarousel.tsx` (reports the active place, A11y module, compact slides), `.baguio-swiper` CSS (arrows below slides). `ParallaxLayer` and `public/baguio-heightmap.json` are reused unchanged.

**Delete:** `proxy.ts`; `public/{file,globe,next,vercel,window}.svg`; `FogBank`, `FogIcon`, `PineIcon` if nothing uses them after the rewrite.

---

## Phase 1: gates first

### Task 1: Test harness

**Files:**
- Create: `vitest.config.mts`, `playwright.config.ts`, `tests/unit/fare.test.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**
- Produces: `npm test` (Vitest, `tests/unit/**/*.test.ts`), `npm run test:e2e` (Playwright, projects `desktop` and `mobile`; files ending `.mobile.spec.ts` run only on `mobile`). `@/` resolves to the repo root in both.

- [ ] **Step 1: Install**

```bash
npm i -D vitest @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write the runner configs**

`vitest.config.mts`:
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

// Test-only values baked into the production build the suite starts. The
// .test TLD is reserved, so this address can never reach a real inbox.
const TEST_ENV = {
  NEXT_PUBLIC_GA_ID: "G-TEST000000",
  NEXT_PUBLIC_CONTACT_EMAIL: "hello@example.test",
};

const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  use: { baseURL: external ?? "http://localhost:3000" },
  webServer: external
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 400_000,
        env: TEST_ENV,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /\.mobile\.spec\.ts$/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /\.mobile\.spec\.ts$/ },
  ],
});
```

`package.json` scripts, add:
```json
"test": "vitest run",
"test:e2e": "playwright test"
```

`.gitignore`, append:
```
# test runners
/test-results/
/playwright-report/
```

- [ ] **Step 3: Write a characterization test for existing fare logic**

`tests/unit/fare.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { haversineKm, jeepneyFare } from "@/lib/geo/fare";

describe("jeepneyFare", () => {
  it("charges only the base fare inside the first 4 km", () => {
    expect(jeepneyFare(3.2, 13, 1.8).fare).toBe(13);
  });
  it("adds the per-km rate beyond 4 km", () => {
    expect(jeepneyFare(6, 13, 1.8).fare).toBe(16.6);
  });
});

describe("haversineKm", () => {
  it("puts Burnham Park about 3.8 km from Mines View Park", () => {
    expect(haversineKm([120.5936, 16.4116], [120.628, 16.4201])).toBeCloseTo(3.79, 1);
  });
});
```

- [ ] **Step 4: Write the e2e smoke test**

`tests/e2e/smoke.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("home renders its heading", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toBeVisible();
});
```

- [ ] **Step 5: Run both**

Run: `npm test` → Expected: 3 passed.
Run: `npm run test:e2e -- --project=desktop` → Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.mts playwright.config.ts tests .gitignore
git commit -m "Add Vitest and Playwright with a fare characterization test"
```

---

### Task 2: Regression gates, and the homepage overflow fix

**Files:**
- Create: `tests/e2e/routes.ts`, `tests/e2e/overflow.spec.ts`, `tests/e2e/links.spec.ts`, `tests/e2e/nav.spec.ts`, `tests/e2e/nav.mobile.spec.ts`
- Modify: `app/page.tsx` (Transit + Eat section)

**Interfaces:**
- Produces: `PAGES` in `tests/e2e/routes.ts`, the list every page-level gate iterates. **Every task that adds a public page appends it here.**

- [ ] **Step 1: Write the gates**

`tests/e2e/routes.ts`:
```ts
/** Every public, indexable page. Tasks that add a page append it here. */
export const PAGES: string[] = [
  "/",
  "/map",
  "/destinations",
  "/destinations/burnham-park",
  "/eat-stay",
  "/history",
  "/transit",
];
```

`tests/e2e/overflow.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

for (const width of [360, 375, 414]) {
  for (const path of PAGES) {
    test(`${path} has no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800); // let fonts and client layout settle
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  }
}
```

`tests/e2e/links.spec.ts`:
```ts
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
```

`tests/e2e/nav.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("the logo goes home", async ({ page }) => {
  await page.goto("/destinations");
  await page.getByRole("link", { name: "Baguio 3D home" }).click();
  await expect(page).toHaveURL("/");
});
```

`tests/e2e/nav.mobile.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("the mobile menu opens and lists the primary pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile" });
  await expect(menu.getByRole("link", { name: "Destinations" })).toBeVisible();
});
```

- [ ] **Step 2: Run them and watch the overflow gate fail**

Run: `npm run test:e2e`
Expected: FAIL on `/ has no horizontal scroll at 360px`, `375px` and `414px` (scroll ≈ 407–460 > client). Everything else passes.

- [ ] **Step 3: Fix the root cause**

In `app/page.tsx`, the Transit + Eat section: grid items need `min-width: 0` so `truncate` can truncate instead of widening the track. Change the two column wrappers:

```tsx
          {/* Transit teaser */}
          <ScrollReveal className="min-w-0">
```
```tsx
          {/* Eat & Stay teaser */}
          <ScrollReveal delay={1} className="min-w-0">
```

(This section is replaced in Task 25; the gate keeps any replacement honest.)

- [ ] **Step 4: Run again**

Run: `npm run test:e2e`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e app/page.tsx
git commit -m "Gate overflow, links and nav; fix homepage horizontal scroll on phones"
```

---

## Phase 2: broken stuff and bad data

### Task 3: Real site origin; remove placeholders, false claims and dead weight

**Files:**
- Create: `lib/site.ts`, `tests/unit/site.test.ts`
- Modify: `app/layout.tsx:32`, `app/page.tsx:304`, `.env.example`
- Delete: `proxy.ts`, `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

**Interfaces:**
- Produces: `SITE_URL: string` (no trailing slash), `resolveSiteUrl(env)`, `SITE_NAME = "Baguio 3D"`, `CONTACT_EMAIL: string` (empty when unset), `CORRECTIONS_RESPONSE_DAYS: number`, `clip(text: string, max?: number): string`.

- [ ] **Step 1: Write the failing test**

`tests/unit/site.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { clip, resolveSiteUrl } from "@/lib/site";

describe("resolveSiteUrl", () => {
  it("prefers the explicit site URL and trims trailing slashes", () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://baguio.example/" })).toBe("https://baguio.example");
  });
  it("falls back to the Vercel production domain", () => {
    expect(resolveSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "baguio-3d.vercel.app" })).toBe("https://baguio-3d.vercel.app");
  });
  it("uses localhost when nothing is configured", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("clip", () => {
  it("leaves short text alone", () => {
    expect(clip("Pine trees.", 155)).toBe("Pine trees.");
  });
  it("cuts at a word boundary and marks the cut", () => {
    const out = clip("The green heart of Baguio, laid out around a man-made lagoon", 30);
    expect(out).toBe("The green heart of Baguio…");
    expect(out.length).toBeLessThanOrEqual(31);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- tests/unit/site.test.ts` → Expected: FAIL, cannot resolve `@/lib/site`.

- [ ] **Step 3: Implement `lib/site.ts`**

```ts
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
```

- [ ] **Step 4: Use it, and remove the placeholder domain**

`app/layout.tsx`: add `import { SITE_URL } from "@/lib/site";` and replace line 32 with:
```ts
  metadataBase: new URL(SITE_URL),
```

`.env.example`, append:
```
# Canonical origin for share links, canonical tags and the sitemap. Leave unset
# on Vercel: VERCEL_PROJECT_PRODUCTION_URL is used automatically.
# NEXT_PUBLIC_SITE_URL="https://your-domain"

# Shown in the footer and privacy policy. Hidden while unset.
# NEXT_PUBLIC_CONTACT_EMAIL=""

# Google Analytics 4 measurement ID. Analytics stays off while unset.
# NEXT_PUBLIC_GA_ID=""
```

- [ ] **Step 5: Remove the false claim**

`app/page.tsx:304`, replace the paragraph text:
```tsx
            Terrain, landmarks and jeepney routes, all on one map.
```

- [ ] **Step 6: Delete dead weight**

`proxy.ts` returns `NextResponse.next()` for every page request and does nothing else. Nothing imports it.
```bash
grep -rn "proxy" app components lib --include='*.ts' --include='*.tsx'   # expect no import of ./proxy
git rm proxy.ts public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

- [ ] **Step 7: Verify**

Run: `npm test` → PASS. Run: `npx tsc --noEmit` → no output. Run: `npm run test:e2e` → PASS (links gate confirms nothing pointed at the deleted files).

- [ ] **Step 8: Commit**

```bash
git add -A lib/site.ts tests/unit/site.test.ts app/layout.tsx app/page.tsx .env.example
git commit -m "Resolve the real site origin; drop the placeholder domain, a false claim and dead files"
```

---

### Task 4: Correct destination elevations from the terrain model

**Files:**
- Modify: `scripts/baguio-dem-probe.py` (guard its survey block), `data/geojson/landmarks.geojson` (generated)
- Create: `scripts/fix-elevations.py`, `tests/unit/elevations.test.ts`, `supabase/migrations/20260924090000_correct_destination_elevations.sql` (generated)

**Interfaces:**
- Consumes: `elevation(lon, lat, z)` from `scripts/baguio-dem-probe.py` (returns metres from AWS Terrarium).
- Produces: `elevation_m` values that later tasks (Problem section, Proof, JSON-LD) treat as measured.

- [ ] **Step 1: Write the failing test**

`tests/unit/elevations.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Feature = { properties: { slug: string; elevation_m: number | null } };
const features: Feature[] = JSON.parse(readFileSync("data/geojson/landmarks.geojson", "utf8")).features;
const elevation = (slug: string) => features.find((f) => f.properties.slug === slug)?.properties.elevation_m;

// Terrain DEM at z15, measured 2026-09-22 (docs/baguio-3d-model-plan.md §3c).
const MEASURED: Record<string, number> = {
  "bencab-museum": 979,
  "burnham-park": 1442,
  "good-shepherd-convent": 1550,
  "session-road": 1449,
  "camp-john-hay": 1503,
  "mines-view-park": 1523,
};

describe("destination elevations", () => {
  for (const [slug, dem] of Object.entries(MEASURED)) {
    it(`${slug} is within 20 m of the terrain model`, () => {
      expect(Math.abs((elevation(slug) ?? Infinity) - dem)).toBeLessThanOrEqual(20);
    });
  }
  it("every destination has an elevation inside Baguio's real range", () => {
    for (const f of features) {
      expect(f.properties.elevation_m, f.properties.slug).toBeGreaterThan(850);
      expect(f.properties.elevation_m, f.properties.slug).toBeLessThan(1700);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -- tests/unit/elevations.test.ts`
Expected: FAIL, `bencab-museum` (1420 vs 979).

- [ ] **Step 3: Make the probe importable**

`scripts/baguio-dem-probe.py` runs its survey at import time. Indent everything from the line `POINTS = [` to the end of the file under a main guard:
```python
if __name__ == "__main__":
    POINTS = [
        ...  # existing lines, indented one level
```
Check: `python3 scripts/baguio-dem-probe.py` still prints the same table.

- [ ] **Step 4: Write the fixer**

`scripts/fix-elevations.py`:
```python
"""Resample every destination's elevation_m from the AWS Terrarium DEM (the
terrain the map renders) and write a matching Supabase migration.

The seed values clustered in 1,400-1,540 m while real terrain across the map
spans roughly 910-1,667 m; BenCab Museum was 441 m too high.

Usage: python3 scripts/fix-elevations.py
"""
import importlib.util
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("probe", ROOT / "scripts" / "baguio-dem-probe.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

GEO = ROOT / "data" / "geojson" / "landmarks.geojson"
MIGRATION = ROOT / "supabase" / "migrations" / "20260924090000_correct_destination_elevations.sql"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")

text = GEO.read_text()
sql = [
    "-- elevation_m resampled from the AWS Terrarium DEM at z15 by scripts/fix-elevations.py.",
]
doc = json.loads(text)
for feature in doc["features"]:
    slug = feature["properties"]["slug"]
    assert SLUG.fullmatch(slug), f"unexpected slug {slug!r}"
    lng, lat = feature["geometry"]["coordinates"]
    new = round(probe.elevation(lng, lat, z=15))
    old = feature["properties"].get("elevation_m")
    print(f"{slug:32} {old!s:>6} -> {new:>5}")
    # Rewrite in place so the file keeps its hand formatting. elevation_m
    # follows slug inside each feature's properties.
    text, n = re.subn(
        rf'("slug": "{slug}"[\s\S]*?"elevation_m": )(null|-?\d+(?:\.\d+)?)',
        rf"\g<1>{new}",
        text,
        count=1,
    )
    assert n == 1, f"elevation_m not found for {slug}"
    sql.append(f"update destinations set elevation_m = {new} where slug = '{slug}';")

GEO.write_text(text)
MIGRATION.write_text("\n".join(sql) + "\n")
```
The JSON parse only reads coordinates; the file is rewritten by targeted substitution so its hand formatting survives.

- [ ] **Step 5: Run it**

Run: `python3 scripts/fix-elevations.py`
Expected: 22 lines; `bencab-museum 1420 -> ~979`; `git diff --stat data/geojson/landmarks.geojson` shows only `elevation_m` lines changed.

- [ ] **Step 6: Tests pass**

Run: `npm test -- tests/unit/elevations.test.ts` → Expected: PASS.

- [ ] **Step 7: Apply to Supabase**

Confirm the project is `ACTIVE_HEALTHY`, then apply the migration (Supabase MCP `apply_migration` with the file's SQL, or `npx supabase db push`). Verify:
```sql
select slug, elevation_m from destinations where slug in ('bencab-museum', 'burnham-park') order by slug;
```
Expected: bencab-museum ≈ 979, burnham-park ≈ 1442.

- [ ] **Step 8: See it on the site**

Open `/destinations/bencab-museum`: elevation reads about 979 m.

- [ ] **Step 9: Commit**

```bash
git add scripts/baguio-dem-probe.py scripts/fix-elevations.py data/geojson/landmarks.geojson supabase/migrations/20260924090000_correct_destination_elevations.sql tests/unit/elevations.test.ts
git commit -m "Resample destination elevations from the terrain model (worst was 441 m off)"
```

---

### Task 5: Fares with a source and a date

**Files:**
- Modify: `lib/geo/fare.ts`, `app/transit/page.tsx`
- Create: `tests/unit/fare-source.test.ts`, `tests/e2e/transit.spec.ts`

**Interfaces:**
- Produces: `FARE_SOURCE: { checkedOn: string; jeepney: { label: string; url: string }; taxi: { label: string; url: string; verified: boolean } }` exported from `lib/geo/fare.ts`.

- [ ] **Step 1: Verify the figures (research, before any code)**

Using the Playwright browser (Claude's built-in pane can't reach some government sites reliably), find on `ltfrb.gov.ph` (or the LTFRB Region CAR page) the **current** issuance for:
1. Traditional jeepney minimum fare and the kilometres it covers, and the rate per succeeding km.
2. Taxi flag-down and distance/waiting rates that apply in Baguio.

Record in the ledger: the exact page URL, the circular number, the figures, and today's date. Rules: a figure that doesn't appear on an official page is **not verified**. Don't carry a figure from memory or a news site into `verified: true`.

- [ ] **Step 2: Write the failing tests**

`tests/unit/fare-source.test.ts`:
```ts
import { expect, it } from "vitest";
import { FARE_SOURCE } from "@/lib/geo/fare";

it("fare figures carry a check date and an official source", () => {
  expect(FARE_SOURCE.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(FARE_SOURCE.jeepney.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*ltfrb\.gov\.ph\//);
});
```

`tests/e2e/transit.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("the transit page says where fares come from and when they were checked", async ({ page }) => {
  await page.goto("/transit");
  await expect(page.getByText(/Fares checked/)).toBeVisible();
  await expect(page.getByText(/Route lines are approximate/)).toBeVisible();
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npm test -- tests/unit/fare-source.test.ts` → FAIL (no export). E2E → FAIL.

- [ ] **Step 4: Implement**

`lib/geo/fare.ts`, add below the taxi constants, filled from Step 1:
```ts
/**
 * Where the fare figures come from. Update the figures, the date and the URLs
 * together. `taxi.verified` stays false unless the taxi rates above were read
 * on an official LTFRB page on `checkedOn`.
 */
export const FARE_SOURCE = {
  checkedOn: "2026-09-24", // the date of the Step 1 check
  jeepney: { label: "LTFRB fare matrix", url: "https://ltfrb.gov.ph/" }, // exact page from Step 1
  taxi: { label: "LTFRB taxi fares", url: "https://ltfrb.gov.ph/", verified: false },
} as const;
```
If Step 1 found different jeepney figures, also update `fareBase`/`farePerKm` in `data/geojson/jeepney-routes.geojson` and add a migration `supabase/migrations/20260924090050_update_fares.sql` with `update transit_routes set fare_base = …, fare_per_km = …;`. If Step 1 found different taxi figures on an official page, update `TAXI_*` and set `verified: true`.

`app/transit/page.tsx`: under the fare explanation, add (import `FARE_SOURCE` from `@/lib/geo/fare`):
```tsx
<p className="mt-4 text-sm text-muted-foreground">
  Fares checked {new Date(FARE_SOURCE.checkedOn).toLocaleDateString("en-PH", { dateStyle: "long" })} against the{" "}
  <a href={FARE_SOURCE.jeepney.url} className="text-primary underline underline-offset-4">{FARE_SOURCE.jeepney.label}</a>.
  {FARE_SOURCE.taxi.verified ? null : " Taxi figures are estimates."} Confirm the fare with the driver.
</p>
<p className="mt-2 text-sm text-muted-foreground">
  Route lines are approximate: they join the stops in order and may not follow every street the jeepney takes.
</p>
```
And stop showing internal route codes as badges on this page: render the route name alone (codes stay in URLs).

- [ ] **Step 5: Run the tests** → Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/geo/fare.ts app/transit/page.tsx tests/unit/fare-source.test.ts tests/e2e/transit.spec.ts data supabase/migrations
git commit -m "Show where fares come from and when they were checked; label routes approximate"
```

---

### Task 6: Give the venue card's hover something to do

**Files:**
- Modify: `components/site/VenueCard.tsx`
- Create: `tests/e2e/venue-card.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("clicking anywhere on a venue card opens it on the map", async ({ page }) => {
  await page.goto("/eat-stay");
  const card = page.locator("article").first();
  await card.locator("p").first().click(); // the description, not the name
  await expect(page).toHaveURL(/\/map\?venue=/);
});
```
Run: `npm run test:e2e -- tests/e2e/venue-card.spec.ts` → Expected: FAIL (the description isn't a link).

- [ ] **Step 2: Implement a stretched link**

`components/site/VenueCard.tsx`: the article becomes `relative` with a visible focus ring; the name becomes the one link and stretches over the card; "View on map" becomes a label.
```tsx
    <article className="weave-edge group relative flex flex-col border-y border-r border-border bg-card p-5 transition-colors hover:bg-secondary focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg leading-snug">
            <Link
              href={`/map?venue=${v.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {v.name}
            </Link>
          </h3>
```
…and at the bottom replace the `<Link>…View on map</Link>` with:
```tsx
        <span className="text-xs font-medium text-primary group-hover:underline" aria-hidden="true">
          View on map
        </span>
```

- [ ] **Step 3: Run** → Expected: PASS. Run the full e2e → PASS.

- [ ] **Step 4: Commit**

```bash
git add components/site/VenueCard.tsx tests/e2e/venue-card.spec.ts
git commit -m "Make the whole venue card the link its hover state promises"
```

---

## Phase 3: security

### Task 7: Close the Supabase Data API

**Files:**
- Create: `supabase/migrations/20260924090100_revoke_data_api_roles.sql`

This task is verified with SQL and HTTP, not unit tests.

- [ ] **Step 1: Record the baseline**

Run through the Supabase MCP `execute_sql`:
```sql
select has_table_privilege('anon', 'public.spatial_ref_sys', 'INSERT') as srs_insert,
       has_table_privilege('anon', 'public.spatial_ref_sys', 'DELETE') as srs_delete,
       has_table_privilege('anon', 'public.venues', 'INSERT')         as venues_insert;
```
Expected today: `true, true, true`. Also run `get_advisors` (security) and note lints 0013, 0028, 0029.

- [ ] **Step 2: Write the migration**

`supabase/migrations/20260924090100_revoke_data_api_roles.sql`:
```sql
-- The app reads through baguio_app over the pooler and never calls the Data
-- API (PostgREST), so anon and authenticated need nothing in public. RLS
-- already blocks them on app tables; this removes the grants underneath,
-- including the INSERT/UPDATE/DELETE they held on PostGIS's spatial_ref_sys.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
```
Don't revoke `EXECUTE` from `PUBLIC`: `baguio_app` calls PostGIS functions through that grant.

- [ ] **Step 3: Apply and re-check**

Apply the migration, rerun the Step 1 query.
Expected: `venues_insert = false`. `spatial_ref_sys` may still read `true`: its grants were made by `supabase_admin`, which `postgres` can't revoke. That's what Step 4 is for.

- [ ] **Step 4: Stop exposing `public` through the Data API (owner, in the dashboard)**

Supabase dashboard → Project Settings → Data API → Exposed schemas: remove `public` (or turn the Data API off). This closes `spatial_ref_sys` and the `st_estimatedextent` functions from outside regardless of grants. The app doesn't use the Data API, so nothing breaks.

- [ ] **Step 5: Verify from the outside**

Get the anon key with the Supabase MCP `get_publishable_keys` (never paste it into the repo), then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://<project-ref>.supabase.co/rest/v1/spatial_ref_sys?limit=1" \
  -H "apikey: $ANON_KEY"
```
Expected: not `200` (PostgREST answers `406`/`404` with "schema must be one of" or the API is off).
Run `get_advisors` (security) → Expected: no ERROR-level lints; 0028/0029 gone.

- [ ] **Step 6: Confirm the app still reads**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/geo/destinations` → `200`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260924090100_revoke_data_api_roles.sql
git commit -m "Revoke Data API roles in public; close spatial_ref_sys writes to anon"
```

---

### Task 8: Validate API input, and stop caching misses

**Files:**
- Create: `lib/validate.ts`, `tests/unit/validate.test.ts`, `tests/unit/redis.test.ts`, `tests/e2e/api.spec.ts`
- Modify: `lib/constants.ts`, `components/map/DeepLink.tsx:19-23`, `lib/redis.ts` (`cacheAside`), `app/api/venues/route.ts`, `app/api/venues/[id]/route.ts`, `app/api/geo/destinations/[slug]/route.ts`, `app/api/geo/transit/fare/route.ts`

**Interfaces:**
- Produces: `SERVICE_AREA: [minLng, minLat, maxLng, maxLat]` in `lib/constants.ts`; `isSlug(s)`, `isId(s)`, `isRouteCode(s)`, `MAX_QUERY_LENGTH`, `inServiceArea(lng, lat)` in `lib/validate.ts`.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/validate.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { inServiceArea, isId, isRouteCode, isSlug } from "@/lib/validate";

describe("validators", () => {
  it("accepts real slugs and rejects anything else", () => {
    expect(isSlug("burnham-park")).toBe(true);
    expect(isSlug("<script>")).toBe(false);
    expect(isSlug("a".repeat(81))).toBe(false);
  });
  it("accepts cuid and uuid ids", () => {
    expect(isId("clx2k9w0a0000qz8h3v1y2b3c")).toBe(true);
    expect(isId("5048ee8f-4b01-40ed-b334-11b497b35912")).toBe(true);
    expect(isId("1 OR 1=1")).toBe(false);
  });
  it("accepts route codes", () => {
    expect(isRouteCode("PLZ-MVP")).toBe(true);
    expect(isRouteCode("plz mvp")).toBe(false);
  });
  it("knows where Baguio is", () => {
    expect(inServiceArea(120.5936, 16.4116)).toBe(true);
    expect(inServiceArea(0, 0)).toBe(false);
  });
});
```

`tests/unit/redis.test.ts`:
```ts
import { expect, it, vi } from "vitest";

const { setexSpy } = vi.hoisted(() => ({ setexSpy: vi.fn() }));
vi.mock("ioredis", () => ({
  default: class {
    get = async () => null;
    setex = setexSpy;
    on() {
      return this;
    }
  },
}));

import { cacheAside } from "@/lib/redis";

it("does not cache a miss", async () => {
  await cacheAside("miss", 60, async () => null);
  expect(setexSpy).not.toHaveBeenCalled();
});

it("caches a hit", async () => {
  await cacheAside("hit", 60, async () => ({ ok: true }));
  expect(setexSpy).toHaveBeenCalledWith("hit", 60, '{"ok":true}');
});
```
Run: `npm test` → Expected: FAIL (no `lib/validate`; `setex` called for the miss).

- [ ] **Step 2: Implement**

`lib/constants.ts`, add:
```ts
/** Coordinates outside this window aren't Baguio: [minLng, minLat, maxLng, maxLat]. */
export const SERVICE_AREA: [number, number, number, number] = [120.4, 16.2, 120.8, 16.6];
```

`components/map/DeepLink.tsx`: delete the local `LNG_MIN … LAT_MAX` constants (lines 19–23) and use `inServiceArea(lng, lat)` from `@/lib/validate` where they were compared.

`lib/validate.ts`:
```ts
// Shape checks for untrusted route parameters. SQL is already parameterized;
// these keep junk out of queries and out of the Redis key space.
import { SERVICE_AREA } from "@/lib/constants";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID = /^[a-z0-9-]{20,40}$/i; // cuid (local) or uuid (Supabase seed)
const ROUTE_CODE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

export const MAX_QUERY_LENGTH = 80;

export const isSlug = (s: string) => s.length <= 80 && SLUG.test(s);
export const isId = (s: string) => ID.test(s);
export const isRouteCode = (s: string) => s.length <= 16 && ROUTE_CODE.test(s);

export function inServiceArea(lng: number, lat: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = SERVICE_AREA;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}
```

`lib/redis.ts`, in `cacheAside`, only write real results:
```ts
  const fresh = await fetcher();

  // A miss (null) isn't cached: otherwise every made-up slug or id would sit
  // in Redis for the full TTL.
  if (fresh !== null) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
    } catch {
      // Best-effort write; ignore failures.
    }
  }

  return fresh;
```

Routes:
- `app/api/geo/destinations/[slug]/route.ts`: `if (!slug || !isSlug(slug)) return errorResponse("destination not found", 404);`
- `app/api/venues/[id]/route.ts`: `if (!id || !isId(id)) return errorResponse("venue not found", 404);`
- `app/api/venues/route.ts`: after reading `q`: `if (q && q.length > MAX_QUERY_LENGTH) return errorResponse(\`q must be at most ${MAX_QUERY_LENGTH} characters\`, 400);` and `if (cursor && !isId(cursor)) return errorResponse("invalid cursor", 400);`
- `app/api/geo/transit/fare/route.ts`: after the NaN check: `if (!inServiceArea(fromLng, fromLat) || !inServiceArea(toLng, toLat)) return errorResponse("points must be in Baguio", 400);` and for jeepney mode `if (!isRouteCode(routeCode)) return errorResponse("unknown routeCode", 400);`

- [ ] **Step 3: E2E the boundaries**

`tests/e2e/api.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("API rejects junk input", async ({ request }) => {
  expect((await request.get("/api/geo/destinations/%3Cscript%3E")).status()).toBe(404);
  expect((await request.get("/api/venues/1%20OR%201=1")).status()).toBe(404);
  expect((await request.get(`/api/venues?q=${"x".repeat(81)}`)).status()).toBe(400);
  expect((await request.get("/api/geo/transit/fare?mode=taxi&fromLng=0&fromLat=0&toLng=1&toLat=1")).status()).toBe(400);
});
```

- [ ] **Step 4: Run** `npm test` and `npm run test:e2e` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib app/api components/map/DeepLink.tsx tests
git commit -m "Validate API route input and stop caching misses in Redis"
```

---

### Task 9: Security headers, with CSP in report-only

**Files:**
- Modify: `next.config.ts`
- Create: `tests/e2e/headers.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("pages send security headers", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toContain("geolocation=()");
  expect(h["content-security-policy-report-only"]).toContain("worker-src 'self' blob:");
});
```
Run → Expected: FAIL.

- [ ] **Step 2: Implement** `next.config.ts`:
```ts
import type { NextConfig } from "next";

const TILE_HOSTS = "https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com";
const GA_HOSTS = "https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

// Report-only until the browser console on /, /map and /corrections shows no
// violations across a week of normal use (Phase 10). MapLibre runs its
// workers from blob: URLs; Emotion and MapLibre inject inline styles.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${TILE_HOSTS} ${GA_HOSTS}`,
  "font-src 'self'",
  `connect-src 'self' ${TILE_HOSTS} ${GA_HOSTS}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // The site never asks for location, camera, microphone or payment.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: CSP },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Run** → Expected: PASS. Open `/map` in the Playwright browser, read console messages: record any `Content-Security-Policy` report-only violations in the ledger (fix the directive list if a legitimate host is missing).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts tests/e2e/headers.spec.ts
git commit -m "Send security headers; CSP in report-only"
```

---

## Phase 4: brand assets and search

### Task 10: Favicon, touch icon and share image in the weave palette

**Files:**
- Modify: `app/icon.svg`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`
- Create: `tests/unit/brand-assets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const RETIRED = /#1e4d3a|#14352a|#0f281f|#2f6d52|#e0a84f|#eef4f0|#a9c1b5/i;

it("brand assets use the weave palette, not the retired green", () => {
  for (const file of ["app/icon.svg", "app/apple-icon.tsx", "app/opengraph-image.tsx"]) {
    const src = readFileSync(file, "utf8");
    expect(src, file).not.toMatch(RETIRED);
    expect(src, file).toMatch(/#8C2318/i);
  }
});
```
Run → FAIL.

- [ ] **Step 2: Rewrite the three files**

`app/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="3" fill="#8C2318"/>
  <path transform="translate(4 4)" fill="#F5F0E6" d="M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z"/>
</svg>
```

`app/apple-icon.tsx`:
```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const PINE =
  "M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#8C2318" }}>
        <svg width="118" height="118" viewBox="0 0 24 24">
          <path d={PINE} fill="#F5F0E6" />
        </svg>
      </div>
    ),
    size,
  );
}
```

`app/opengraph-image.tsx`:
```tsx
import { ImageResponse } from "next/og";

export const alt = "Baguio 3D, a 3D map of Baguio City with jeepney routes and places to eat and stay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BONE = "#F5F0E6";
const WARP = "#16130F";
const MADDER = "#8C2318";
const THREAD = "#6B6156";
const PINE =
  "M12 2 L16.5 9.5 L14.5 9.5 L18.5 16 L15.5 16 L19 21.5 L5 21.5 L8.5 16 L5.5 16 L9.5 9.5 L7.5 9.5 Z";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BONE }}>
        {/* Warp edge: madder and warp threads, the site's structural motif. */}
        <div style={{ display: "flex", flexDirection: "column", width: 16, height: "100%" }}>
          {Array.from({ length: 21 }, (_, i) => (
            <div key={i} style={{ flex: 1, background: i % 3 === 1 ? WARP : MADDER }} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "72px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path d={PINE} fill={MADDER} />
            </svg>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: WARP }}>
              Baguio<span style={{ color: MADDER, marginLeft: 10 }}>3D</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: WARP }}>Baguio City,</div>
            <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1, letterSpacing: -2, color: WARP }}>mapped in 3D.</div>
            <div style={{ marginTop: 28, fontSize: 32, color: THREAD }}>
              Terrain, jeepney routes and places to eat and stay, on one map.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm test` → PASS. Open `/icon.svg`, `/apple-icon`, `/opengraph-image` in the browser and screenshot each; confirm bone/madder, no green.

- [ ] **Step 4: Commit**

```bash
git add app/icon.svg app/apple-icon.tsx app/opengraph-image.tsx tests/unit/brand-assets.test.ts
git commit -m "Redraw favicon, touch icon and share image in the weave palette"
```

---

### Task 11: Titles, descriptions and canonical URLs on every page

**Files:**
- Modify: `app/layout.tsx` (title default/template, descriptions), `app/page.tsx`, `app/destinations/page.tsx`, `app/destinations/[slug]/page.tsx`, `app/eat-stay/page.tsx`, `app/history/page.tsx`, `app/transit/page.tsx`, `app/map/page.tsx`
- Create: `tests/e2e/meta.spec.ts`

- [ ] **Step 1: Write the failing gate**

```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

test("every page has a unique title, a description and an absolute canonical URL", async ({ page }) => {
  const titles = new Map<string, string>();
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    const description = (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
    const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
    expect(title, path).not.toBe("");
    expect(titles.get(title), `${path} repeats the title of ${titles.get(title)}`).toBeUndefined();
    titles.set(title, path);
    expect(description.length, `${path} description`).toBeGreaterThanOrEqual(50);
    expect(description.length, `${path} description`).toBeLessThanOrEqual(160);
    expect(canonical, `${path} canonical`).toMatch(/^https?:\/\//);
  }
});
```
Run → FAIL (no canonical anywhere).

- [ ] **Step 2: Implement**

`app/layout.tsx` metadata:
```ts
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Baguio 3D | A 3D map of Baguio City",
    template: "%s | Baguio 3D",
  },
  description:
    "A free 3D map of Baguio City: tilt the terrain, find landmarks and viewpoints, check jeepney routes and fares, and see what's open to eat and stay.",
  alternates: { canonical: "/" },
```
Rewrite the `openGraph` and `twitter` titles/descriptions the same way (no em dashes).

Per page, add `alternates.canonical` (filters in query strings canonicalize to the bare page):
- `app/page.tsx`: `export const metadata: Metadata = { alternates: { canonical: "/" } };`
- `app/destinations/page.tsx`: `alternates: { canonical: "/destinations" }`
- `app/eat-stay/page.tsx`: `alternates: { canonical: "/eat-stay" }`
- `app/history/page.tsx`: `alternates: { canonical: "/history" }`
- `app/transit/page.tsx`: `alternates: { canonical: "/transit" }`, and title `"Jeepney routes and fares"`
- `app/map/page.tsx`: title `"Interactive 3D map"`, `alternates: { canonical: "/map" }`
- `app/destinations/[slug]/page.tsx` `generateMetadata`:
```ts
  return {
    title: destination.name,
    description: clip(destination.description),
    alternates: { canonical: `/destinations/${destination.slug}` },
  };
```
(import `clip` from `@/lib/site`). Remove em dashes from any metadata string.

- [ ] **Step 3: Run** the meta gate → PASS; full e2e → PASS.

- [ ] **Step 4: Commit**

```bash
git add app tests/e2e/meta.spec.ts
git commit -m "Give every page a canonical URL, a real description and a unique title"
```

---

### Task 12: Structured data and breadcrumbs

**Files:**
- Create: `lib/jsonld.ts`, `components/site/JsonLd.tsx`, `components/site/Breadcrumbs.tsx`, `tests/unit/jsonld.test.ts`, `tests/e2e/structured-data.spec.ts`
- Modify: `app/page.tsx` (WebSite), `app/destinations/[slug]/page.tsx` (breadcrumbs + TouristAttraction, replacing the "All destinations" back link)

**Interfaces:**
- Produces: `serializeJsonLd(data: object): string`; `websiteJsonLd()`; `attractionJsonLd(d: { name; description; slug; lng; lat; elevationM: number | null })`; `breadcrumbJsonLd(items: { name: string; path: string }[])`; `<JsonLd data={…} />`; `<Breadcrumbs trail={Crumb[]} />` where `Crumb = { name: string; path: string }` and Home is prepended automatically.

- [ ] **Step 1: Write the failing unit test**

```ts
import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/jsonld";

describe("serializeJsonLd", () => {
  it("escapes < so data can't close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script>");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail from 1 with absolute URLs", () => {
    const data = breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }]);
    expect(data.itemListElement[1]).toMatchObject({ position: 2, name: "Destinations" });
    expect(data.itemListElement[1].item).toMatch(/^https?:\/\/.+\/destinations$/);
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`lib/jsonld.ts`:
```ts
// schema.org data for search engines. LocalBusiness is deliberately absent:
// Baguio 3D is a guide, not a business with premises.
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** JSON for a <script type="application/ld+json">, with "<" escaped (Next JSON-LD guide). */
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function websiteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
}

export function attractionJsonLd(d: {
  name: string;
  description: string;
  slug: string;
  lng: number;
  lat: number;
  elevationM: number | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: d.name,
    description: d.description,
    url: `${SITE_URL}/destinations/${d.slug}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: d.lat,
      longitude: d.lng,
      ...(d.elevationM != null && { elevation: d.elevationM }),
    },
    containedInPlace: { "@type": "City", name: "Baguio", address: { "@type": "PostalAddress", addressCountry: "PH" } },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path === "/" ? "" : it.path}`,
    })),
  };
}
```

`components/site/JsonLd.tsx`:
```tsx
import { serializeJsonLd } from "@/lib/jsonld";

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
```

`components/site/Breadcrumbs.tsx`:
```tsx
import Link from "next/link";
import { JsonLd } from "@/components/site/JsonLd";
import { breadcrumbJsonLd } from "@/lib/jsonld";

export interface Crumb {
  name: string;
  path: string;
}

/** Trail from Home to the current page. The last crumb is the page itself, not a link. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const items: Crumb[] = [{ name: "Home", path: "/" }, ...trail];
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.path} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">/</span>}
              {last ? (
                <span aria-current="page" className="text-foreground">{c.name}</span>
              ) : (
                <Link href={c.path} className="underline-offset-4 hover:text-foreground hover:underline">{c.name}</Link>
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </nav>
  );
}
```

`app/page.tsx`: render `<JsonLd data={websiteJsonLd()} />` as the first child of the page wrapper.

`app/destinations/[slug]/page.tsx`: replace the "All destinations" `<Link>` (and the `ArrowLeft` import) with:
```tsx
        <Breadcrumbs trail={[{ name: "Destinations", path: "/destinations" }, { name: destination.name, path: `/destinations/${destination.slug}` }]} />
        <JsonLd data={attractionJsonLd(destination)} />
```

- [ ] **Step 3: E2E**

`tests/e2e/structured-data.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("a destination page carries breadcrumbs and TouristAttraction data", async ({ page }) => {
  await page.goto("/destinations/burnham-park");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Destinations" })).toHaveAttribute("href", "/destinations");
  await expect(crumbs.getByText("Burnham Park")).toHaveAttribute("aria-current", "page");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.map((b) => JSON.parse(b)["@type"]);
  expect(types).toEqual(expect.arrayContaining(["TouristAttraction", "BreadcrumbList"]));
});
```

- [ ] **Step 4: Run** `npm test` and `npm run test:e2e` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/jsonld.ts components/site/JsonLd.tsx components/site/Breadcrumbs.tsx app tests
git commit -m "Add breadcrumbs and schema.org data for the site and each destination"
```

---

## Phase 5: pages and structure

### Task 13: Link related pages from each destination

**Files:**
- Create: `lib/nearby.ts`, `tests/unit/nearby.test.ts`, `tests/e2e/internal-links.spec.ts`
- Modify: `app/destinations/[slug]/page.tsx`

**Interfaces:**
- Consumes: `haversineKm` (`lib/geo/fare.ts`), `getDestinations`, `getVenues`, `getTransitRoutes` (`lib/content.ts`).
- Produces: `nearest<T extends { lng: number; lat: number }>(origin, items, n): { item: T; km: number }[]`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, it } from "vitest";
import { nearest } from "@/lib/nearby";

const burnham = { lng: 120.5936, lat: 16.4116 };
const places = [
  { slug: "mines-view", lng: 120.628, lat: 16.4201 },
  { slug: "session-road", lng: 120.5967, lat: 16.4118 },
  { slug: "bencab", lng: 120.549, lat: 16.382 },
];

it("orders by distance and keeps n", () => {
  const out = nearest(burnham, places, 2);
  expect(out.map((o) => o.item.slug)).toEqual(["session-road", "mines-view"]);
  expect(out[0].km).toBeLessThan(0.5);
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `lib/nearby.ts`:
```ts
import { haversineKm } from "@/lib/geo/fare";

export interface Located {
  lng: number;
  lat: number;
}

/** The `n` items closest to `origin`, nearest first, with distance in km. */
export function nearest<T extends Located>(origin: Located, items: readonly T[], n: number): { item: T; km: number }[] {
  return items
    .map((item) => ({ item, km: haversineKm([origin.lng, origin.lat], [item.lng, item.lat]) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}
```

- [ ] **Step 3: Use it on the detail page**

In `app/destinations/[slug]/page.tsx`:
- Fetch `getDestinations()` and `getTransitRoutes()` alongside history and venues.
- Replace the inline nearby-venues computation with `nearest(destination, venues, 3)`.
- Compute:
```ts
  const nearbyPlaces = nearest(destination, destinations.filter((d) => d.slug !== destination.slug), 3);

  // The jeepney that stops closest to this place, if one stops within walking distance.
  const ride = routes
    .flatMap((route) => nearest(destination, route.stops, 1).map(({ item: stop, km }) => ({ route, stop, km })))
    .sort((a, b) => a.km - b.km)[0];
  const WALKABLE_KM = 0.8;
```
- Render, after the description/era block:
```tsx
            {ride && ride.km <= WALKABLE_KM ? (
              <section className="max-w-2xl border-t border-border pt-6">
                <h2 className="font-display text-xl">Getting here</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  The {ride.route.name} jeepney stops at {ride.stop.name},{" "}
                  <span className="font-mono text-foreground">{Math.round(ride.km * 1000)} m</span> away.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
                  <Link href={`/map?route=${ride.route.code}`} className="text-primary underline-offset-4 hover:underline">Show the route on the map</Link>
                  <Link href="/transit" className="text-primary underline-offset-4 hover:underline">All routes and fares</Link>
                </div>
              </section>
            ) : null}
```
- And a "Nearby places" section after "Eat & stay nearby":
```tsx
        <section className="mt-16">
          <h2 className="font-display text-2xl">Nearby places</h2>
          <ul className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-3">
            {nearbyPlaces.map(({ item, km }) => (
              <li key={item.slug} className="bg-card">
                <Link href={`/destinations/${item.slug}`} className="flex h-full items-baseline justify-between gap-4 p-5 hover:bg-secondary">
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{km.toFixed(1)} km</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
```

- [ ] **Step 4: E2E**

`tests/e2e/internal-links.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("a destination links to nearby places and its jeepney", async ({ page }) => {
  await page.goto("/destinations/burnham-park");
  const nearby = page.locator("section", { has: page.getByRole("heading", { name: "Nearby places" }) });
  await expect(nearby.locator('a[href^="/destinations/"]')).toHaveCount(3);
  await expect(page.locator('a[href^="/map?route="]')).toHaveCount(1);
});
```

- [ ] **Step 5: Run** unit + e2e → PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nearby.ts app/destinations tests
git commit -m "Link each destination to nearby places and the jeepney that serves it"
```

---

### Task 14: A 404 page that helps

**Files:**
- Modify: `app/not-found.tsx`
- Create: `tests/e2e/not-found.spec.ts`

A plain `not-found.tsx` can't export `metadata` in Next 16 (only the experimental `global-not-found` can, and it drops the site layout). React 19 hoists a `<title>` rendered in a component into `<head>`, so the page renders its own. Next adds `noindex` to 404 responses automatically.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("unknown pages return 404 with their own title and a way back", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found | Baguio 3D");
  await expect(page.getByRole("link", { name: "The 3D map" })).toHaveAttribute("href", "/map");
});
```
Run → FAIL (title is the homepage's).

- [ ] **Step 2: Implement** `app/not-found.tsx`:
```tsx
import Link from "next/link";

const WAYS_BACK = [
  { href: "/map", name: "The 3D map", note: "Tilt the terrain and find a place." },
  { href: "/destinations", name: "Destinations", note: "Every landmark in the guide, by kind." },
  { href: "/eat-stay", name: "Eat and stay", note: "Food, lodging and pasalubong." },
] as const;

export default function NotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
      <title>Page not found | Baguio 3D</title>
      <h1 className="max-w-[16ch] font-display text-4xl leading-[1.02] text-balance sm:text-6xl">
        This page isn&apos;t on the map.
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg leading-8 text-muted-foreground">
        The link may be old, or the address has a typo. Everything in the guide starts from one of these.
      </p>
      <ul className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-3">
        {WAYS_BACK.map((w) => (
          <li key={w.href} className="bg-card">
            <Link href={w.href} className="block h-full p-6 transition-colors hover:bg-secondary">
              <span className="font-display text-xl">{w.name}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{w.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
Also square `app/error.tsx` (drop `rounded-2xl`/`rounded-full`, the pine tile and the `RotateCcw` icon; keep the retry button, now `bg-primary px-5 py-2.5`).

- [ ] **Step 3: Run** → PASS.

- [ ] **Step 4: Commit**

```bash
git add app/not-found.tsx app/error.tsx tests/e2e/not-found.spec.ts
git commit -m "Rebuild the 404 with its own title and three ways back"
```

---

### Task 15: Corrections form, thank-you page and response-time promise

**Files:**
- Create: `supabase/migrations/20260924090200_corrections.sql`, `prisma/migrations/20260924090200_corrections/migration.sql`, `lib/corrections.ts`, `app/corrections/page.tsx`, `app/corrections/CorrectionForm.tsx`, `app/corrections/actions.ts`, `app/corrections/thanks/page.tsx`, `tests/unit/corrections.test.ts`, `tests/e2e/corrections.spec.ts`
- Modify: `prisma/schema.prisma`, `tests/e2e/routes.ts` (add `/corrections`), `app/destinations/[slug]/page.tsx` (add "Suggest a correction" link)

**Interfaces:**
- Produces: `CorrectionFields`, `FieldErrors`, `CorrectionState`, `initialCorrectionState`, `MIN_FILL_MS`, `parseCorrection(form: FormData, now: number): ParseResult` in `lib/corrections.ts`; server action `submitCorrection(prev: CorrectionState, form: FormData): Promise<CorrectionState>`.

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/corrections.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MIN_FILL_MS, parseCorrection } from "@/lib/corrections";

const NOW = 1_000_000;
function form(fields: Record<string, string>) {
  const fd = new FormData();
  const base = { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: "", website: "", startedAt: String(NOW - MIN_FILL_MS - 1) };
  for (const [k, v] of Object.entries({ ...base, ...fields })) fd.set(k, v);
  return fd;
}

describe("parseCorrection", () => {
  it("accepts a real report", () => {
    expect(parseCorrection(form({}), NOW)).toEqual({
      kind: "valid",
      data: { page: "/destinations/burnham-park", message: "The boat rental closes at 5 pm now.", email: null },
    });
  });
  it("asks for a longer message and keeps what was typed", () => {
    const out = parseCorrection(form({ message: "wrong" }), NOW);
    expect(out.kind).toBe("invalid");
    if (out.kind === "invalid") {
      expect(out.state.errors?.message).toMatch(/at least 10/);
      expect(out.state.fields?.message).toBe("wrong");
    }
  });
  it("rejects an incomplete email", () => {
    const out = parseCorrection(form({ email: "someone@" }), NOW);
    expect(out.kind === "invalid" && out.state.errors?.email).toBeTruthy();
  });
  it("treats a filled honeypot as spam", () => {
    expect(parseCorrection(form({ website: "http://spam" }), NOW).kind).toBe("spam");
  });
  it("treats an instant submission as spam", () => {
    expect(parseCorrection(form({ startedAt: String(NOW - 100) }), NOW).kind).toBe("spam");
  });
});
```
Run → FAIL.

- [ ] **Step 2: Implement `lib/corrections.ts`**

```ts
// Pure parsing and validation for the corrections form. No I/O, so it's
// tested directly; the server action only adds storage.

export interface CorrectionFields {
  page: string;
  message: string;
  email: string;
}
export type FieldErrors = Partial<Record<keyof CorrectionFields, string>>;
export interface CorrectionState {
  status: "idle" | "error";
  formError?: string;
  errors?: FieldErrors;
  fields?: CorrectionFields;
}
export const initialCorrectionState: CorrectionState = { status: "idle" };

/** A person takes longer than this to read the page and type a report. */
export const MIN_FILL_MS = 3000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseResult =
  | { kind: "valid"; data: { page: string; message: string; email: string | null } }
  | { kind: "invalid"; state: CorrectionState }
  | { kind: "spam" };

export function parseCorrection(form: FormData, now: number): ParseResult {
  const str = (key: string) => String(form.get(key) ?? "").trim();

  if (str("website") !== "") return { kind: "spam" };
  const started = Number(str("startedAt"));
  if (!Number.isFinite(started) || now - started < MIN_FILL_MS) return { kind: "spam" };

  const fields: CorrectionFields = { page: str("page") || "/", message: str("message"), email: str("email") };
  const errors: FieldErrors = {};
  if (!fields.page.startsWith("/") || fields.page.length > 200) {
    errors.page = "Use an address from this site, starting with /.";
  }
  if (fields.message.length < 10) errors.message = "Tell us what's wrong in at least 10 characters.";
  else if (fields.message.length > 2000) errors.message = "Keep it under 2,000 characters.";
  if (fields.email && (fields.email.length > 254 || !EMAIL.test(fields.email))) {
    errors.email = "That email address looks incomplete.";
  }

  if (Object.keys(errors).length > 0) return { kind: "invalid", state: { status: "error", errors, fields } };
  return { kind: "valid", data: { page: fields.page, message: fields.message, email: fields.email || null } };
}
```
Run the unit tests → PASS.

- [ ] **Step 3: The table**

`supabase/migrations/20260924090200_corrections.sql`:
```sql
-- Correction reports from the public form. The app can add a report and count
-- the last hour's (for the rate cap) but can never read one back: reports are
-- reviewed in the Supabase dashboard. No IP addresses are stored.
create table public.corrections (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  page_path text not null check (char_length(page_path) between 1 and 200),
  message text not null check (char_length(message) between 10 and 2000),
  reply_email text check (reply_email is null or char_length(reply_email) <= 254),
  resolved_at timestamptz
);
create index corrections_created_at_idx on public.corrections (created_at);

alter table public.corrections enable row level security;
grant insert (page_path, message, reply_email) on public.corrections to baguio_app;
grant select (created_at) on public.corrections to baguio_app;
grant usage on sequence public.corrections_id_seq to baguio_app;
create policy app_insert on public.corrections for insert to baguio_app with check (true);
create policy app_count_recent on public.corrections for select to baguio_app
  using (created_at > now() - interval '1 hour');
```

`prisma/migrations/20260924090200_corrections/migration.sql` (local Docker path; the same table without the Supabase-only role grants):
```sql
CREATE TABLE "corrections" (
  "id" BIGSERIAL NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "page_path" TEXT NOT NULL CHECK (char_length("page_path") BETWEEN 1 AND 200),
  "message" TEXT NOT NULL CHECK (char_length("message") BETWEEN 10 AND 2000),
  "reply_email" TEXT CHECK ("reply_email" IS NULL OR char_length("reply_email") <= 254),
  "resolved_at" TIMESTAMPTZ(6),
  CONSTRAINT "corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "corrections_created_at_idx" ON "corrections"("created_at");
```

`prisma/schema.prisma`, add:
```prisma
model Correction {
  id         BigInt    @id @default(autoincrement())
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  pagePath   String    @map("page_path")
  message    String
  replyEmail String?   @map("reply_email")
  resolvedAt DateTime? @map("resolved_at") @db.Timestamptz(6)

  @@index([createdAt])
  @@map("corrections")
}
```
Apply the Supabase migration (confirm `ACTIVE_HEALTHY` first). Verify the least-privilege shape:
```sql
select
  has_column_privilege('baguio_app', 'public.corrections', 'page_path',  'INSERT') as can_insert,    -- true
  has_column_privilege('baguio_app', 'public.corrections', 'created_at', 'SELECT') as can_count,     -- true
  has_column_privilege('baguio_app', 'public.corrections', 'message',    'SELECT') as can_read_text, -- false
  has_sequence_privilege('baguio_app', 'public.corrections_id_seq', 'USAGE')       as can_number;    -- true
```
The real insert path, as `baguio_app` through the pooler, is exercised by the `E2E_DB` test in Step 7.

- [ ] **Step 4: The server action** `app/corrections/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseCorrection, type CorrectionState } from "@/lib/corrections";

// ponytail: one global hourly cap instead of per-visitor limits, so no IP is
// stored. Switch to per-client limiting if the form gets abused.
const HOURLY_CAP = 30;

export async function submitCorrection(_prev: CorrectionState, form: FormData): Promise<CorrectionState> {
  const parsed = parseCorrection(form, Date.now());
  if (parsed.kind === "invalid") return parsed.state;

  if (parsed.kind === "valid") {
    const { page, message, email } = parsed.data;
    const fields = { page, message, email: email ?? "" };
    try {
      const [{ recent }] = await prisma.$queryRaw<[{ recent: number }]>(Prisma.sql`
        SELECT count(created_at)::int AS recent FROM corrections
        WHERE created_at > now() - interval '1 hour'`);
      if (recent >= HOURLY_CAP) {
        return {
          status: "error",
          fields,
          formError: "We've had a lot of reports this hour. Your text is still here; send it again in an hour.",
        };
      }
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO corrections (page_path, message, reply_email) VALUES (${page}, ${message}, ${email})`);
    } catch {
      return { status: "error", fields, formError: "Your report didn't save, and nothing was sent. Try again in a minute." };
    }
  }

  // Spam reaches here too: bots get the same thank-you page and learn nothing.
  // redirect() throws, so it stays outside the try above.
  redirect("/corrections/thanks");
}
```

- [ ] **Step 5: The form** `app/corrections/CorrectionForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import Button from "@mui/material/Button";
import { initialCorrectionState } from "@/lib/corrections";
import { submitCorrection } from "./actions";

const input =
  "mt-2 block w-full border border-border bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-primary";

export function CorrectionForm({ page, startedAt, responseDays }: { page: string; startedAt: number; responseDays: number }) {
  const [state, action, pending] = useActionState(submitCorrection, initialCorrectionState);
  const e = state.errors ?? {};
  // Returned fields become the defaults, so React's post-action form reset
  // puts the visitor's text back instead of wiping it.
  const f = state.fields;

  return (
    <form action={action} noValidate className="mt-10 max-w-2xl space-y-7">
      {state.formError ? (
        <p role="alert" className="border-l-2 border-primary bg-card px-4 py-3 text-sm">{state.formError}</p>
      ) : null}
      {Object.keys(e).length > 0 ? (
        <p role="alert" className="border-l-2 border-primary bg-card px-4 py-3 text-sm">
          Check the highlighted field{Object.keys(e).length > 1 ? "s" : ""} below.
        </p>
      ) : null}

      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="page" className="font-medium">Which page?</label>
        <input id="page" name="page" defaultValue={f?.page ?? page} placeholder="/destinations/burnham-park" aria-invalid={!!e.page} aria-describedby={e.page ? "page-error" : "page-hint"} className={input} />
        <p id="page-hint" className="mt-1.5 text-sm text-muted-foreground">Leave it blank if it's about the whole site.</p>
        {e.page ? <p id="page-error" className="mt-1.5 text-sm text-primary">{e.page}</p> : null}
      </div>

      <div>
        <label htmlFor="message" className="font-medium">What&apos;s wrong?</label>
        <textarea id="message" name="message" rows={6} defaultValue={f?.message} required aria-invalid={!!e.message} aria-describedby={e.message ? "message-error" : "message-hint"} className={input} />
        <p id="message-hint" className="mt-1.5 text-sm text-muted-foreground">A closed shop, new hours, a fare that changed, a pin in the wrong place.</p>
        {e.message ? <p id="message-error" className="mt-1.5 text-sm text-primary">{e.message}</p> : null}
      </div>

      <div>
        <label htmlFor="email" className="font-medium">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={f?.email} aria-invalid={!!e.email} aria-describedby={e.email ? "email-error" : "email-hint"} className={input} />
        <p id="email-hint" className="mt-1.5 text-sm text-muted-foreground">Only if you want to hear back. We use it for this report and delete it once we reply.</p>
        {e.email ? <p id="email-error" className="mt-1.5 text-sm text-primary">{e.email}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" size="large" disabled={pending}>
          {pending ? "Sending report…" : "Send report"}
        </Button>
        <p className="text-sm text-muted-foreground">We read every report within {responseDays} days.</p>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: The pages**

`app/corrections/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";
import { CorrectionForm } from "./CorrectionForm";

export const metadata: Metadata = {
  title: "Suggest a correction",
  description: "Found a wrong opening time, fare or pin on Baguio 3D? Tell us what changed and we'll fix the guide.",
  alternates: { canonical: "/corrections" },
};

export default async function CorrectionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const fromPage = page && page.startsWith("/") && page.length <= 200 ? page : "";
  // Rendered on the server so the time check works without JavaScript.
  const startedAt = Date.now();
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Breadcrumbs trail={[{ name: "Suggest a correction", path: "/corrections" }]} />
      <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Suggest a correction</h1>
      <p className="mt-4 max-w-[56ch] text-lg leading-8 text-muted-foreground">
        Hours change, shops close, fares go up. If something here is out of date, tell us and we&apos;ll fix it for the next visitor.
      </p>
      <CorrectionForm page={fromPage} startedAt={startedAt} responseDays={CORRECTIONS_RESPONSE_DAYS} />
    </div>
  );
}
```

`app/corrections/thanks/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";

export const metadata: Metadata = { title: "Report received", robots: { index: false } };

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
      <h1 className="font-display text-4xl leading-[1.02] sm:text-5xl">Thanks, your report is in.</h1>
      <p className="mt-5 max-w-[56ch] text-lg leading-8 text-muted-foreground">
        We read every report within {CORRECTIONS_RESPONSE_DAYS} days. If you left an email, we&apos;ll write back once the guide is fixed.
      </p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-medium">
        <Link href="/map" className="text-primary underline-offset-4 hover:underline">Back to the map</Link>
        <Link href="/corrections" className="text-primary underline-offset-4 hover:underline">Report something else</Link>
      </div>
    </div>
  );
}
```

On `app/destinations/[slug]/page.tsx`, at the end of the fact panel:
```tsx
            <Link href={`/corrections?page=/destinations/${destination.slug}`} className="mt-4 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Something wrong here? Suggest a correction
            </Link>
```
Add `"/corrections"` to `PAGES`.

- [ ] **Step 7: E2E**

`tests/e2e/corrections.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("a too-short report shows an error and keeps the text", async ({ page }) => {
  await page.goto("/corrections?page=/destinations/burnham-park");
  await expect(page.getByLabel("Which page?")).toHaveValue("/destinations/burnham-park");
  await page.waitForTimeout(3200); // past the minimum fill time
  await page.getByLabel("What's wrong?").fill("closed");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Tell us what's wrong in at least 10 characters.")).toBeVisible();
  await expect(page.getByLabel("What's wrong?")).toHaveValue("closed");
});

test("a valid report lands on the thank-you page", async ({ page }) => {
  test.skip(!process.env.E2E_DB, "needs a reachable database: set E2E_DB=1");
  await page.goto("/corrections");
  await page.waitForTimeout(3200);
  await page.getByLabel("What's wrong?").fill("E2E check: please delete this row.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page).toHaveURL("/corrections/thanks");
  await expect(page.getByRole("heading", { name: "Thanks, your report is in." })).toBeVisible();
});
```
Run: `npm test && npm run test:e2e` → PASS (second test skipped unless `E2E_DB=1`). With the DB up, run `E2E_DB=1 npm run test:e2e -- tests/e2e/corrections.spec.ts` → PASS, then delete the E2E row in the dashboard.

- [ ] **Step 8: Commit**

```bash
git add supabase prisma lib/corrections.ts app/corrections app/destinations tests
git commit -m "Add a corrections form with inline errors, a thank-you page and a response-time promise"
```

---

### Task 16: Privacy policy, terms of use and about page

**Files:**
- Create: `lib/sources.ts`, `app/(legal)/layout.tsx`, `app/(legal)/privacy/page.tsx`, `app/(legal)/terms/page.tsx`, `app/about/page.tsx`, `tests/e2e/legal.spec.ts`
- Modify: `app/globals.css` (`.legal-prose`), `tests/e2e/routes.ts` (add `/privacy`, `/terms`, `/about`)

**Interfaces:**
- Produces: `DATA_SOURCES: { name: string; supplies: string; href: string }[]`, `OSM_BUILDINGS: { count: number; countedOn: string }` in `lib/sources.ts`.

> These pages describe what the code actually does (Audit E1–E4). They are a plain-language draft, not legal advice: have a lawyer familiar with the Philippine Data Privacy Act review them before launch, and record that in the ledger.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("the privacy policy names every service that sees a visitor's IP", async ({ page }) => {
  await page.goto("/privacy");
  for (const host of ["tiles.openfreemap.org", "s3.amazonaws.com", "server.arcgisonline.com"]) {
    await expect(page.getByText(host)).toBeVisible();
  }
  await expect(page.getByText(/Data Privacy Act of 2012/)).toBeVisible();
});

test("terms and about pages exist and credit the map data", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/OpenStreetMap contributors/).first()).toBeVisible();
  await page.goto("/about");
  await expect(page.locator("#sources")).toBeVisible();
});
```
Run → FAIL (404s).

- [ ] **Step 2: Shared data** `lib/sources.ts`:
```ts
// The data the map is made of. Used by the homepage Proof section and the
// about page, so both always list the same sources.

export interface DataSource {
  name: string;
  supplies: string;
  href: string;
}

export const DATA_SOURCES: DataSource[] = [
  { name: "AWS Terrain Tiles (Mapzen, Tilezen)", supplies: "Ground heights for the 3D terrain", href: "https://registry.opendata.aws/terrain-tiles/" },
  { name: "OpenStreetMap contributors", supplies: "Streets, buildings and place names", href: "https://www.openstreetmap.org/copyright" },
  { name: "OpenFreeMap", supplies: "Map tiles and the street map style", href: "https://openfreemap.org" },
  { name: "Esri World Imagery", supplies: "Satellite photos, one tap away on the map", href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9" },
];

/** Counted with the Overpass API inside the map area (120.5 to 120.7° E, 16.3 to 16.5° N). */
export const OSM_BUILDINGS = { count: 120_751, countedOn: "2026-09-22" } as const;
```

- [ ] **Step 3: Layout and prose styles**

`app/(legal)/layout.tsx`:
```tsx
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</div>;
}
```

`app/globals.css`, append:
```css
/* Long-form legal and about pages. */
.legal-prose h2 { font-variation-settings: "wdth" 125; font-size: 1.5rem; line-height: 1.2; margin-top: 2.75rem; color: var(--foreground); }
.legal-prose p, .legal-prose li { max-width: 68ch; line-height: 1.75; color: var(--muted-foreground); }
.legal-prose p { margin-top: 1rem; }
.legal-prose ul { margin-top: 1rem; padding-left: 1.25rem; list-style: square; }
.legal-prose li + li { margin-top: 0.5rem; }
.legal-prose a { color: var(--primary); text-decoration: underline; text-underline-offset: 4px; }
.legal-prose code { font-family: var(--font-geist-mono); font-size: 0.9em; color: var(--foreground); }
```

- [ ] **Step 4: Privacy policy** `app/(legal)/privacy/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Baguio 3D collects, which map services see your IP address, and your rights under the Philippine Data Privacy Act.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "24 September 2026";
const HOST = "Vercel"; // Phase 0, D7
const analytics = Boolean(process.env.NEXT_PUBLIC_GA_ID);

export default function PrivacyPage() {
  return (
    <article className="legal-prose">
      <Breadcrumbs trail={[{ name: "Privacy policy", path: "/privacy" }]} />
      <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Privacy policy</h1>
      <p>Last updated {UPDATED}.</p>
      <p>
        Baguio 3D is a free map and field guide. You can use all of it without an account. This page lists
        everything that happens to information about you when you do.
      </p>

      <h2>Using the map</h2>
      <p>
        There are no accounts, no sign-in, no payments and no uploads, and the site never asks for your
        location.
      </p>

      <h2>Services that see your IP address</h2>
      <p>
        Map tiles load straight from your browser to the companies that serve them, so each one receives
        your IP address and the part of the map you&apos;re looking at:
      </p>
      <ul>
        <li>OpenFreeMap, for the street map and labels (<code>tiles.openfreemap.org</code>)</li>
        <li>Amazon Web Services, for terrain heights (<code>s3.amazonaws.com</code>)</li>
        <li>Esri, only when you switch to satellite imagery (<code>server.arcgisonline.com</code>)</li>
        <li>{HOST}, which hosts this site and keeps standard request logs</li>
      </ul>
      <p>Fonts are served from this site, so your browser doesn&apos;t contact Google Fonts.</p>

      <h2 id="analytics">Analytics</h2>
      {analytics ? (
        <p>
          Only if you choose &ldquo;Allow analytics&rdquo;, Google Analytics 4 sets cookies and records the
          pages you view, how you arrived, your device and browser, and your approximate location from your
          IP address. If you choose &ldquo;No thanks&rdquo;, or don&apos;t choose, the analytics code never
          loads. Your choice is saved in your browser&apos;s local storage, and you can change it any time
          from &ldquo;Cookie settings&rdquo; at the bottom of every page.
        </p>
      ) : (
        <p>This site doesn&apos;t use analytics or advertising cookies.</p>
      )}

      <h2>Correction reports</h2>
      <p>
        If you send a correction, we store what you wrote and the page it&apos;s about, plus your email only
        if you give one. We use the email to reply about that report and delete it once we have, or after 90
        days, whichever comes first. The report itself stays, without your email, as a record of what changed.
        We don&apos;t store your IP address with it.
      </p>

      <h2>AI</h2>
      <p>The site doesn&apos;t use AI to process anything you send or do.</p>
      {/* Phase 0, D6: if the owner confirms, add: "Some place descriptions were drafted with AI assistance and edited by hand." */}

      <h2>Your rights</h2>
      <p>
        Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) you can ask what we hold about
        you, ask us to correct or delete it, and object to its use.
        {CONTACT_EMAIL ? (
          <> Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
        ) : (
          <> Use the <a href="/corrections">correction form</a> and leave an email so we can reply.</>
        )}{" "}
        If you&apos;re not satisfied with our answer, you can complain to the{" "}
        <a href="https://privacy.gov.ph">National Privacy Commission</a>.
      </p>

      <h2>Children</h2>
      <p>The site isn&apos;t aimed at children and we don&apos;t knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>When this policy changes, the date at the top changes with it.</p>
    </article>
  );
}
```

- [ ] **Step 5: Terms** `app/(legal)/terms/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { FARE_SOURCE } from "@/lib/geo/fare";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using Baguio 3D: estimates you should confirm, the map data licenses we rely on, and how correction reports are used.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="legal-prose">
      <Breadcrumbs trail={[{ name: "Terms of use", path: "/terms" }]} />
      <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Terms of use</h1>
      <p>Last updated 24 September 2026. By using Baguio 3D you agree to these terms.</p>

      <h2>What the site is</h2>
      <p>A free map and field guide to Baguio City for personal, non-commercial use.</p>

      <h2>Check before you travel</h2>
      <p>
        Fares are estimates based on the LTFRB fare structure, last checked on {FARE_SOURCE.checkedOn}.
        Opening hours are checked by hand and can go out of date. Heights come from a terrain model and
        positions from OpenStreetMap, and both can be off by a few metres. Confirm fares with the driver and
        hours with the place before you rely on them. We aren&apos;t responsible for decisions made on this
        information.
      </p>

      <h2>Map data and credits</h2>
      <ul>
        <li>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the Open Database License.</li>
        <li>Map tiles and style by <a href="https://openfreemap.org">OpenFreeMap</a>.</li>
        <li>Terrain by Mapzen and Tilezen, through AWS Open Data.</li>
        <li>Satellite imagery © Esri, Maxar, Earthstar Geographics.</li>
      </ul>
      <p>Their own terms apply to their data.</p>

      <h2>Correction reports</h2>
      <p>
        Don&apos;t include other people&apos;s personal information in a report. By sending one, you let us
        use it to update the guide. We may edit or decline any report.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is provided as it is, without warranties of any kind, to the extent Philippine law allows.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Republic of the Philippines.</p>

      <h2>Contact</h2>
      <p>
        {CONTACT_EMAIL ? <>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or use the </> : <>Use the </>}
        <Link href="/corrections">correction form</Link>.
      </p>
    </article>
  );
}
```

- [ ] **Step 6: About** `app/about/page.tsx`:
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { FARE_SOURCE } from "@/lib/geo/fare";
import { DATA_SOURCES, OSM_BUILDINGS } from "@/lib/sources";

export const metadata: Metadata = {
  title: "About",
  description: "How Baguio 3D is built: the open data behind the 3D map, how heights and fares were checked, and how to report a mistake.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <article className="legal-prose">
        <Breadcrumbs trail={[{ name: "About", path: "/about" }]} />
        <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">About Baguio 3D</h1>
        <p>
          Baguio sits on ridges and in ravines, and a flat map hides most of that. Baguio 3D puts the city
          on its real terrain, then adds what a visitor needs on top: landmarks, jeepney routes with fares,
          and places to eat and stay with their opening hours.
        </p>

        <h2 id="sources">What it&apos;s made of</h2>
        <ul>
          {DATA_SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.href}>{s.name}</a>: {s.supplies}.
            </li>
          ))}
        </ul>
        <p>
          OpenStreetMap has {OSM_BUILDINGS.count.toLocaleString("en-PH")} building footprints inside the map
          area, counted on {OSM_BUILDINGS.countedOn}.
        </p>

        <h2>How it was checked</h2>
        <p>
          Every destination&apos;s height was re-sampled from the same terrain model the map draws, after the
          original figures turned out to be off by up to 441 m. Fares were checked against the LTFRB on{" "}
          {FARE_SOURCE.checkedOn}. The terrain is drawn 1.35 times taller than life so slopes read on a
          phone screen.
        </p>

        <h2>Found a mistake?</h2>
        <p>
          <Link href="/corrections">Suggest a correction</Link>. Hours and fares change, and reports from
          visitors are how the guide stays right.
        </p>
      </article>
    </div>
  );
}
```
(When D5 is answered yes, add a "Source code" line linking the repository. When a real photo of the maker is provided, add it under a "Who made it" heading with descriptive alt text. Don't add either before then.)

Add `/privacy`, `/terms`, `/about` to `PAGES`.

- [ ] **Step 7: Run** the legal spec, the meta gate and the overflow gate → PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/sources.ts "app/(legal)" app/about app/globals.css tests
git commit -m "Add privacy policy, terms of use and an about page drawn from what the code does"
```

---

### Task 17: robots.txt and sitemap.xml

**Files:**
- Create: `app/robots.ts`, `app/sitemap.ts`, `tests/e2e/crawl-files.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

test("robots.txt allows the site, blocks the API and points at the sitemap", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /api/");
  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("the sitemap lists every page and destination, and each one resolves", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of PAGES) expect(urls).toContain(path);
  expect(urls.filter((u) => u.startsWith("/destinations/")).length).toBe(22);
  for (const path of urls) expect((await request.get(path)).status(), path).toBe(200);
});
```
Run → FAIL (404s).

- [ ] **Step 2: Implement**

`app/robots.ts`:
```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/corrections/thanks"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

`app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { getDestinations } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

const PAGES = ["/", "/map", "/destinations", "/eat-stay", "/transit", "/history", "/about", "/corrections", "/privacy", "/terms"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destinations = await getDestinations();
  return [
    ...PAGES.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` })),
    ...destinations.map((d) => ({ url: `${SITE_URL}/destinations/${d.slug}` })),
  ];
}
```
(`new URL("https://x").pathname` is `/`, so the homepage entry matches `PAGES`.)

- [ ] **Step 3: Run** → PASS.

- [ ] **Step 4: Commit**

```bash
git add app/robots.ts app/sitemap.ts tests/e2e/crawl-files.spec.ts
git commit -m "Serve robots.txt and a sitemap of every page and destination"
```

---

## Phase 6: nav, footer, mobile CTA

### Task 18: Nav with three links and one CTA

**Files:**
- Modify: `components/site/SiteNav.tsx`, `tests/e2e/nav.spec.ts`, `tests/e2e/nav.mobile.spec.ts`

- [ ] **Step 1: Extend the gates (failing)**

Add to `tests/e2e/nav.spec.ts`:
```ts
test("the desktop nav has three page links and one call to action", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link")).toHaveText(["Destinations", "Jeepneys", "Eat & stay", "Open the 3D map"]);
});

test("the header is solid, not frosted glass", async ({ page }) => {
  await page.goto("/");
  const blur = await page.locator("header").first().evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(blur === "none" || blur === "").toBe(true);
});
```
Add to `tests/e2e/nav.mobile.spec.ts`:
```ts
test("the mobile menu matches the desktop links and closes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile" });
  await expect(menu.getByRole("link")).toHaveText(["Destinations", "Jeepneys", "Eat & stay", "Open the 3D map"]);
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(menu).toBeHidden();
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `components/site/SiteNav.tsx`:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import { cn } from "@/lib/utils";
import { PineMark } from "@/components/site/PineMark";

// History left the nav (ruling R3): it's linked from the homepage, from every
// destination with an era, and from the sitemap.
const NAV_LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/transit", label: "Jeepneys" },
  { href: "/eat-stay", label: "Eat & stay" },
] as const;

/** Three threads of unequal length: the weave's own menu glyph. */
function MenuGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h9" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Baguio 3D home">
          <PineMark className="size-5 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Baguio<span className="text-primary"> 3D</span>
          </span>
          <span className="readout mt-0.5 hidden text-muted-foreground lg:inline">1,500 m</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative px-3 py-2 text-sm font-medium transition-colors",
                  "after:absolute after:inset-x-3 after:-bottom-[9px] after:h-0.5 after:bg-primary after:transition-transform",
                  active ? "text-foreground after:scale-x-100" : "text-muted-foreground after:scale-x-0 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Button component={Link} href="/map" size="small" className="ml-3">
            Open the 3D map
          </Button>
        </nav>

        <div className="md:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="flex size-10 items-center justify-center">
            <MenuGlyph />
          </button>
          <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)} slotProps={{ paper: { sx: { width: 288 } } }}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2 font-display text-lg">
                <PineMark className="size-4 text-primary" /> Baguio 3D
              </span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex size-10 items-center justify-center text-2xl leading-none">
                ×
              </button>
            </div>
            <div className="weave-band" aria-hidden="true" />
            <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn("px-3 py-3 text-base font-medium hover:bg-muted", isActive(link.href) && "bg-muted")}
                >
                  {link.label}
                </Link>
              ))}
              <Button component={Link} href="/map" onClick={() => setMenuOpen(false)} className="mt-4" size="large">
                Open the 3D map
              </Button>
            </nav>
          </Drawer>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Run** the nav specs and the full e2e → PASS.

- [ ] **Step 4: Commit**

```bash
git add components/site/SiteNav.tsx tests/e2e/nav*.ts
git commit -m "Cut the nav to three links and one CTA; solid header; drawn menu glyph"
```

---

### Task 19: Footer with legal and contact links

**Files:**
- Modify: `components/site/SiteFooter.tsx`
- Create: `tests/e2e/footer.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("the footer carries legal and contact links, not a page list", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  for (const [name, href] of [
    ["Privacy policy", "/privacy"],
    ["Terms of use", "/terms"],
    ["Data sources", "/about#sources"],
    ["Suggest a correction", "/corrections"],
  ]) {
    await expect(footer.getByRole("link", { name })).toHaveAttribute("href", href);
  }
  await expect(footer.getByRole("link", { name: "hello@example.test" })).toHaveAttribute("href", "mailto:hello@example.test");
  await expect(footer.getByRole("link", { name: "Destinations" })).toHaveCount(0);
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `components/site/SiteFooter.tsx`:
```tsx
import Link from "next/link";
import { Treeline } from "@/components/site/atmosphere";
import { PineMark } from "@/components/site/PineMark";
import { CONTACT_EMAIL } from "@/lib/site";

// Page links live in the nav, the homepage and the sitemap (ruling R2).
const LEGAL = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/about#sources", label: "Data sources" },
] as const;

const link = "text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline";

export function SiteFooter() {
  return (
    <footer>
      <Treeline className="text-primary/70" />
      {/* Bottom padding on phones leaves room for the sticky map button. */}
      <div className="border-t border-border bg-secondary/60 pb-20 md:pb-0">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
              <PineMark className="size-4 text-primary" />
              <span>
                Baguio<span className="text-primary"> 3D</span>
              </span>
            </p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              A 3D map and field guide to Baguio City, free to use without an account.
            </p>
          </div>
          <nav aria-label="Legal" className="space-y-3">
            <h2 className="text-sm font-medium">Legal</h2>
            <ul className="space-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Contact</h2>
            <ul className="space-y-2">
              <li>
                <Link href="/corrections" className={link}>Suggest a correction</Link>
              </li>
              {CONTACT_EMAIL ? (
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={link}>{CONTACT_EMAIL}</a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6">
            <p>© {new Date().getFullYear()} Baguio 3D</p>
            <p>
              Map data ©{" "}
              <a href="https://www.openstreetmap.org/copyright" className="underline underline-offset-4 hover:text-foreground">
                OpenStreetMap contributors
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
```
In `app/page.tsx`, delete the `<Treeline />` inside the closing CTA section so the page has one treeline, the footer's (the dead band in screenshot 1).

- [ ] **Step 3: Run** footer + links + overflow gates → PASS.

- [ ] **Step 4: Commit**

```bash
git add components/site/SiteFooter.tsx app/page.tsx tests/e2e/footer.spec.ts
git commit -m "Footer: legal and contact links, OSM credit, one treeline"
```

---

### Task 20: Sticky map button on phones

**Files:**
- Create: `components/site/StickyCta.tsx`, `tests/e2e/sticky-cta.mobile.spec.ts`
- Modify: `app/layout.tsx` (mount after `<SiteFooter />`)

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("after the first screen, a map button stays pinned to the bottom", async ({ page }) => {
  await page.goto("/destinations");
  const bar = page.getByTestId("sticky-cta");
  await expect(bar).not.toBeInViewport();
  await page.mouse.wheel(0, 1200);
  await expect(bar.getByRole("link", { name: "Open the 3D map" })).toBeInViewport();
  await bar.getByRole("link", { name: "Open the 3D map" }).click();
  await expect(page).toHaveURL("/map");
  await expect(page.getByTestId("sticky-cta")).toHaveCount(0);
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `components/site/StickyCta.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const HIDDEN_ON = [/^\/map(\/|$)/, /^\/corrections(\/|$)/];

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}
const pastFirstScreen = () => window.scrollY > window.innerHeight * 0.6;

/** Phones only: once the visitor scrolls past the first screen, keep the map one tap away. */
export function StickyCta() {
  const pathname = usePathname();
  const shown = useSyncExternalStore(subscribe, pastFirstScreen, () => false);
  if (HIDDEN_ON.some((re) => re.test(pathname))) return null;

  return (
    <div
      data-testid="sticky-cta"
      inert={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 md:hidden motion-reduce:transition-none",
        shown ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link href="/map" className="flex h-12 w-full items-center justify-center bg-primary text-base font-medium text-primary-foreground">
        Open the 3D map
      </Link>
    </div>
  );
}
```
Mount in `app/layout.tsx` right after `<SiteFooter />`: `<StickyCta />`.

- [ ] **Step 3: Run** → PASS (mobile project).

- [ ] **Step 4: Commit**

```bash
git add components/site/StickyCta.tsx app/layout.tsx tests/e2e/sticky-cta.mobile.spec.ts
git commit -m "Pin a map button to the bottom on phones after the first screen"
```

---

## Phase 7: the homepage

Design plan (from the frontend-design brief, reviewed against the audit):
- **Identity unchanged:** bone ground, warp text, madder as the one accent, Archivo wide display, mono only for measurements.
- **The one bold thing:** the Problem section's wireframe. Baguio's real ground, sampled from the same terrain model the map uses, starts as a flat grid and rises into relief as the section scrolls in, with the madder ridges surfacing last. The product's whole argument in one motion.
- **Three existing pieces, each given a new job** (owner decision, 2026-09-24):
  - the **wireframe** moves from hero decoration to the Problem section, where rising from flat *is* the point;
  - the **coverflow carousel** stops being a highlights reel and becomes the controller for the live map in Solution: pick a place, the map flies there;
  - the **parallax ridgelines** move from behind the history teaser to behind the closing CTA, whose line is about the hills.
- **Layout:** left-aligned editorial column, `max-w-6xl`, sections divided by hairlines. No eyebrow labels, no stat strips. Section order is the brief's: Hero, Proof, Problem, Solution, FAQ, CTA.
- **Motion:** the weave band draws once under the hero; the wireframe rises and the ridgelines drift with scroll; the map moves only when a visitor picks a place. All of it holds still under `prefers-reduced-motion`, and WebGL stops drawing when offscreen.

### Task 21: Pull the map's data sources out of MapView

**Files:**
- Create: `lib/map/sources.ts`
- Modify: `components/map/MapView.tsx`, `app/api/geo/terrain/route.ts`

**Interfaces:**
- Produces: `BASEMAP_STYLE: string`, `SATELLITE_STYLE: StyleSpecification`, `DEM_SOURCE = "terrain-dem"`, `TERRAIN_EXAGGERATION = 1.35`, `applyTerrain(map: MapLibreMap, exaggeration?: number): void`.

No behavior change; this is a move so the homepage demo can reuse it.

- [ ] **Step 1: Create `lib/map/sources.ts`** by moving, unchanged, from `components/map/MapView.tsx`: `BASEMAP_STYLE`, `SATELLITE_STYLE` (with its comment), `DEM_SOURCE`, and the body of `applyTerrain` (the DEM `addSource`, `setTerrain`, and the `setSky` try/catch). Export them, plus:
```ts
/** Drawn taller than life so slopes read on a phone screen. The terrain API reports this value. */
export const TERRAIN_EXAGGERATION = 1.35;

export function applyTerrain(m: MapLibreMap, exaggeration = TERRAIN_EXAGGERATION) {
  // …moved body, unchanged…
}
```

- [ ] **Step 2: Point the callers at it.** In `MapView.tsx`, import the five names and delete the local copies; `let exaggeration = TERRAIN_EXAGGERATION;`. In `app/api/geo/terrain/route.ts`, `exaggeration: TERRAIN_EXAGGERATION`.

- [ ] **Step 3: Verify nothing moved**

Run: `npx tsc --noEmit` → clean. Run the full e2e → PASS. Then, in the Playwright browser on `/map`, read the map instance (walk up from `.maplibregl-map` to a React fiber, find the ref with `getPitch`) and check: `getTerrain().exaggeration === 1.35`, layer `terrain-hillshade` exists, `getPaintProperty("water", "fill-color") === "#9FB3C4"`, and toggling satellite twice raises no page errors.

- [ ] **Step 4: Commit**

```bash
git add lib/map/sources.ts components/map/MapView.tsx app/api/geo/terrain/route.ts
git commit -m "Move basemap styles and terrain setup into lib/map/sources"
```

---

### Task 22: Map posters and the live demo component

**Files:**
- Create: `scripts/capture-map-posters.mjs`, `public/home/hero-map.jpg`, `public/home/demo-map.jpg`, `components/home/MapDemo.tsx`, `tests/unit/posters.test.ts`

**Interfaces:**
- Consumes: `BASEMAP_STYLE`, `DEM_SOURCE`, `applyTerrain` (Task 21), `applyWeaveBasemap` (`components/map/basemapTheme.ts`), `DEFAULT_CAMERA` (`lib/constants.ts`).
- Produces: `DemoTarget = { slug: string; name: string; lng: number; lat: number }` and `<MapDemo target={DemoTarget | null} />` (client). The map flies to `target` whenever it changes; Task 25's carousel supplies it. With `target` null the map never moves on its own.

- [ ] **Step 1: Capture the posters**

`scripts/capture-map-posters.mjs`:
```js
// Captures two stills of the running app's map for the homepage.
// Usage: npm run dev (or start), then: node scripts/capture-map-posters.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Hide everything but the map canvas: HUD panels, header, attribution. The
// homepage prints the attribution under each image instead.
const MAP_ONLY =
  "body * { visibility: hidden !important; } .maplibregl-canvas-container, .maplibregl-canvas { visibility: visible !important; }";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

async function capture(path, preset) {
  await page.goto(`${BASE}/map`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);
  if (preset) {
    await page.getByRole("button", { name: preset }).click();
    await page.waitForTimeout(9000);
  }
  await page.addStyleTag({ content: MAP_ONLY });
  await page.locator(".maplibregl-map").screenshot({ path, type: "jpeg", quality: 78 });
}

await capture("public/home/hero-map.jpg", "Burnham");
await capture("public/home/demo-map.jpg", null);
await browser.close();
```
Run it against a dev server with the database up (markers need it). Open both files and check: bone/madder basemap, hillshade visible, destination markers present, no HUD.

- [ ] **Step 2: Budget test**

`tests/unit/posters.test.ts`:
```ts
import { statSync } from "node:fs";
import { expect, it } from "vitest";

it("homepage posters stay under 250 KB", () => {
  for (const file of ["public/home/hero-map.jpg", "public/home/demo-map.jpg"]) {
    expect(statSync(file).size, file).toBeLessThan(250_000);
  }
});
```
Run → PASS (if not, recapture at `quality: 70`).

- [ ] **Step 3: The demo component** `components/home/MapDemo.tsx`:
```tsx
"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Map as MapLibreMap } from "maplibre-gl";
import { applyWeaveBasemap } from "@/components/map/basemapTheme";
import { DEFAULT_CAMERA } from "@/lib/constants";
import { BASEMAP_STYLE, DEM_SOURCE, applyTerrain } from "@/lib/map/sources";
import { cn } from "@/lib/utils";

export interface DemoTarget {
  slug: string;
  name: string;
  lng: number;
  lat: number;
}

type Stage = "poster" | "loading" | "live";

/**
 * The real map, on the homepage. MapLibre loads only when this scrolls into
 * view (and not at all on Save-Data), so the page's first paint is an image.
 * It moves only when `target` changes, and `target` only changes when a
 * visitor picks a place in the carousel.
 */
export function MapDemo({ target }: { target: DemoTarget | null }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [stage, setStage] = useState<Stage>("poster");

  useEffect(() => {
    const frame = frameRef.current;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!frame || saveData) return;
    let cancelled = false;

    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setStage("loading");
        const { default: maplibregl } = await import("maplibre-gl");
        if (cancelled || !canvasRef.current) return;
        const map = new maplibregl.Map({
          container: canvasRef.current,
          style: BASEMAP_STYLE,
          center: DEFAULT_CAMERA.center as [number, number],
          zoom: DEFAULT_CAMERA.zoom,
          pitch: DEFAULT_CAMERA.pitch,
          bearing: DEFAULT_CAMERA.bearing,
          scrollZoom: false, // never hijack page scrolling
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map.on("style.load", () => {
          applyTerrain(map);
          applyWeaveBasemap(map, DEM_SOURCE);
        });
        map.once("idle", () => {
          if (!cancelled) setStage("live");
        });
        mapRef.current = map;
      },
      { rootMargin: "200px" },
    );
    io.observe(frame);

    return () => {
      cancelled = true;
      io.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to the picked place. If the map is still loading, this runs again
  // once it's live, so the visitor's last pick is where it lands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stage !== "live" || !target) return;
    const to = { center: [target.lng, target.lat] as [number, number], zoom: 15.2, pitch: 62, bearing: -20 };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.jumpTo(to);
    else map.flyTo({ ...to, duration: 2400 });
  }, [target, stage]);

  return (
    <figure className="weave-edge border-y border-r border-border bg-card">
      <div ref={frameRef} className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]">
        <div ref={canvasRef} className="absolute inset-0" role="region" aria-label="Interactive 3D map preview" />
        <Image
          src="/home/demo-map.jpg"
          alt=""
          fill
          sizes="(min-width: 1024px) 56vw, 100vw"
          className={cn("pointer-events-none object-cover transition-opacity duration-500", stage === "live" && "opacity-0")}
        />
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3">
        <p role="status" className="text-sm font-medium">
          {target
            ? `Showing ${target.name} on the map`
            : stage === "loading"
              ? "Loading the terrain…"
              : "Pick a place below and the map flies there"}
        </p>
        <span className="text-xs text-muted-foreground">Map data © OpenStreetMap contributors, OpenFreeMap</span>
      </figcaption>
    </figure>
  );
}
```
(The poster is decorative once the live map sits under it, hence `alt=""`; the region label names the map.)

- [ ] **Step 4: Verify** with `npx tsc --noEmit`. The component is exercised by Task 25's e2e.

- [ ] **Step 5: Commit**

```bash
git add scripts/capture-map-posters.mjs public/home components/home/MapDemo.tsx tests/unit/posters.test.ts
git commit -m "Capture homepage map stills and build the lazy live map demo"
```

---

### Task 23: Hero and Proof

**Files:**
- Create: `components/home/Hero.tsx`, `components/home/Proof.tsx`, `tests/e2e/home.spec.ts`, `tests/e2e/home.mobile.spec.ts`
- Modify: `app/page.tsx` (replace the old hero section; insert Proof after it)

**Interfaces:**
- Produces: `<Hero destinations={number} venues={number} />`; `<Proof destinations={number} venues={number} />`.

- [ ] **Step 1: Write the failing tests**

`tests/e2e/home.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("the hero says what the site is and shows the real map", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Baguio City, mapped in 3D.");
  await expect(page.locator('img[src*="hero-map"]')).toBeVisible();
  await expect(page.getByText(/Free, no account\./)).toBeVisible();
});

test("proof is sources and measurements, not testimonials", async ({ page }) => {
  await page.goto("/");
  const proof = page.locator("section", { has: page.getByRole("heading", { name: "What the map is made of" }) });
  await expect(proof.getByRole("link", { name: /OpenStreetMap contributors/ })).toBeVisible();
  await expect(proof.getByText("120,751")).toBeVisible();
});
```
`tests/e2e/home.mobile.spec.ts`:
```ts
import { expect, test } from "@playwright/test";

test("the main CTA is above the fold on a phone", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("main").getByRole("link", { name: "Open the 3D map" }).first();
  const box = await cta.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
```
Run → FAIL.

- [ ] **Step 2: Hero** `components/home/Hero.tsx`:
```tsx
import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/LinkButton";
import { ScrollReveal } from "@/components/site/Motion";

export function Hero({ destinations, venues }: { destinations: number; venues: number }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14 lg:pb-20">
        <div className="min-w-0">
          <h1 className="font-display text-[2.5rem] leading-[0.95] text-balance sm:text-6xl lg:text-[4.25rem]">
            Baguio City, mapped in 3D.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-8 text-muted-foreground text-pretty">
            Tilt the terrain to see how steep the walk really is. Find {destinations} places worth the climb,
            the jeepney that gets you there, and {venues} places to eat and stay. Free, no account.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <LinkButton href="/map" size="large">Open the 3D map</LinkButton>
            <Link href="#how-it-works" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              See how it works
            </Link>
          </div>
        </div>
        <Link href="/map" className="weave-edge block min-w-0 border-y border-r border-border" tabIndex={-1} aria-hidden="true">
          <Image
            src="/home/hero-map.jpg"
            alt=""
            width={1600}
            height={1000}
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="h-auto w-full"
          />
        </Link>
      </div>
      {/* The page's one orchestrated moment: the band draws itself across. */}
      <ScrollReveal variant="weave">
        <div className="weave-band" aria-hidden="true" />
      </ScrollReveal>
    </section>
  );
}
```
(The image link duplicates the CTA for mouse users, so it's hidden from keyboard and screen readers rather than announced twice.)

- [ ] **Step 3: Proof** `components/home/Proof.tsx`:
```tsx
import { FARE_SOURCE } from "@/lib/geo/fare";
import { OSM_BUILDINGS } from "@/lib/sources";
import { TERRAIN_EXAGGERATION } from "@/lib/map/sources";

const n = (x: number) => x.toLocaleString("en-PH");
const date = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { dateStyle: "long" });

export function Proof({ destinations, venues }: { destinations: number; venues: number }) {
  const rows = [
    {
      layer: "Terrain",
      source: { name: "AWS Terrain Tiles (Mapzen, Tilezen)", href: "https://registry.opendata.aws/terrain-tiles/" },
      measured: <>Drawn {TERRAIN_EXAGGERATION}× taller than life, so slopes read on a phone.</>,
    },
    {
      layer: "Streets and buildings",
      source: { name: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
      measured: <><span className="font-mono text-foreground">{n(OSM_BUILDINGS.count)}</span> building footprints in the map area, counted {date(OSM_BUILDINGS.countedOn)}.</>,
    },
    {
      layer: "Places",
      source: { name: "Curated for this guide", href: "/about#sources" },
      measured: <>{destinations} landmarks and {venues} places to eat and stay, every height re-checked against the terrain.</>,
    },
    {
      layer: "Fares",
      source: { name: "LTFRB fare structure", href: FARE_SOURCE.jeepney.url },
      measured: <>Checked {date(FARE_SOURCE.checkedOn)}.</>,
    },
  ];

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 className="font-display text-3xl leading-[1.05] sm:text-4xl">What the map is made of</h2>
        <p className="mt-3 max-w-[60ch] text-muted-foreground">
          Open data you can check, and the numbers we measured from it.
        </p>
        <dl className="mt-10 border-t border-border">
          {rows.map((r) => (
            <div key={r.layer} className="grid gap-1 border-b border-border py-5 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-8">
              <dt className="font-medium">{r.layer}</dt>
              <dd>
                <a href={r.source.href} className="text-primary underline-offset-4 hover:underline">{r.source.name}</a>
              </dd>
              <dd className="text-muted-foreground">{r.measured}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Mount them.** In `app/page.tsx`, replace the whole `{/* Hero */}` `<section>` (the gradient wash, `TerrainCanvas`, `FogBank`, coordinates readout, stat grid and weave band) with:
```tsx
      <Hero destinations={destinations.length} venues={venues.length} />
      <Proof destinations={destinations.length} venues={venues.length} />
```
Remove the now-unused imports (`TerrainCanvas`, `ContourIcon`, `RouteIcon`, `PineIcon`, `FogIcon`, `FogBank` if unused).

- [ ] **Step 5: Run** the home specs, overflow and meta gates → PASS. Screenshot `/` at 1440×900 and 375×812 and check against the design plan.

- [ ] **Step 6: Commit**

```bash
git add components/home/Hero.tsx components/home/Proof.tsx app/page.tsx tests/e2e/home*.ts
git commit -m "Homepage hero says what the site does and shows the map; proof from sources"
```

---

### Task 24: Problem section, with the wireframe rising from a flat map

**Files:**
- Create: `lib/relief.ts`, `tests/unit/relief.test.ts`, `components/home/LazyTerrain.tsx`, `components/home/Problem.tsx`
- Modify: `components/site/TerrainCanvas.tsx` (scroll-linked rise, offscreen pause), `app/page.tsx` (insert after Proof; remove the old Highlights section, whose carousel returns with a new job in Task 25), `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: corrected `elevationM` (Task 4); `public/baguio-heightmap.json` (existing: 96×96 Terrarium z13 samples over exactly the model bounds, 153–2,230 m).
- Produces: `relief(origin, places): Relief` with `Relief = { points: ReliefPoint[]; lowest; highest; spanM }` and `ReliefPoint = { slug; name; elevationM; km }`; `<TerrainCanvas riseOnScroll? />`; `<LazyTerrain className? />`; `<Problem relief originName minFare withHours total />`.

- [ ] **Step 1: Write the failing unit test**

`tests/unit/relief.test.ts`:
```ts
import { expect, it } from "vitest";
import { relief } from "@/lib/relief";

const origin = { lng: 120.5936, lat: 16.4116 };
const places = [
  { slug: "burnham-park", name: "Burnham Park", lng: 120.5936, lat: 16.4116, elevationM: 1442 },
  { slug: "mines-view-park", name: "Mines View Park", lng: 120.628, lat: 16.4201, elevationM: 1523 },
  { slug: "bencab-museum", name: "BenCab Museum", lng: 120.549, lat: 16.382, elevationM: 979 },
  { slug: "no-height", name: "No height", lng: 120.6, lat: 16.41, elevationM: null },
];

it("orders places by distance and finds the span", () => {
  const r = relief(origin, places);
  expect(r.points.map((p) => p.slug)).toEqual(["burnham-park", "mines-view-park", "bencab-museum"]);
  expect(r.lowest.slug).toBe("bencab-museum");
  expect(r.highest.slug).toBe("mines-view-park");
  expect(r.spanM).toBe(544);
});
```
Run → FAIL.

- [ ] **Step 2: Implement** `lib/relief.ts`:
```ts
import { haversineKm } from "@/lib/geo/fare";

export interface ReliefPoint {
  slug: string;
  name: string;
  elevationM: number;
  km: number;
}
export interface Relief {
  points: ReliefPoint[];
  lowest: ReliefPoint;
  highest: ReliefPoint;
  spanM: number;
}

/**
 * Places by distance from `origin` and by height, for the homepage Problem
 * section's copy and its screen-reader table. Heights are the terrain-sampled
 * values from scripts/fix-elevations.py, so every number shown is measured.
 */
export function relief(
  origin: { lng: number; lat: number },
  places: { slug: string; name: string; lng: number; lat: number; elevationM: number | null }[],
): Relief {
  const points = places
    .filter((p): p is typeof p & { elevationM: number } => p.elevationM != null)
    .map((p) => ({ slug: p.slug, name: p.name, elevationM: p.elevationM, km: haversineKm([origin.lng, origin.lat], [p.lng, p.lat]) }))
    .sort((a, b) => a.km - b.km);
  if (points.length === 0) throw new Error("relief() needs at least one place with a height");
  const byHeight = [...points].sort((a, b) => a.elevationM - b.elevationM);
  const lowest = byHeight[0];
  const highest = byHeight[byHeight.length - 1];
  return { points, lowest, highest, spanM: highest.elevationM - lowest.elevationM };
}
```
Run → PASS.

- [ ] **Step 3: Teach the wireframe to rise, and to rest offscreen**

`components/site/TerrainCanvas.tsx`. Update the doc comment's first line from "The hero's 3D element" to "Baguio's actual topography as a wireframe (homepage Problem section)". Then:

Add the prop:
```tsx
export function TerrainCanvas({
  className,
  style,
  riseOnScroll = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Start as a flat grid and rise to full relief as the element scrolls into view. */
  riseOnScroll?: boolean;
}) {
```
Add, right after `const reduced = …`:
```ts
    // Mid-page WebGL shouldn't spend frames nobody can see.
    let onScreen = true;
    const visibility = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { rootMargin: "100px" },
    );
    visibility.observe(host);

    // Flat as the element enters the viewport, full relief once its top has
    // travelled 80% of the viewport height. The flat grid is the flat map; the
    // rise is the ground it hides.
    const riseNow = () => {
      if (!riseOnScroll || reduced) return 1;
      const top = host.getBoundingClientRect().top;
      const vh = window.innerHeight;
      return Math.min(1, Math.max(0.02, (vh - top) / (vh * 0.8)));
    };
```
Replace `tick`:
```ts
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!onScreen) return;
      const t = (performance.now() - start) / 1000;
      const rise = riseNow();
      if (mesh && ridge) {
        // Heights live on the plane's local z (it's rotated flat), so scaling
        // z lifts the relief without moving the grid.
        mesh.scale.z = rise;
        ridge.scale.z = rise;
        // The madder ridges surface last, arriving with the relief.
        (ridge.material as THREE.LineBasicMaterial).opacity = 0.85 * rise * rise;
      }
      if (!reduced) {
        group.rotation.z = Math.sin(t * 0.055) * 0.14;
        camera.position.x += (target.x * 1.5 - camera.position.x) * 0.035;
        camera.position.y += (7.6 - target.y * 0.9 - camera.position.y) * 0.035;
        camera.lookAt(0, -0.6, 0);
      }
      renderer.render(scene, camera);
    };
```
Add `visibility.disconnect();` to the cleanup, and `riseOnScroll` to the effect's dependency array.

- [ ] **Step 4: Load it only when it's about to be seen** `components/home/LazyTerrain.tsx`:
```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const TerrainCanvas = dynamic(
  () => import("@/components/site/TerrainCanvas").then((m) => m.TerrainCanvas),
  { ssr: false },
);

/**
 * Mounts the three.js wireframe, and fetches its heightmap, only when the
 * Problem section is about to scroll into view. Nothing loads for visitors
 * who never scroll that far.
 */
export function LazyTerrain({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {near ? <TerrainCanvas riseOnScroll className="size-full" /> : null}
    </div>
  );
}
```

- [ ] **Step 5: The section** `components/home/Problem.tsx`:
```tsx
import type { Relief } from "@/lib/relief";
import { LazyTerrain } from "./LazyTerrain";

export function Problem({
  relief,
  originName,
  minFare,
  withHours,
  total,
}: {
  relief: Relief;
  originName: string;
  minFare: number;
  withHours: number;
  total: number;
}) {
  const m = (x: number) => <span className="font-mono text-foreground">{x.toLocaleString("en-PH")} m</span>;
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="max-w-[18ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
          A flat map hides the hills.
        </h2>

        <figure className="mt-8">
          {/* The edges fade so the grid reads as a landscape, not a box. */}
          <LazyTerrain className="h-[280px] w-full [mask-image:linear-gradient(to_right,transparent,#000_10%,#000_90%,transparent)] sm:h-[440px]" />
          <figcaption className="mt-3 max-w-[60ch] text-sm text-muted-foreground">
            The real ground under the map area, drawn from the terrain model the 3D map uses.
          </figcaption>
          <table className="sr-only">
            <caption>Height of each place in the guide</caption>
            <thead>
              <tr><th>Place</th><th>Distance from {originName}</th><th>Height</th></tr>
            </thead>
            <tbody>
              {relief.points.map((p) => (
                <tr key={p.slug}><td>{p.name}</td><td>{p.km.toFixed(1)} km</td><td>{p.elevationM} m</td></tr>
              ))}
            </tbody>
          </table>
        </figure>

        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">The climbs are real.</span> {relief.lowest.name} sits{" "}
            {m(relief.spanM)} below {relief.highest.name}. Between ridges the road switches back and the
            shortcut is a stairway, and a flat map shows none of it.
          </p>
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">The cheapest ride takes local knowledge.</span>{" "}
            Jeepneys start at <span className="font-mono text-foreground">₱{minFare}</span>, if you know which
            one to board.
          </p>
          <p className="leading-7 text-muted-foreground">
            <span className="font-medium text-foreground">Hours move.</span> {withHours} of {total} places in this
            guide post opening hours, and they shift around holidays. A closed gate is a long walk back uphill.
          </p>
        </div>
      </div>
    </section>
  );
}
```
(`mask-image` hides pixels; it paints nothing, so it isn't the gradient tell.)

- [ ] **Step 6: Mount it and gate it.** In `app/page.tsx`: compute, then render `<Problem>` right after `<Proof>`; delete the whole `{/* Highlights */}` section (the carousel returns in Task 25).
```tsx
  const origin = destinations.find((d) => d.slug === "burnham-park") ?? destinations[0];
  const places = [...destinations, ...venues];
  const withHours = places.filter((p) => p.hours != null).length;
```
```tsx
      <Problem
        relief={relief(origin, destinations)}
        originName={origin.name}
        minFare={Math.min(...routes.map((r) => r.fareBase))}
        withHours={withHours}
        total={places.length}
      />
```
Add to `tests/e2e/home.spec.ts`:
```ts
test("the wireframe loads only as the problem section nears, and every height is listed", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  expect(requests.some((u) => u.includes("baguio-heightmap.json"))).toBe(false);

  const heading = page.getByRole("heading", { name: "A flat map hides the hills." });
  await heading.scrollIntoViewIfNeeded();
  await expect.poll(() => requests.some((u) => u.includes("baguio-heightmap.json"))).toBe(true);
  const problem = page.locator("section", { has: heading });
  await expect(problem.locator("canvas")).toBeAttached();
  await expect(problem.locator("table.sr-only tbody tr")).toHaveCount(22);
});
```

- [ ] **Step 7: Run and look.** Unit + e2e (home; overflow at 360/375/414) → PASS. Then in the Playwright browser at 1440×900, screenshot the figure twice: once with the section's top just inside the bottom of the viewport (expect a near-flat grid, no madder), once with the section centered (expect full relief, madder ridges). Repeat with `page.emulateMedia({ reducedMotion: "reduce" })`: full relief both times, no drift.

- [ ] **Step 8: Commit**

```bash
git add lib/relief.ts components/site/TerrainCanvas.tsx components/home/LazyTerrain.tsx components/home/Problem.tsx app/page.tsx tests
git commit -m "Problem section: the real terrain rises out of a flat grid as it scrolls in"
```

---

### Task 25: Solution section, where the carousel steers the live map

**Files:**
- Create: `components/home/TerrainTour.tsx`, `components/home/Solution.tsx`
- Modify: `components/site/DestinationCarousel.tsx` (reports the active place, loads the A11y module, compact slides), `app/globals.css` (arrows below the slides), `app/page.tsx` (replace the History and Transit + Eat sections), `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `<MapDemo target />` and `DemoTarget` (Task 22), `OpenNowBadge`, `PriceGlyphs`, `ContourIcon`, `RouteIcon`.
- Produces: `<DestinationCarousel destinations onActiveChange? />`; `<TerrainTour destinations />`; `<Solution featured routes venues eras />`, section `id="how-it-works"`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/e2e/home.spec.ts`:
```ts
test("the carousel steers the live map", async ({ page }) => {
  await page.goto("/");
  const how = page.locator("#how-it-works");
  await how.scrollIntoViewIfNeeded();
  await expect(how.locator("canvas.maplibregl-canvas")).toBeAttached({ timeout: 20_000 });
  await how.getByRole("button", { name: "Next destination" }).click();
  await expect(how.locator("figure").getByRole("status")).toHaveText(/^Showing .+ on the map$/);
  for (const href of ["/map", "/transit", "/eat-stay", "/history"]) {
    await expect(how.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
});

test("carousel arrows sit below the slides, never over their text", async ({ page }) => {
  await page.goto("/");
  const how = page.locator("#how-it-works");
  await how.scrollIntoViewIfNeeded();
  const next = await how.getByRole("button", { name: "Next destination" }).boundingBox();
  const slide = await how.locator(".swiper-slide-active article").boundingBox();
  expect(next!.y).toBeGreaterThanOrEqual(slide!.y + slide!.height);
});
```
Run → FAIL. (Today there is no "Next destination" button at all: the carousel passes `a11y` messages but never loads Swiper's `A11y` module, so its arrows are unlabeled divs. That's a bug in its own right.)

- [ ] **Step 2: Refit the carousel** `components/site/DestinationCarousel.tsx`:
```tsx
"use client";

import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, EffectCoverflow, Keyboard, Mousewheel, Navigation, Parallax } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";

import type { Destination } from "@/lib/content";
import { formatElevation } from "@/components/site/labels";

/**
 * Coverflow of places, used as the controller for the homepage's live map:
 * each slide you land on, the map flies to.
 *
 * The 3D tilt isn't decoration: slides rake back like ridgelines receding into
 * haze, which is how Baguio reads from a viewpoint. Slides carry only a name
 * and a measured height, so the receding ones never show clipped paragraphs.
 */
export function DestinationCarousel({
  destinations,
  onActiveChange,
}: {
  destinations: Destination[];
  onActiveChange?: (destination: Destination) => void;
}) {
  return (
    <div className="baguio-swiper relative">
      <Swiper
        modules={[A11y, EffectCoverflow, Navigation, Keyboard, Mousewheel, Parallax]}
        effect="coverflow"
        grabCursor
        centeredSlides
        parallax
        loop
        keyboard={{ enabled: true }}
        mousewheel={{ forceToAxis: true }}
        navigation
        onSlideChange={(swiper) => onActiveChange?.(destinations[swiper.realIndex])}
        slidesPerView={1.3}
        spaceBetween={16}
        coverflowEffect={{ rotate: 0, stretch: 0, depth: 130, modifier: 1, slideShadows: false }}
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 2.4, spaceBetween: 24 },
        }}
        a11y={{ prevSlideMessage: "Previous destination", nextSlideMessage: "Next destination" }}
      >
        {destinations.map((d) => (
          <SwiperSlide key={d.slug}>
            <article className="weave-edge h-full border-y border-r border-border bg-card px-5 py-5">
              <h3 className="font-display text-xl leading-tight" data-swiper-parallax="-40">
                <Link href={`/destinations/${d.slug}`} className="hover:text-primary">
                  {d.name}
                </Link>
              </h3>
              {d.elevationM != null ? (
                <p className="readout mt-2 text-muted-foreground" data-swiper-parallax="-20">
                  {formatElevation(d.elevationM)}
                </p>
              ) : null}
            </article>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
```
`onSlideChange` doesn't fire on first render, so the map stays put until someone swipes, clicks an arrow or presses an arrow key.

`app/globals.css`, in the Swiper block: replace the `.baguio-swiper .swiper { padding-block: … }` rule and add the arrow placement:
```css
.baguio-swiper .swiper { padding-block: 0.5rem 4rem; }
/* Arrows sit under the slides, left-aligned, so they never cover text (they
   used to overlay the middle of the cards). */
.baguio-swiper .swiper-button-prev,
.baguio-swiper .swiper-button-next { top: auto; bottom: 0; margin-top: 0; }
.baguio-swiper .swiper-button-prev { left: 0; right: auto; }
.baguio-swiper .swiper-button-next { left: 3.25rem; right: auto; }
```

- [ ] **Step 3: Couple it to the map** `components/home/TerrainTour.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { Destination } from "@/lib/content";
import { DestinationCarousel } from "@/components/site/DestinationCarousel";
import { MapDemo, type DemoTarget } from "./MapDemo";

/** The carousel steers the live map: each place a visitor lands on, the map flies to. */
export function TerrainTour({ destinations }: { destinations: Destination[] }) {
  const [target, setTarget] = useState<DemoTarget | null>(null);
  return (
    <div className="min-w-0 space-y-6">
      <MapDemo target={target} />
      <DestinationCarousel
        destinations={destinations}
        onActiveChange={(d) => setTarget({ slug: d.slug, name: d.name, lng: d.lng, lat: d.lat })}
      />
    </div>
  );
}
```

- [ ] **Step 4: The section** `components/home/Solution.tsx`:
```tsx
import Link from "next/link";
import type { Destination, TransitRouteContent, Venue } from "@/lib/content";
import { ContourIcon, RouteIcon } from "@/components/site/AnimatedIcons";
import { OpenNowBadge } from "@/components/site/OpenNowBadge";
import { PriceGlyphs } from "@/components/site/badges";
import { TerrainTour } from "./TerrainTour";

const more = "text-sm font-medium text-primary underline-offset-4 hover:underline";

export function Solution({
  featured,
  routes,
  venues,
  eras,
}: {
  featured: Destination[];
  routes: TransitRouteContent[];
  venues: Venue[];
  eras: number;
}) {
  const sample = venues.filter((v) => v.hours != null).slice(0, 4);
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="max-w-[20ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
          One map for the climb, the ride and the table.
        </h2>

        {/* Terrain: the live product, steered by the carousel */}
        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <ContourIcon className="size-6 text-primary" />
            <h3 className="mt-3 font-display text-2xl">Fly the terrain</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Every landmark sits on real ground heights. Pick a place and the map flies you over the ridges to it,
              before you walk it.
            </p>
            <Link href="/map" className={`mt-4 inline-block ${more}`}>Open the full map</Link>
          </div>
          <TerrainTour destinations={featured} />
        </div>

        {/* Jeepneys */}
        <div className="mt-16 grid gap-8 border-t border-border pt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <RouteIcon className="size-6 text-primary" />
            <h3 className="mt-3 font-display text-2xl">Board the right jeepney</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              {routes.length} routes from the City Plaza, each with its stops and a fare for your trip.
            </p>
            <Link href="/transit" className={`mt-4 inline-block ${more}`}>Routes and fares</Link>
          </div>
          <ul className="min-w-0 border-t border-border">
            {routes.slice(0, 4).map((r) => (
              <li key={r.code}>
                <Link href={`/map?route=${r.code}`} className="flex items-baseline justify-between gap-4 border-b border-border py-4 hover:bg-secondary">
                  <span className="min-w-0 truncate font-medium">{r.name}</span>
                  <span className="shrink-0 font-mono text-sm text-muted-foreground">from ₱{r.fareBase}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Hours */}
        <div className="mt-16 grid gap-8 border-t border-border pt-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0">
            <h3 className="font-display text-2xl">Know what&apos;s open</h3>
            <p className="mt-3 leading-7 text-muted-foreground">
              Every listing shows its hours and whether it&apos;s open right now, in Baguio time.
            </p>
            <Link href="/eat-stay" className={`mt-4 inline-block ${more}`}>Places to eat and stay</Link>
          </div>
          <ul className="min-w-0 border-t border-border">
            {sample.map((v) => (
              <li key={v.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-4">
                <span className="min-w-0 font-medium">{v.name}</span>
                <span className="flex items-center gap-4">
                  <PriceGlyphs priceRange={v.priceRange} />
                  <OpenNowBadge hours={v.hours} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* History, which left the nav (ruling R3) */}
        <div className="mt-16 border-t border-border pt-12 lg:max-w-[36rem]">
          <h3 className="font-display text-2xl">Read the city&apos;s past</h3>
          <p className="mt-3 leading-7 text-muted-foreground">
            {eras} eras, from Ibaloi pasture to today, pinned to the places they happened.
          </p>
          <Link href="/history" className={`mt-4 inline-block ${more}`}>Open the timeline</Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Mount it.** In `app/page.tsx`, delete the `{/* History */}` and `{/* Transit + Eat */}` sections and render after `<Problem>`:
```tsx
const FEATURED_SLUGS = [
  "burnham-park",
  "mines-view-park",
  "camp-john-hay",
  "session-road",
  "bencab-museum",
  "tam-awan-village",
];
```
```tsx
  const featured = FEATURED_SLUGS.map((slug) => destinations.find((d) => d.slug === slug)).filter((d) => d != null);
```
```tsx
      <Solution featured={featured} routes={routes} venues={venues} eras={history.eras.length} />
```

- [ ] **Step 6: Run** home + overflow (360/375/414) + links gates → PASS. In the Playwright browser, press the "Next destination" arrow three times and confirm the map lands on each place in turn; with reduced motion emulated, it jumps instead of flying.

- [ ] **Step 7: Commit**

```bash
git add components/site/DestinationCarousel.tsx components/home/TerrainTour.tsx components/home/Solution.tsx app/globals.css app/page.tsx tests/e2e/home.spec.ts
git commit -m "Solution section: the coverflow carousel now steers the live map"
```

---

### Task 26: FAQ, and a closing CTA over parallax ridgelines

**Files:**
- Create: `components/home/Faq.tsx`, `components/home/Ridgelines.tsx`, `components/home/ClosingCta.tsx`
- Modify: `app/page.tsx` (final form), `components/site/atmosphere.tsx`, `components/site/AnimatedIcons.tsx`, `tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `ParallaxLayer` (`components/site/Motion.tsx`, unchanged).
- Produces: `<Faq />`, `<Ridgelines />`, `<ClosingCta />`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/e2e/home.spec.ts`:
```ts
test("the homepage runs hero, proof, problem, solution, FAQ, CTA in that order", async ({ page }) => {
  await page.goto("/");
  const headings = await page.locator("main h1, main h2").allTextContents();
  expect(headings).toEqual([
    "Baguio City, mapped in 3D.",
    "What the map is made of",
    "A flat map hides the hills.",
    "One map for the climb, the ride and the table.",
    "Questions",
    "See the hills before you climb them.",
  ]);
});

test("FAQ answers open natively", async ({ page }) => {
  await page.goto("/");
  await page.getByText("How accurate are the jeepney fares?").click();
  await expect(page.getByText(/confirm with the driver/i).first()).toBeVisible();
});

test("the ridgelines behind the closing CTA drift with scroll", async ({ page }) => {
  await page.goto("/");
  const cta = page.locator("section", { has: page.getByRole("heading", { name: "See the hills before you climb them." }) });
  await cta.scrollIntoViewIfNeeded();
  const layer = cta.locator(".parallax-layer").last();
  const before = await layer.evaluate((el) => getComputedStyle(el).transform);
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(250);
  const after = await layer.evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);
});

test("the ridgelines hold still for reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const cta = page.locator("section", { has: page.getByRole("heading", { name: "See the hills before you climb them." }) });
  await cta.scrollIntoViewIfNeeded();
  const transforms = await cta.locator(".parallax-layer").evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
  expect(transforms.every((t) => t === "none")).toBe(true);
});
```
Run → FAIL.

- [ ] **Step 2: FAQ** `components/home/Faq.tsx`:
```tsx
import Link from "next/link";
import { FARE_SOURCE } from "@/lib/geo/fare";
import { CORRECTIONS_RESPONSE_DAYS } from "@/lib/site";

const checked = new Date(FARE_SOURCE.checkedOn).toLocaleDateString("en-PH", { dateStyle: "long" });
const a = "text-primary underline underline-offset-4";

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  { q: "Is it free?", a: <>Yes. The whole site is free and there&apos;s no account to create.</> },
  {
    q: "Where does the map data come from?",
    a: <>Terrain from AWS Terrain Tiles, streets and buildings from OpenStreetMap, satellite imagery from Esri. The places, routes and hours are curated for this guide. The full list is on the <Link href="/about#sources" className={a}>about page</Link>.</>,
  },
  {
    q: "How accurate are the jeepney fares?",
    a: <>They follow the LTFRB fare structure, last checked {checked}. Fares change, so confirm with the driver before you pay.</>,
  },
  {
    q: "Are the opening hours up to date?",
    a: <>They&apos;re checked by hand and can go stale, especially around holidays and Panagbenga. If you spot a wrong one, <Link href="/corrections" className={a}>send a correction</Link>.</>,
  },
  {
    q: "Does it work on my phone?",
    a: <>Yes, in any recent mobile browser. The 3D view needs a data connection because the terrain streams in as you move, so it doesn&apos;t work offline.</>,
  },
  {
    q: "How do I report a mistake?",
    a: <>Use the <Link href="/corrections" className={a}>correction form</Link>. We read every report within {CORRECTIONS_RESPONSE_DAYS} days.</>,
  },
];

export function Faq() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
        <h2 className="font-display text-4xl leading-[1.02] sm:text-5xl">Questions</h2>
        <div className="min-w-0 border-t border-border">
          {QUESTIONS.map(({ q, a: answer }) => (
            <details key={q} className="group border-b border-border py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="mt-0.5 font-mono text-primary transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
              </summary>
              <p className="mt-3 max-w-[62ch] leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Ridgelines** `components/home/Ridgelines.tsx`, the three ridge paths from the old history section, now behind the CTA:
```tsx
import { ParallaxLayer } from "@/components/site/Motion";

// Far to near. The far ridge moves least, which is how depth reads across a
// valley. Each layer carries a solid block under its ridge so rising never
// opens a gap at the section's bottom edge.
const RIDGES = [
  { speed: -0.05, height: 220, opacity: 0.06, d: "M0 200 L120 120 L260 168 L420 88 L560 150 L700 96 L860 160 L1010 110 L1200 170 V220 H0 Z" },
  { speed: -0.11, height: 180, opacity: 0.1, d: "M0 170 L160 104 L320 150 L480 76 L640 138 L820 92 L980 146 L1200 104 V180 H0 Z" },
  { speed: -0.19, height: 140, opacity: 0.16, d: "M0 130 L140 78 L300 120 L470 60 L620 112 L790 70 L960 118 L1200 82 V140 H0 Z" },
];

export function Ridgelines() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
      {RIDGES.map((r) => (
        <ParallaxLayer key={r.d} speed={r.speed} className="absolute inset-x-0 -bottom-24">
          <div style={{ opacity: r.opacity }}>
            <svg viewBox={`0 0 1200 ${r.height}`} preserveAspectRatio="none" className="block w-full" style={{ height: r.height }}>
              <path d={r.d} fill="currentColor" />
            </svg>
            <div className="h-24 bg-current" />
          </div>
        </ParallaxLayer>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Closing CTA** `components/home/ClosingCta.tsx`:
```tsx
import { LinkButton } from "@/components/ui/LinkButton";
import { Ridgelines } from "./Ridgelines";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      <Ridgelines />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-40 pt-16 sm:px-6 sm:pb-48 sm:pt-20 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="max-w-[16ch] font-display text-4xl leading-[1.02] text-balance sm:text-5xl">
            See the hills before you climb them.
          </h2>
          <p className="mt-4 text-background/75">Free, no account, and it works on your phone.</p>
        </div>
        <LinkButton
          href="/map"
          size="large"
          sx={{ bgcolor: "background.default", color: "text.primary", "&:hover": { bgcolor: "#E8DFD0" } }}
        >
          Open the 3D map
        </LinkButton>
      </div>
    </section>
  );
}
```
(The deep bottom padding is where the ridges live, below the copy.)

- [ ] **Step 5: Final `app/page.tsx`**

```tsx
import type { Metadata } from "next";
import { getDestinations, getHistory, getTransitRoutes, getVenues } from "@/lib/content";
import { relief } from "@/lib/relief";
import { websiteJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/site/JsonLd";
import { Hero } from "@/components/home/Hero";
import { Proof } from "@/components/home/Proof";
import { Problem } from "@/components/home/Problem";
import { Solution } from "@/components/home/Solution";
import { Faq } from "@/components/home/Faq";
import { ClosingCta } from "@/components/home/ClosingCta";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// The places first-time visitors ask about; they fill the map carousel.
const FEATURED_SLUGS = [
  "burnham-park",
  "mines-view-park",
  "camp-john-hay",
  "session-road",
  "bencab-museum",
  "tam-awan-village",
];

export default async function Home() {
  const [destinations, venues, history, routes] = await Promise.all([
    getDestinations(),
    getVenues(),
    getHistory(),
    getTransitRoutes(),
  ]);

  const featured = FEATURED_SLUGS.map((slug) => destinations.find((d) => d.slug === slug)).filter((d) => d != null);
  const origin = destinations.find((d) => d.slug === "burnham-park") ?? destinations[0];
  const places = [...destinations, ...venues];
  const withHours = places.filter((p) => p.hours != null).length;

  return (
    <div>
      <JsonLd data={websiteJsonLd()} />
      <Hero destinations={destinations.length} venues={venues.length} />
      <Proof destinations={destinations.length} venues={venues.length} />
      <Problem
        relief={relief(origin, destinations)}
        originName={origin.name}
        minFare={Math.min(...routes.map((r) => r.fareBase))}
        withHours={withHours}
        total={places.length}
      />
      <Solution featured={featured} routes={routes} venues={venues} eras={history.eras.length} />
      <Faq />
      <ClosingCta />
    </div>
  );
}
```

- [ ] **Step 6: Remove only what's truly unused.** The carousel, wireframe, `swiper`, `three` and `ParallaxLayer` all stay (owner decision). Delete `FogBank` from `components/site/atmosphere.tsx` and `FogIcon`/`PineIcon` from `components/site/AnimatedIcons.tsx` only if `grep -rn "FogBank\|FogIcon\|PineIcon" app components` finds no remaining use. Check the three reused pieces are each mounted exactly once on the homepage:
```bash
grep -rn "LazyTerrain\|TerrainTour\|Ridgelines" components/home app/page.tsx
```

- [ ] **Step 7: Run everything**

`npm test`, `npx tsc --noEmit`, `npm run lint` (only the 3 known MapView errors), `npm run build`, `npm run test:e2e` → PASS. Screenshot `/` full page at 1440 and 375; review against the design plan. On a mid-range phone profile (Pixel 7), scroll from top to bottom and read the console: no WebGL context-lost warnings with the wireframe and the live map both mounted.

- [ ] **Step 8: Commit**

```bash
git add -A app/page.tsx components tests
git commit -m "Finish the homepage: FAQ, and a closing CTA over parallax ridgelines"
```

---

## Phase 8: the rest of the site, and analytics

### Task 27: Design-tell sweep and copy gates across every page

**Files:**
- Modify: `components/site/SectionHeading.tsx` (remove `eyebrow`), its call sites (`app/destinations/page.tsx`, `app/eat-stay/page.tsx`, `app/history/page.tsx`, `app/transit/page.tsx`), `app/destinations/[slug]/page.tsx`, `app/transit/page.tsx`, `app/history/page.tsx`, `components/panels/VenueList.tsx`, `components/panels/DestinationSheet.tsx`, `app/*/loading.tsx`, `data/geojson/landmarks.geojson` (Burnham year, if Step 1 says so)
- Create: `tests/e2e/copy.spec.ts`, `tests/unit/no-rounded-surfaces.test.ts`

- [ ] **Step 1: Verify one date.** Look up when Daniel Burnham's Baguio plan was made (Wikipedia "Burnham Park (Baguio)" and one other source). If it's 1905, change "1904 city plan" in the Burnham Park description; record the sources in the ledger.

- [ ] **Step 2: Write the failing gates**

`tests/e2e/copy.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { PAGES } from "./routes";

for (const path of PAGES) {
  test(`${path}: copy follows the house rules`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const text = await page.locator("body").innerText();
    expect(text, "em dash").not.toMatch(/—/);
    expect(text, "middot meta string").not.toMatch(/ · /);
    expect(text, "arrow glyph").not.toMatch(/[→←]/);
  });

  test(`${path}: every image has alt text or is marked decorative`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const missing = await page.$$eval("img", (imgs) =>
      imgs.filter((i) => !i.hasAttribute("alt") && i.getAttribute("aria-hidden") !== "true").map((i) => i.src),
    );
    expect(missing).toEqual([]);
  });
}
```

`tests/unit/no-rounded-surfaces.test.ts`:
```ts
import { globSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

// The weave identity is square (radius token 0.125rem). rounded-full stays
// allowed for dots and circles.
it("no rounded-lg/xl/2xl/3xl surfaces remain", () => {
  const files = globSync("{app,components}/**/*.tsx");
  const offenders = files.filter((f) => /\brounded-(lg|xl|2xl|3xl)\b/.test(readFileSync(f, "utf8")));
  expect(offenders).toEqual([]);
});
```
(`fs.globSync` needs Node 22; this machine runs 22.22.)
Run both → FAIL (transit, history, detail page, loading skeletons, DestinationSheet).

- [ ] **Step 3: Fix, file by file**

- `components/site/SectionHeading.tsx`: delete the `eyebrow` prop and its block; update each call site to drop `eyebrow=`.
- `app/destinations/[slug]/page.tsx`: the header readout becomes two labelled facts instead of `ELEV … · coords`:
```tsx
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {destination.elevationM != null ? (
              <div><dt className="text-xs text-muted-foreground">Elevation</dt><dd className="readout">{formatElevation(destination.elevationM)}</dd></div>
            ) : null}
            <div><dt className="text-xs text-muted-foreground">Position</dt><dd className="readout">{formatCoord(destination.lng, destination.lat)}</dd></div>
          </dl>
```
  "In its era · 1900–1941" becomes a heading `{era.name}` with the years on its own line; the era box and fact panel lose `rounded-xl` (use `border border-border bg-card`); the CTA loses `endIcon`.
- `app/transit/page.tsx`: `{peso(route.fareBase)} base · {peso(route.farePerKm)}/km after` becomes `{peso(route.fareBase)} for the first 4 km, then {peso(route.farePerKm)} per km`; "Worked example · 3.5 km (Plaza → Mines View)" becomes "Worked example: 3.5 km, Plaza to Mines View"; "Distance · …" and "Waiting · …" become "Distance: …" and "Waiting: …"; drop `ArrowRight`; square every `rounded-*`.
- `app/history/page.tsx`: "Era 01 · 1900–1941" becomes "Era 1, 1900 to 1941" (eras are a real sequence, so the number stays).
- `components/panels/VenueList.tsx`: popup and list meta join with ", " instead of " · ".
- `app/*/loading.tsx`, `components/panels/DestinationSheet.tsx`: `rounded*` to square (keep `rounded-full` only on dots).
- Remove remaining em dashes from any UI string (`grep -rn "—" app components --include='*.tsx'` and check each hit is inside a comment).

- [ ] **Step 4: Run** unit + e2e → PASS. Screenshot `/transit`, `/history`, `/destinations/burnham-park` at 1440 and 375.

- [ ] **Step 5: Commit**

```bash
git add -A app components data tests
git commit -m "Remove eyebrows, em dashes, middots, arrows and rounded cards across the site"
```

---

### Task 28: Google Analytics 4, loaded only with consent

**Files:**
- Create: `components/site/Analytics.tsx`, `tests/e2e/analytics.spec.ts`
- Modify: `app/layout.tsx` (mount `<Analytics />`), `components/site/SiteFooter.tsx` (Cookie settings)

Read `node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md` (Google Analytics section) first.

- [ ] **Step 1: Install** `npm i @next/third-parties`

- [ ] **Step 2: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Never send test traffic to Google: count requests, answer them empty.
  await page.route("**/*googletagmanager.com/**", (route) => route.fulfill({ status: 200, body: "" }));
});

test("Google Analytics loads only after the visitor allows it", async ({ page }) => {
  const ga: string[] = [];
  page.on("request", (r) => r.url().includes("googletagmanager.com") && ga.push(r.url()));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Analytics choice" })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(ga).toEqual([]);
  await page.getByRole("button", { name: "Allow analytics" }).click();
  await expect.poll(() => ga.length).toBeGreaterThan(0);
});

test("No thanks keeps analytics off after a reload", async ({ page }) => {
  const ga: string[] = [];
  page.on("request", (r) => r.url().includes("googletagmanager.com") && ga.push(r.url()));
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.reload();
  await expect(page.getByRole("region", { name: "Analytics choice" })).toHaveCount(0);
  await page.waitForTimeout(1500);
  expect(ga).toEqual([]);
});

test("Cookie settings in the footer reopens the choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "No thanks" }).click();
  await page.locator("footer").getByRole("button", { name: "Cookie settings" }).click();
  await expect(page.getByRole("region", { name: "Analytics choice" })).toBeVisible();
});
```
Run → FAIL.

- [ ] **Step 3: Implement** `components/site/Analytics.tsx`:
```tsx
"use client";

import { useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

// GA4 in basic consent mode (ruling R7): the tag isn't loaded at all until the
// visitor allows it. The choice lives in localStorage, not a cookie.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "b3d-analytics-consent";
const EVENT = "b3d:consent-change";
type Choice = "granted" | "denied" | "unset";

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}
function write(choice: Choice) {
  try {
    if (choice === "unset") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: the banner simply asks again next visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function Analytics() {
  const choice = useSyncExternalStore(subscribe, read, () => "ssr" as const);
  if (!GA_ID || choice === "ssr" || choice === "denied") return null;
  if (choice === "granted") return <GoogleAnalytics gaId={GA_ID} />;

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 max-w-md border border-border bg-background p-4 md:bottom-6 md:left-6 md:right-auto"
    >
      <p className="text-sm leading-6">
        Can we count your visit with Google Analytics? It sets cookies, and nothing loads unless you say yes.{" "}
        <a href="/privacy#analytics" className="text-primary underline underline-offset-4">What it records</a>
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
        write("unset");
        if (!wasGranted) return;
        for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim())) {
          if (!name.startsWith("_ga")) continue;
          document.cookie = `${name}=; Max-Age=0; path=/`;
          document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
        }
        location.reload();
      }}
    >
      Cookie settings
    </button>
  );
}
```
Mount `<Analytics />` in `app/layout.tsx` after `<StickyCta />`. In the footer's bottom row, add `<CookieSettingsLink className="underline underline-offset-4 hover:text-foreground" />` next to the copyright.

- [ ] **Step 4: Run** → PASS. Then build without `NEXT_PUBLIC_GA_ID` and confirm no banner, no "Cookie settings" button, and the privacy page says the site doesn't use analytics.

- [ ] **Step 5: Commit**

```bash
git add components/site/Analytics.tsx app/layout.tsx components/site/SiteFooter.tsx package.json package-lock.json tests/e2e/analytics.spec.ts
git commit -m "Add GA4 behind an explicit consent choice, with a way to change it"
```

---

## Phase 9: the photoreal 3D city

The full specification is `docs/baguio-3d-model-plan.md` (15 sections: aerial and street-level research, datum rulings, Blender architecture via the Blender MCP, terrain, roads, buildings, landmarks, vegetation, Geometry Nodes, LOD budgets, glTF pipeline, coordinates, phases, validation, risks). It stays the source of truth for the model itself. This section sets where it sits in the overall sequence and what this overhaul changed for it.

### Already delivered by Phases 1–8

| Spec item | Delivered by |
|---|---|
| §3(c), §15 step 4: correct all 22 `elevation_m` values from the DEM | Task 4 |
| §14 "Supabase paused": restore before seeding `landmarks` | Global Constraints |
| A test harness that can assert on the live map | Tasks 1–2, 21 |
| Security of the database the `landmarks` rows go into | Task 7 |

### New integration constraints (discovered after the spec was written)

1. **Terrain is removed during every basemap swap.** Since commit `3f58ad5`, `MapView` calls `map.setTerrain(null)` before `setStyle({ diff: false })` to stop a render-loop crash. In that window `queryTerrainElevation()` returns `null`, and `setStyle` also removes every custom layer. So the landmark `CustomLayerInterface` must be installed from a `MapLayers` hook (which remounts on each `styleGeneration`), query terrain on its first render after `style.load`, and never cache an altitude across a swap. This extends spec §10 step 4, which only mentions the `styleInFlightRef` guard.
2. **The basemap is re-dyed and hill-shaded** (`components/map/basemapTheme.ts`). Material and lighting review in spec §13 must be done against both the weave basemap and satellite.
3. **three.js has two users.** The homepage wireframe (Problem section, loaded as the section nears; Task 24) and the landmark layer. The landmark layer must load it lazily too, when the first destination sheet opens (spec §9), so `/map` doesn't pay for it up front.
4. **The homepage demo shares `lib/map/sources.ts`.** Landmarks can appear in the demo later with no new plumbing, as long as spec §9's budget holds (≤ 2 MB total 3D payload, ≤ 60 KB per tier-1 landmark).

### Milestones and gates

| M | Milestone | Gate (measured, not eyeballed) |
|---|---|---|
| M1 | Data: Copernicus GLO-30 DEM for the padded bounds; Geofabrik Philippines OSM extract clipped to the bounds | DEM agrees with the app's Terrarium DEM at the 15 trusted anchors (±35 m); OSM building count within 1% of 120,751. **Not** "the whole DEM spans 910–1,667 m": that range is the city limits, while the model bounds also take in lowland valleys and ground above 2,000 m (a z13 Terrarium survey of exactly `[120.5, 16.3, 120.7, 16.5]` read 153–2,230 m). Spec §5's range check needs the same correction; see its addendum |
| M2 | Terrain authoring mesh in Blender (Displace from DEM, 3 LODs), driven through the Blender MCP | The 15 trusted anchors from spec §3(c) within 35 m; Mines View ridge at `120.628, 16.417` ≈ 1,530 m |
| M3 | **Vertical slice: `baguio-cathedral`** end to end: model → GLB → manifest → `landmarks` row → rendered on `/map` | GLB ≤ 60 KB after gltfpack; base within ±2 m of `queryTerrainElevation` at the pin; survives terrain → satellite → terrain with no page errors; screenshot matches the drone reference |
| M4 | Tier-1 landmarks: `burnham-park`, `session-road`, `mines-view-park`, `camp-john-hay` | Same gates as M3, each |
| M5 | Context layers: roads, building massing (height heuristic), pine scatter, for renders and authoring | Spec §13 visual checks; no building floats on a slope |
| M6 | Remaining 17 landmarks | Same gates as M3 |
| M7 | Optimization and export | Total payload ≤ 2 MB; every GLB opens in a standalone viewer |
| M8 | Integration hardening | Full e2e green; landmark layer lazy (no three.js request before a destination sheet opens) |

Per the plan-writing rule for separate subsystems, M1–M8 get their own bite-sized plan, written at M1 kickoff in a session with Blender and the MCP running. Every Blender step is authored against the live `bpy` API (spec §4.0: `bpy_api_lookup`, `describe_node_type`, `get_viewport_screenshot`); writing `bpy` code now would guess at exactly the API state the spec says to look up.

**Open questions still owed by the owner (spec §14):** whether bulk buildings ship to the web or only the 22 landmarks; whether 2 MB is the right payload ceiling; whether La Trinidad is modelled as context only. (The exaggeration question is resolved: query terrain at render time.)

---

## Phase 10: whole-branch verification

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint` (only the 3 known MapView errors), `npm run build`, `npm run test:e2e` (desktop and mobile) → all green. Paste the summary lines into the ledger.
- [ ] Supabase `get_advisors` (security) → no ERROR lints.
- [ ] CSP: open `/`, `/map` (toggle satellite), `/corrections` in the Playwright browser, read console messages; zero report-only violations from legitimate sources. If clean, open a follow-up to switch `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
- [ ] Screenshots at 1440×900 and 375×812: `/`, `/destinations/burnham-park`, `/transit`, `/corrections`, `/privacy`, a 404. Review each against the design plan and the Global Constraints.
- [ ] Fresh-eyes review: a subagent that hasn't seen this session checks every row of the coverage table below against the branch, and the whole diff against the Global Constraints. Fix findings through the task's implementer, then re-review.
- [ ] Surface every ledger ruling and its cost-if-wrong to the owner. Then open the PR `feat/site-overhaul` → `main`.

---

## Coverage: every item in the brief

| Brief item | Where |
|---|---|
| Homepage: hero, proof, problem, solution, FAQ, CTA | Tasks 23, 23, 24, 25, 26, 26 |
| Nav: fewer CTAs | Task 18 |
| Footer: page links out, legal links in | Task 19 |
| Broken links, footer included | Audit A2 (0 found); gate Task 2; sitemap check Task 17 |
| Buttons that do nothing | Audit A3 (none); new controls all have handlers |
| Horizontal scroll / mobile overflow | Task 2 (fix + gate at 360/375/414) |
| Mobile menu | Exists; Task 18 aligns it with desktop and adds Close |
| Logo goes home | Exists; gated in Task 2 |
| Clickable phone and email | Task 19 (`mailto:`); no phone numbers exist (A6), none invented |
| Works on mobile | Mobile project in every run; Tasks 2, 20, 23; Phase 10 screenshots |
| Placeholder text, dead nav links | Task 3; none dead (A2) |
| Custom 404 | Task 14 |
| Thank-you page after forms | Task 15 |
| Breadcrumbs | Task 12 |
| Internal links between related pages | Task 13 |
| Privacy policy | Task 16 |
| Unique titles | Task 11 (+ 404 in Task 14) |
| Meta descriptions | Task 11 |
| Favicon | Task 10 (exists; recolored) |
| robots.txt | Task 17 |
| og:image | Task 10 (+ real origin in Task 3) |
| Local business schema | Not applicable (C4); WebSite + TouristAttraction + BreadcrumbList instead, Task 12 |
| Alt text on every image | Gate in Task 27; new images in Tasks 22, 23 |
| Compress images | Posters budgeted and tested (Task 22); the wireframe's three.js and heightmap load only near their section (Task 24) |
| Real reviews; flag fake ones | None exist, none written (F1, R1) |
| Response-time promise near the form | Task 15 |
| FAQ, 5 questions | Task 26 (6 questions) |
| Case studies | Not applicable (F2) |
| Team photo on about page | About page Task 16; photo only if provided (F3) |
| Copyright year | Already current (F4) |
| Main CTA above the fold | Task 23 (gated on mobile) |
| Sticky mobile CTA | Task 20 |
| Form success and error messages | Task 15 |
| Google Analytics | Task 28 |
| Keys/secrets in client or repo | Audit D1 (clean, full history scanned) |
| Auth on protected routes | Audit D3 (nothing protected exists or should) |
| Database access rules / public buckets | Task 7; 0 buckets (D3) |
| Unvalidated input | Task 8 (API), Task 15 (form) |
| Open endpoints that need auth | None (D3) |
| Privacy policy discloses data collected | Task 16 (from code, E1) |
| AI use disclosed | Task 16 (none at runtime; D6 for content) |
| Third-party services that collect data | Task 16 (tile hosts, host, GA) |
| Uploaded files deleted | Not applicable: no uploads (E3) |
| Cancel as easy as sign-up | Not applicable: no sign-up (E3) |
| Renewal reminders | Not applicable: no billing (E3) |
| AI chat self-harm handling | Not applicable: no chat; standing rule recorded (E3) |
| Gradients, glass, pills, rounded cards, bento, Lucide, fade-ups, empty hovers | H1–H8; Tasks 6, 18, 23, 26, 27. Parallax kept by owner decision (R10) |
| Keep the carousel, wireframe and parallax, used differently | Carousel steers the live map (Task 25, R4); wireframe rises in Problem (Task 24, R5); ridgelines behind the closing CTA (Task 26, R10) |
| Space Grotesk only | Pass (H9) |
| Vague hero | Task 23 |
| No live demo | Tasks 22, 25 |
| Text-only logo, Vercel/Lovable badge, one-page structure | Pass / Task 3 (H12, H13) |
| Fake-looking numbers | Tasks 4, 5, 23 (H14) |
| Em dashes, cursive fonts | Tasks 11, 19, 27 (H15); no cursive |
| 3D photoreal model plan | Phase 9 + `docs/baguio-3d-model-plan.md` |
