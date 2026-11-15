import { resolve } from "node:path";
import { config } from "dotenv";
export const NODE_ENV = process.env.NODE_ENV ?? "development";
config({ path: resolve(`.env.${NODE_ENV}`) });
config({ path: resolve(`.env`) });
if (NODE_ENV !== "production") {
  config({ path: resolve(`.env.development`) });
}

// DB configuration (mongodb, redis)
export const PORT: number = parseInt(process.env.PORT ?? "3000", 10);
export const DB_URI: string = (process.env.DB_URI as string) || "mongodb://127.0.0.1:27017/TrozianaERP";
export const DB_NAME: string = (process.env.DB_NAME as string) || "TrozianaERP";
export const REDIS_URI: string = (process.env.REDIS_URI as string) || "redis://127.0.0.1:6379";
export const ENABLE_REDIS: boolean = process.env.ENABLE_REDIS === "true";

// encryption configuration
export const ENC_KEY: string =
  (process.env.ENC_KEY as string) || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
export const IV_LENGTH: number = parseInt(process.env.IV_LENGTH ?? "16", 10);

// token configuration
export const ACCESS_TOKEN_EXPIRES_IN: number = parseInt(
  process.env.ACCESS_TOKEN_EXPIRES_IN ?? process.env.ACCESS_TOKEN_EXPIRY ?? "900",
  10,
);
export const ACCESS_USER_TOKEN_SIGNATURE: string =
  (process.env.ACCESS_USER_TOKEN_SIGNATURE as string) || "troziana-dev-access-secret-key-2026";
export const REFRESH_TOKEN_EXPIRES_IN: number = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_IN ?? process.env.REFRESH_TOKEN_EXPIRY ?? "30758400",
  10,
);
export const REFRESH_USER_TOKEN_SIGNATURE: string =
  (process.env.REFRESH_USER_TOKEN_SIGNATURE as string) || "troziana-dev-refresh-secret-key-2026";

// mail configuration
export const APP_PASSWORD: string = process.env.APP_PASSWORD as string;
export const APP_EMAIL: string = process.env.APP_EMAIL as string;

// app name
export const APPLICATION_NAME: string = process.env.APPLICATION_NAME as string;

// allowed origins to access backend apis
export const ORIGINS: string =
  (process.env.ORIGINS as string) ||
  (process.env.FRONTEND_ORIGIN as string) ||
  "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000";
export const FRONTEND_ORIGIN: string = ORIGINS;
export const COOKIE_DOMAIN: string = (process.env.COOKIE_DOMAIN as string) || "localhost";

// Aws configuration
export const AWS_ACCESS_KEY_ID: string = (process.env.AWS_ACCESS_KEY_ID as string) || "";
export const AWS_SECRET_ACCESS_KEY: string = (process.env.AWS_SECRET_ACCESS_KEY as string) || "";
export const AWS_REGION: string = (process.env.AWS_REGION as string) || "eu-north-1";
export const AWS_BUCKET_NAME: string = (process.env.AWS_BUCKET_NAME as string) || "troziana-erp-assets";

// attachment storage
export const FILE_STORAGE_PROVIDER: string =
  (process.env.FILE_STORAGE_PROVIDER as string) || (process.env.ATTACHMENT_STORAGE as string) || "LOCAL";
export const ATTACHMENT_STORAGE: string = FILE_STORAGE_PROVIDER;

// attachment storage url
export const ATTACHMENT_STORAGE_URL: string = `https://${AWS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/`;

// Logging & Jobs
export const LOG_LEVEL: string = (process.env.LOG_LEVEL as string) || (NODE_ENV === "production" ? "info" : "debug");
export const JOB_QUEUE_INTERVAL_MS: number = parseInt(process.env.JOB_QUEUE_INTERVAL_MS ?? "60000", 10);
export const PASSPORT_MIN_VALIDITY_MONTHS: number = parseInt(process.env.PASSPORT_MIN_VALIDITY_MONTHS ?? "6", 10);
export const PASSPORT_POLICY_MODE: "REJECT" | "WARN" = process.env.PASSPORT_POLICY_MODE === "WARN" ? "WARN" : "REJECT";
export const BOOKING_HOLD_DEFAULT_MINUTES: number = parseInt(process.env.BOOKING_HOLD_DEFAULT_MINUTES ?? "30", 10);

export function validateEnvironment(): void {
  if (NODE_ENV === "production") {
    const requiredVars = ["DB_URI", "ENC_KEY", "ACCESS_USER_TOKEN_SIGNATURE", "REFRESH_USER_TOKEN_SIGNATURE"];
    const missing = requiredVars.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }
  }
}
