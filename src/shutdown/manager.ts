import { getLogger } from "../logging/logger.js";

const log = getLogger("shutdown");

type CleanupFn = () => Promise<void>;

const cleanupHandlers: CleanupFn[] = [];
let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function registerCleanup(fn: CleanupFn): void {
  cleanupHandlers.push(fn);
}

async function runShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  log.info({ signal }, "Shutting down gracefully...");

  const timeout = setTimeout(() => {
    log.warn("Shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);

  try {
    await Promise.all(cleanupHandlers.map((fn) => fn().catch((err) => {
      log.error({ err }, "Error during cleanup");
    })));
  } finally {
    clearTimeout(timeout);
  }

  log.info("Shutdown complete");
  process.exit(0);
}

export function registerShutdownHandlers(): void {
  process.on("SIGTERM", () => void runShutdown("SIGTERM"));
  process.on("SIGINT", () => void runShutdown("SIGINT"));
  process.on("SIGHUP", () => void runShutdown("SIGHUP"));
}
