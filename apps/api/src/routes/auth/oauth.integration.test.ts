/**
 * Connecting a Microsoft (Outlook) account from Settings, through the auth
 * routes against a real Postgres with Microsoft's endpoints faked. Skipped
 * unless TEST_DATABASE_URL points at a disposable database — its schema is
 * dropped and re-migrated.
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { decrypt, encrypt } from "../../lib/encryption.js";
import { authRoutes } from "./index.js";

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const { oauthTokens, systemSettings, users } = schema;
process.env.ENCRYPTION_KEY ??= "0".repeat(64);
// Credentials come from Settings in these tests, never the environment
for (const name of ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_TENANT_ID"]) delete process.env[name];

let client: ReturnType<typeof postgres>;
let db: Database;
let app: FastifyInstance;
let userId: string;

const HOST = "frame.example.com";
const REDIRECT_URI = `https://${HOST}/api/v1/auth/oauth/microsoft/callback`;
const RETURN_URL = `https://${HOST}/settings/connections?connected=1`;
const CALENDAR_SCOPES = ["Calendars.ReadWrite", "User.Read", "email", "offline_access", "openid", "profile"];

// --- fake Microsoft ------------------------------------------------------------

const realFetch = globalThis.fetch;
let requests: Array<{ url: URL; body: URLSearchParams | null }> = [];
let tokenResponse: () => Response;
let profileResponse: () => Response;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installFakeFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    requests.push({ url, body: init.body instanceof URLSearchParams ? init.body : null });
    if (url.host === "login.microsoftonline.com") return tokenResponse();
    if (url.host === "graph.microsoft.com") return profileResponse();
    return json({ error: `no fake for ${url.href}` }, 599);
  }) as typeof fetch;
}

// --- helpers -------------------------------------------------------------------

async function resetDatabase() {
  await client.unsafe("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../packages/database/src/migrations"
  );
  await migrate(db, { migrationsFolder });
}

/** Save the Microsoft app credentials the way Settings does (the secret encrypted). */
async function saveMicrosoftCredentials(values: { client_id?: string; client_secret?: string; tenant_id?: string }) {
  for (const [key, value] of Object.entries(values)) {
    const isSecret = key === "client_secret";
    await db.insert(systemSettings).values({ category: "microsoft", key, value: isSecret ? encrypt(value) : value, isSecret });
  }
}

function encryptWithOtherKey(value: string) {
  const current = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  try {
    return encrypt(value);
  } finally {
    process.env.ENCRYPTION_KEY = current;
  }
}

/** Click "Connect Outlook" in Settings: returns the redirect the browser gets. */
async function startConnecting(signedIn = true) {
  const params = new URLSearchParams({ feature: "calendar", returnUrl: RETURN_URL });
  if (signedIn) params.set("token", app.jwt.sign({ userId }));
  const res = await app.inject({ method: "GET", url: `/api/v1/auth/oauth/microsoft?${params}`, headers: { host: HOST } });
  assert.equal(res.statusCode, 302, res.body);
  return new URL(res.headers.location as string);
}

/** Microsoft sends the browser back to the callback. */
async function returnFromMicrosoft(query: Record<string, string>) {
  return app.inject({
    method: "GET",
    url: `/api/v1/auth/oauth/microsoft/callback?${new URLSearchParams(query)}`,
    headers: { host: HOST },
  });
}

/** Where a failure sent the browser, and the message Settings shows. */
function settingsError(location: URL) {
  assert.equal(`${location.origin}${location.pathname}`, `https://${HOST}/settings/connections`);
  assert.equal(location.searchParams.get("connected"), null, "a failure must not look like a new connection");
  return location.searchParams.get("error") ?? "";
}

// --- tests -----------------------------------------------------------------------

describe("connecting a Microsoft account (integration)", { skip: !DATABASE_URL && "set TEST_DATABASE_URL to run" }, () => {
  before(async () => {
    client = postgres(DATABASE_URL!, { onnotice: () => {} });
    db = drizzle(client, { schema }) as unknown as Database;
    await resetDatabase();
    installFakeFetch();

    app = Fastify();
    await app.register(sensible);
    await app.register(fastifyJwt, { secret: "test-jwt-secret-test-jwt-secret-1234" });
    app.decorate("db", db);
    app.decorate("authenticate", async () => {});
    app.decorate("authenticateAny", async () => {});
    await app.register(authRoutes, { prefix: "/api/v1/auth" });
    await app.ready();
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await app?.close();
    await client?.end();
  });

  beforeEach(async () => {
    requests = [];
    tokenResponse = () => json({ error: "unexpected token request" }, 500);
    profileResponse = () => json({ error: "unexpected profile request" }, 500);
    await client.unsafe("TRUNCATE users CASCADE; DELETE FROM system_settings;");
    const [user] = await db.insert(users).values({ email: "owner@example.com" }).returning();
    userId = user!.id;
  });

  test("connects, using trimmed credentials, the same redirect URI and the requested scopes", async () => {
    // Pasted with the whitespace copy-paste tends to add
    await saveMicrosoftCredentials({ client_id: " client-123 ", client_secret: "secret-value\n", tenant_id: "common " });

    const authorize = await startConnecting();
    assert.equal(authorize.origin + authorize.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    assert.equal(authorize.searchParams.get("client_id"), "client-123");
    assert.equal(authorize.searchParams.get("redirect_uri"), REDIRECT_URI);
    assert.deepEqual(authorize.searchParams.get("scope")!.split(" ").sort(), CALENDAR_SCOPES);

    tokenResponse = () =>
      json({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600, scope: CALENDAR_SCOPES.join(" ") });
    profileResponse = () => json({ mail: "person@outlook.com", displayName: "Person" });
    const res = await returnFromMicrosoft({ code: "the-code", state: authorize.searchParams.get("state")! });
    assert.equal(res.statusCode, 302, res.body);
    assert.equal(res.headers.location, RETURN_URL);

    const exchange = requests.find((r) => r.url.pathname.endsWith("/oauth2/v2.0/token"))!;
    assert.equal(exchange.url.href, "https://login.microsoftonline.com/common/oauth2/v2.0/token");
    assert.equal(exchange.body!.get("code"), "the-code");
    assert.equal(exchange.body!.get("client_id"), "client-123");
    assert.equal(exchange.body!.get("client_secret"), "secret-value");
    assert.equal(exchange.body!.get("redirect_uri"), REDIRECT_URI);
    assert.deepEqual(exchange.body!.get("scope")!.split(" ").sort(), CALENDAR_SCOPES);

    const [token] = await db.select().from(oauthTokens).where(eq(oauthTokens.userId, userId));
    assert.equal(token!.provider, "microsoft");
    assert.equal(token!.externalAccountId, "person@outlook.com");
    assert.equal(decrypt(token!.accessToken), "access-1");
    assert.equal(decrypt(token!.refreshToken!), "refresh-1");
  });

  test("a rejected code exchange goes back to Settings with Microsoft's reason and the fix", async () => {
    await saveMicrosoftCredentials({ client_id: "client-123", client_secret: "the-secret-id-by-mistake" });
    const authorize = await startConnecting();

    tokenResponse = () =>
      json(
        {
          error: "invalid_client",
          error_description:
            "AADSTS7000215: Invalid client secret provided. Ensure the secret being sent in the request is the client secret value, not the client secret ID, for a secret added to app 'client-123'. Trace ID: 0000 Correlation ID: 1111 Timestamp: 2026-09-25 12:00:00Z",
          error_codes: [7000215],
        },
        401
      );
    const res = await returnFromMicrosoft({ code: "the-code", state: authorize.searchParams.get("state")! });
    assert.equal(res.statusCode, 302, res.body);
    const message = settingsError(new URL(res.headers.location as string));
    assert.match(message, /^Microsoft rejected the connection \(AADSTS7000215\)\./);
    assert.match(message, /Value, not its Secret ID/);
    assert.equal((await db.select().from(oauthTokens)).length, 0);
  });

  test("errors Microsoft reports on the way back are explained too", async () => {
    await saveMicrosoftCredentials({ client_id: "client-123", client_secret: "secret" });

    let authorize = await startConnecting();
    let res = await returnFromMicrosoft({
      error: "unauthorized_client",
      error_description:
        "The client does not exist or is not enabled for consumers. If you are the application developer, configure a new application through the App Registrations in the Azure Portal.",
      state: authorize.searchParams.get("state")!,
    });
    assert.match(settingsError(new URL(res.headers.location as string)), /doesn't accept personal Microsoft accounts/);

    authorize = await startConnecting();
    res = await returnFromMicrosoft({ error: "access_denied", state: authorize.searchParams.get("state")! });
    assert.equal(settingsError(new URL(res.headers.location as string)), "Microsoft sign-in was cancelled or access was denied.");
    assert.equal(requests.length, 0);
  });

  test("a missing or unreadable client secret is reported before anyone is sent to Microsoft", async () => {
    await saveMicrosoftCredentials({ client_id: "client-123" });
    let location = await startConnecting();
    assert.match(settingsError(location), /the client secret is missing/);

    // Saved before the server's encryption key changed
    await db
      .insert(systemSettings)
      .values({ category: "microsoft", key: "client_secret", value: encryptWithOtherKey("secret"), isSecret: true });
    location = await startConnecting();
    assert.match(settingsError(location), /saved with a different encryption key/);
    assert.equal(requests.length, 0);
  });

  test("a failure never redirects to another site", async () => {
    await saveMicrosoftCredentials({ client_id: "client-123" });
    const params = new URLSearchParams({ feature: "calendar", returnUrl: "https://elsewhere.example/login", token: app.jwt.sign({ userId }) });
    const res = await app.inject({ method: "GET", url: `/api/v1/auth/oauth/microsoft?${params}`, headers: { host: HOST } });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().message, /the client secret is missing/);
  });

  test("signing in (not connecting from Settings) answers with the reason instead", async () => {
    await saveMicrosoftCredentials({ client_id: "client-123", client_secret: "secret" });
    const authorize = await startConnecting(false);

    tokenResponse = () => json({ error: "invalid_grant", error_description: "AADSTS70008: The provided authorization code or refresh token has expired due to inactivity." }, 400);
    const res = await returnFromMicrosoft({ code: "old-code", state: authorize.searchParams.get("state")! });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().message, "Microsoft rejected the connection (AADSTS70008). The sign-in code expired. Try connecting again.");
  });
});
