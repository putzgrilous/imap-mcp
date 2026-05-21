import { z } from "zod";

export const AuthPasswordSchema = z.object({
  type: z.literal("password"),
});

export const AccountConfigSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(993),
  secure: z.boolean().default(true),
  auth: AuthPasswordSchema.default({ type: "password" }),
  // Optional SMTP overrides — derived from IMAP host/port when absent
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  // Legacy: password in config.json — deprecated, triggers warning at startup
  password: z.string().optional(),
});

export const CacheConfigSchema = z.object({
  folderTtlSeconds: z.number().int().positive().default(300),
  metadataTtlSeconds: z.number().int().positive().default(120),
});

export const PoolConfigSchema = z.object({
  maxConnectionsPerAccount: z.number().int().min(1).max(10).default(2),
  idleTimeoutSeconds: z.number().int().positive().default(60),
});

export const FeaturesConfigSchema = z.object({
  // Read tools — enabled by default
  list_accounts: z.boolean().default(true),
  list_folders: z.boolean().default(true),
  list_emails: z.boolean().default(true),
  search_emails: z.boolean().default(true),
  get_email: z.boolean().default(true),
  get_attachment: z.boolean().default(true),
  // Account management — enabled by default
  setup_account: z.boolean().default(true),
  remove_account: z.boolean().default(true),
  update_account: z.boolean().default(true),
  list_config: z.boolean().default(true),
  // Write tools — disabled by default (destructive / require explicit opt-in)
  move_email: z.boolean().default(false),
  delete_email: z.boolean().default(false),
  mark_read: z.boolean().default(false),
  flag_email: z.boolean().default(false),
  create_folder: z.boolean().default(false),
  delete_folder: z.boolean().default(false),
  // Send — disabled by default (requires SMTP config)
  send_email: z.boolean().default(false),
  reply_email: z.boolean().default(false),
  // Notification — disabled by default (long-lived connection)
  watch_folder: z.boolean().default(false),
});

export const SmtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
});

export const ServerConfigSchema = z.object({
  version: z.number().int().default(2),
  locale: z.string().default("en"),
  logLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("warn"),
  enableMetrics: z.boolean().default(false),
  features: FeaturesConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
  pool: PoolConfigSchema.default({}),
  accounts: z.array(AccountConfigSchema).default([]),
});

export type AccountConfig = z.infer<typeof AccountConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type PoolConfig = z.infer<typeof PoolConfigSchema>;
export type FeaturesConfig = z.infer<typeof FeaturesConfigSchema>;
export type SmtpConfig = z.infer<typeof SmtpConfigSchema>;

export type ResolvedCredentials = { type: "password"; value: string };

export interface ResolvedAccount {
  config: AccountConfig;
  credentials: ResolvedCredentials;
}
