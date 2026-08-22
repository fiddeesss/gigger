#!/usr/bin/env node
// Apply a migration file from supabase/migrations/ to the Supabase project.
// Usage: node scripts/apply_migration.mjs <filename.sql> [extraSQL]
// Requires SUPABASE_ACCESS_TOKEN (management API token) in env or .env.local.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local if present (no deps — tiny parser)
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!TOKEN || !REF) {
  console.error("Need SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL (in .env.local)");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply_migration.mjs <filename.sql> [extraSQL]");
  process.exit(1);
}

const sqlPath = join(root, "supabase", "migrations", file);
let sql = readFileSync(sqlPath, "utf8");
if (process.argv[3]) sql += "\n" + process.argv[3];

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
console.log(`HTTP ${res.status}: ${body.slice(0, 300)}`);
process.exit(res.status === 201 ? 0 : 1);
