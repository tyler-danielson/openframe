import { after, afterEach, before, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { parseRssFeed, validateFeedUrl } from "./rss-parser.js";

const rss = (title: string) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title>` +
  `<item><title>First</title><link>https://example.com/1</link></item></channel></rss>`;

describe("reading feeds", () => {
  let server: http.Server;
  let base: string;
  const hostedMode = process.env.HOSTED_MODE;

  before(async () => {
    mock.method(console, "warn", () => undefined);
    server = http.createServer((request, response) => {
      if (request.url === "/latin1.xml") {
        response.writeHead(200, { "content-type": "application/rss+xml; charset=ISO-8859-1" });
        response.end(Buffer.from(rss("Café"), "latin1"));
        return;
      }
      response.writeHead(200, { "content-type": "text/html" }).end("<html><body>internal page</body></html>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
    mock.restoreAll();
  });

  afterEach(() => {
    if (hostedMode === undefined) delete process.env.HOSTED_MODE;
    else process.env.HOSTED_MODE = hostedMode;
  });

  test("decodes the charset the server names", async () => {
    delete process.env.HOSTED_MODE;
    const feed = await parseRssFeed(`${base}/latin1.xml`);
    assert.equal(feed.title, "Café");
    assert.equal(feed.articles[0]?.title, "First");
  });

  test("validation doesn't repeat what the address returned", async () => {
    delete process.env.HOSTED_MODE;
    assert.deepEqual(await validateFeedUrl(`${base}/page.html`), {
      valid: false,
      error: "Couldn't read a feed at that address",
    });
  });

  test("the hosted service won't read feeds on its own network", async () => {
    process.env.HOSTED_MODE = "true";
    const result = await validateFeedUrl(`${base}/latin1.xml`);
    assert.equal(result.valid, false);
    assert.match(result.error ?? "", /isn't reachable from OpenFrame's servers/);
  });
});
