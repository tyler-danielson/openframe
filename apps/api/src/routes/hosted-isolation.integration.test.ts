/**
 * The hosted service: households that don't know each other share one server
 * and one database, and every account is its own household's "admin". One of
 * them must not be able to reach another's data, the server-wide settings, or
 * someone else's account. Skipped unless TEST_DATABASE_URL points at a
 * disposable database — its schema is dropped and re-migrated.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { encrypt } from "../lib/encryption.js";
import { LogBuffer } from "../lib/logBuffer.js";
import { authPlugin } from "../plugins/auth.js";
import { requireAdminPlugin } from "../plugins/require-admin.js";
import { adminRoutes } from "./admin/index.js";
import { authRoutes } from "./auth/index.js";
import { cloudRoutes } from "./cloud/index.js";
import { recipeRoutes } from "./recipes/index.js";
import { settingsRoutes } from "./settings/index.js";
import { setupRoutes } from "./setup/index.js";
import { userRoutes } from "./users/index.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { apiKeys, kioskConfig, kiosks, oauthTokens, refreshTokens, systemSettings, users } = schema;
process.env.ENCRYPTION_KEY ??= "0".repeat(64);

const HOST = "openframe.example";
const PROVISIONING_SECRET = "provisioning-secret-for-tests-0123456789";
const PLATFORM_SECRET = "sk-platform-anthropic-key";

let client: ReturnType<typeof postgres>;
let db: Database;
let app: FastifyInstance;
let dataDir: string;
let alice: typeof users.$inferSelect | undefined;
let bob: typeof users.$inferSelect | undefined;
let operator: typeof users.$inferSelect | undefined;

const env = { ...process.env };

function bearer(user: { id: string }) {
  return { authorization: `Bearer ${app.jwt.sign({ userId: user.id })}`, host: HOST };
}

// --- fake Microsoft ------------------------------------------------------------

const realFetch = globalThis.fetch;
let microsoftIdToken = "";
let microsoftProfile: Record<string, string> = {};

function idToken(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
}

function installFakeFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    if (url.host === "login.microsoftonline.com") {
      return json({ access_token: "ms-access", refresh_token: "ms-refresh", expires_in: 3600, scope: "User.Read", id_token: microsoftIdToken });
    }
    if (url.host === "graph.microsoft.com") return json(microsoftProfile);
    return new Response("no fake", { status: 599 });
  }) as typeof fetch;
}

/** Sign in with Microsoft from a fresh browser: the callback's response. */
async function signInWithMicrosoft() {
  const start = await app.inject({ method: "GET", url: "/api/v1/auth/oauth/microsoft", headers: { host: HOST } });
  assert.equal(start.statusCode, 302, start.body);
  const state = new URL(start.headers.location as string).searchParams.get("state")!;
  const cookies = Object.fromEntries(start.cookies.map((c) => [c.name, c.value]));
  return app.inject({
    method: "GET",
    url: `/api/v1/auth/oauth/microsoft/callback?code=c&state=${state}`,
    headers: { host: HOST },
    cookies,
  });
}

describe("hosted service isolation (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
    await migrate(db, {
      migrationsFolder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../packages/database/src/migrations"),
    });

    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "openframe-hosted-"));
    process.env.DATA_DIR = dataDir;
    process.env.HOSTED_MODE = "true";
    process.env.PLATFORM_ADMIN_EMAILS = "Operator@OpenFrame.example";
    for (const name of ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      delete process.env[name];
    }
    installFakeFetch();

    app = Fastify();
    await app.register(sensible);
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, { secret: "test-jwt-secret-test-jwt-secret-1234" });
    app.decorate("hostedMode", true);
    app.decorate("provisioningSecret", PROVISIONING_SECRET);
    app.decorate("relaySecret", "relay-secret-that-must-not-work");
    app.decorate("logBuffer", new LogBuffer());
    await app.register(
      fp(
        async (f) => {
          f.decorate("db", db);
        },
        { name: "database" }
      )
    );
    await app.register(authPlugin);
    await app.register(requireAdminPlugin);
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.register(userRoutes, { prefix: "/api/v1/users" });
    await app.register(adminRoutes, { prefix: "/api/v1/admin" });
    await app.register(setupRoutes, { prefix: "/api/v1/setup" });
    await app.register(settingsRoutes, { prefix: "/api/v1/settings" });
    await app.register(cloudRoutes, { prefix: "/api/v1/cloud" });
    await app.register(recipeRoutes, { prefix: "/api/v1/recipes" });
    await app.ready();
  });

  after(async () => {
    globalThis.fetch = realFetch;
    process.env = env;
    await app?.close();
    await client?.end();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await client.unsafe("TRUNCATE users CASCADE; DELETE FROM system_settings;");
    // Two households, provisioned the way openframe.us does it, and the operator
    [alice] = await db.insert(users).values({ email: "alice@example.com", role: "admin" }).returning();
    [bob] = await db.insert(users).values({ email: "bob@example.com", role: "admin" }).returning();
    [operator] = await db.insert(users).values({ email: "operator@openframe.example", role: "admin" }).returning();
    // Settings for the whole platform
    await db.insert(systemSettings).values([
      { category: "anthropic", key: "api_key", value: encrypt(PLATFORM_SECRET), isSecret: true },
      { category: "microsoft", key: "client_id", value: "ms-client" },
      { category: "microsoft", key: "client_secret", value: encrypt("ms-secret"), isSecret: true },
    ]);
  });

  afterEach(() => {
    microsoftIdToken = "";
    microsoftProfile = {};
  });

  test("a household's account doesn't administer the server", async () => {
    for (const [method, url] of [
      ["GET", "/api/v1/users"],
      ["PATCH", `/api/v1/users/${bob!.id}/role`],
      ["DELETE", `/api/v1/users/${bob!.id}`],
      ["GET", "/api/v1/admin/users"],
      ["GET", "/api/v1/admin/logs"],
      ["PUT", `/api/v1/admin/users/${alice!.id}/plan`],
    ] as const) {
      const res = await app.inject({ method, url, headers: bearer(alice!), payload: method === "PATCH" ? { role: "member" } : method === "PUT" ? { planId: "pro" } : undefined });
      assert.equal(res.statusCode, 403, `${method} ${url}: ${res.body}`);
    }
    assert.equal((await db.select().from(users).where(eq(users.id, bob!.id))).length, 1);

    // The operator, listed in PLATFORM_ADMIN_EMAILS, does
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users", headers: bearer(operator!) });
    assert.equal(res.statusCode, 200, res.body);
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: bearer(alice!) });
    assert.equal(me.json().data.isServerAdmin, false);
  });

  test("a household can't change or read the platform's settings", async () => {
    const configure = await app.inject({
      method: "POST",
      url: "/api/v1/setup/configure",
      headers: bearer(alice!),
      payload: { category: "microsoft", settings: { client_id: "attacker-app" } },
    });
    assert.equal(configure.statusCode, 403, configure.body);
    const [clientId] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.category, "microsoft"), eq(systemSettings.key, "client_id"), isNull(systemSettings.userId)));
    assert.equal(clientId!.value, "ms-client");

    const exported = await app.inject({
      method: "GET",
      url: "/api/v1/settings/export?categories=settings&includeCredentials=true",
      headers: bearer(alice!),
    });
    assert.equal(exported.statusCode, 200, exported.body);
    assert.doesNotMatch(exported.body, new RegExp(PLATFORM_SECRET));
    assert.doesNotMatch(exported.body, /ms-secret|ms-client/);

    const category = await app.inject({ method: "GET", url: "/api/v1/settings/category/microsoft", headers: bearer(alice!) });
    assert.doesNotMatch(category.body, /ms-client/);
  });

  test("nobody can repoint the server at another cloud relay, or use a relay secret", async () => {
    const callback = await app.inject({
      method: "POST",
      url: "/api/v1/cloud/callback?instanceId=x&relaySecret=attacker&wsEndpoint=wss://attacker.example/relay",
      headers: { host: HOST },
    });
    assert.equal(callback.statusCode, 404);
    const connect = await app.inject({
      method: "POST",
      url: "/api/v1/cloud/connect",
      headers: bearer(alice!),
      payload: { cloudUrl: "https://attacker.example" },
    });
    assert.equal(connect.statusCode, 404);
    assert.equal((await db.select().from(systemSettings).where(eq(systemSettings.category, "cloud"))).length, 0);

    const relayed = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { host: HOST, "x-relay-secret": "relay-secret-that-must-not-work", "x-relay-user-id": bob!.id },
    });
    assert.equal(relayed.statusCode, 401);
  });

  test("nobody can claim someone else's email address", async () => {
    const signup = await app.inject({
      method: "POST",
      url: "/api/v1/auth/signup",
      headers: { host: HOST },
      payload: { email: "carol@example.com", name: "Not Carol", password: "password123" },
    });
    assert.equal(signup.statusCode, 404);

    const invite = await app.inject({
      method: "POST",
      url: "/api/v1/users/invite",
      headers: bearer(alice!),
      payload: { email: "carol@example.com", role: "admin" },
    });
    assert.equal(invite.statusCode, 404);
    assert.equal((await db.select().from(users).where(eq(users.email, "carol@example.com"))).length, 0);
  });

  test("signing up at openframe.us closes whatever way in someone else left on the account", async () => {
    // Made by a household for their relative, with a password the household chose
    const [carol] = await db.insert(users).values({ email: "carol@example.com", role: "member", passwordHash: "chosen-by-alice" }).returning();
    await db.insert(refreshTokens).values({ userId: carol!.id, tokenHash: "h1", familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86400000) });
    await db.insert(apiKeys).values({ userId: carol!.id, name: "k", keyHash: "0".repeat(64), keyPrefix: "openframe_abc" });
    await db.insert(oauthTokens).values({ userId: carol!.id, provider: "google", accessToken: "t", externalAccountId: "alice@example.com" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { host: HOST, "x-provisioning-secret": PROVISIONING_SECRET },
      payload: { email: "carol@example.com" },
    });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().data.userId, carol!.id);

    const [claimed] = await db.select().from(users).where(eq(users.id, carol!.id));
    assert.equal(claimed!.passwordHash, null);
    assert.equal(claimed!.role, "admin");
    const [session] = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, carol!.id));
    assert.ok(session!.revokedAt);
    assert.equal((await db.select().from(apiKeys).where(eq(apiKeys.userId, carol!.id))).length, 0);
    assert.equal((await db.select().from(oauthTokens).where(eq(oauthTokens.userId, carol!.id))).length, 0);
  });

  test("a work account with someone's email address doesn't sign in as them", async () => {
    // Any organization can give one of its accounts anyone's address
    microsoftIdToken = idToken({ tid: "attacker-tenant", oid: "attacker-object" });
    microsoftProfile = { mail: "alice@example.com", displayName: "Not Alice" };
    const res = await signInWithMicrosoft();
    assert.equal(res.statusCode, 400, res.body);
    assert.doesNotMatch(res.headers.location ?? "", /accessToken/);
    assert.equal((await db.select().from(oauthTokens).where(eq(oauthTokens.userId, alice!.id))).length, 0);

    // A personal Microsoft account's address is verified by Microsoft
    microsoftIdToken = idToken({ tid: "9188040d-6c67-4c5b-b112-36a304b66dad", oid: "alice-object" });
    const personal = await signInWithMicrosoft();
    assert.equal(personal.statusCode, 302, personal.body);
    assert.match(personal.headers.location as string, /accessToken=/);
    const [linked] = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, alice!.id));
    assert.equal(linked!.providerSubject, "9188040d-6c67-4c5b-b112-36a304b66dad:alice-object");
  });

  test("sign-in only returns to this site, and only the browser that started it finishes it", async () => {
    const elsewhere = await app.inject({
      method: "GET",
      url: `/api/v1/auth/oauth/microsoft?callbackUrl=${encodeURIComponent("https://attacker.example/cb")}`,
      headers: { host: HOST },
    });
    assert.equal(elsewhere.statusCode, 400);

    const start = await app.inject({
      method: "GET",
      url: `/api/v1/auth/oauth/microsoft?callbackUrl=${encodeURIComponent(`https://${HOST}/auth/callback`)}`,
      headers: { host: HOST },
    });
    assert.equal(start.statusCode, 302, start.body);
    const state = new URL(start.headers.location as string).searchParams.get("state")!;
    // Someone else's browser, e.g. a victim sent the provider's sign-in link
    const res = await app.inject({ method: "GET", url: `/api/v1/auth/oauth/microsoft/callback?code=c&state=${state}`, headers: { host: HOST } });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /different browser/);
  });

  test("a link can't connect an account to someone else's", async () => {
    // A session token in the link (how links used to connect accounts) is refused
    const withToken = await app.inject({
      method: "GET",
      url: `/api/v1/auth/oauth/microsoft?token=${app.jwt.sign({ userId: alice!.id })}`,
      headers: { host: HOST },
    });
    assert.equal(withToken.statusCode, 401);

    // A ticket only works in the browser it was issued to
    const ticket = await app.inject({ method: "POST", url: "/api/v1/auth/oauth/link-ticket", headers: bearer(alice!) });
    assert.equal(ticket.statusCode, 200, ticket.body);
    const url = `/api/v1/auth/oauth/microsoft?linkTicket=${ticket.json().data.ticket}`;
    const otherBrowser = await app.inject({ method: "GET", url, headers: { host: HOST } });
    assert.equal(otherBrowser.statusCode, 401);
  });

  test("the screensaver doesn't show another household's settings", async () => {
    await db.insert(kiosks).values({ userId: bob!.id, name: "Bob's kitchen" });
    await db.insert(kioskConfig).values({ userId: bob!.id, screensaverLayoutConfig: { secret: "bob's layout" } });
    const anonymous = await app.inject({ method: "GET", url: "/api/v1/auth/kiosk/screensaver", headers: { host: HOST } });
    assert.equal(anonymous.statusCode, 200);
    assert.doesNotMatch(anonymous.body, /bob's layout/);
    const asBob = await app.inject({ method: "GET", url: "/api/v1/auth/kiosk/screensaver", headers: bearer(bob!) });
    assert.match(asBob.body, /bob's layout/);
  });

  test("recipe images can't reach outside the user's own folder", async () => {
    fs.writeFileSync(path.join(dataDir, "secrets.json"), '{"jwtSecret":"s"}');
    fs.mkdirSync(path.join(dataDir, "recipes", bob!.id), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "recipes", bob!.id, "dinner.jpg"), "bob's photo");
    fs.mkdirSync(path.join(dataDir, "recipes", alice!.id), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "recipes", alice!.id, "lunch.jpg"), "alice's photo");

    for (const target of ["../../secrets.json", `../${bob!.id}/dinner.jpg`, "..%2F..%2Fsecrets.json"]) {
      const res = await app.inject({ method: "GET", url: `/api/v1/recipes/image/recipes/${alice!.id}/${target}`, headers: bearer(alice!) });
      assert.equal(res.statusCode, 403, `${target}: ${res.body}`);
    }
    const own = await app.inject({ method: "GET", url: `/api/v1/recipes/image/recipes/${alice!.id}/lunch.jpg`, headers: bearer(alice!) });
    assert.equal(own.statusCode, 200);
    assert.equal(own.body, "alice's photo");
  });

  test("a kiosk display's key never administers anything", async () => {
    const [kiosk] = await db.insert(kiosks).values({ userId: operator!.id, name: "Lobby" }).returning();
    const res = await app.inject({ method: "GET", url: "/api/v1/admin/users", headers: { host: HOST, "x-api-key": `kiosk_${kiosk!.token}` } });
    assert.equal(res.statusCode, 403);
  });
});
