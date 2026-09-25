/**
 * Running the rmapi CLI (ddvk/rmapi, https://github.com/ddvk/rmapi) for the
 * reMarkable integration.
 *
 * One API process serves many unrelated users, so:
 *  - rmapi is started directly with an argument array (execFile, never a
 *    shell): document paths, folder names and the one-time code reach it
 *    verbatim and are never read as shell syntax.
 *  - every user has their own rmapi config (device + user token) at
 *    `${DATA_DIR}/rmapi/<userId>.conf` (0600, in a 0700 directory), which rmapi
 *    reads from the RMAPI_CONFIG environment variable, and their own HOME and
 *    cache directory (`${DATA_DIR}/rmapi/home/<userId>`), where rmapi keeps its
 *    cache of the account's document tree. Nothing points rmapi at the shared
 *    ~/.config/rmapi/rmapi.conf of older versions.
 *  - downloads and uploads happen in a fresh private temp directory per run,
 *    so files from concurrent runs can't be mixed up.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const execFileAsync = promisify(execFile);

/** The rmapi executable, looked up on PATH */
export const RMAPI_BIN = "rmapi";

/** Longest reMarkable folder/document path accepted from API input */
export const REMARKABLE_PATH_MAX_LENGTH = 512;

/** Longest path handed to rmapi (document ids are folder path + document name) */
const RMAPI_PATH_MAX_LENGTH = 1024;

const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// Enough for listing/stat output of very large folders
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** C0/C1 control characters (incl. line breaks, NUL) and Unicode line separators */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) {
      return true;
    }
  }
  return false;
}

/**
 * Why `value` can't be used as a reMarkable folder/document path, or null when
 * it can. reMarkable names may contain spaces and most punctuation, so only
 * control characters, ".." segments and overlong paths are refused.
 */
export function remarkablePathProblem(
  value: unknown,
  maxLength = REMARKABLE_PATH_MAX_LENGTH
): string | null {
  if (typeof value !== "string" || value.length === 0) return "must be a non-empty string";
  if (value.length > maxLength) return `must be at most ${maxLength} characters`;
  if (hasControlCharacters(value)) return "must not contain control characters";
  if (value.split("/").includes("..")) return "must not contain '..' segments";
  return null;
}

/**
 * Check a reMarkable path before it is handed to rmapi and make it absolute
 * (rmapi resolves relative paths from the root, so this doesn't change which
 * entry it names), which also means it can never be taken for a flag.
 */
export function toRmapiPath(value: string): string {
  const problem = remarkablePathProblem(value, RMAPI_PATH_MAX_LENGTH);
  if (problem) {
    throw new Error(`Invalid reMarkable path: ${problem}`);
  }
  return value.startsWith("/") ? value : `/${value}`;
}

// ---------------------------------------------------------------------------
// Per-user rmapi config and home directory
// ---------------------------------------------------------------------------

export interface RmapiUserPaths {
  /** The user's rmapi config (device + user token), passed as RMAPI_CONFIG */
  configPath: string;
  /** The user's private HOME for rmapi runs (holds rmapi's document-tree cache) */
  homeDir: string;
}

/** `${DATA_DIR}/rmapi`, where every user's rmapi config lives */
export function rmapiDataDir(): string {
  return path.resolve(process.env.DATA_DIR || "./data", "rmapi");
}

export function rmapiUserPaths(userId: string): RmapiUserPaths {
  // Ids are UUIDs; anything else must not become part of a file path
  if (typeof userId !== "string" || !USER_ID_PATTERN.test(userId)) {
    throw new Error("Invalid user id for reMarkable");
  }
  const dataDir = rmapiDataDir();
  return {
    configPath: path.join(dataDir, `${userId}.conf`),
    homeDir: path.join(dataDir, "home", userId),
  };
}

/**
 * The single rmapi config every user shared before per-user configs. Only read
 * to migrate a self-hosted install, never in hosted mode.
 */
export function legacyRmapiConfigPath(): string {
  const home = process.env.NODE_ENV === "production" ? "/root" : os.homedir();
  return path.join(home, ".config", "rmapi", "rmapi.conf");
}

export function isHostedMode(): boolean {
  return process.env.HOSTED_MODE === "true";
}

/** A non-empty regular file (rmapi writes its config only once registration worked) */
export function configFileExists(file: string): boolean {
  try {
    const stat = fs.statSync(file);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function makePrivateDir(dir: string): void {
  // Parents (e.g. DATA_DIR itself) keep their usual permissions
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  try {
    fs.mkdirSync(dir, { mode: 0o700 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
  try {
    if ((fs.statSync(dir).mode & 0o777) !== 0o700) fs.chmodSync(dir, 0o700);
  } catch {
    // Best effort: mkdir already created it 0700
  }
}

/** Create `${DATA_DIR}/rmapi` and the user's rmapi home, both 0700 */
export function ensureRmapiUserDirs(paths: RmapiUserPaths): void {
  makePrivateDir(path.dirname(paths.configPath));
  makePrivateDir(path.dirname(paths.homeDir));
  makePrivateDir(paths.homeDir);
}

export function removeFileIfExists(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** A fresh private (0700) directory for one rmapi run's files */
export function makeRmapiWorkDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openframe-remarkable-"));
}

export function removeDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Leftover temp files are not worth failing the request over
  }
}

// ---------------------------------------------------------------------------
// Invocation
// ---------------------------------------------------------------------------

/**
 * The environment for a user's rmapi run: the server's environment (PATH,
 * proxies, CA settings, RMAPI_* tuning) with rmapi's config and every
 * HOME/XDG-derived location pointed at that user's own files.
 */
export function rmapiEnv(
  paths: RmapiUserPaths,
  workDir: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...base,
    // ddvk/rmapi (config/config.go) reads its config path from RMAPI_CONFIG
    RMAPI_CONFIG: paths.configPath,
    HOME: paths.homeDir,
    XDG_CONFIG_HOME: path.join(paths.homeDir, ".config"),
    // rmapi keeps its document-tree cache in the user cache dir
    XDG_CACHE_HOME: path.join(paths.homeDir, ".cache"),
    // rmapi's own temp files go in the run's private directory
    TMPDIR: workDir,
  };
}

export interface RmapiInvocation {
  file: string;
  args: string[];
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: false;
    windowsHide: true;
  };
}

/**
 * What to start for `rmapi <args>`: the executable and its argument vector,
 * each argument passed as-is (no shell ever sees them).
 */
export function buildRmapiInvocation(
  args: readonly string[],
  paths: RmapiUserPaths,
  workDir: string
): RmapiInvocation {
  for (const arg of args) {
    if (typeof arg !== "string" || arg.includes("\0")) {
      throw new Error("Invalid rmapi argument");
    }
  }
  return {
    file: RMAPI_BIN,
    args: [...args],
    options: {
      cwd: workDir,
      env: rmapiEnv(paths, workDir),
      shell: false,
      windowsHide: true,
    },
  };
}

export interface ExecRmapiOptions {
  timeoutMs?: number;
  /** Directory rmapi runs in (and writes downloads to); a temp one when omitted */
  workDir?: string;
  /** Written to rmapi's stdin, which is then closed (one-time code, shell commands) */
  input?: string;
}

/**
 * Run `rmapi <args>` for a user. Resolves with its output, rejects with the
 * child_process error (carrying stdout/stderr) when it fails or times out.
 */
export async function execRmapi(
  paths: RmapiUserPaths,
  args: readonly string[],
  options: ExecRmapiOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  ensureRmapiUserDirs(paths);
  const ownWorkDir = options.workDir ? null : makeRmapiWorkDir();
  const workDir = options.workDir ?? ownWorkDir!;

  try {
    const invocation = buildRmapiInvocation(args, paths, workDir);
    const pending = execFileAsync(invocation.file, invocation.args, {
      ...invocation.options,
      timeout: options.timeoutMs ?? 30000,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf8",
    });

    const stdin = pending.child.stdin;
    if (stdin) {
      // rmapi may exit before reading everything; that's not an error here
      stdin.on("error", () => {});
      // Without input stdin stays open (as with the previous exec()), so an
      // unexpected code prompt waits for the timeout instead of spinning on EOF
      if (options.input !== undefined) {
        stdin.end(options.input);
      }
    }

    return await pending;
  } finally {
    if (ownWorkDir) removeDir(ownWorkDir);
  }
}

/** Turn a failed rmapi run into an Error with a readable message */
export function rmapiError(err: unknown, timeoutMs: number): Error {
  const error = err as {
    code?: number | string;
    killed?: boolean;
    stderr?: string;
    message?: string;
  };
  if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return new Error("rmapi error: output too large");
  }
  if (error.killed) {
    return new Error(`rmapi command timed out after ${timeoutMs}ms`);
  }
  // rmapi returns exit code 1 on errors
  if (error.stderr) {
    return new Error(`rmapi error: ${error.stderr}`);
  }
  return new Error(`rmapi error: ${error.message || "Unknown error"}`);
}

// ---------------------------------------------------------------------------
// rmapi's interactive shell (used to stat many documents in one session)
// ---------------------------------------------------------------------------

/**
 * Quote one argument for a line of rmapi's interactive shell, which splits
 * lines like a POSIX shell (google/shlex: inside double quotes a backslash
 * escapes the next character). Returns null for values that can't be put on
 * a line safely: a line break would end the command and "<<" starts a
 * heredoc there.
 */
export function quoteRmapiShellArg(value: string): string | null {
  if (hasControlCharacters(value) || value.includes("<<")) {
    return null;
  }
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/** stdin for one rmapi shell session that prints `stat` for each path */
export function buildStatScript(remotePaths: readonly string[]): string {
  const lines: string[] = [];
  for (const remotePath of remotePaths) {
    const quoted = quoteRmapiShellArg(remotePath);
    if (quoted) {
      lines.push(`stat ${quoted}`);
    }
  }
  if (lines.length === 0) {
    return "";
  }
  lines.push("exit");
  return `${lines.join("\n")}\n`;
}
