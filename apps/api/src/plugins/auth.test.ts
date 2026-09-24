import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import fp from "fastify-plugin";
import { kiosks } from "@openframe/database/schema";
import { authPlugin } from "./auth.js";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const KIOSK_TOKEN = "22222222-2222-4222-8222-222222222222";
const JWT_SECRET = "test-jwt-secret-test-jwt-secret-1234";

/**
 * Just enough of the Drizzle query builder for the auth plugin: every select
 * from `kiosks` finds one active kiosk, as on a self-hosted server with a
 * kiosk set up. Other tables are empty.
 */
function fakeDb() {
  const kiosk = { id: "k1", userId: OWNER_ID, token: KIOSK_TOKEN, isActive: true };
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === kiosks ? [kiosk] : []),
        }),
        limit: async () => [],
      }),
    }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
}

async function buildApp() {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: JWT_SECRET });
  await app.register(
    fp(
      async (f) => {
        f.decorate("db", fakeDb() as never);
        f.decorate("hostedMode", false);
        f.decorate("relaySecret", null);
      },
      { name: "database" }
    )
  );
  await app.register(authPlugin);
  app.route({
    method: ["GET", "HEAD", "POST"],
    url: "/whoami",
    onRequest: [app.authenticateKioskOrAny],
    handler: async (request) => ({ userId: request.user?.userId ?? null }),
  });
  await app.ready();
  return app;
}

test("requests without credentials are rejected even when a kiosk is active", async () => {
  const app = await buildApp();
  for (const method of ["GET", "POST"] as const) {
    const res = await app.inject({ method, url: "/whoami" });
    assert.equal(res.statusCode, 401, `${method} without credentials`);
  }
  await app.close();
});

test("kiosk devices authenticate with their kiosk key", async () => {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/whoami", headers: { "x-api-key": `kiosk_${KIOSK_TOKEN}` } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().userId, OWNER_ID);
  await app.close();
});

test("media URLs can carry credentials in the query string on GET", async () => {
  const app = await buildApp();
  const jwt = app.jwt.sign({ userId: OWNER_ID });
  const urls = [
    `/whoami?apiKey=kiosk_${KIOSK_TOKEN}`,
    // The web app's camera URLs send whichever credential it has as ?token=
    `/whoami?token=kiosk_${KIOSK_TOKEN}`,
    `/whoami?token=${encodeURIComponent(jwt)}`,
  ];
  for (const url of urls) {
    const res = await app.inject({ method: "GET", url });
    assert.equal(res.statusCode, 200, url);
    assert.equal(res.json().userId, OWNER_ID, url);
  }
  const bad = await app.inject({ method: "GET", url: "/whoami?token=not-a-jwt" });
  assert.equal(bad.statusCode, 401);
  await app.close();
});

test("query-string credentials are not accepted for writes", async () => {
  const app = await buildApp();
  const jwt = app.jwt.sign({ userId: OWNER_ID });
  const res = await app.inject({ method: "POST", url: `/whoami?token=${encodeURIComponent(jwt)}` });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("headers take precedence over query-string credentials", async () => {
  const app = await buildApp();
  const jwt = app.jwt.sign({ userId: OWNER_ID });
  const res = await app.inject({
    method: "GET",
    url: "/whoami?token=not-a-jwt",
    headers: { authorization: `Bearer ${jwt}` },
  });
  assert.equal(res.statusCode, 200);
  await app.close();
});
