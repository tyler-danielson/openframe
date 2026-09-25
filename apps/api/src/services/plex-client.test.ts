import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlexImagePath } from "./plex-client.js";

test("isPlexImagePath allows Plex's own image paths", () => {
  for (const path of [
    "/library/metadata/123/thumb/1699999999",
    "/library/metadata/123/art/1699999999",
    "/photo/:/transcode?width=300&height=450&url=/library/metadata/123/thumb/1699999999",
  ]) {
    assert.equal(isPlexImagePath(path), true, path);
  }
});

test("isPlexImagePath refuses other endpoints, hosts and dot segments", () => {
  for (const path of [
    "",
    "library/metadata/1/thumb",
    "@evil.example/library/metadata/1/thumb",
    "//evil.example/library/metadata/1/thumb",
    "/:/prefs",
    "/library/../:/prefs",
    "/library/%2e%2E/:/prefs",
    "/library/.%2e/:/prefs",
    "/library/..\\:/prefs",
    "/library/.\t./:/prefs",
  ]) {
    assert.equal(isPlexImagePath(path), false, JSON.stringify(path));
  }
});
