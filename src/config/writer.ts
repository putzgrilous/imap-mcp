import * as fs from "fs";
import { ServerConfigSchema, type ServerConfig } from "./schema.js";
import { getLogger } from "../logging/logger.js";
import { resolveWritableConfigPath } from "./paths.js";

const log = getLogger("config-writer");

export function resolveConfigPath(): string {
  return resolveWritableConfigPath();
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

export function saveConfig(
  configPath: string,
  config: ServerConfig,
  options?: { allowPlainTextPasswords?: boolean },
): void {
  const safe = {
    ...config,
    accounts: options?.allowPlainTextPasswords
      ? config.accounts
      : config.accounts.map((a) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pw, ...rest } = a;
        return rest;
      }),
  };
  fs.writeFileSync(configPath, JSON.stringify(safe, null, 2) + "\n", { mode: 0o600 });
  log.info({ configPath }, "Config saved");
}
