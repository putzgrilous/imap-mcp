import fs from "fs";
import { ServerConfigSchema, type ServerConfig } from "./schema.js";
import { ConfigValidationError } from "../errors/types.js";
import { getConfigCandidates } from "./paths.js";

export function loadConfig(): ServerConfig {
  const candidates = getConfigCandidates();

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
