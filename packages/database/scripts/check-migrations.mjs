#!/usr/bin/env node
/**
 * Fails if the SQL migrations and meta/_journal.json disagree.
 *
 * drizzle's migrator only runs migrations listed in the journal, in journal
 * order, and only those whose "when" is newer than the last one applied. So a
 * .sql file that isn't registered (or is registered with an older "when")
 * silently never runs, and the database drifts from the schema.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/migrations");
const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, "meta/_journal.json"), "utf8"));
const files = new Set(
  fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, -".sql".length))
);

// Shipped together with the entry before it (so every install applies both in
// one run) and idempotent; its older "when" is historical and harmless.
const KNOWN_OUT_OF_ORDER = new Set(["0010_add_calendar_visibility"]);

const problems = [];
const registered = new Set();
let newest = null;
journal.entries.forEach((entry, i) => {
  if (entry.idx !== i) problems.push(`${entry.tag}: idx is ${entry.idx}, expected ${i}`);
  if (registered.has(entry.tag)) problems.push(`${entry.tag}: registered twice`);
  registered.add(entry.tag);
  if (!files.has(entry.tag)) problems.push(`${entry.tag}: in the journal, but ${entry.tag}.sql doesn't exist`);
  // The migrator skips anything not newer than the newest migration applied
  if (newest && !(entry.when > newest.when) && !KNOWN_OUT_OF_ORDER.has(entry.tag)) {
    problems.push(`${entry.tag}: "when" (${entry.when}) must be greater than ${newest.tag}'s (${newest.when})`);
  }
  if (!newest || entry.when > newest.when) newest = entry;
});
for (const tag of files) {
  if (!registered.has(tag)) problems.push(`${tag}.sql: not registered in meta/_journal.json, so it never runs`);
}

if (problems.length > 0) {
  console.error(`Migration journal problems (${path.relative(process.cwd(), migrationsDir)}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`All ${files.size} migrations are registered in order.`);
