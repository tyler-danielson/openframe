import { Writable } from "node:stream";

export interface LogEntry {
  timestamp: string;
  level: number;
  levelLabel: string;
  msg: string;
  module?: string;
  err?: string;
  reqMethod?: string;
  reqUrl?: string;
}

const LEVEL_LABELS: Record<number, string> = {
  10: "trace",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "fatal",
};

export interface GetEntriesOptions {
  level?: number;
  since?: string;
  search?: string;
  limit?: number;
}

export class LogBuffer {
  private buffer: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  push(entry: LogEntry): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  getEntries(opts?: GetEntriesOptions): LogEntry[] {
    let entries = this.buffer;

    if (opts?.level) {
      entries = entries.filter((e) => e.level >= opts.level!);
    }

    if (opts?.since) {
      const sinceTime = new Date(opts.since).getTime();
      entries = entries.filter(
        (e) => new Date(e.timestamp).getTime() > sinceTime
      );
    }

    if (opts?.search) {
      const term = opts.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.msg.toLowerCase().includes(term) ||
          (e.module && e.module.toLowerCase().includes(term)) ||
          (e.reqUrl && e.reqUrl.toLowerCase().includes(term))
      );
    }

    if (opts?.limit && opts.limit > 0) {
      entries = entries.slice(-opts.limit);
    }

    return entries;
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }
}

export function createLogBufferStream(buffer: LogBuffer): Writable {
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      try {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          const parsed = JSON.parse(line);
          const entry: LogEntry = {
            timestamp: parsed.time
              ? new Date(parsed.time).toISOString()
              : new Date().toISOString(),
            level: parsed.level ?? 30,
            levelLabel: LEVEL_LABELS[parsed.level] ?? "info",
            msg: parsed.msg ?? "",
            module: parsed.module ?? parsed.name,
            err: parsed.err?.message ?? parsed.err,
            reqMethod: parsed.req?.method,
            reqUrl: parsed.req?.url,
          };
          buffer.push(entry);
        }
      } catch {
        // Ignore unparseable lines
      }
      callback();
    },
  });
}

export const logBuffer = new LogBuffer();
