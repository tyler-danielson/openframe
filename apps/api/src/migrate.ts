import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "@openframe/database";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set, skipping migrations.");
    process.exit(1);
  }

  console.log("Running database migrations...");

  const db = createDatabase(databaseUrl);

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, "../../packages/database/src/migrations"),
    });
    console.log("Migrations completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

runMigrations();
