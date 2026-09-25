import { test } from "node:test";
import assert from "node:assert/strict";
import { redactUrl } from "./redact.js";

test("credentials in query strings are blanked", () => {
  assert.equal(
    redactUrl("/api/v1/photos/files/a/b.jpg?token=eyJhbGciOi.x.y&w=400"),
    "/api/v1/photos/files/a/b.jpg?token=[redacted]&w=400"
  );
  assert.equal(redactUrl("/api/v1/x?apiKey=openframe_ab_cd"), "/api/v1/x?apiKey=[redacted]");
  assert.equal(
    redactUrl("/api/v1/auth/oauth/google/callback?code=4/abc&state=123&scope=email"),
    "/api/v1/auth/oauth/google/callback?code=[redacted]&state=[redacted]&scope=email"
  );
});

test("credentials in paths are blanked", () => {
  assert.equal(redactUrl("/api/v1/kiosks/public/2b1c-uuid/events?start=1"), "/api/v1/kiosks/public/[redacted]/events?start=1");
  assert.equal(redactUrl("/api/v1/users/invite/abc/accept"), "/api/v1/users/invite/[redacted]/accept");
  assert.equal(redactUrl("/api/v1/recipes/upload/tok123"), "/api/v1/recipes/upload/[redacted]");
});

test("other URLs are unchanged", () => {
  assert.equal(redactUrl("/api/v1/events?start=2026-01-01&end=2026-02-01"), "/api/v1/events?start=2026-01-01&end=2026-02-01");
  assert.equal(redactUrl(undefined), undefined);
});
