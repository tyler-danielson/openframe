/**
 * Calendars the user adds themselves show on the calendar views right away.
 * Skipped unless TEST_DATABASE_URL points at a disposable database — its
 * schema is dropped and re-migrated.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import sensible from "@fastify/sensible";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { calendarRoutes } from "./index.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

let client: ReturnType<typeof postgres>;
let db: Database;
let app: FastifyInstance;
let userId: string;

describe("local calendars (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, {
      migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../packages/database/src/migrations"),
    });
    const [user] = await db.insert(schema.users).values({ email: "calendars@example.com" }).returning();
    userId = user!.id;

    app = Fastify();
    await app.register(sensible);
    app.decorate("db", db);
    app.decorate("authenticateKioskOrAny", async (request: FastifyRequest) => {
      request.user = { userId };
    });
    await app.register(calendarRoutes, { prefix: "/calendars" });
    await app.ready();
  });

  after(async () => {
    await app?.close();
    await client?.end();
  });

  test("a new local calendar is shown in the day, week and month views", async () => {
    const res = await app.inject({ method: "POST", url: "/calendars/local", payload: { name: "Family", color: "#f97316" } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json().data.visibility, { week: true, month: true, day: true, popup: true, screensaver: false });
  });
});
