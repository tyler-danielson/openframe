#!/usr/bin/env node
/**
 * Fails if the Drizzle schema (src/schema) and the SQL migrations describe
 * different databases. Pushes the schema into one scratch database, runs the
 * migrations in another, and compares their columns (type, nullability,
 * default), enums and indexes.
 *
 *   DATABASE_URL=postgres://user:pass@localhost/postgres node scripts/check-schema-drift.mjs
 *
 * The DATABASE_URL user must be allowed to create databases; the scratch
 * databases are dropped afterwards.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

const scratch = { schema: `drift_schema_${process.pid}`, migrations: `drift_migrations_${process.pid}` };
const urlFor = (database) => {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
};

const FINGERPRINT = [
  `select table_name || '.' || column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '') as line
     from information_schema.columns where table_schema = 'public'`,
  `select 'enum ' || t.typname || '=' || string_agg(e.enumlabel, ',' order by e.enumlabel) as line
     from pg_type t join pg_enum e on e.enumtypid = t.oid group by t.typname`,
  `select 'index ' || tablename || ': ' || regexp_replace(indexdef, '^.*USING ', '') as line
     from pg_indexes where schemaname = 'public'`,
];

async function fingerprint(url) {
  const sql = postgres(url, { onnotice: () => {} });
  try {
    const lines = [];
    for (const query of FINGERPRINT) {
      for (const row of await sql.unsafe(query)) lines.push(row.line);
    }
    return lines.sort();
  } finally {
    await sql.end();
  }
}

const admin = postgres(adminUrl, { onnotice: () => {} });
try {
  for (const database of Object.values(scratch)) await admin.unsafe(`CREATE DATABASE "${database}"`);

  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    cwd: packageDir,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, DATABASE_URL: urlFor(scratch.schema) },
  });

  const client = postgres(urlFor(scratch.migrations), { onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(packageDir, "src/migrations") });
  } finally {
    await client.end();
  }

  const [fromSchema, fromMigrations] = await Promise.all([
    fingerprint(urlFor(scratch.schema)),
    fingerprint(urlFor(scratch.migrations)),
  ]);
  const migrationLines = new Set(fromMigrations);
  const schemaLines = new Set(fromSchema);
  const onlySchema = fromSchema.filter((line) => !migrationLines.has(line));
  const onlyMigrations = fromMigrations.filter((line) => !schemaLines.has(line));

  if (onlySchema.length > 0 || onlyMigrations.length > 0) {
    console.error("The Drizzle schema and the migrations disagree (add a migration, or fix the schema):");
    for (const line of onlySchema) console.error(`  schema only:     ${line}`);
    for (const line of onlyMigrations) console.error(`  migrations only: ${line}`);
    process.exitCode = 1;
  } else {
    console.log(`The Drizzle schema matches the migrations (${fromSchema.length} columns, enums and indexes).`);
  }
} finally {
  for (const database of Object.values(scratch)) {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${database}"`).catch(() => {});
  }
  await admin.end();
}
