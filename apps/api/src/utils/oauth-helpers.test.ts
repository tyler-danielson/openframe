import { test } from "node:test";
import assert from "node:assert/strict";
import {
  credentialValue,
  describeOAuthError,
  describeOAuthTokenError,
  oauthNotConfiguredMessage,
} from "./oauth-helpers.js";

const microsoftTokenError = (code: number, description: string) =>
  JSON.stringify({
    error: "invalid_client",
    error_description: `AADSTS${code}: ${description} Trace ID: 8d6f Correlation ID: 3b1c Timestamp: 2026-09-25 12:00:00Z`,
    error_codes: [code],
    trace_id: "8d6f",
  });

test("Microsoft token errors people hit while setting up Azure come with the fix", () => {
  assert.equal(
    describeOAuthTokenError("microsoft", 401, microsoftTokenError(7000215, "Invalid client secret provided.")),
    "Microsoft rejected the connection (AADSTS7000215). The client secret is wrong. In Azure (App registrations → Certificates & secrets), copy the secret's Value, not its Secret ID, and save it in Settings → Connections → Provider Credentials."
  );
  assert.match(
    describeOAuthTokenError("microsoft", 401, microsoftTokenError(7000222, "The provided client secret keys for app are expired.")),
    /\(AADSTS7000222\)\. The client secret has expired\./
  );
  assert.match(
    describeOAuthTokenError(
      "microsoft",
      400,
      microsoftTokenError(9002327, "Tokens issued for the 'Single-Page Application' client-type may only be redeemed via cross-origin requests.")
    ),
    /\(AADSTS9002327\)\. .*add it under the Web platform/
  );
});

test("the AADSTS code is also read from the description", () => {
  const body = JSON.stringify({ error: "invalid_request", error_description: "AADSTS50011: The redirect URI does not match." });
  assert.match(describeOAuthTokenError("microsoft", 400, body), /^Microsoft rejected the connection \(AADSTS50011\)\. The redirect URI isn't registered/);
});

test("other provider errors show their first line, without trace ids", () => {
  assert.equal(
    describeOAuthTokenError("microsoft", 400, microsoftTokenError(12345, "Something unusual happened.")),
    "Microsoft rejected the connection: AADSTS12345: Something unusual happened."
  );
  assert.equal(
    describeOAuthError("google", { error: "server_error", description: "Try again later\nmore detail" }),
    "Google rejected the connection: Try again later"
  );
});

test("an unreadable error response still says what happened", () => {
  assert.equal(describeOAuthTokenError("microsoft", 503, "<html>Service Unavailable</html>"), "Microsoft rejected the connection: HTTP 503");
  assert.equal(describeOAuthTokenError("google", 500, ""), "Google rejected the connection: HTTP 500");
});

test("errors from the authorization step", () => {
  assert.equal(describeOAuthError("microsoft", { error: "access_denied" }), "Microsoft sign-in was cancelled or access was denied.");
  assert.match(
    describeOAuthError("microsoft", {
      error: "unauthorized_client",
      description: "The client does not exist or is not enabled for consumers. If you are the application developer, configure a new application.",
    }),
    /^Microsoft rejected the connection \(unauthorized_client\)\. The app doesn't accept personal Microsoft accounts/
  );
  assert.match(describeOAuthError("google", { error: "redirect_uri_mismatch" }), /\(redirect_uri_mismatch\)\. The redirect URI isn't registered/);
});

test("messages carry no '%', which older Settings pages fail to show", () => {
  const message = describeOAuthError("microsoft", { description: "AADSTS99999: 100% of %zz failed." });
  assert.ok(!message.includes("%"), message);
});

test("credentials are trimmed and blank ones skipped", () => {
  assert.equal(credentialValue(" client-id\n"), "client-id");
  assert.equal(credentialValue("  ", undefined, null, "\tfrom-env "), "from-env");
  assert.equal(credentialValue("", null, undefined), undefined);
});

test("not-configured messages name what is missing", () => {
  assert.equal(
    oauthNotConfiguredMessage("microsoft", ["client secret"]),
    "Microsoft sign-in isn't fully set up: the client secret is missing. Add it in Settings → Connections → Provider Credentials."
  );
  assert.equal(
    oauthNotConfiguredMessage("google", ["client ID", "client secret"]),
    "Google sign-in isn't fully set up: the client ID and client secret are missing. Add them in Settings → Connections → Provider Credentials."
  );
});
