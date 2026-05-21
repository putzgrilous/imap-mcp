import { LRUCache } from "lru-cache";
import type { CacheConfig } from "../config/schema.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("cache");

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TtlCache<T> {
  private readonly cache: LRUCache<string, CacheEntry<T>>;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlSeconds: number) {
    this.cache = new LRUCache({ max: maxSize });
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }
}

export class CacheManager {
  readonly folders: TtlCache<string[]>;
  readonly metadata: TtlCache<object>;

  constructor(config: CacheConfig) {
    this.folders = new TtlCache(200, config.folderTtlSeconds);
    this.metadata = new TtlCache(1000, config.metadataTtlSeconds);
  }

  invalidateAccount(email: string): void {
    this.folders.invalidatePrefix(email);
    this.metadata.invalidatePrefix(email);
    log.debug({ email }, "Cache invalidated for account");
  }
}

let _cache: CacheManager | null = null;

export function initCache(config: CacheConfig): CacheManager {
  _cache = new CacheManager(config);
  return _cache;
}

export function getCache(): CacheManager {
  if (!_cache) throw new Error("Cache not initialized. Call initCache() first.");
  return _cache;
}
