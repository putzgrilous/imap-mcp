import { ImapMcpError } from "./types.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("error-handler");

// Regex to redact anything that looks like a credential in error messages
const CREDENTIAL_PATTERN = /\b(pass(word)?|secret|token|auth|key)\s*[:=]\s*\S+/gi;

function sanitizeMessage(msg: string): string {
  return msg.replace(CREDENTIAL_PATTERN, "[REDACTED]");
}

export function formatToolError(err: unknown): string {
  if (err instanceof ImapMcpError) {
    log.error({ code: err.code, retryable: err.retryable }, err.message);
    return `Error [${err.code}]: ${sanitizeMessage(err.message)}`;
  }

  if (err instanceof Error) {
    log.error({ name: err.name, stack: err.stack, cause: (err as NodeJS.ErrnoException).code }, err.message);
    return `Error: ${sanitizeMessage(err.message)}`;
  }

  log.error({ err }, "Unknown error type");
  return "An unexpected error occurred.";
}
