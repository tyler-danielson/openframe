import { test } from "node:test";
import assert from "node:assert/strict";
import { encrypt } from "./encryption.js";
import { resolvePlatformKey } from "./platform-keys.js";

process.env.ENCRYPTION_KEY ??= "0".repeat(64);

// Just enough of a drizzle db for a select ... limit(1) returning `rows`
function fakeDb(rows: Array<{ value: string | null }>) {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain };
}

test("a key saved in the admin panel wins over the env var", async () => {
  process.env.OPENWEATHERMAP_PLATFORM_KEY = "from-env";
  const db = fakeDb([{ value: encrypt("from-admin") }]);
  assert.deepEqual(await resolvePlatformKey(db, "openweathermap_api_key"), {
    value: "from-admin",
    source: "admin",
  });
});

test("without a saved key, the env var applies", async () => {
  process.env.GOOGLE_MAPS_PLATFORM_KEY = "from-env";
  assert.deepEqual(await resolvePlatformKey(fakeDb([]), "google_maps_api_key"), {
    value: "from-env",
    source: "env",
  });
});

test("a saved key that can't be decrypted falls back to the env var", async () => {
  process.env.GOOGLE_MAPS_PLATFORM_KEY = "from-env";
  const db = fakeDb([{ value: "not-encrypted" }]);
  assert.equal((await resolvePlatformKey(db, "google_maps_api_key")).source, "env");
});

test("neither set means not configured", async () => {
  delete process.env.VITE_GOOGLE_MAPS_API_KEY;
  assert.deepEqual(await resolvePlatformKey(fakeDb([]), "google_maps_embed_key"), {
    value: null,
    source: null,
  });
});
