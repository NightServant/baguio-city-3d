# Baguio 3D Model, M7: Optimization and Export Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove every budget in contract C6 on the shipped assets and the real page, make the texture-format decision with numbers, validate every GLB, and measure frame rate on a real mid-range phone. Tune only where a measurement says so.

**Architecture:** Mostly measurement:
- Khronos validation over every GLB.
- A runtime-bytes e2e, which counts what JavaScript the 3D path loads after `idle`.
- A texture experiment on the shipped landmarks: WebP as shipped vs KTX2 via gltfpack.
- A frame-rate probe the owner runs on a phone over Chrome remote debugging.

Code changes happen only through the tuning levers M5 and M3 already expose.

**Tech Stack:** `npx gltf-validator` (no new dependency), Playwright, gltfpack (M3's pin), Chrome remote debugging.

**Spec:** spec §9, §13 "Technical"; budgets from the 1 Oct addendum; contract C2 (texture rule, "M7 decides whether KTX2 replaces WebP"), C5, C6.

## Global Constraints

- M3's Global Constraints.
- **Measure, then change.** No tuning without a failing number. Every number goes in the ledger.
- Budgets (C6), unchanged: runtime ≤ 180 KiB; tile ≤ 100 KiB; default view ≤ 1 MiB; landmark ≤ 150 KiB (tier-1 geometry ≤ 60 KiB); session ≤ 6 MiB; ≥ 30 fps on a Galaxy A51-class phone; ≤ 500k triangles; ≤ 100 draw calls.

---

### Task 1: Validate every GLB

**Files:** Create `model/scripts/validate_glbs.mjs`.

- [ ] **Step 1: Write the script**

```js
// M7: run the Khronos glTF validator over every shipped GLB. Errors fail; warnings are listed.
// Run: node model/scripts/validate_glbs.mjs   (fetches gltf-validator through npx; no dependency added)
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const dirs = ["public/models/landmarks", "public/models/buildings"];
let errors = 0;
for (const dir of dirs) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".glb"))) {
    const out = execFileSync("npx", ["-y", "gltf-validator", "-o", `${dir}/${f}`], { encoding: "utf8" });
    const report = JSON.parse(out);
    const n = report.issues.numErrors;
    errors += n;
    if (n || report.issues.numWarnings) console.log(`${dir}/${f}: ${n} errors, ${report.issues.numWarnings} warnings`);
  }
}
console.log(errors ? `${errors} validation errors` : "all GLBs valid");
process.exit(errors ? 1 : 0);
```

- [ ] **Step 2:** Run `npx -y gltf-validator --help | head -20` first and check that `-o` writes the JSON report to stdout. If the flag differs, use the documented one. Then run `node model/scripts/validate_glbs.mjs`.
  - Expected: `all GLBs valid`.
  - `EXT_meshopt_compression` may show as an unsupported-extension info or warning. That isn't an error.
- [ ] **Step 3: Commit** with the trailer: "Validate every shipped 3D model file".

### Task 2: Runtime bytes and session bytes on the real page

**Files:** Create `tests/e2e/model-budgets.spec.ts`.

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from "@playwright/test";

test("the 3D runtime and a landmark visit stay within budget", async ({ page }) => {
  const js = new Map<string, number>();
  const models = new Map<string, number>();
  page.on("response", async (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(page.url() || "http://localhost").origin) return;
    const body = await r.body().catch(() => null);
    if (!body) return;
    if (url.pathname.endsWith(".js") && /WebGLRenderer|GLTFLoader|MeshoptDecoder/.test(body.toString("latin1"))) js.set(url.pathname, body.length);
    if (url.pathname.startsWith("/models/")) models.set(url.pathname, body.length);
  });
  await page.goto("/map?dest=baguio-cathedral");
  await expect.poll(() => [...models.keys()].some((p) => p.includes("baguio-cathedral.")), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(5_000);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`3D runtime chunks: ${[...js.keys()].join(", ")} = ${sum(js)} bytes; models ${models.size} files = ${sum(models)} bytes`);
  expect(sum(js), "3D runtime, uncompressed bytes as received").toBeLessThanOrEqual(180 * 1024 * 4); // see Step 2
  expect(sum(models), "session bytes for this visit").toBeLessThanOrEqual(6 * 1024 * 1024);
});
```

- [ ] **Step 2: Make the runtime check exact.**
  - Playwright's `body()` is the decoded body. The budget is compressed over the wire, so the `× 4` above is only a coarse guard.
  - For the real number, run `npm run build`, find the chunks the spec printed under `.next/static/chunks/`, and measure `gzip -9c <chunk> | wc -c` for each. Their sum must be ≤ 180 KiB (planning measured three's chunk at 129 KiB gzip; `GLTFLoader` about 25 KiB; meshopt about 8 KiB).
  - Then replace `180 * 1024 * 4` with the measured decoded/gzip ratio × 180 KiB, and write the ratio in a comment.
- [ ] **Step 3:** Run `npm run test:e2e -- model-budgets`: 1 passed. Commit: "Check the 3D runtime and session bytes on the real page" plus the trailer.

### Task 3: Texture format decision

- [ ] **Step 1: Measure the shipped state.** Sum image bytes across all landmark GLBs. Use M3's `glb_stats` logic: total minus geometry, which is what `pack_landmark.py` prints as file vs geometry.
- [ ] **Step 2: Try KTX2.** For the three landmarks with the most image bytes, run `npx -y <M3's GLTFPACK pin> -i model/data/out/<slug>.raw.glb -o /tmp/<slug>.ktx2.glb -cc -tc`.
  - Record file size and whether it ran without an external `basisu`/`toktx` binary.
  - Also record the KTX2 transcoder's size: `ls -l node_modules/three/examples/jsm/libs/basis/` (`basis_transcoder.js` + `.wasm`), gzip each.
- [ ] **Step 3: Decide by this rule.**
  - Adopt KTX2 only if (texture bytes saved across all 22 landmarks) > (gzip transcoder bytes), and the runtime budget (Task 2) still holds with the transcoder added.
  - Otherwise WebP stays, and contract C2's WebP rule becomes final.
  - Record the numbers and the decision in the ledger.
  - If KTX2 wins, add `KTX2Loader` to `loadKit()` in `ModelLayer.ts` with the transcoder served from `public/basis/`, re-pack every landmark with `-tc`, and rerun Tasks 1 and 2.

### Task 4: Frame rate on a real phone

**Files:** Create `model/scripts/fps-probe.js`.

- [ ] **Step 1: Write the probe** (pasted into a remote DevTools console; it measures and changes nothing):

```js
// Paste into Chrome DevTools (chrome://inspect → the phone's /map tab). Pan and tilt the map with a finger for 10 s.
(() => {
  let frames = 0, worst = 0, last = performance.now();
  const end = last + 10_000;
  const tick = (t) => {
    frames++; worst = Math.max(worst, t - last); last = t;
    if (t < end) requestAnimationFrame(tick);
    else console.log(`fps ${(frames / 10).toFixed(1)}, worst frame ${worst.toFixed(0)} ms`);
  };
  requestAnimationFrame(tick);
})();
```

- [ ] **Step 2: The owner runs it.** Ask the owner in chat to open the deployed preview's `/map` on a Galaxy A51-class Android phone (or the closest they have, and say which), connect Chrome remote debugging, paste the probe, and pan for 10 s. Do this at the default view, then at `/map?dest=burnham-park`. Record the device, Chrome version, fps and worst frame.
- [ ] **Step 3: Tune only if it's under 30 fps.** In order, re-measuring after each:
  1. Raise `FAR_MIN_AREA` (fewer far triangles).
  2. Load far tiles only within the view's nearer half: sort the visible tiles by distance to the map centre and cap them at 40.
  3. Pass `antialias: false` to the three renderer on devices with `devicePixelRatio > 2`.

  Each change is its own commit with its measurement.
- [ ] **Step 4:** Commit the probe and any tuning; append `## Phase 9, M7 (date)` to the ledger with the validator result, runtime gzip bytes, session bytes, texture decision with numbers, and the device fps. Report to the owner.

## If a gate fails

Stop and report the number. Budgets don't move without the owner. The levers, in order: textures (size, format), far-LOD culling, tile count in view, then landmark scope.
