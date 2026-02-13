import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "@openframe/database";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set, skipping migrations.");
    process.exit(1);
  }

  console.log("Running database migrations...");

  const db = createDatabase(databaseUrl);

  // Try Docker path first, fall back to relative path for development
  const dockerMigrationsPath = "/app/packages/database/src/migrations";
  const relativeMigrationsPath = path.resolve(__dirname, "../../../packages/database/src/migrations");

  const migrationsFolder = fs.existsSync(dockerMigrationsPath) 
    ? dockerMigrationsPath 
    : relativeMigrationsPath;

  console.log(`Using migrations folder: ${migrationsFolder}`);

  if (!fs.existsSync(migrationsFolder)) {
    console.error(`Migrations folder does not exist: ${migrationsFolder}`);
    process.exit(1);
  }

  try {
    await migrate(db, {
      migrationsFolder,
    });
    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

runMigrations();
