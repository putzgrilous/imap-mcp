import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ServerConfigSchema, type ServerConfig } from "./schema.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("config-writer");

export function resolveConfigPath(): string {
  if (process.env.IMAP_MCP_CONFIG) return process.env.IMAP_MCP_CONFIG;

  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (appData) {
      const dir = path.join(appData, "imap-mcp");
      fs.mkdirSync(dir, { recursive: true });
      return path.join(dir, "config.json");
    }
  } else {
    const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
    const dir = path.join(xdg, "imap-mcp");
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "config.json");
  }

  // Fallback: same dir as executable / project root
  const isPkg = typeof (process as NodeJS.Process & { pkg?: unknown }).pkg !== "undefined";
  const base = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
  return path.join(base, "config.json");
}

export function loadOrCreateConfig(configPath: string): ServerConfig {
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const result = ServerConfigSchema.safeParse(raw);
      if (result.success) return result.data;
    } catch {
      // File exists but is invalid — start fresh
    }
  }
  return ServerConfigSchema.parse({ accounts: [] });
}

export function saveConfig(configPath: string, config: ServerConfig): void {
  // Never persist plain-text passwords
  const safe = {
    ...config,
    accounts: config.accounts.map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...rest } = a;
      return rest;
    }),
  };
  fs.writeFileSync(configPath, JSON.stringify(safe, null, 2) + "\n", { mode: 0o600 });
  log.info({ configPath }, "Config saved");
}
