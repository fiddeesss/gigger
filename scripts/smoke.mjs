#!/usr/bin/env node
// Runs every phase smoke script in sequence (loads .env.local itself).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const phase = process.argv[2] ?? "all";
const phases = ["phase5_smoke.mjs", "phase6_smoke.mjs", "phase7_smoke.mjs"];

const targets = phase === "all" ? phases : phases.filter((p) => p.includes(phase));

for (const file of targets) {
  console.log(`\n=== ${file} ===`);
  const res = spawnSync("node", [join("scripts", file)], { cwd: root, stdio: "inherit", env: process.env });
  if (res.status !== 0) {
    console.error(`FAILED: ${file} (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
}
console.log("\nAll smoke suites passed.");
