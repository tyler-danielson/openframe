import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  buildRmapiInvocation,
  buildStatScript,
  execRmapi,
  quoteRmapiShellArg,
  remarkablePathProblem,
  rmapiUserPaths,
  toRmapiPath,
} from "./rmapi.js";
import { getRemarkableClient } from "./client.js";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

// Stand-in for the rmapi binary: records its argv, cwd, environment and (in
// interactive mode, i.e. without arguments) stdin. Given a one-time code on
// stdin it writes a config to RMAPI_CONFIG, like rmapi after registering.
const FAKE_RMAPI = `#!/usr/bin/env node
const fs = require("fs");
const record = {
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  env: {
    RMAPI_CONFIG: process.env.RMAPI_CONFIG,
    HOME: process.env.HOME,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    XDG_CACHE_HOME: process.env.XDG_CACHE_HOME,
    TMPDIR: process.env.TMPDIR,
  },
  stdin: null,
};
const finish = () => fs.appendFileSync(process.env.FAKE_RMAPI_LOG, JSON.stringify(record) + "\\n");
if (record.argv.length === 0) {
  let data = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (data += chunk));
  process.stdin.on("end", () => {
    record.stdin = data;
    if (/^[A-Za-z0-9]{8}\\n$/.test(data)) {
      fs.writeFileSync(process.env.RMAPI_CONFIG, "devicetoken: fake-" + data.trim() + "\\n");
    }
    finish();
  });
} else {
  finish();
}
`;

interface RmapiRun {
  argv: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  stdin: string | null;
}

const savedEnv = { ...process.env };
let root: string;
let dataDir: string;
let logFile: string;
let marker: string;

function runs(): RmapiRun[] {
  if (!fs.existsSync(logFile)) return [];
  return fs
    .readFileSync(logFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RmapiRun);
}

/** Minimal Fastify stand-in: the user's remarkable_config row, no-op writes */
function fakeFastify(row: { isConnected: boolean; deviceToken?: string } | undefined): FastifyInstance {
  const query = {
    from: () => query,
    where: () => query,
    limit: async () => (row ? [row] : []),
  };
  const noop = () => {};
  return {
    db: {
      select: () => query,
      insert: () => ({ values: async () => undefined }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
      delete: () => ({ where: async () => undefined }),
    },
    log: { info: noop, warn: noop, error: noop, debug: noop },
  } as unknown as FastifyInstance;
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "rmapi-test-"));
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir);
  fs.writeFileSync(path.join(binDir, "rmapi"), FAKE_RMAPI, { mode: 0o755 });
  process.env.PATH = `${binDir}${path.delimiter}${savedEnv.PATH ?? ""}`;
});

after(() => {
  process.env = { ...savedEnv };
  fs.rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(root, "data-"));
  logFile = path.join(dataDir, "rmapi-runs.log");
  marker = path.join(dataDir, "pwned");
  process.env.DATA_DIR = dataDir;
  process.env.FAKE_RMAPI_LOG = logFile;
  // os.homedir() (where the legacy shared config lived) follows HOME
  process.env.HOME = path.join(dataDir, "server-home");
  delete process.env.NODE_ENV;
  delete process.env.HOSTED_MODE;
});

afterEach(() => {
  delete process.env.HOSTED_MODE;
});

describe("rmapi invocation", () => {
  test("paths with shell syntax are single argv elements, never run through a shell", async () => {
    const hostile = [
      `/Calendar/"; touch ${marker}; "`,
      `$(touch ${marker})`,
      `\`touch ${marker}\``,
      `/Notes/it's | touch ${marker} && echo &`,
    ];
    const paths = rmapiUserPaths(USER_A);

    const invocation = buildRmapiInvocation(["mkdir", ...hostile], paths, dataDir);
    assert.equal(invocation.file, "rmapi");
    assert.deepEqual(invocation.args, ["mkdir", ...hostile]);
    assert.equal(invocation.options.shell, false);

    await execRmapi(paths, ["mkdir", ...hostile]);

    const [run] = runs();
    assert.deepEqual(run?.argv, ["mkdir", ...hostile]);
    assert.equal(fs.existsSync(marker), false, "no shell command ran");
  });

  test("each user's rmapi runs with that user's own config, HOME and cache", async () => {
    const a = rmapiUserPaths(USER_A);
    const b = rmapiUserPaths(USER_B);
    assert.equal(a.configPath, path.join(dataDir, "rmapi", `${USER_A}.conf`));
    assert.notEqual(a.configPath, b.configPath);
    assert.notEqual(a.homeDir, b.homeDir);

    await execRmapi(a, ["ls", "/"]);
    await execRmapi(b, ["ls", "/"]);

    const [runA, runB] = runs();
    assert.equal(runA?.env.RMAPI_CONFIG, a.configPath);
    assert.equal(runA?.env.HOME, a.homeDir);
    assert.equal(runA?.env.XDG_CACHE_HOME, path.join(a.homeDir, ".cache"));
    assert.equal(runB?.env.RMAPI_CONFIG, b.configPath);
    assert.equal(runB?.env.HOME, b.homeDir);

    // Private directories: the config dir and the user's home are 0700
    assert.equal(fs.statSync(path.dirname(a.configPath)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(a.homeDir).mode & 0o777, 0o700);
    // Each run gets its own temp directory, removed afterwards
    assert.notEqual(runA?.cwd, runB?.cwd);
    assert.equal(runA?.env.TMPDIR, runA?.cwd);
    assert.equal(fs.existsSync(runA!.cwd), false);
  });

  test("user ids can't escape the rmapi directory", () => {
    assert.throws(() => rmapiUserPaths("../../etc/passwd"));
    assert.throws(() => rmapiUserPaths(""));
  });

  test("shell-session commands are quoted, unsafe names skipped", async () => {
    assert.equal(quoteRmapiShellArg(`/My "quoted" \\ doc`), `"/My \\"quoted\\" \\\\ doc"`);
    assert.equal(quoteRmapiShellArg("/a\nput /etc/passwd /"), null);
    assert.equal(quoteRmapiShellArg("/a << EOF"), null);

    const script = buildStatScript(["/Notes/one", `/Notes/"two"`, "/Notes/x\nrm -r /"]);
    assert.equal(script, `stat "/Notes/one"\nstat "/Notes/\\"two\\""\nexit\n`);

    await execRmapi(rmapiUserPaths(USER_A), [], { input: script });
    const [run] = runs();
    assert.deepEqual(run?.argv, []);
    assert.equal(run?.stdin, script);
  });
});

describe("reMarkable path validation", () => {
  test("ordinary names with spaces and punctuation are fine", () => {
    for (const ok of ["/Calendar/Daily Agenda", "/Tyler's notes (2026) #1 & more!", "Calendar/Notes", "/日記/メモ"]) {
      assert.equal(remarkablePathProblem(ok), null, ok);
    }
  });

  test("control characters, '..' segments and overlong paths are refused", () => {
    for (const bad of ["/a\nb", "/a\rb", "/a\u0000b", "/a\u0085b", "/../other", "/a/../../b", "..", "", "/" + "x".repeat(512)]) {
      assert.notEqual(remarkablePathProblem(bad), null, JSON.stringify(bad));
    }
  });

  test("rmapi only ever gets absolute paths, so no argument looks like a flag", () => {
    assert.equal(toRmapiPath("--force"), "/--force");
    assert.equal(toRmapiPath("Calendar/Notes"), "/Calendar/Notes");
    assert.equal(toRmapiPath("/Calendar"), "/Calendar");
    assert.throws(() => toRmapiPath("/a/../b"));
  });
});

describe("per-user reMarkable client", () => {
  test("connect writes only the connecting user's config; disconnect removes only theirs", async () => {
    const a = getRemarkableClient(fakeFastify(undefined), USER_A);
    const b = getRemarkableClient(fakeFastify(undefined), USER_B);

    await assert.rejects(a.connect(`$(id)xy`), /Invalid code/);
    assert.equal(runs().length, 0, "an invalid code never reaches rmapi");

    await a.connect("ABCD1234");
    await b.connect("WXYZ9876");

    const aPaths = rmapiUserPaths(USER_A);
    const bPaths = rmapiUserPaths(USER_B);
    assert.equal(fs.readFileSync(aPaths.configPath, "utf8"), "devicetoken: fake-ABCD1234\n");
    assert.equal(fs.readFileSync(bPaths.configPath, "utf8"), "devicetoken: fake-WXYZ9876\n");
    assert.equal(fs.statSync(aPaths.configPath).mode & 0o777, 0o600);

    const [connectA] = runs();
    assert.equal(connectA?.stdin, "ABCD1234\n");
    assert.equal(path.dirname(connectA!.env.RMAPI_CONFIG!), path.dirname(aPaths.configPath));
    // No leftover registration files
    assert.deepEqual(
      fs.readdirSync(path.dirname(aPaths.configPath)).filter((f) => f.endsWith(".pending")),
      []
    );

    await a.disconnect();
    assert.equal(fs.existsSync(aPaths.configPath), false);
    assert.equal(fs.existsSync(bPaths.configPath), true, "another user's connection is untouched");
  });

  test("a user without their own config can't run rmapi at all", async () => {
    const client = getRemarkableClient(fakeFastify({ isConnected: true }), USER_B);
    assert.equal(await client.testConnection(), false);
    await assert.rejects(client.getDocuments("/"), /not connected/);
    await assert.rejects(client.downloadDocumentWithAnnotations("/Notes/x"), /not connected/);
    assert.equal(runs().length, 0);
  });

  test("testConnection runs rmapi with the user's own config", async () => {
    const paths = rmapiUserPaths(USER_A);
    fs.mkdirSync(path.dirname(paths.configPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(paths.configPath, "devicetoken: a\n", { mode: 0o600 });

    const client = getRemarkableClient(fakeFastify({ isConnected: true }), USER_A);
    assert.equal(await client.testConnection(), true);
    const [run] = runs();
    assert.deepEqual(run?.argv, ["ls", "/"]);
    assert.equal(run?.env.RMAPI_CONFIG, paths.configPath);
  });

  describe("the shared config of older versions", () => {
    let legacyPath: string;

    beforeEach(() => {
      legacyPath = path.join(process.env.HOME!, ".config", "rmapi", "rmapi.conf");
      fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
      fs.writeFileSync(legacyPath, "devicetoken: shared\n", { mode: 0o600 });
    });

    test("is never read in hosted mode", async () => {
      process.env.HOSTED_MODE = "true";
      const client = getRemarkableClient(fakeFastify({ isConnected: true }), USER_A);
      assert.equal(await client.ensureConfigured(), false);
      assert.equal(await client.testConnection(), false);
      assert.equal(fs.existsSync(rmapiUserPaths(USER_A).configPath), false);
      assert.equal(runs().length, 0);
    });

    test("self-hosted: copied for a user whose connection is recorded as active", async () => {
      const client = getRemarkableClient(fakeFastify({ isConnected: true }), USER_A);
      assert.equal(await client.ensureConfigured(), true);
      const { configPath } = rmapiUserPaths(USER_A);
      assert.equal(fs.readFileSync(configPath, "utf8"), "devicetoken: shared\n");
      assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
      assert.equal(fs.existsSync(legacyPath), true, "the shared file is copied, not moved");
    });

    test("self-hosted: not copied for a user who isn't connected", async () => {
      for (const row of [undefined, { isConnected: false }]) {
        const client = getRemarkableClient(fakeFastify(row), USER_B);
        assert.equal(await client.ensureConfigured(), false);
      }
      assert.equal(fs.existsSync(rmapiUserPaths(USER_B).configPath), false);
    });
  });
});
