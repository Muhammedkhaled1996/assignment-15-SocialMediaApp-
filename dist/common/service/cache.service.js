"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redis_1 = require("redis");
const config_1 = require("../../config");
class CacheService {
    client = null;
    isConnected = false;
    memoryStore = new Map();
    constructor() {
        if (config_1.ENABLE_REDIS) {
            this.client = (0, redis_1.createClient)({
                url: config_1.REDIS_URI,
                socket: { connectTimeout: 3000, reconnectStrategy: false },
            });
            this.client.on("error", () => {
                this.isConnected = false;
            });
        }
    }
    cleanExpired(key) {
        const entry = this.memoryStore.get(key);
        if (entry?.expiresAt && Date.now() > entry.expiresAt) {
            this.memoryStore.delete(key);
        }
    }
    async connect() {
        if (!config_1.ENABLE_REDIS || !this.client) {
            this.isConnected = false;
            return;
        }
        try {
            await this.client.connect();
            this.isConnected = true;
            console.log(`Redis Connect Successfully 👌`);
        }
        catch (error) {
            this.isConnected = false;
            console.log(`Failed to establish Redis connection, using in-memory cache fallback`);
        }
    }
    async set({ key, value, ttl = undefined }) {
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
    async get({ key }) {
        let value = null;
        if (this.isConnected && this.client) {
            value = await this.client.get(key);
        }
        else {
            this.cleanExpired(key);
            value = this.memoryStore.get(key)?.value ?? null;
        }
        if (value === null)
            return null;
        try {
            return JSON.parse(value);
        }
        catch (error) {
            return value;
        }
    }
    async exists({ key }) {
        if (this.isConnected && this.client) {
            return await this.client.exists(key);
        }
        this.cleanExpired(key);
        return this.memoryStore.has(key) ? 1 : 0;
    }
    async update({ key, value, ttl = undefined }) {
        if (!(await this.exists({ key }))) {
            return 0;
        }
        return await this.set({ key, value, ttl });
    }
    async del({ key }) {
        const keys = Array.isArray(key) ? key : [key];
        if (keys.length === 0)
            return 0;
        if (this.isConnected && this.client) {
            return await this.client.del(keys);
        }
        let deleted = 0;
        for (const k of keys) {
            if (this.memoryStore.delete(k))
                deleted++;
        }
        return deleted;
    }
    async keys({ prefix }) {
        if (this.isConnected && this.client) {
            return await this.client.keys(`${prefix}*`);
        }
        const result = [];
        for (const k of Array.from(this.memoryStore.keys())) {
            this.cleanExpired(k);
            if (this.memoryStore.has(k) && k.startsWith(prefix)) {
                result.push(k);
            }
        }
        return result;
    }
    async ttl({ key }) {
        if (this.isConnected && this.client) {
            return this.client.ttl(key);
        }
        this.cleanExpired(key);
        const entry = this.memoryStore.get(key);
        if (!entry)
            return -2;
        if (!entry.expiresAt)
            return -1;
        return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    }
    async expire({ key, ttl }) {
        if (this.isConnected && this.client) {
            return this.client.expire(key, ttl);
        }
        this.cleanExpired(key);
        const entry = this.memoryStore.get(key);
        if (!entry)
            return 0;
        entry.expiresAt = Date.now() + ttl * 1000;
        this.memoryStore.set(key, entry);
        return 1;
    }
    async incrementBy({ key, count = 1 }) {
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
    async decrementBy({ key, count = 1 }) {
        if (this.isConnected && this.client) {
            return this.client.decrBy(key, count);
        }
        return this.incrementBy({ key, count: -count });
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
