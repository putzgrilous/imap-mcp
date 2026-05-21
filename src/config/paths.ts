import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function getExecutableConfigPath(): string {
  const isPkg = typeof (process as NodeJS.Process & { pkg?: unknown }).pkg !== "undefined";
  const base = isPkg ? path.dirname(process.execPath) : path.resolve(__dirname, "..");
  return path.join(base, "config.json");
}

function getUserConfigPath(): string | undefined {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return appData ? path.join(appData, "imap-mcp", "config.json") : undefined;
  }

  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(xdg, "imap-mcp", "config.json");
}

export function getConfigCandidates(): string[] {
  const candidates = [
    process.env.IMAP_MCP_CONFIG,
    getExecutableConfigPath(),
    path.join(process.cwd(), "config.json"),
    getUserConfigPath(),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

export function resolveWritableConfigPath(): string {
  const explicit = process.env.IMAP_MCP_CONFIG;
  if (explicit) return explicit;

  const existing = getConfigCandidates().find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;

  const userConfig = getUserConfigPath();
  if (userConfig) {
    fs.mkdirSync(path.dirname(userConfig), { recursive: true });
    return userConfig;
  }

  return getExecutableConfigPath();
}

