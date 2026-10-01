# Baguio 3D Model, M6: Remaining 17 Landmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 17 tier-2 landmarks through the landmark procedure, so all 22 destinations have a model on the map.

**Architecture:** No new pipeline. M5's Task 0 already wrote each slug's scope and footprint (procedure B), so its exclusion ring cuts the building massing. Here each slug completes its sheet (procedure A), is modeled (C) and shipped (D). Four batch tasks, one reviewer gate each. Step E runs once at the end (one migration, one owner approval).

**Tech Stack:** as M3.

**Spec:** spec §1, §6; contract C2, C3, C6; M3's "The landmark procedure", `lm_common.py`, `export_landmark.py`, `pack_landmark.py`, `landmarks_sql.py`; M4's e2e extension (data-driven over the index, so new landmarks are covered automatically).

## Global Constraints

- M3's Global Constraints.
- Tier 2 budgets: ≤ 10k source triangles, GLB ≤ 150 KiB with textures (C6). Prefer flat materials; at most one texture ≤ 256 px.
- **Keep the scope M5 Task 0 fixed.** The exclusion rings are baked into the published tiles. If a sheet shows a scope must change, re-run procedure B, then rebuild the tiles (`uv run model/scripts/build_massing.py build`) and redo M5's budget e2e in the same task.
- Overpass: at most one call per 30 s (procedure B is done, so this should only come up on a scope change).

## Per-slug steps (run for every slug in the task's list)

1. **Sheet (A):** complete `model/landmarks/<slug>.md` below its `## Scope` section: sources, `ESTIMATE`s with method, 3 to 5 references with licence and viewpoint. Gate: every number has a URL or an `ESTIMATE`.
2. **Model (C):** write `model/blender/landmarks/<slug_with_underscores>.py` on M3's skeleton (`SLUG = "<slug>"`; `lm.begin`, `lm.foundation`, geometry citing sheet lines, `lm.human_reference`, `lm.report`, `lm.context_instance`, save). Run it headless against `model/data/blend/baguio.blend`. Render an oblique view (45° pitch, 150 m) to `model/data/renders/m6/<slug>.png`, read it, and iterate against the references. Gate: `REPORT` within 10,000 triangles; no assertion.
3. **Ship (D):** export, pack, and check determinism exactly as M3 Task 5 Step 4, with the slug. Gate: `PACK` within budget, `IDENTICAL`.
4. Set the registry `status` to `"shipped"`.

Each batch task ends with `npm test` and one commit: "Model <names> for the 3D map" plus the trailer.

## Notes the spec already gives (verify in the sheet)

| Slug | Note |
|---|---|
| `bencab-museum` | In Tuba on Asin Road, ground about 980 m (DEM 979 m, spec §3c). The destination's old `elevation_m` was off by 441 m (fixed in overhaul Task 4) |
| `la-trinidad-strawberry-farms` | La Trinidad valley floor; about 80 ha of farmland (drone caption, §1); greenhouse rows. Context-only town (owner answer 4) but this destination keeps its landmark |
| `good-shepherd-convent` | Low buildings in mature pine on a ridge edge (§1) |
| `lions-head-kennon-road` | A sculpture by Kennon Road. M5 Task 0 may have hand-drawn its ring; the model is the sculpture and its plinth |
| `philippine-military-academy` | A campus in Loakan. Pick its most recognisable structure, as M5 Task 0's scope says |
| others | Only what M5 Task 0's scope sentence and the sheet's sources say |

---

### Task 1: Parks and views
Slugs: `wright-park`, `botanical-garden`, `mile-hi-cjh-viewdeck`, `lourdes-grotto`.
- [ ] Run the per-slug steps for each slug, in order.
- [ ] `npm test`; commit.

### Task 2: Heritage and civic buildings
Slugs: `the-mansion`, `baguio-city-hall`, `baguio-museum`, `diplomat-hotel-ruins`, `good-shepherd-convent`.
- [ ] Run the per-slug steps for each slug, in order.
- [ ] `npm test`; commit.

### Task 3: Markets, campuses and villages
Slugs: `baguio-public-market`, `teachers-camp`, `philippine-military-academy`, `tam-awan-village`.
- [ ] Run the per-slug steps for each slug, in order.
- [ ] `npm test`; commit.

### Task 4: Outskirts and sculpture
Slugs: `bencab-museum`, `la-trinidad-strawberry-farms`, `igorot-stone-kingdom`, `lions-head-kennon-road`.
- [ ] Run the per-slug steps for each slug, in order.
- [ ] `npm test`; commit.

### Task 5: Data, e2e and review for all 17 (procedure E)

- [ ] **Step 1:** Run `uv run model/scripts/landmarks_sql.py`, then `node scripts/generate-supabase-seed.mjs`. `git diff data/geojson/landmarks.geojson` shows exactly 17 new `meshUrl` values, and all 22 are now set.
- [ ] **Step 2:** After the owner says so in chat: check the project is `ACTIVE_HEALTHY`, then run `supabase db push --linked` and `supabase migration list --linked`.
- [ ] **Step 3:** Run `npm run test:e2e -- landmark-model`: 1 + 22 passed (M4's data-driven test covers every slug in the index). Then the full `npm run test:e2e`, all green.
- [ ] **Step 4: Review.** Read each new `test-results/landmark-<slug>.png`. Each landmark stands on the ground, the right way up, recognisable. Record one line per slug in the ledger.
- [ ] **Step 5:** Commit the migration, geojson and seed: "Record all landmark models in the database" plus the trailer. Append `## Phase 9, M6 (date)` to the ledger (per slug: bytes, triangles, hash, review). Report to the owner.

## If a gate fails

As M3 and M4. A tier-2 landmark that can't be recognisable in 10k triangles gets a narrower scope (and the M6 Global Constraints' tile rebuild), never a bigger budget.
