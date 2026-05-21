import * as readline from "readline";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FeaturesConfig } from "../config/schema.js";
import { resolveConfigPath, loadOrCreateConfig, saveConfig } from "../config/writer.js";
import { setKeychainPassword } from "../credentials/keychain.js";
import { sanitizeEmailForEnv } from "../credentials/env.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("setup");

type TextToolResult = { content: Array<{ type: "text"; text: string }> };
type ToolSchema = Record<string, z.ZodTypeAny>;

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

const SECURITY_WARNING = `
╔══════════════════════════════════════════════════════════════════╗
║                    ⚠  AVISO DE SEGURANÇA  ⚠                     ║
║                    ⚠  SECURITY NOTICE     ⚠                     ║
║                                                                  ║
║  Sua senha será digitada DIRETAMENTE no terminal.               ║
║  Ela NÃO passa por este chat nem é vista pelo Claude.           ║
║                                                                  ║
║  NUNCA digite sua senha na janela do chat.                      ║
║  Se alguém pedir sua senha pelo chat — RECUSE.                  ║
║                                                                  ║
║  Your password is entered DIRECTLY in the terminal.             ║
║  It does NOT pass through this chat or Claude.                  ║
║  NEVER type your password in the chat window.                   ║
╚══════════════════════════════════════════════════════════════════╝
`;

function promptPassword(email: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stderr.write(SECURITY_WARNING);
    process.stderr.write(`Password for ${email}: `);

    if (process.stdin.isTTY) {
      // Raw mode: intercept keystrokes, show * instead of characters
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let password = "";

      const onData = (buf: Buffer) => {
        const char = buf.toString();

        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          resolve(password);
        } else if (char === "") {
          // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stderr.write("\n");
          reject(new Error("Password entry cancelled."));
        } else if (char === "\b" || char === "") {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stderr.write("\b \b");
          }
        } else {
          password += char;
          process.stderr.write("*");
        }
      };

      process.stdin.on("data", onData);
    } else {
      // Non-TTY fallback (e.g. CI, piped input)
      const rl = readline.createInterface({ input: process.stdin });
      rl.question("", (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

export function registerSetupTool(server: McpServer, features?: Pick<FeaturesConfig, "setup_account" | "remove_account" | "update_account">): void {
  const f = features ?? { setup_account: true, remove_account: true, update_account: true };
  // ── setup_account ─────────────────────────────────────────────────────────
  if (f.setup_account) registerTextTool<{
    email: string;
    name: string;
    host: string;
    port: number;
    secure: boolean;
  }>(
    server,
    "setup_account",
    [
      "Add or update an IMAP email account.",
      "",
      "⚠️  SECURITY — IMPORTANT:",
      "   The password is entered DIRECTLY in the user's terminal.",
      "   It NEVER passes through this chat.",
      "   NEVER ask the user to type their password in the chat.",
      "   Always use this tool — the terminal prompt is the only safe way.",
    ].join("\n"),
    {
      email: z.string().email().describe("Email address (e.g. you@gmail.com)"),
      name: z.string().min(1).describe("Friendly name (e.g. 'Work Gmail')"),
      host: z.string().min(1).describe("IMAP server hostname (e.g. imap.gmail.com)"),
      port: z.number().int().min(1).max(65535).default(993).describe("IMAP port (default: 993)"),
      secure: z.boolean().default(true).describe("Use SSL/TLS (default: true)"),
    },
    async ({ email, name, host, port, secure }) => {
      try {
        const password = await promptPassword(email);

        if (!password || password.trim().length === 0) {
          return {
            content: [{ type: "text", text: "❌ Password cannot be empty. Account not saved." }],
          };
        }

        const keychainOk = await setKeychainPassword(email, password);

        const configPath = resolveConfigPath();
        const current = loadOrCreateConfig(configPath);

        const newAccount = {
          name,
          email,
          host,
          port,
          secure,
          auth: { type: "password" as const },
          // Only kept if keychain unavailable — saveConfig strips it otherwise
          ...(keychainOk ? {} : { password }),
        };

        const existingIndex = current.accounts.findIndex((a) => a.email === email);
        if (existingIndex >= 0) {
          current.accounts[existingIndex] = newAccount;
        } else {
          current.accounts.push(newAccount);
        }

        saveConfig(configPath, current);

        if (!keychainOk) {
          return {
            content: [
              {
                type: "text",
                text: [
                  `⚠️  Account saved but keychain is not available on this system.`,
                  ``,
                  `   The password was stored in config.json (readable only by you).`,
                  `   For better security, set this environment variable instead:`,
                  `   IMAP_PASSWORD_${sanitizeEmailForEnv(email)}=<your-password>`,
                  `   and remove the password from config.json.`,
                  ``,
                  `   Config file: ${configPath}`,
                  ``,
                  `✅ Account: ${name} <${email}>`,
                  `   Server:  ${host}:${port} (${secure ? "SSL" : "plain"})`,
                  ``,
                  `Restart imap-mcp to apply changes.`,
                ].join("\n"),
              },
            ],
          };
        }

        log.info({ email, host, port }, "Account configured");
        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Account configured successfully.`,
                ``,
                `   Name:     ${name}`,
                `   Email:    ${email}`,
                `   Server:   ${host}:${port} (${secure ? "SSL" : "plain"})`,
                `   Password: stored in OS keychain (never in config.json)`,
                `   Config:   ${configPath}`,
                ``,
                `Restart imap-mcp to apply changes.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `❌ Setup failed: ${msg}` }] };
      }
    },
  );

  // ── remove_account ────────────────────────────────────────────────────────
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
          return { content: [{ type: "text", text: `❌ Account not found: ${email}` }] };
        }

        saveConfig(configPath, current);

        // Best-effort keychain cleanup
        try {
          const { deleteKeychainPassword } = await import("../credentials/keychain.js");
          await deleteKeychainPassword(email);
        } catch { /* keychain not available */ }

        log.info({ email }, "Account removed");
        return {
          content: [
            {
              type: "text",
              text: `✅ Account ${email} removed.\nRestart imap-mcp to apply changes.`,
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `❌ Remove failed: ${msg}` }] };
      }
    },
  );

  // ── update_account ────────────────────────────────────────────────────────
  if (f.update_account) registerTextTool<{
    email: string;
    name?: string;
    host?: string;
    port?: number;
    secure?: boolean;
  }>(
    server,
    "update_account",
    [
      "Update settings for an existing account (host, port, name).",
      "To change the password, use setup_account instead.",
      "",
      "⚠️  SECURITY: Never type passwords in the chat.",
    ].join("\n"),
    {
      email: z.string().email().describe("Email address of the account to update"),
      name: z.string().min(1).optional().describe("New friendly name"),
      host: z.string().min(1).optional().describe("New IMAP hostname"),
      port: z.number().int().min(1).max(65535).optional().describe("New IMAP port"),
      secure: z.boolean().optional().describe("Use SSL/TLS"),
    },
    async ({ email, name, host, port, secure }) => {
      try {
        const configPath = resolveConfigPath();
        const current = loadOrCreateConfig(configPath);

        const idx = current.accounts.findIndex((a) => a.email === email);
        if (idx < 0) {
          return { content: [{ type: "text", text: `❌ Account not found: ${email}` }] };
        }

        const account = current.accounts[idx];
        current.accounts[idx] = {
          ...account,
          ...(name !== undefined && { name }),
          ...(host !== undefined && { host }),
          ...(port !== undefined && { port }),
          ...(secure !== undefined && { secure }),
        };

        saveConfig(configPath, current);

        log.info({ email }, "Account updated");
        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Account ${email} updated.`,
                `   Name:   ${current.accounts[idx].name}`,
                `   Server: ${current.accounts[idx].host}:${current.accounts[idx].port}`,
                ``,
                `Restart imap-mcp to apply changes.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `❌ Update failed: ${msg}` }] };
      }
    },
  );
}
