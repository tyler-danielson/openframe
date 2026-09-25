import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { CalendarSyncError } from "./errors.js";
import { fetchIcsFeed } from "./ics.js";

let server: http.Server;
let feedUrl: string;
const hostedMode = process.env.HOSTED_MODE;

before(async () => {
  server = http.createServer((_request, response) => {
    response.end("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  feedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/family.ics`;
});

after(() => server.close());

afterEach(() => {
  if (hostedMode === undefined) delete process.env.HOSTED_MODE;
  else process.env.HOSTED_MODE = hostedMode;
});

test("fetchIcsFeed: a self-hosted server reads feeds on its home network", async () => {
  delete process.env.HOSTED_MODE;
  assert.match(await fetchIcsFeed(feedUrl), /BEGIN:VCALENDAR/);
});

test("fetchIcsFeed: the hosted service refuses its own network, with a message for the user", async () => {
  process.env.HOSTED_MODE = "true";
  await assert.rejects(
    fetchIcsFeed(feedUrl),
    (err) => err instanceof CalendarSyncError && /isn't reachable from OpenFrame's servers/.test(err.message)
  );
});
