import { RedisClientType } from "@redis/client";
import { createClient } from "redis";
import { ENABLE_REDIS, REDIS_URI } from "../../config";

interface MemoryEntry {
  value: string;
  expiresAt?: number | undefined;
}

export class CacheService {
  private readonly client: RedisClientType | null = null;
  private isConnected: boolean = false;
  private memoryStore: Map<string, MemoryEntry> = new Map();

  constructor() {
    if (ENABLE_REDIS) {
      this.client = createClient({
        url: REDIS_URI,
        socket: { connectTimeout: 3000, reconnectStrategy: false },
      });
      this.client.on("error", () => {
        this.isConnected = false;
      });
    }
  }

  private cleanExpired(key: string): void {
    const entry = this.memoryStore.get(key);
    if (entry?.expiresAt && Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
    }
  }

  async connect() {
    if (!ENABLE_REDIS || !this.client) {
      this.isConnected = false;
      return;
    }
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log(`Redis Connect Successfully 👌`);
    } catch (error) {
      this.isConnected = false;
      console.log(`Failed to establish Redis connection, using in-memory cache fallback`);
    }
  }

  async set({ key, value, ttl = undefined }: { key: string; value: any; ttl?: number | undefined }) {
    const serialized = typeof value === "object" ? JSON.stringify(value) : String(value);
    if (this.isConnected && this.client) {
      return this.client.set(key, serialized, { ...(ttl ? { EX: ttl } : {}) });
    }
    this.memoryStore.set(key, {
      value: serialized,
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
    return "OK";
  }

  async get({ key }: { key: string }) {
    let value: string | null = null;
    if (this.isConnected && this.client) {
      value = await this.client.get(key);
    } else {
      this.cleanExpired(key);
      value = this.memoryStore.get(key)?.value ?? null;
    }
    if (value === null) return null;
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  async exists({ key }: { key: string }) {
    if (this.isConnected && this.client) {
      return await this.client.exists(key);
    }
    this.cleanExpired(key);
    return this.memoryStore.has(key) ? 1 : 0;
  }

  async update({ key, value, ttl = undefined }: { key: string; value: any; ttl?: number }) {
    if (!(await this.exists({ key }))) {
      return 0;
    }
    return await this.set({ key, value, ttl });
  }

  async del({ key }: { key: string | string[] }) {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return 0;
    if (this.isConnected && this.client) {
      return await this.client.del(keys);
    }
    let deleted = 0;
    for (const k of keys) {
      if (this.memoryStore.delete(k)) deleted++;
    }
    return deleted;
  }

  async keys({ prefix }: { prefix: string }) {
    if (this.isConnected && this.client) {
      return await this.client.keys(`${prefix}*`);
    }
    const result: string[] = [];
    for (const k of Array.from(this.memoryStore.keys())) {
      this.cleanExpired(k);
      if (this.memoryStore.has(k) && k.startsWith(prefix)) {
        result.push(k);
      }
    }
    return result;
  }

  async ttl({ key }: { key: string }) {
    if (this.isConnected && this.client) {
      return this.client.ttl(key);
    }
    this.cleanExpired(key);
    const entry = this.memoryStore.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async expire({ key, ttl }: { key: string; ttl: number }) {
    if (this.isConnected && this.client) {
      return this.client.expire(key, ttl);
    }
    this.cleanExpired(key);
    const entry = this.memoryStore.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttl * 1000;
    this.memoryStore.set(key, entry);
    return 1;
  }

  async incrementBy({ key, count = 1 }: { key: string; count?: number }) {
    if (this.isConnected && this.client) {
      return this.client.incrBy(key, count);
    }
    this.cleanExpired(key);
    const entry = this.memoryStore.get(key);
    const current = entry ? parseInt(entry.value, 10) || 0 : 0;
    const nextVal = current + count;
    this.memoryStore.set(key, {
      value: String(nextVal),
      expiresAt: entry?.expiresAt,
    });
    return nextVal;
  }

  async decrementBy({ key, count = 1 }: { key: string; count?: number }) {
    if (this.isConnected && this.client) {
      return this.client.decrBy(key, count);
    }
    return this.incrementBy({ key, count: -count });
  }
}

export const cacheService = new CacheService();

