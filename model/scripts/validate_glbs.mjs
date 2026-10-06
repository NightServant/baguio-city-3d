// M7: run the Khronos glTF validator over every shipped GLB. Errors fail; warnings are listed.
// Run: node model/scripts/validate_glbs.mjs
// The npm package has no CLI (2.0.0-dev.3.10), so it is installed once into the OS temp folder and used as a
// library: no project dependency is added.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const PIN = "gltf-validator@2.0.0-dev.3.10";
const prefix = join(tmpdir(), "baguio-gltf-validator");
const entry = join(prefix, "node_modules", "gltf-validator", "gltf_validator.dart.js");
if (!existsSync(entry)) execFileSync("npm", ["install", "--no-save", "--prefix", prefix, PIN], { stdio: "ignore" });
const { default: validator } = await import(pathToFileURL(join(prefix, "node_modules", "gltf-validator", "index.js")).href);

const dirs = ["public/models/landmarks", "public/models/buildings", "public/models/roads"];
let errors = 0;
let files = 0;
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".glb")).sort()) {
    const report = await validator.validateBytes(new Uint8Array(readFileSync(`${dir}/${f}`)), { uri: f, maxIssues: 50 });
    const { numErrors: n, numWarnings: w } = report.issues;
    errors += n;
    files++;
    if (n || w) {
      console.log(`${dir}/${f}: ${n} errors, ${w} warnings`);
      for (const m of report.issues.messages.filter((m) => m.severity <= 1).slice(0, 5)) console.log(`  ${m.code}: ${m.message}`);
    }
  }
}
console.log(errors ? `${errors} validation errors in ${files} files` : `all ${files} GLBs valid`);
process.exit(errors ? 1 : 0);
