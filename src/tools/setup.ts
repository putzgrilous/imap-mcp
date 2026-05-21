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

async function saveAccountWithPassword(input: SetupAccountInput, password: string): Promise<{
  configPath: string;
  keychainOk: boolean;
}> {
  const keychainWriteOk = await setKeychainPassword(input.email, password);
  const keychainOk = keychainWriteOk && await getKeychainPassword(input.email) === password;
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
    ...(keychainOk ? {} : { password }),
  };

  const existingIndex = current.accounts.findIndex((a) => a.email === input.email);
  if (existingIndex >= 0) {
    current.accounts[existingIndex] = newAccount;
  } else {
    current.accounts.push(newAccount);
  }

  const hasPlainTextPasswords = current.accounts.some((account) => Boolean(account.password));
  saveConfig(configPath, current, { allowPlainTextPasswords: hasPlainTextPasswords });
  return { configPath, keychainOk };
}

function renderPasswordForm(input: SetupAccountInput, expiresAt: Date): string {
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"><title>imap-mcp setup</title>",
    "<style>",
    "body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:40px;max-width:560px;line-height:1.45}",
    "label,input,button{display:block;width:100%;font-size:16px}",
    "input{box-sizing:border-box;margin:8px 0 16px;padding:10px}",
    "button{padding:10px;cursor:pointer}",
    ".meta{color:#555}",
    "</style></head><body>",
    "<h1>imap-mcp account setup</h1>",
    `<p class="meta">Account: <strong>${escapeHtml(input.name)}</strong> &lt;${escapeHtml(input.email)}&gt;</p>`,
    "<form method=\"post\">",
    "<label for=\"password\">Password or app password</label>",
    "<input id=\"password\" name=\"password\" type=\"password\" autocomplete=\"current-password\" required autofocus>",
    "<button type=\"submit\">Save account</button>",
    "</form>",
    `<p class="meta">This local link expires at ${escapeHtml(expiresAt.toLocaleTimeString())}. The password is sent only to this local MCP process.</p>`,
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
          if (!password) {
            sendHtml(res, 400, "<h1>Password cannot be empty</h1>");
            return;
          }

          const { configPath, keychainOk } = await saveAccountWithPassword(input, password);
          completed = true;
          sendHtml(res, 200, [
            "<!doctype html><html><head><meta charset=\"utf-8\"><title>imap-mcp setup complete</title></head><body>",
            "<h1>Account saved</h1>",
            `<p>${escapeHtml(input.email)} was configured successfully.</p>`,
            `<p>Password storage: ${keychainOk ? "OS keychain" : "config.json fallback"}</p>`,
            `<p>Config: ${escapeHtml(configPath)}</p>`,
            "<p>Restart imap-mcp to apply changes.</p>",
            "</body></html>",
          ].join(""));
          log.info({ email: input.email, host: input.host, port: input.port, keychainOk }, "Account configured");
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
                `The link expires at ${expiresAt.toLocaleTimeString()} (about 15 minutes).`,
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
