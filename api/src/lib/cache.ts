import { LRUCache } from 'lru-cache';
import { env } from '../config/env.js';

/**
 * Cache for public read endpoints. In-memory LRU per process.
 * If you run many replicas and need instant cross-instance invalidation, swap
 * this implementation for Redis; the short TTL keeps replicas eventually consistent.
 */
export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  invalidatePrefix(prefix: string): void;
  clear(): void;
}

class MemoryCache implements Cache {
  private readonly enabled = env.PUBLIC_CACHE_TTL_SECONDS > 0;
  private readonly lru = new LRUCache<string, { v: unknown }>({
    max: 500,
    ttl: Math.max(env.PUBLIC_CACHE_TTL_SECONDS, 1) * 1000,
  });

  get<T>(key: string): T | undefined {
    return this.enabled ? (this.lru.get(key)?.v as T | undefined) : undefined;
  }
  set<T>(key: string, value: T): void {
    if (this.enabled) this.lru.set(key, { v: value });
  }
  invalidatePrefix(prefix: string): void {
    for (const k of [...this.lru.keys()]) if (k.startsWith(prefix)) this.lru.delete(k);
  }
  clear(): void {
    this.lru.clear();
  }
}

export const cache: Cache = new MemoryCache();

/** In-flight de-duplication so a cold cache under load triggers one DB query, not N. */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get<T>(key);
  if (hit !== undefined) return hit;
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const p = load()
    .then((value) => {
      cache.set(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
