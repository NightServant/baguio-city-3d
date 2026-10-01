# Baguio 3D Model, M4: Tier-1 Landmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four remaining tier-1 landmarks (`burnham-park`, `session-road`, `mines-view-park`, `camp-john-hay`) through the landmark procedure M3 established. Each passes M3's gates.

**Architecture:** No new pipeline. Each landmark is one task running procedure steps A to D from `docs/superpowers/plans/2026-10-01-baguio-3d-model-m3.md` ("The landmark procedure"), with that landmark's own sheet, footprint and modeling script. Step E (migration, e2e, review) runs once for all four at the end, so the owner approves one migration.

**Tech Stack:** as M3. Nothing new.

**Spec:** spec §1 (aerial and street observations), §6 "Landmarks" (tier 1, Burnham Park's published figures); contract C2, C3, C6; M3's procedure, `lm_common.py`, `export_landmark.py`, `pack_landmark.py`, `landmarks_sql.py`.

## Global Constraints

- Everything in M3's Global Constraints.
- Tier 1 budgets: ≤ 25k source triangles; GLB ≤ 150 KiB with textures; geometry ≤ 60 KiB (C6). Textures ≤ 512 px WebP, at most two per landmark (C2).
- **Scope is decided in each sheet (procedure A) from sources, not here.** The hints below say what the spec already established and what makes each place hard. They are not dimensions.
- Areas larger than about 300 m across get their defining structures modeled. The ground stays the map's (basemap plus terrain), and the exclusion ring covers only modeled structures, so the building massing (M5) still fills the rest.

## Scope hints (from the spec; verify in the sheet)

| Slug | What the spec already says | The hard part |
|---|---|---|
| `burnham-park` | 32.84 ha; Daniel Burnham's 1905 plan, established 1925; Burnham Lake avg depth 3.04 m, ~34,000 m³; 12 clusters incl. Rose Garden, Athletic Bowl, Children's Playground, Orchidarium, Melvin Jones Grandstand, Igorot Park, Japanese Peace Tower, Skating Rink; ~2,600 trees / 72 species (spec §2, §6, Wikipedia). Street-level: patterned paving, a tiered stone monument, stone gate piers with pyramidal caps (§1A) | The lake is the signature: model its water surface and rim. A water surface must sit at the lake's real level, not the centroid's ground height, so check both with `terrain_sample` and use foundations for the rim. Pick 3 to 5 structures (grandstand, skating rink, peace tower) by visibility from the burnham-park preset |
| `session-road` | The commercial spine climbing a ridge; CBD 4–8 storeys; continuous corrugated-metal awnings over narrow sidewalks (§1, §1B) | It's a street. Scope candidates: the Session Road rotunda/top end, or the awning-covered frontage along one block. The model must read at the session-road preset (z16, pitch 60, bearing 30). The building massing also covers this street, so the exclusion ring must be tight |
| `mines-view-park` | Destination at `120.628, 16.4201`, DEM 1,523 m (§3c). The camera preset frames a point about 340 m away and about 100 m lower (§3c item 3) | The viewing deck and its railings over a steep drop. Foundations will be deep (contract C2); check that `lm_common.foundation`'s depth looks right in the render |
| `camp-john-hay` | Mature pine stands with structures embedded in them (§1) | A large area (former base). Pick one recognisable built element visible from the camp-john-hay preset. Pine scatter is M5's (render-only), so don't model trees here |

---

### Task 1: `burnham-park`

**Files:** Create `model/landmarks/burnham-park.md`, `model/blender/landmarks/burnham_park.py`. Generated: `model/landmarks.json` entry, `public/models/landmarks/burnham-park.<hash8>.glb`, manifest, index.

- [ ] **Step 1 (procedure A): Sheet.** Gate: every number has a URL or `ESTIMATE`.
- [ ] **Step 2 (procedure B): Footprint.** Run `uv run model/scripts/landmark_osm.py candidates burnham-park`, then `footprint burnham-park <ids of the lake and the chosen structures>`. Gate: the exclusion ring covers the chosen structures only (printed area).
- [ ] **Step 3 (procedure C): Model.** Write `model/blender/landmarks/burnham_park.py` on the M3 skeleton (`SLUG = "burnham-park"`; `lm.begin`, `lm.foundation`, geometry citing sheet lines, `lm.human_reference`, `lm.report`, `lm.context_instance`, save). Run it headless. Render the burnham-park preset camera and an oblique view into `model/data/renders/m4/`, read them, and iterate against the references. Gate: `REPORT` within 25,000 triangles; no assertion.
- [ ] **Step 4 (procedure D): Ship.** Export, pack and check determinism exactly as M3 Task 5 Step 4, with `burnham-park`. Run `npm test`. Gate: `PACK` within budget, `IDENTICAL`, tests pass.
- [ ] **Step 5: Commit** sheet, script, registry, manifest, index and GLB: "Model Burnham Park for the 3D map" plus the trailer.

### Task 2: `session-road`

**Files:** Create `model/landmarks/session-road.md`, `model/blender/landmarks/session_road.py`. Generated as Task 1.

- [ ] **Step 1 (A): Sheet.** Decide the scope (see hints) and justify it by what the session-road preset shows.
- [ ] **Step 2 (B): Footprint.** `candidates session-road`, then `footprint session-road <ids>`.
- [ ] **Step 3 (C): Model.** `model/blender/landmarks/session_road.py`, `SLUG = "session-road"`. Render the session-road preset and an oblique view into `model/data/renders/m4/` and iterate.
- [ ] **Step 4 (D): Ship.** As Task 1 Step 4 with `session-road`.
- [ ] **Step 5: Commit**: "Model Session Road for the 3D map" plus the trailer.

### Task 3: `mines-view-park`

**Files:** Create `model/landmarks/mines-view-park.md`, `model/blender/landmarks/mines_view_park.py`. Generated as Task 1.

- [ ] **Step 1 (A): Sheet.**
- [ ] **Step 2 (B): Footprint.** `candidates mines-view-park`, then `footprint mines-view-park <ids>`.
- [ ] **Step 3 (C): Model.** `SLUG = "mines-view-park"`. Render the mines-view preset and an oblique view and iterate. Also check the deck's edge against the terrain in the render: no daylight between the deck and the slope.
- [ ] **Step 4 (D): Ship.** As Task 1 Step 4 with `mines-view-park`.
- [ ] **Step 5: Commit**: "Model Mines View Park for the 3D map" plus the trailer.

### Task 4: `camp-john-hay`

**Files:** Create `model/landmarks/camp-john-hay.md`, `model/blender/landmarks/camp_john_hay.py`. Generated as Task 1.

- [ ] **Step 1 (A): Sheet.**
- [ ] **Step 2 (B): Footprint.** `candidates camp-john-hay`, then `footprint camp-john-hay <ids>`.
- [ ] **Step 3 (C): Model.** `SLUG = "camp-john-hay"`. Render the camp-john-hay preset and an oblique view and iterate.
- [ ] **Step 4 (D): Ship.** As Task 1 Step 4 with `camp-john-hay`.
- [ ] **Step 5: Commit**: "Model Camp John Hay for the 3D map" plus the trailer.

### Task 5: Data, e2e and review for all four (procedure E)

**Files:** Generated: one migration, geojson `meshUrl`, `supabase/seed.sql`. Modify: `tests/e2e/landmark-model.spec.ts`.

- [ ] **Step 1:** Run `uv run model/scripts/landmarks_sql.py`, then `node scripts/generate-supabase-seed.mjs`. Check that `git diff data/geojson/landmarks.geojson` shows exactly four new `meshUrl` values.
- [ ] **Step 2:** After the owner says so in chat: check the project is `ACTIVE_HEALTHY`, then run `supabase db push --linked` and `supabase migration list --linked`.
- [ ] **Step 3: Extend the e2e spec** with a data-driven test for every landmark in the index. Append to `tests/e2e/landmark-model.spec.ts`:

```ts
import { readFileSync } from "node:fs";

const shipped = (JSON.parse(readFileSync("public/models/landmarks/index.json", "utf8")) as { landmarks: { slug: string }[] }).landmarks;
for (const { slug } of shipped) {
  test(`${slug}: its model loads with its sheet, with no page errors`, async ({ page }) => {
    const errors: string[] = [];
    const hit: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => { if (r.url().includes(`/models/landmarks/${slug}.`)) hit.push(r.url()); });
    await page.goto(`/map?dest=${slug}`);
    await expect.poll(() => hit.length, { timeout: 30_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(2_000);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/landmark-${slug}.png` });
  });
}
```

Move the `import { readFileSync }` line to the top of the file with the other import. Run `npm run test:e2e -- landmark-model`: 1 + 5 passed.
- [ ] **Step 4: Review.** Read each `test-results/landmark-<slug>.png`. Each landmark stands on the ground, the right way up, recognisable against its sheet's references. Record one line per landmark in the ledger.
- [ ] **Step 5:** Run `npm test` and `npm run test:e2e` (all), `npx tsc --noEmit`. Commit the migration, geojson, seed and spec: "Record the tier-1 landmark models in the database and check them on the map" plus the trailer. Append `## Phase 9, M4 (date)` to the ledger with per-landmark bytes, triangles, hash and review notes. Report to the owner.

## If a gate fails

As M3. Two M4-specific cases:
- **A landmark can't fit 25k triangles at a recognisable scope:** narrow the scope in the sheet. Never raise the budget.
- **Burnham's lake surface z-fights with the basemap:** the water must sit at least 0.3 m above the terrain sampled under it, and its rim foundation must hide the edge.
