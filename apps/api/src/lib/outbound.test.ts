import { after, afterEach, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { assertPublicHost, fetchPublic, isBlockedDestination, isPrivateAddress } from "./outbound.js";

describe("isPrivateAddress", () => {
  test("internal, local and reserved addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.17.0.2",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "::",
      "fe80::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not an address",
    ]) {
      assert.equal(isPrivateAddress(address), true, address);
    }
  });

  test("public addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "140.82.112.3", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      assert.equal(isPrivateAddress(address), false, address);
    }
  });
});

describe("requests to user-supplied addresses", () => {
  let server: http.Server;
  let port: number;
  const hostedMode = process.env.HOSTED_MODE;

  before(async () => {
    server = http.createServer((request, response) => {
      if (request.url === "/redirect") {
        response.writeHead(302, { location: `http://127.0.0.1:${port}/secret` }).end();
        return;
      }
      response.end("internal secret");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  after(() => server.close());

  afterEach(() => {
    if (hostedMode === undefined) delete process.env.HOSTED_MODE;
    else process.env.HOSTED_MODE = hostedMode;
  });

  test("the hosted service can't reach its own network", async () => {
    process.env.HOSTED_MODE = "true";
    for (const url of [`http://127.0.0.1:${port}/secret`, `http://localhost:${port}/secret`, `http://[::1]:${port}/`]) {
      await assert.rejects(fetchPublic(url), (err) => isBlockedDestination(err), url);
    }
    await assert.rejects(assertPublicHost("localhost"), (err) => isBlockedDestination(err));
    await assert.rejects(assertPublicHost("10.0.0.5"), (err) => isBlockedDestination(err));
  });

  test("only http(s)", async () => {
    await assert.rejects(fetchPublic("file:///etc/passwd"), (err) => isBlockedDestination(err));
  });

  test("a self-hosted server reaches its home network", async () => {
    delete process.env.HOSTED_MODE;
    const response = await fetchPublic(`http://127.0.0.1:${port}/redirect`);
    assert.equal(await response.text(), "internal secret");
    await assertPublicHost("localhost");
  });
});
