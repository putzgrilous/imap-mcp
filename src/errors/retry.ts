import { ImapMcpError } from "./types.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("retry");

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof ImapMcpError) return err.retryable;
  // Retry on generic network errors
  if (err instanceof Error) {
    return (
      err.message.includes("ECONNRESET") ||
      err.message.includes("ETIMEDOUT") ||
      err.message.includes("ENOTFOUND") ||
      err.message.includes("EPIPE")
    );
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  op: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, maxDelayMs = 10_000 } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxAttempts) {
        throw err;
      }

      const jitter = Math.random() * baseDelayMs;
      const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);

      log.warn(
        { attempt, maxAttempts, backoffMs: Math.round(backoff) },
        "Operation failed, retrying",
      );

      await delay(backoff);
    }
  }

  throw lastError;
}
