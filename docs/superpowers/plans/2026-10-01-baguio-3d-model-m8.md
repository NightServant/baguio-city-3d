# Baguio 3D Model, M8: Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D layer safe to ship:
- Nothing 3D loads before the map is idle (proved by test).
- A failed model never breaks the map.
- A lost WebGL context recovers.
- The site tells the truth about the massing and credits its sources.
- The whole branch passes review and every gate before it merges.

**Architecture:** One DOM signal (`data-map-idle` on the map container) makes the lazy-load gate testable without reaching into MapLibre. `ModelLayer` gains context-loss recovery by re-adding its custom layer on `webglcontextrestored`. Everything else is tests, copy and docs.

**Tech Stack:** as M3; Playwright route interception; the `WEBGL_lose_context` extension.

**Spec:** spec §9 (lazy load), §13 "Integration"; contract C5, C9; the overhaul's deferred findings (the R5 context-loss item; `/map`'s WebGL fallback was fixed on 1 Oct 2026).

## Global Constraints

- M3's Global Constraints, the overhaul's copy rules and the truth rule.
- Merge only after a whole-branch review (`ultraclaude-milestone-execution`) and the owner's word. Push to `main` only when the owner says so.

---

### Task 1: The lazy-load gate

**Files:** Modify `components/map/MapView.tsx`. Create `tests/e2e/model-lazy.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("nothing 3D is requested before the map's first idle (or the 10 s fallback, contract C5)", async ({ page }) => {
  // On a fast link idle comes well inside 10 s; if this flakes on a slow one, the fallback fired first.
  const early: string[] = [];
  page.on("request", async (r) => {
    const path = new URL(r.url()).pathname;
    const idle = await page.locator("[data-map-idle='true']").count().catch(() => 0);
    if (idle) return;
    if (path.startsWith("/models/")) early.push(path);
  });
  page.on("response", async (r) => {
    const path = new URL(r.url()).pathname;
    if (!path.endsWith(".js")) return;
    const idle = await page.locator("[data-map-idle='true']").count().catch(() => 0);
    const body = await r.body().catch(() => null);
    if (!idle && body && /WebGLRenderer|GLTFLoader/.test(body.toString("latin1"))) early.push(path);
  });
  await page.goto("/map");
  await expect(page.locator("[data-map-idle='true']")).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(3_000);
  expect(early).toEqual([]);
});
```

Run `npm run test:e2e -- model-lazy`. Expected: FAIL, because `data-map-idle` doesn't exist yet.

- [ ] **Step 2: Add the signal.** In `MapView.tsx`:
  - Add `const [idle, setIdle] = useState(false);` next to the other state.
  - In the map-creation effect, after `map.on("load", onLoad);`, add `map.once("idle", () => setIdle(true));`.
  - On the container element, add `data-map-idle={idle ? "true" : undefined}`.
  - Comment: `// Test hook: true after the map's first idle; the 3D layer loads nothing before it (contract C5).`
- [ ] **Step 3:** Rerun the test: PASS. Also run `npx tsc --noEmit`, `npx eslint components/map` (no new errors), and the full e2e. Commit: "Prove nothing 3D loads before the map is idle" plus the trailer.

### Task 2: A failed model never breaks the map

**Files:** Create `tests/e2e/model-failure.spec.ts`.

- [ ] **Step 1: Write the test**

```ts
import { expect, test } from "@playwright/test";

test("when every model request fails, the map and its panels still work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/models/**", (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/map?dest=baguio-cathedral");
  await page.waitForTimeout(8_000);
  await page.getByRole("button", { name: "Explore" }).click();
  await expect(page.getByRole("heading", { name: "Explore Baguio" })).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2:** Run it.
  - Expected: PASS. M3's loaders already catch (`loadIndex`/`loadTileIndex` fall back to empty lists; a failed model resolves to `null`).
  - If it fails, fix the uncaught path in `ModelLayer.ts`, and only that.
  - Commit: "Check that failed model requests never break the map" plus the trailer.

### Task 3: Recover from a lost WebGL context

**Files:** Modify `components/map/layers/ModelLayer.ts`. Create `tests/e2e/model-context-loss.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "@playwright/test";

test("the 3D layer survives a WebGL context loss and restore without refetching", async ({ page }) => {
  const errors: string[] = [];
  const glb: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => { if (/baguio-cathedral\.[0-9a-f]{8}\.glb$/.test(r.url())) glb.push(r.url()); });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => glb.length, { timeout: 30_000 }).toBe(1);
  await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement;
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext;
    const ext = gl.getExtension("WEBGL_lose_context")!;
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 1_000));
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 3_000));
  });
  expect(glb.length, "the model is reused, not refetched").toBe(1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/m8-after-context-restore.png" });
});
```

Run it. Expected: FAIL or a blank model in the screenshot, because the old three renderer is bound to a dead context.

- [ ] **Step 2: Re-add the layer on restore.** In `useModelLayer`'s effect, keep the `Kit` once loaded (`let k: Kit | null = null;`, set in `want`/`wantTile`). Add:

```ts
    // MapLibre rebuilds its own GL state on restore; ours belongs to a dead context. Re-adding the
    // layer runs onAdd again with the new context, and three re-uploads the cached geometry.
    const onRestored = () => {
      if (!k || cancelled || isTornDown(map)) return;
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      try {
        map.addLayer(createLayer(map, k, shown));
      } catch {
        layerAdded = false; // style mid-swap; the next want() re-adds it
      }
      map.triggerRepaint();
    };
    map.on("webglcontextrestored", onRestored);
```

  In the cleanup, add `map.off("webglcontextrestored", onRestored);` next to the other `off` call.
- [ ] **Step 3:** Rerun: PASS. Read the screenshot: the cathedral is drawn. Run the full e2e. Commit: "Recover the 3D layer after a WebGL context loss" plus the trailer. In the ledger, mark the overhaul's R5 deferred finding resolved for the 3D layer. MapLibre's own restore covers the base map.

### Task 4: Truth and attribution

**Files:** Modify the `/about` page's sources section (find it: `grep -rn 'id="sources"' app`).

- [ ] **Step 1:** Add to the sources list, in the page's existing voice (copy rules: sentence case, no em dashes):
  - **Building shapes:** OpenStreetMap footprints (already credited). Heights are estimated from building type, size and distance from the city centre: plausible massing, not measured heights (spec §6, contract C9).
  - **Landmark models:** modeled from the sources listed in each landmark's research sheet. Optionally link the repo's `model/landmarks/` folder if the About page already links the repo; don't add a new external link otherwise.
  - **Terrain used to model landmark foundations:** the Copernicus notice, verbatim from `model/sources.json` (`attribution`) and its `access_note`. Landmark foundations were sized on Copernicus heights (M3 `lm_common.foundation`), so shipped files derive from it (contract C9).
- [ ] **Step 2:** Run `npm run test:e2e -- copy legal` (the copy gate and legal specs) and the full suite. Commit: "Credit the 3D model's sources and say the building heights are estimates" plus the trailer.

### Task 5: Docs and the whole-branch gate

- [ ] **Step 1: README.** Add a short "3D model" section.
  - Where things live: `model/`, `public/models/`, the plans, the contract.
  - How to rebuild from scratch, in order: `check_m1.py` fetches; `terrain_grid.py`; the headless Blender build; landmark scripts plus export/pack; `build_massing.py build`; `landmarks_sql.py`.
  - Note that `model/data/` is regenerable and gitignored.
- [ ] **Step 2: Spec.** Append an addendum to `docs/baguio-3d-model-plan.md` marking Phase 9 done, with links to the contract and the M1–M8 plans and the final measured numbers (from the ledger).
- [ ] **Step 3: Every gate, from a clean shell:**
  - `uv run model/scripts/check_m1.py`
  - the M2 Blender gates
  - `node model/scripts/validate_glbs.mjs`
  - `npm test`
  - `npx tsc --noEmit`
  - `npx eslint .` (still 28 errors, all from the base branch)
  - `npm run test:e2e` (all green)

  Paste the summary lines into the ledger.
- [ ] **Step 4: Whole-branch review.** Run `ultraclaude-milestone-execution`'s whole-branch review over `main..feat/3d-model`. Fix only confirmed findings, each as its own commit, and rerun Step 3.
- [ ] **Step 5:** Commit the docs. Report to the owner with the gate summary and the device fps from M7. Merge and push to `main` only on their word.

## If a gate fails

Stop and report with output. The lazy gate failing means some import pulled three or a model into the first-load path. Find it with the request log the test prints, and move it behind `whenFirstIdle`.
