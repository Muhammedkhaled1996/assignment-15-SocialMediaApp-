import { Request, Response, NextFunction } from "express";
import rateLimit, {
  ipKeyGenerator,
  RateLimitRequestHandler,
  Store,
  IncrementCallback,
  ClientRateLimitInfo,
} from "express-rate-limit";
import geoip, { Lookup } from "geoip-lite";
import { cacheService, CacheService } from "../service/cache.service.js";

export interface IRateLimiterOptions {
  ttl?: number;
  limit?: number;
  message?: string;
  status?: number;
  legacyHeaders?: boolean;
  standardHeaders?: "draft-6" | "draft-7" | boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiterService {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = cacheService;
  }
  // استخراج بيانات الموقع الجغرافي بناءً على الـ IP
  private fromWhere(ip: string): Lookup | null {
    try {
      return geoip.lookup(ip);
    } catch (error) {
      console.error({
        error: error instanceof Error ? error.message : String(error),
        status: (error as { status?: unknown })?.status,
      });
      return null;
    }
  }

  // إنشاء Redis Custom Store متوافق مع express-rate-limit
  private createRedisStore(ttlInMinutes: number): Store {
    const ttl = ttlInMinutes * 60;
    const windowMs = ttlInMinutes * 60 * 1000;

    return {
      // باراميتر واحد فقط (key: string) وبدون cb نهائياً
      increment: async (key: string): Promise<ClientRateLimitInfo> => {
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

      decrement: async (key: string): Promise<void> => {
        const isExists = await this.cacheService.exists({ key });
        if (isExists) {
          await cacheService.decrementBy({ key });
        }
      },

      resetKey: async (key: string): Promise<void> => {
        await this.cacheService.del({ key: [key] });
      },
    };
  }

  // توليد Middleware لتحديد معدل الطلبات
  public generateLimiter({
    ttl = 15,
    limit = 1000,
    message = "Too many requests",
    status = 429,
    legacyHeaders = true,
    standardHeaders = "draft-6",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  }: IRateLimiterOptions = {}): RateLimitRequestHandler {
    return rateLimit({
      windowMs: ttl * 60 * 1000,

      limit: (req: Request) => {
        const ip = req.ip || req.socket.remoteAddress || "";
        const data = this.fromWhere(ip);
        // return data?.country === "EG" ? limit : 0;
        return limit;
      },

      handler: (req: Request, res: Response, next: NextFunction) => {
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

      keyGenerator: (req: Request) => {
        const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
        const normalizedIp = ipKeyGenerator(ip, 52);
        return `${normalizedIp}::${req.path}`;
      },

      store: this.createRedisStore(ttl),
    });
  }
}

export const rateLimiterService = new RateLimiterService();
