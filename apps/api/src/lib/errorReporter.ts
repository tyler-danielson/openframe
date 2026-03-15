import type { FastifyInstance } from "fastify";

interface ErrorPayload {
  level: string;
  message: string;
  stack?: string;
  errorCode?: string;
  httpMethod?: string;
  httpUrl?: string;
  httpStatus?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
  reportedAt: string;
}

// Rate limiter: max 100 errors per minute
let errorCount = 0;
let windowStart = Date.now();
const MAX_ERRORS_PER_MINUTE = 100;
const STACK_MAX_LENGTH = 4000;

function isRateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    errorCount = 0;
    windowStart = now;
  }
  if (errorCount >= MAX_ERRORS_PER_MINUTE) {
    return true;
  }
  errorCount++;
  return false;
}

function truncateStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack.length > STACK_MAX_LENGTH ? stack.slice(0, STACK_MAX_LENGTH) : stack;
}

export function reportErrorToCloud(app: FastifyInstance, error: ErrorPayload): void {
  if (isRateLimited()) return;

  const httpUrl = error.httpUrl ? error.httpUrl.split("?")[0] : undefined;
  const payload = {
    ...error,
    message: error.message.slice(0, 10_000),
    stack: truncateStack(error.stack),
    httpUrl,
  };

  try {
    if (app.cloudRelay?.isConnected) {
      app.cloudRelay.reportErrors([payload]);
    }
  } catch {
    // Fire-and-forget — never let error reporting break the app
  }
}
