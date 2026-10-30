"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiterService = exports.RateLimiterService = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const geoip_lite_1 = __importDefault(require("geoip-lite"));
const cache_service_js_1 = require("../service/cache.service.js");
class RateLimiterService {
    cacheService;
    constructor() {
        this.cacheService = cache_service_js_1.cacheService;
    }
    fromWhere(ip) {
        try {
            return geoip_lite_1.default.lookup(ip);
        }
        catch (error) {
            console.error({
                error: error instanceof Error ? error.message : String(error),
                status: error?.status,
            });
            return null;
        }
    }
    createRedisStore(ttlInMinutes) {
        const ttl = ttlInMinutes * 60;
        const windowMs = ttlInMinutes * 60 * 1000;
        return {
            increment: async (key) => {
                const totalHits = await this.cacheService.incrementBy({ key });
                if (totalHits === 1) {
                    await this.cacheService.expire({ key, ttl });
                }
                const remainingTtl = (await this.cacheService.ttl?.({ key })) ?? ttl;
                const resetTime = new Date(Date.now() + (remainingTtl > 0 ? remainingTtl * 1000 : windowMs));
                return {
                    totalHits,
                    resetTime,
                };
            },
            decrement: async (key) => {
                const isExists = await this.cacheService.exists({ key });
                if (isExists) {
                    await cache_service_js_1.cacheService.decrementBy({ key });
                }
            },
            resetKey: async (key) => {
                await this.cacheService.del({ key: [key] });
            },
        };
    }
    generateLimiter({ ttl = 15, limit = 1000, message = "Too many requests", status = 429, legacyHeaders = true, standardHeaders = "draft-6", skipSuccessfulRequests = false, skipFailedRequests = false, } = {}) {
        return (0, express_rate_limit_1.default)({
            windowMs: ttl * 60 * 1000,
            limit: (req) => {
                const ip = req.ip || req.socket.remoteAddress || "";
                const data = this.fromWhere(ip);
                return limit;
            },
            handler: (req, res, next) => {
                if (res.headersSent) {
                    return;
                }
                return res.status(status).json({
                    message,
                    status,
                });
            },
            standardHeaders,
            legacyHeaders,
            skipSuccessfulRequests,
            skipFailedRequests,
            keyGenerator: (req) => {
                const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
                const normalizedIp = (0, express_rate_limit_1.ipKeyGenerator)(ip, 52);
                return `${normalizedIp}::${req.path}`;
            },
            store: this.createRedisStore(ttl),
        });
    }
}
exports.RateLimiterService = RateLimiterService;
exports.rateLimiterService = new RateLimiterService();
