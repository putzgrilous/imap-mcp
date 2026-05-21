import * as crypto from "crypto";
import * as http from "http";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AccountConfig, FeaturesConfig } from "../config/schema.js";
import { resolveConfigPath, loadOrCreateConfig, saveConfig } from "../config/writer.js";
import { getKeychainPassword, setKeychainPassword } from "../credentials/keychain.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("setup");

type TextToolResult = { content: Array<{ type: "text"; text: string }> };
type ToolSchema = Record<string, z.ZodTypeAny>;

type SetupAccountInput = {
  email: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  smtp_host?: string;
  smtp_port?: number;
};

type CredentialStorageMode = "auto" | "keychain" | "config";

function registerTextTool<TArgs extends Record<string, unknown>>(
  server: McpServer,
  name: string,
  description: string,
  schema: ToolSchema,
  handler: (args: TArgs) => TextToolResult | Promise<TextToolResult>,
): void {
  const tool = server.tool.bind(server) as (
    name: string,
    description: string,
    schema: ToolSchema,
    handler: (args: Record<string, unknown>) => TextToolResult | Promise<TextToolResult>,
  ) => unknown;

  tool(name, description, schema, (args) => handler(args as TArgs));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sendHtml(res: http.ServerResponse, statusCode: number, html: string): void {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(html);
}

function formatLocalTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function saveAccountWithPassword(input: SetupAccountInput, password: string, storageMode: CredentialStorageMode): Promise<{
  configPath: string;
  keychainOk: boolean;
  passwordInConfig: boolean;
  storage: "keychain" | "config";
}> {
  const shouldTryKeychain = storageMode !== "config";
  const keychainWriteOk = shouldTryKeychain ? await setKeychainPassword(input.email, password) : false;
  const keychainOk = keychainWriteOk && await getKeychainPassword(input.email) === password;

  if (storageMode === "keychain" && !keychainOk) {
    throw new Error("OS keychain storage could not be verified.");
  }

  const storeInConfig = storageMode === "config" || !keychainOk;
  const configPath = resolveConfigPath();
  const current = loadOrCreateConfig(configPath);

  const newAccount: AccountConfig = {
    name: input.name,
    email: input.email,
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { type: "password" },
    ...(input.smtp_host ? { smtpHost: input.smtp_host } : {}),
    ...(input.smtp_port ? { smtpPort: input.smtp_port } : {}),
    ...(storeInConfig ? { password } : {}),
  };

  const existingIndex = current.accounts.findIndex((a) => a.email === input.email);
  if (existingIndex >= 0) {
    current.accounts[existingIndex] = newAccount;
  } else {
    current.accounts.push(newAccount);
  }

  const hasPlainTextPasswords = current.accounts.some((account) => Boolean(account.password));
  saveConfig(configPath, current, { allowPlainTextPasswords: hasPlainTextPasswords });
  const saved = loadOrCreateConfig(configPath);
  const savedAccount = saved.accounts.find((account) => account.email === input.email);
  const passwordInConfig = Boolean(savedAccount?.password);

  return {
    configPath,
    keychainOk,
    passwordInConfig,
    storage: keychainOk && !passwordInConfig ? "keychain" : "config",
  };
}

function renderPasswordForm(input: SetupAccountInput, expiresAt: Date): string {
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>imap-mcp setup</title>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<style>",
    ":root{color-scheme:light dark;--bg:#f6f7f9;--panel:#fff;--text:#172033;--muted:#5f6b7a;--line:#d9dee7;--accent:#1f6feb;--accent2:#1557b0;--ok:#16833a}",
    "@media(prefers-color-scheme:dark){:root{--bg:#101419;--panel:#171c22;--text:#eef2f7;--muted:#a8b3c1;--line:#303946;--accent:#66a3ff;--accent2:#8ab8ff;--ok:#51c878}}",
    "*{box-sizing:border-box}",
    "body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45;display:grid;place-items:center;padding:24px}",
    "main{width:min(640px,100%);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:28px;box-shadow:0 18px 45px rgba(18,29,43,.12)}",
    "h1{font-size:24px;line-height:1.2;margin:0 0 8px}",
    "p{margin:0 0 16px}",
    ".meta{color:var(--muted)}",
    ".account{padding:14px 16px;border:1px solid var(--line);border-radius:8px;margin:18px 0;background:rgba(127,127,127,.05)}",
    ".account strong{display:block;font-size:16px;margin-bottom:2px}",
    ".secure{display:flex;gap:10px;align-items:flex-start;color:var(--muted);font-size:14px;margin:0 0 18px}",
    ".secure b{color:var(--ok);font-weight:700}",
    "label{display:block;font-weight:650;margin:16px 0 7px}",
    "input,select{display:block;width:100%;font-size:16px;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px}",
    "input:focus,select:focus{outline:3px solid color-mix(in srgb,var(--accent) 25%,transparent);border-color:var(--accent)}",
    "button{width:100%;margin-top:20px;border:0;border-radius:6px;padding:13px 16px;font-size:16px;font-weight:700;color:#fff;background:var(--accent);cursor:pointer}",
    "button:hover{background:var(--accent2)}",
    ".hint{font-size:13px;color:var(--muted);margin-top:8px}",
    ".footer{border-top:1px solid var(--line);padding-top:16px;margin-top:22px;font-size:13px;color:var(--muted)}",
    "</style></head><body>",
    "<main>",
    "<h1>imap-mcp account setup</h1>",
    "<p class=\"meta\">Enter the password for this local MCP server.</p>",
    "<div class=\"account\">",
    `<strong>${escapeHtml(input.name)}</strong>`,
    `<span>${escapeHtml(input.email)}</span>`,
    "</div>",
    "<p class=\"secure\"><span><b>Local only.</b> The password is posted to 127.0.0.1 and never goes through the chat.</span></p>",
    "<form method=\"post\">",
    "<label for=\"password\">Password or app password</label>",
    "<input id=\"password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" required autofocus>",
    "<label for=\"credential_storage\">Credential storage</label>",
    "<select id=\"credential_storage\" name=\"credential_storage\">",
    "<option value=\"config\" selected>config.json</option>",
    "<option value=\"auto\">Auto: use OS keychain, fallback to config.json</option>",
    "<option value=\"keychain\">OS keychain only</option>",
    "</select>",
    "<p class=\"hint\">config.json is the most predictable option for this packaged local server. The file is ignored by Git.</p>",
    "<button type=\"submit\">Save account</button>",
    "</form>",
    `<p class=\"footer\">This link expires at ${escapeHtml(formatLocalTime(expiresAt))}. Close this tab after saving.</p>`,
    "</main>",
    "</body></html>",
  ].join("");
}

function renderSuccessPage(input: SetupAccountInput, result: {
  configPath: string;
  keychainOk: boolean;
  passwordInConfig: boolean;
  storage: "keychain" | "config";
}): string {
  const storageLabel = result.storage === "keychain" ? "OS keychain" : "config.json";
  const smtpHost = input.smtp_host ?? input.host.replace(/^imap\./, "smtp.");
  const smtpPort = input.smtp_port ?? (input.secure ? 465 : 587);
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>imap-mcp setup complete</title>",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<style>",
    ":root{color-scheme:light dark;--bg:#f6f7f9;--panel:#fff;--text:#172033;--muted:#5f6b7a;--line:#d9dee7;--accent:#1f6feb;--ok:#16833a;--warn:#a15c00}",
    "@media(prefers-color-scheme:dark){:root{--bg:#101419;--panel:#171c22;--text:#eef2f7;--muted:#a8b3c1;--line:#303946;--accent:#66a3ff;--ok:#51c878;--warn:#f5b65a}}",
    "*{box-sizing:border-box}",
    "body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.45;display:grid;place-items:center;padding:24px}",
    "main{width:min(640px,100%);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:28px;box-shadow:0 18px 45px rgba(18,29,43,.12)}",
    "h1{font-size:24px;line-height:1.2;margin:0 0 8px}",
    "p{margin:0 0 16px}",
    ".meta{color:var(--muted)}",
    ".account{padding:14px 16px;border:1px solid var(--line);border-radius:8px;margin:18px 0;background:rgba(127,127,127,.05)}",
    ".account strong{display:block;font-size:16px;margin-bottom:2px}",
    ".status{display:grid;gap:10px;margin:18px 0}",
    ".row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}",
    ".row span:first-child{color:var(--muted)}",
    ".ok{color:var(--ok);font-weight:700}",
    ".warn{color:var(--warn);font-weight:700}",
    ".path{word-break:break-all;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px}",
    ".footer{border-top:1px solid var(--line);padding-top:16px;margin-top:22px;font-size:13px;color:var(--muted)}",
    "</style></head><body>",
    "<main>",
    "<h1>Account saved</h1>",
    "<p class=\"meta\">The account was configured successfully.</p>",
    "<div class=\"account\">",
    `<strong>${escapeHtml(input.name)}</strong>`,
    `<span>${escapeHtml(input.email)}</span>`,
    "</div>",
    "<div class=\"status\">",
    `<div class=\"row\"><span>IMAP server</span><strong>${escapeHtml(input.host)}:${input.port}</strong></div>`,
    `<div class=\"row\"><span>IMAP TLS</span><strong>${input.secure ? "enabled" : "disabled"}</strong></div>`,
    `<div class=\"row\"><span>SMTP server</span><strong>${escapeHtml(smtpHost)}:${smtpPort}</strong></div>`,
    `<div class=\"row\"><span>Password storage</span><strong>${escapeHtml(storageLabel)}</strong></div>`,
    `<div class=\"row\"><span>Keychain verified</span><strong class=\"${result.keychainOk ? "ok" : "warn"}\">${result.keychainOk ? "yes" : "no"}</strong></div>`,
    `<div class=\"row\"><span>Password present in config.json</span><strong class=\"${result.passwordInConfig ? "ok" : "warn"}\">${result.passwordInConfig ? "yes" : "no"}</strong></div>`,
    `<div class=\"row\"><span>Config</span><strong class=\"path\">${escapeHtml(result.configPath)}</strong></div>`,
    "</div>",
    "<p class=\"footer\">Restart imap-mcp to apply changes. You can close this tab.</p>",
    "</main>",
    "</body></html>",
  ].join("");
}

async function startPasswordSetupServer(input: SetupAccountInput): Promise<{
  url: string;
  expiresAt: Date;
}> {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  let completed = false;

  const server = http.createServer((req, res) => {
    void (async () => {
      const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
      const validToken = requestUrl.searchParams.get("token") === token;
      const expired = Date.now() > expiresAt.getTime();

      if (requestUrl.pathname === "/favicon.ico") {
        res.writeHead(204, { "cache-control": "no-store" });
        res.end();
        return;
      }

      if (requestUrl.pathname !== "/setup") {
        sendHtml(res, 404, "<h1>Setup link not found</h1>");
        return;
      }

      if (!validToken) {
        sendHtml(res, 403, "<h1>Setup token invalid</h1><p>Run setup_account again and open the full URL returned by the MCP tool.</p>");
        return;
      }

      if (expired) {
        sendHtml(res, 410, "<h1>Setup link expired</h1><p>Run setup_account again to generate a fresh link.</p>");
        return;
      }

      if (req.method === "GET") {
        sendHtml(res, 200, renderPasswordForm(input, expiresAt));
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { allow: "GET, POST" });
        res.end();
        return;
      }

      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 64 * 1024) req.destroy();
      });
      req.on("end", async () => {
        try {
          const params = new URLSearchParams(body);
          const password = params.get("password") ?? "";
          const storageModeRaw = params.get("credential_storage") ?? "auto";
          const storageMode: CredentialStorageMode = storageModeRaw === "keychain" || storageModeRaw === "config"
            ? storageModeRaw
            : "auto";
          if (!password) {
            sendHtml(res, 400, "<h1>Password cannot be empty</h1>");
            return;
          }

          const result = await saveAccountWithPassword(input, password, storageMode);
          completed = true;
          sendHtml(res, 200, renderSuccessPage(input, result));
          log.info({ email: input.email, host: input.host, port: input.port, keychainOk: result.keychainOk }, "Account configured");
          setTimeout(() => server.close(), 250);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendHtml(res, 500, `<h1>Setup failed</h1><pre>${escapeHtml(msg)}</pre>`);
        }
      });
    })().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      sendHtml(res, 500, `<h1>Setup failed</h1><pre>${escapeHtml(msg)}</pre>`);
    });
  });

  const listen = (port: number) => new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : port);
    });
  });

  let port: number;
  try {
    port = await listen(7823);
  } catch {
    port = await listen(0);
  }

  const expiryTimer = setTimeout(() => {
    if (!completed) server.close();
  }, Math.max(0, expiresAt.getTime() - Date.now()));
  expiryTimer.unref();

  return {
    url: `http://127.0.0.1:${port}/setup?token=${token}`,
    expiresAt,
  };
}

export function registerSetupTool(server: McpServer, features?: Pick<FeaturesConfig, "setup_account" | "remove_account" | "update_account">): void {
  const f = features ?? { setup_account: true, remove_account: true, update_account: true };

  if (f.setup_account) registerTextTool<SetupAccountInput>(
    server,
    "setup_account",
    [
      "Add or update an IMAP email account.",
      "",
      "SECURITY:",
      "The password is entered in a temporary local browser page.",
      "It never passes through this chat.",
      "Never ask the user to type their password in the chat.",
    ].join("\n"),
    {
      email: z.string().email().describe("Email address (e.g. you@gmail.com)"),
      name: z.string().min(1).describe("Friendly name (e.g. 'Work Gmail')"),
      host: z.string().min(1).describe("IMAP server hostname (e.g. imap.gmail.com)"),
      port: z.number().int().min(1).max(65535).default(993).describe("IMAP port (default: 993)"),
      secure: z.boolean().default(true).describe("Use SSL/TLS (default: true)"),
      smtp_host: z.string().optional().describe("SMTP hostname derived from IMAP host if omitted (e.g. smtp.gmail.com)"),
      smtp_port: z.number().int().min(1).max(65535).optional().describe("SMTP port (default: 465 for SSL, 587 for STARTTLS)"),
    },
    async (input) => {
      try {
        const { url, expiresAt } = await startPasswordSetupServer(input);
        return {
          content: [
            {
              type: "text",
              text: [
                "Open this local link to enter the password:",
                "",
                url,
                "",
                `The link expires at ${formatLocalTime(expiresAt)} (about 15 minutes).`,
                "The password is sent only to this local MCP process and never through the chat.",
                "After saving, restart imap-mcp to apply changes.",
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Setup failed: ${msg}` }] };
      }
    },
  );

  if (f.remove_account) registerTextTool<{ email: string }>(
    server,
    "remove_account",
    "Remove a configured email account and delete its stored password.",
    {
      email: z.string().email().describe("Email address of the account to remove"),
    },
    async ({ email }) => {
      try {
        const configPath = resolveConfigPath();
        const current = loadOrCreateConfig(configPath);

        const before = current.accounts.length;
        current.accounts = current.accounts.filter((a) => a.email !== email);

        if (current.accounts.length === before) {
          return { content: [{ type: "text", text: `Account not found: ${email}` }] };
        }

        saveConfig(configPath, current, {
          allowPlainTextPasswords: current.accounts.some((a) => Boolean(a.password)),
        });

        try {
          const { deleteKeychainPassword } = await import("../credentials/keychain.js");
          await deleteKeychainPassword(email);
        } catch {
          // Keychain cleanup is best effort.
        }

        log.info({ email }, "Account removed");
        return {
          content: [{ type: "text", text: `Account ${email} removed.\nRestart imap-mcp to apply changes.` }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Remove failed: ${msg}` }] };
      }
    },
  );

  if (f.update_account) registerTextTool<{
    email: string;
    name?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    smtp_host?: string;
    smtp_port?: number;
  }>(
    server,
    "update_account",
    [
      "Update settings for an existing account (host, port, name, SMTP).",
      "To change the password, use setup_account instead.",
      "",
      "SECURITY: Never type passwords in the chat.",
    ].join("\n"),
    {
      email: z.string().email().describe("Email address of the account to update"),
      name: z.string().min(1).optional().describe("New friendly name"),
      host: z.string().min(1).optional().describe("New IMAP hostname"),
      port: z.number().int().min(1).max(65535).optional().describe("New IMAP port"),
      secure: z.boolean().optional().describe("Use SSL/TLS"),
      smtp_host: z.string().optional().describe("SMTP hostname override (e.g. smtp.gmail.com)"),
      smtp_port: z.number().int().min(1).max(65535).optional().describe("SMTP port override"),
    },
    async ({ email, name, host, port, secure, smtp_host, smtp_port }) => {
      try {
        const configPath = resolveConfigPath();
        const current = loadOrCreateConfig(configPath);

        const idx = current.accounts.findIndex((a) => a.email === email);
        if (idx < 0) {
          return { content: [{ type: "text", text: `Account not found: ${email}` }] };
        }

        const account = current.accounts[idx];
        current.accounts[idx] = {
          ...account,
          ...(name !== undefined && { name }),
          ...(host !== undefined && { host }),
          ...(port !== undefined && { port }),
          ...(secure !== undefined && { secure }),
          ...(smtp_host !== undefined && { smtpHost: smtp_host }),
          ...(smtp_port !== undefined && { smtpPort: smtp_port }),
        };

        saveConfig(configPath, current, {
          allowPlainTextPasswords: current.accounts.some((a) => Boolean(a.password)),
        });

        log.info({ email }, "Account updated");
        return {
          content: [
            {
              type: "text",
              text: [
                `Account ${email} updated.`,
                `Name:   ${current.accounts[idx].name}`,
                `Server: ${current.accounts[idx].host}:${current.accounts[idx].port}`,
                "",
                "Restart imap-mcp to apply changes.",
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Update failed: ${msg}` }] };
      }
    },
  );
}
