import { RedisClientType } from "@redis/client";
import { createClient } from "redis";
import { REDIS_URI } from "../../config";

export class CacheService {
  private readonly client: RedisClientType;
  constructor() {
    this.client = createClient({ url: REDIS_URI });
  }

  async connect() {
    try {
      await this.client.connect();
      console.log(`Redis Connect Successfully 👌`);
    } catch (error) {
      console.log(`Failed to stablish Redis connection ❌`);
    }
  }

  async set({ key, value, ttl = undefined }: { key: string; value: any; ttl?: number | undefined }) {
    if (typeof value == "object") {
      value = JSON.stringify(value);
    }
    return this.client.set(key, value, { ...(ttl ? { EX: ttl } : {}) });
  }

  async get({ key }: { key: string }) {
    let value = await this.client.get(key);
    try {
      return JSON.parse(value as string);
    } catch (error) {
      return value;
    }
  }

  async exists({ key }: { key: string }) {
    return await this.client.exists(key);
  }

  async update({ key, value, ttl = undefined }: { key: string; value: any; ttl?: number }) {
    if (!(await this.client.exists(key))) {
      return 0;
    }
    return await this.set({ key, value, ttl });
  }

  async del({ key }: { key: string[] }) {
    return await this.client.del(key);
  }

  async keys({ prefix }: { prefix: string }) {
    return await this.client.keys(`${prefix}*`);
  }

  async ttl({ key }: { key: string }) {
    return this.client.ttl(key);
  }

  async expire({ key, ttl }: { key: string; ttl: number }) {
    return this.client.expire(key, ttl);
  }

  async incrementBy({ key, count = 1 }: { key: string; count?: number }) {
    return this.client.incrBy(key, count);
  }

  async decrementBy({ key, count = 1 }: { key: string; count?: number }) {
    return this.client.decrBy(key, count);
  }
}

export const cacheService = new CacheService();
