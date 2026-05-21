import pino from "pino";
import type { Logger } from "pino";

const REDACT_PATHS = [
  "password",
  "pass",
  "*.password",
  "*.pass",
  "auth.pass",
  "auth.password",
  "*.accessToken",
  "*.access_token",
  "*.refresh_token",
  "authorization",
  "Authorization",
];

let rootLogger: Logger;

export function initLogger(level: string): void {
  // MCP uses stdout for JSON-RPC — all logs must go to stderr (fd 2)
  rootLogger = pino(
    {
      level,
      redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    },
    pino.destination(2),
  );
}

export function getLogger(name: string): Logger {
  if (!rootLogger) {
    rootLogger = pino({ level: "warn" }, pino.destination(2));
  }
  return rootLogger.child({ module: name });
}
