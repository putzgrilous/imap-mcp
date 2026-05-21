import fs from "fs";
import path from "path";
import os from "os";
import { ServerConfigSchema, type ServerConfig } from "./schema.js";
import { ConfigValidationError } from "../errors/types.js";

function resolvePaths(): string[] {
  const candidates: string[] = [];

  // 1. Explicit env var pointing to config file
  if (process.env.IMAP_MCP_CONFIG) {
    candidates.push(process.env.IMAP_MCP_CONFIG);
  }

  // 2. XDG / platform config dir
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) candidates.push(path.join(appData, "imap-mcp", "config.json"));
  } else {
    const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
    candidates.push(path.join(xdg, "imap-mcp", "config.json"));
  }

  // 3. Legacy: config.json next to the executable (pkg) or next to dist/
  const execDir = process.pkg
    ? path.dirname(process.execPath)
    : path.resolve(__dirname, "..");
  candidates.push(path.join(execDir, "config.json"));

  // 4. CWD fallback for development
  candidates.push(path.join(process.cwd(), "config.json"));

  return candidates;
}

export function loadConfig(): ServerConfig {
  const candidates = resolvePaths();

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
    } catch (err) {
      throw new ConfigValidationError(
        `Failed to parse config file at ${candidate}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const result = ServerConfigSchema.safeParse(raw);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new ConfigValidationError(
        `Invalid config at ${candidate}:\n${issues}`,
      );
    }

    return result.data;
  }

  // No config file found — return empty config so the server starts and the
  // user can run setup_account to add their first account.
  return ServerConfigSchema.parse({});
}

// Augment global process type for pkg detection
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      pkg?: unknown;
    }
  }
}
