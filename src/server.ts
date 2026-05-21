import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { simpleParser } from "mailparser";
import { z } from "zod";
import type { ServerConfig, AccountConfig } from "./config/schema.js";
import { getCredentials } from "./credentials/manager.js";
import { formatToolError } from "./errors/handler.js";
import { withRetry } from "./errors/retry.js";
import { AccountNotFoundError, EmailNotFoundError } from "./errors/types.js";
import { t } from "./i18n/index.js";
import { getLogger } from "./logging/logger.js";
import { registerSetupTool } from "./tools/setup.js";
import { markRead, moveEmail, deleteEmail, flagEmail, createFolder, deleteFolder } from "./imap/operations/write.js";
import { fetchAttachment } from "./imap/operations/fetch.js";
import { sendEmail } from "./smtp/send.js";
import { ImapConnectionPool } from "./imap/pool.js";
import { CacheManager } from "./cache/manager.js";
import { watchFolder } from "./imap/idle.js";

const log = getLogger("server");

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

function findAccount(config: ServerConfig, email: string): AccountConfig {
  const account = config.accounts.find((a) => a.email === email);
  if (!account) throw new AccountNotFoundError(email);
  return account;
}

// pageToken = base64(JSON({uid, folder, email}))
function encodePageToken(email: string, folder: string, uid: number): string {
  return Buffer.from(JSON.stringify({ email, folder, uid })).toString("base64");
}

function decodePageToken(token: string): { email: string; folder: string; uid: number } | null {
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8")) as { email: string; folder: string; uid: number };
  } catch {
    return null;
  }
}

// Active watch handles keyed by watchId
const activeWatches = new Map<string, { stop: () => Promise<void> }>();

export function createServer(config: ServerConfig): { server: McpServer; pool: ImapConnectionPool } {
  const server = new McpServer({
    name: "imap-mcp",
    version: "2.0.0",
  });

  const f = config.features;

  const pool = new ImapConnectionPool(config.pool);
  const cache = new CacheManager(config.cache);

  // ── list_accounts ────────────────────────────────────────────────────────────
  if (f.list_accounts) registerTextTool(
    server,
    "list_accounts",
    t("tool.list_accounts.description"),
    {},
    async () => {
      const accounts = config.accounts.map((a) => ({
        name: a.name,
        email: a.email,
        host: a.host,
      }));
      log.debug({ count: accounts.length }, "list_accounts");
      return {
        content: [{ type: "text", text: JSON.stringify(accounts, null, 2) }],
      };
    },
  );

  // ── list_folders ─────────────────────────────────────────────────────────────
  if (f.list_folders) registerTextTool<{ email: string }>(
    server,
    "list_folders",
    t("tool.list_folders.description"),
    {
      email: z.string().describe(t("tool.list_folders.param_email")),
    },
    async ({ email }) => {
      try {
        const account = findAccount(config, email);
        const cacheKey = `${email}:folders`;
        const cached = cache.folders.get(cacheKey);
        if (cached) {
          log.debug({ email, count: cached.length }, "list_folders (cache hit)");
          return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        }
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const folders: string[] = [];
            for (const folder of await client.list()) {
              folders.push(folder.path);
            }
            cache.folders.set(cacheKey, folders);
            log.debug({ email, count: folders.length }, "list_folders");
            return { content: [{ type: "text", text: JSON.stringify(folders, null, 2) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── list_emails ──────────────────────────────────────────────────────────────
  if (f.list_emails) registerTextTool<{ email: string; folder: string; limit: number; page_token?: string }>(
    server,
    "list_emails",
    t("tool.list_emails.description"),
    {
      email: z.string().describe(t("tool.list_emails.param_email")),
      folder: z.string().default("INBOX").describe(t("tool.list_emails.param_folder")),
      limit: z.number().int().min(1).max(100).default(20).describe(t("tool.list_emails.param_limit")),
      page_token: z.string().optional().describe(t("tool.list_emails.param_page_token")),
    },
    async ({ email, folder, limit, page_token }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const lock = await client.getMailboxLock(folder);
            const emails: object[] = [];
            let nextPageToken: string | undefined;
            try {
              const total = (client.mailbox as { exists: number }).exists;
              if (total === 0) {
                return { content: [{ type: "text", text: t("tool.list_emails.empty", { folder }) }] };
              }

              // Decode cursor from pageToken or default to latest
              let maxUid: number | null = null;
              if (page_token) {
                const decoded = decodePageToken(page_token);
                if (decoded && decoded.email === email && decoded.folder === folder) {
                  maxUid = decoded.uid - 1;
                }
              }

              const range = maxUid !== null ? `1:${maxUid}` : `1:*`;
              const allMsgs: Array<{ uid: number; envelope: unknown; flags: Set<string> }> = [];

              for await (const msg of client.fetch(range, { envelope: true, flags: true })) {
                allMsgs.push({ uid: msg.uid, envelope: msg.envelope, flags: msg.flags ?? new Set() });
              }

              // Sort descending by UID, take limit
              allMsgs.sort((a, b) => b.uid - a.uid);
              const page = allMsgs.slice(0, limit);

              for (const msg of page) {
                const env = msg.envelope as { subject?: string; from?: Array<{ address?: string }>; date?: Date } | null;
                emails.push({
                  uid: msg.uid,
                  subject: env?.subject ?? "(no subject)",
                  from: env?.from?.[0]?.address ?? "",
                  date: env?.date,
                  unread: !(msg.flags as Set<string>).has("\\Seen"),
                  flagged: (msg.flags as Set<string>).has("\\Flagged"),
                });
              }

              // If there are more messages before this page, provide a cursor
              if (allMsgs.length > limit) {
                const oldest = page[page.length - 1];
                nextPageToken = encodePageToken(email, folder, oldest.uid);
              }
            } finally {
              lock.release();
            }
            log.debug({ email, folder, count: emails.length }, "list_emails");
            const result: Record<string, unknown> = { emails };
            if (nextPageToken) result.nextPageToken = nextPageToken;
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── search_emails ────────────────────────────────────────────────────────────
  if (f.search_emails) registerTextTool<{
    email: string;
    query?: string;
    folder: string;
    unread_only: boolean;
    since?: string;
    before?: string;
    larger_than?: number;
    smaller_than?: number;
    has_attachment?: boolean;
    flagged?: boolean;
    limit: number;
  }>(
    server,
    "search_emails",
    t("tool.search_emails.description"),
    {
      email: z.string().describe(t("tool.search_emails.param_email")),
      query: z.string().optional().describe(t("tool.search_emails.param_query")),
      folder: z.string().default("INBOX").describe(t("tool.search_emails.param_folder")),
      unread_only: z.boolean().default(false).describe(t("tool.search_emails.param_unread_only")),
      since: z.string().optional().describe(t("tool.search_emails.param_since")),
      before: z.string().optional().describe(t("tool.search_emails.param_before")),
      larger_than: z.number().int().positive().optional().describe(t("tool.search_emails.param_larger_than")),
      smaller_than: z.number().int().positive().optional().describe(t("tool.search_emails.param_smaller_than")),
      has_attachment: z.boolean().optional().describe(t("tool.search_emails.param_has_attachment")),
      flagged: z.boolean().optional().describe(t("tool.search_emails.param_flagged")),
      limit: z.number().int().min(1).max(100).default(30).describe(t("tool.search_emails.param_limit")),
    },
    async ({ email, query, folder, unread_only, since, before, larger_than, smaller_than, has_attachment, flagged, limit }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const lock = await client.getMailboxLock(folder);
            const emails: object[] = [];
            try {
              // Build IMAP search criteria
              const criteria: Record<string, unknown> = {};
              if (unread_only) criteria.seen = false;
              if (flagged) criteria.flagged = true;
              if (since) criteria.since = new Date(since);
              if (before) criteria.before = new Date(before);
              if (larger_than) criteria.larger = larger_than;
              if (smaller_than) criteria.smaller = smaller_than;

              // Text search: query matches subject OR from OR body
              const textCriteria = query
                ? { or: [{ subject: query }, { or: [{ from: query }, { body: query }] }] }
                : {};

              // has_attachment is not a native IMAP criterion — filter post-fetch
              const merged = { ...criteria, ...textCriteria };
              const uids = await client.search(merged);

              if (uids && uids.length > 0) {
                const slice = uids.slice(-limit * 2); // fetch extra for has_attachment filter
                for await (const msg of client.fetch(slice, {
                  envelope: true,
                  flags: true,
                  bodyStructure: has_attachment ? true : false,
                })) {
                  // Filter has_attachment by checking bodyStructure
                  if (has_attachment) {
                    const struct = (msg as unknown as Record<string, unknown>).bodyStructure as { type?: string; childNodes?: unknown[] } | undefined;
                    const hasAtt = struct?.childNodes && struct.childNodes.length > 1;
                    if (!hasAtt) continue;
                  }
                  emails.push({
                    uid: msg.uid,
                    subject: msg.envelope?.subject ?? "(no subject)",
                    from: msg.envelope?.from?.[0]?.address ?? "",
                    date: msg.envelope?.date,
                    unread: !msg.flags?.has("\\Seen"),
                    flagged: msg.flags?.has("\\Flagged") ?? false,
                  });
                  if (emails.length >= limit) break;
                }
              }
            } finally {
              lock.release();
            }
            if (emails.length === 0) {
              return {
                content: [{ type: "text", text: t("tool.search_emails.no_results", { query: query ?? "(filters)" }) }],
              };
            }
            log.debug({ email, folder, query, count: emails.length }, "search_emails");
            return { content: [{ type: "text", text: JSON.stringify(emails.reverse(), null, 2) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── get_email ─────────────────────────────────────────────────────────────────
  if (f.get_email) registerTextTool<{ email: string; uid: number; folder: string }>(
    server,
    "get_email",
    t("tool.get_email.description"),
    {
      email: z.string().describe(t("tool.get_email.param_email")),
      uid: z.number().int().describe(t("tool.get_email.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.get_email.param_folder")),
    },
    async ({ email, uid, folder }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const lock = await client.getMailboxLock(folder);
            let result: object | null = null;
            try {
              for await (const msg of client.fetch([uid], { source: true, envelope: true })) {
                const parsed = await simpleParser(msg.source as Buffer);
                const toText = parsed.to
                  ? Array.isArray(parsed.to)
                    ? parsed.to.map((addr) => addr.text).join(", ")
                    : parsed.to.text
                  : "";
                result = {
                  uid: msg.uid,
                  subject: parsed.subject ?? "(no subject)",
                  from: parsed.from?.text ?? "",
                  to: toText,
                  date: parsed.date,
                  messageId: parsed.messageId,
                  references: parsed.references ?? [],
                  body: parsed.text ?? t("tool.get_email.empty_body"),
                  html: parsed.html || undefined,
                  attachments: parsed.attachments.map((a, i) => ({
                    index: i,
                    filename: a.filename,
                    contentType: a.contentType,
                    size: a.size,
                  })),
                };
              }
            } finally {
              lock.release();
            }
            if (!result) throw new EmailNotFoundError(uid);
            log.debug({ email, folder, uid }, "get_email");
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── get_attachment ────────────────────────────────────────────────────────────
  if (f.get_attachment) registerTextTool<{ email: string; uid: number; folder: string; index: number }>(
    server,
    "get_attachment",
    t("tool.get_attachment.description"),
    {
      email: z.string().describe(t("tool.get_attachment.param_email")),
      uid: z.number().int().describe(t("tool.get_attachment.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.get_attachment.param_folder")),
      index: z.number().int().min(0).default(0).describe(t("tool.get_attachment.param_index")),
    },
    async ({ email, uid, folder, index }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const att = await fetchAttachment(client, folder, uid, index);
            log.debug({ email, folder, uid, index, filename: att.filename }, "get_attachment");
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  filename: att.filename,
                  contentType: att.contentType,
                  size: att.size,
                  data: att.data,
                  encoding: "base64",
                }, null, 2),
              }],
            };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── account management (setup, remove, update) ───────────────────────────────
  // Passwords are entered via secure terminal prompt — never through the chat.
  registerSetupTool(server, f);

  // ── list_config ──────────────────────────────────────────────────────────────
  if (f.list_config) registerTextTool(
    server,
    "list_config",
    "Show all configured accounts and server settings. Passwords are NEVER shown.",
    {},
    async () => {
      const safe = config.accounts.map((a) => ({
        name: a.name,
        email: a.email,
        host: a.host,
        port: a.port,
        secure: a.secure,
        auth: a.auth.type,
      }));
      return { content: [{ type: "text", text: JSON.stringify(safe, null, 2) }] };
    },
  );

  // ── mark_read ─────────────────────────────────────────────────────────────────
  if (f.mark_read) registerTextTool<{ email: string; uid: number; folder: string; read: boolean }>(
    server,
    "mark_read",
    t("tool.mark_read.description"),
    {
      email: z.string().describe(t("tool.mark_read.param_email")),
      uid: z.number().int().describe(t("tool.mark_read.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.mark_read.param_folder")),
      read: z.boolean().default(true).describe(t("tool.mark_read.param_read")),
    },
    async ({ email, uid, folder, read }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await markRead(client, folder, uid, read);
            log.debug({ email, folder, uid, read }, "mark_read");
            return {
              content: [{ type: "text", text: t("tool.mark_read.success", { uid: String(uid), status: read ? "read" : "unread" }) }],
            };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── flag_email ────────────────────────────────────────────────────────────────
  if (f.flag_email) registerTextTool<{ email: string; uid: number; folder: string; flagged: boolean }>(
    server,
    "flag_email",
    t("tool.flag_email.description"),
    {
      email: z.string().describe(t("tool.flag_email.param_email")),
      uid: z.number().int().describe(t("tool.flag_email.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.flag_email.param_folder")),
      flagged: z.boolean().default(true).describe(t("tool.flag_email.param_flagged")),
    },
    async ({ email, uid, folder, flagged }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await flagEmail(client, folder, uid, flagged);
            log.debug({ email, folder, uid, flagged }, "flag_email");
            return {
              content: [{ type: "text", text: t("tool.flag_email.success", { uid: String(uid), status: flagged ? "starred" : "unstarred" }) }],
            };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── move_email ────────────────────────────────────────────────────────────────
  if (f.move_email) registerTextTool<{ email: string; uid: number; folder: string; destination: string }>(
    server,
    "move_email",
    t("tool.move_email.description"),
    {
      email: z.string().describe(t("tool.move_email.param_email")),
      uid: z.number().int().describe(t("tool.move_email.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.move_email.param_folder")),
      destination: z.string().describe(t("tool.move_email.param_destination")),
    },
    async ({ email, uid, folder, destination }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await moveEmail(client, folder, uid, destination);
            log.debug({ email, folder, uid, destination }, "move_email");
            return {
              content: [{ type: "text", text: t("tool.move_email.success", { uid: String(uid), destination }) }],
            };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── delete_email ──────────────────────────────────────────────────────────────
  if (f.delete_email) registerTextTool<{ email: string; uid: number; folder: string }>(
    server,
    "delete_email",
    t("tool.delete_email.description"),
    {
      email: z.string().describe(t("tool.delete_email.param_email")),
      uid: z.number().int().describe(t("tool.delete_email.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.delete_email.param_folder")),
    },
    async ({ email, uid, folder }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await deleteEmail(client, folder, uid);
            log.debug({ email, folder, uid }, "delete_email");
            return {
              content: [{ type: "text", text: t("tool.delete_email.success", { uid: String(uid) }) }],
            };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── create_folder ─────────────────────────────────────────────────────────────
  if (f.create_folder) registerTextTool<{ email: string; path: string }>(
    server,
    "create_folder",
    t("tool.create_folder.description"),
    {
      email: z.string().describe(t("tool.create_folder.param_email")),
      path: z.string().describe(t("tool.create_folder.param_path")),
    },
    async ({ email, path }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await createFolder(client, path);
            cache.folders.delete(`${email}:folders`);
            log.debug({ email, path }, "create_folder");
            return { content: [{ type: "text", text: t("tool.create_folder.success", { path }) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── delete_folder ─────────────────────────────────────────────────────────────
  if (f.delete_folder) registerTextTool<{ email: string; path: string }>(
    server,
    "delete_folder",
    t("tool.delete_folder.description"),
    {
      email: z.string().describe(t("tool.delete_folder.param_email")),
      path: z.string().describe(t("tool.delete_folder.param_path")),
    },
    async ({ email, path }) => {
      try {
        const account = findAccount(config, email);
        return await withRetry(() =>
          pool.withConnection(account, async (client) => {
            await deleteFolder(client, path);
            cache.folders.delete(`${email}:folders`);
            log.debug({ email, path }, "delete_folder");
            return { content: [{ type: "text", text: t("tool.delete_folder.success", { path }) }] };
          }),
        );
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── send_email ────────────────────────────────────────────────────────────────
  if (f.send_email) registerTextTool<{
    email: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
    reply_to?: string;
    in_reply_to?: string;
  }>(
    server,
    "send_email",
    t("tool.send_email.description"),
    {
      email: z.string().describe(t("tool.send_email.param_email")),
      to: z.string().describe(t("tool.send_email.param_to")),
      subject: z.string().describe(t("tool.send_email.param_subject")),
      text: z.string().optional().describe(t("tool.send_email.param_text")),
      html: z.string().optional().describe(t("tool.send_email.param_html")),
      cc: z.string().optional().describe(t("tool.send_email.param_cc")),
      bcc: z.string().optional().describe(t("tool.send_email.param_bcc")),
      reply_to: z.string().optional().describe(t("tool.send_email.param_reply_to")),
      in_reply_to: z.string().optional().describe(t("tool.send_email.param_in_reply_to")),
    },
    async ({ email, to, subject, text, html, cc, bcc, reply_to, in_reply_to }) => {
      try {
        const account = findAccount(config, email);
        const credentials = await getCredentials(account);
        const messageId = await sendEmail(account, credentials, {
          to, subject, text, html, cc, bcc,
          replyTo: reply_to,
          inReplyTo: in_reply_to,
        });
        log.debug({ email, to, subject }, "send_email");
        return { content: [{ type: "text", text: t("tool.send_email.success", { messageId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── reply_email ───────────────────────────────────────────────────────────────
  if (f.reply_email) registerTextTool<{
    email: string;
    uid: number;
    folder: string;
    text?: string;
    html?: string;
    cc?: string;
    bcc?: string;
    reply_all: boolean;
  }>(
    server,
    "reply_email",
    t("tool.reply_email.description"),
    {
      email: z.string().describe(t("tool.reply_email.param_email")),
      uid: z.number().int().describe(t("tool.reply_email.param_uid")),
      folder: z.string().default("INBOX").describe(t("tool.reply_email.param_folder")),
      text: z.string().optional().describe(t("tool.reply_email.param_text")),
      html: z.string().optional().describe(t("tool.reply_email.param_html")),
      cc: z.string().optional().describe(t("tool.reply_email.param_cc")),
      bcc: z.string().optional().describe(t("tool.reply_email.param_bcc")),
      reply_all: z.boolean().default(false).describe(t("tool.reply_email.param_reply_all")),
    },
    async ({ email, uid, folder, text, html, cc, bcc, reply_all }) => {
      try {
        const account = findAccount(config, email);
        const credentials = await getCredentials(account);

        // Fetch original email for headers
        let originalMessageId = "";
        let originalReferences: string[] = [];
        let originalFrom = "";
        let originalTo = "";
        let originalSubject = "";

        await withRetry(() =>
          pool.withConnection(account, async (client) => {
            const lock = await client.getMailboxLock(folder);
            try {
              for await (const msg of client.fetch([uid], { source: true })) {
                const parsed = await simpleParser(msg.source as Buffer);
                originalMessageId = parsed.messageId ?? "";
                originalReferences = (parsed.references as string[] | string | undefined)
                  ? Array.isArray(parsed.references) ? parsed.references : [parsed.references as string]
                  : [];
                originalFrom = parsed.from?.text ?? "";
                originalTo = parsed.to
                  ? Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(", ") : parsed.to.text
                  : "";
                originalSubject = parsed.subject ?? "";
              }
            } finally {
              lock.release();
            }
          }),
        );

        if (!originalMessageId) throw new EmailNotFoundError(uid);

        // Build reply recipients
        const replyTo = originalFrom;
        const replyCC = reply_all ? [originalTo, cc].filter(Boolean).join(", ") : cc;

        // Build References chain
        const references = [...originalReferences, originalMessageId].filter(Boolean);

        // Prefix subject with Re: if not already present
        const subject = /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject}`;

        const messageId = await sendEmail(account, credentials, {
          to: replyTo,
          subject,
          text,
          html,
          cc: replyCC,
          bcc,
          inReplyTo: originalMessageId,
          references,
        });

        log.debug({ email, uid, replyTo, subject }, "reply_email");
        return { content: [{ type: "text", text: t("tool.reply_email.success", { messageId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── watch_folder ──────────────────────────────────────────────────────────────
  if (f.watch_folder) registerTextTool<{ email: string; folder: string }>(
    server,
    "watch_folder",
    t("tool.watch_folder.description"),
    {
      email: z.string().describe(t("tool.watch_folder.param_email")),
      folder: z.string().default("INBOX").describe(t("tool.watch_folder.param_folder")),
    },
    async ({ email, folder }) => {
      try {
        const account = findAccount(config, email);
        const watchId = `${email}:${folder}:${Date.now()}`;

        const handle = await watchFolder(account, folder, (notification) => {
          // Notifications are logged — in a real push scenario these could be sent via SSE
          log.info({ notification }, "watch_folder: new email");
        });

        activeWatches.set(watchId, handle);
        log.debug({ email, folder, watchId }, "watch_folder started");
        return { content: [{ type: "text", text: t("tool.watch_folder.started", { folder, watchId }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  // ── unwatch_folder ────────────────────────────────────────────────────────────
  if (f.watch_folder) registerTextTool<{ watch_id: string }>(
    server,
    "unwatch_folder",
    t("tool.unwatch_folder.description"),
    {
      watch_id: z.string().describe(t("tool.unwatch_folder.param_watch_id")),
    },
    async ({ watch_id }) => {
      try {
        const handle = activeWatches.get(watch_id);
        if (!handle) {
          return { content: [{ type: "text", text: t("tool.unwatch_folder.not_found", { watchId: watch_id }) }] };
        }
        await handle.stop();
        activeWatches.delete(watch_id);
        const folder = watch_id.split(":")[1] ?? "";
        return { content: [{ type: "text", text: t("tool.watch_folder.stopped", { folder }) }] };
      } catch (err) {
        return { content: [{ type: "text", text: formatToolError(err) }] };
      }
    },
  );

  return { server, pool };
}
