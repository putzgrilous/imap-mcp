import { ImapFlow } from "imapflow";
import type { AccountConfig, PoolConfig } from "../config/schema.js";
import { getCredentials } from "../credentials/manager.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("imap-pool");

interface PoolEntry {
  client: ImapFlow;
  inUse: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  account: string;
}

export class ImapConnectionPool {
  private readonly pool = new Map<string, PoolEntry[]>();
  private readonly config: PoolConfig;

  constructor(config: PoolConfig) {
    this.config = config;
  }

  async withConnection<T>(account: AccountConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = await this.acquire(account);
    try {
      return await fn(client);
    } finally {
      this.release(account.email, client);
    }
  }

  async drain(): Promise<void> {
    const all: Promise<void>[] = [];
    for (const entries of this.pool.values()) {
      for (const entry of entries) {
        if (entry.idleTimer) clearTimeout(entry.idleTimer);
        all.push(entry.client.logout().catch(() => {}));
      }
    }
    await Promise.all(all);
    this.pool.clear();
    log.debug("Pool drained");
  }

  private async acquire(account: AccountConfig): Promise<ImapFlow> {
    const key = account.email;
    const entries = this.pool.get(key) ?? [];
    this.pool.set(key, entries);

    // Reuse idle connection
    const idle = entries.find((e) => !e.inUse);
    if (idle) {
      if (idle.idleTimer) {
        clearTimeout(idle.idleTimer);
        idle.idleTimer = null;
      }
      idle.inUse = true;
      log.debug({ email: key }, "Pool: reusing connection");
      return idle.client;
    }

    // Create new connection if under limit
    if (entries.length < this.config.maxConnectionsPerAccount) {
      const client = await this.createClient(account);
      const entry: PoolEntry = { client, inUse: true, idleTimer: null, account: key };
      entries.push(entry);
      log.debug({ email: key, total: entries.length }, "Pool: new connection");
      return client;
    }

    // Wait for a free slot — poll every 50ms
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10_000;
      const poll = () => {
        const free = entries.find((e) => !e.inUse);
        if (free) {
          if (free.idleTimer) { clearTimeout(free.idleTimer); free.idleTimer = null; }
          free.inUse = true;
          resolve(free.client);
        } else if (Date.now() > deadline) {
          reject(new Error(`No IMAP connection available for ${key} after 10s`));
        } else {
          setTimeout(poll, 50);
        }
      };
      poll();
    });
  }

  private release(email: string, client: ImapFlow): void {
    const entries = this.pool.get(email) ?? [];
    const entry = entries.find((e) => e.client === client);
    if (!entry) return;

    entry.inUse = false;
    entry.idleTimer = setTimeout(async () => {
      await entry.client.logout().catch(() => {});
      const list = this.pool.get(email) ?? [];
      const idx = list.indexOf(entry);
      if (idx >= 0) list.splice(idx, 1);
      log.debug({ email }, "Pool: idle connection closed");
    }, this.config.idleTimeoutSeconds * 1000);
  }

  private async createClient(account: AccountConfig): Promise<ImapFlow> {
    const credentials = await getCredentials(account);
    const client = new ImapFlow({
      host: account.host,
      port: account.port,
      secure: account.secure,
      auth: { user: account.email, pass: credentials.value },
      logger: false,
      tls: { rejectUnauthorized: true },
    });
    await client.connect();
    return client;
  }
}

let _pool: ImapConnectionPool | null = null;

export function initPool(config: PoolConfig): ImapConnectionPool {
  _pool = new ImapConnectionPool(config);
  return _pool;
}

export function getPool(): ImapConnectionPool {
  if (!_pool) throw new Error("Pool not initialized. Call initPool() first.");
  return _pool;
}
