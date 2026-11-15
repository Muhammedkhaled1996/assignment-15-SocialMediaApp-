"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOKING_HOLD_DEFAULT_MINUTES = exports.PASSPORT_POLICY_MODE = exports.PASSPORT_MIN_VALIDITY_MONTHS = exports.JOB_QUEUE_INTERVAL_MS = exports.LOG_LEVEL = exports.ATTACHMENT_STORAGE_URL = exports.ATTACHMENT_STORAGE = exports.FILE_STORAGE_PROVIDER = exports.AWS_BUCKET_NAME = exports.AWS_REGION = exports.AWS_SECRET_ACCESS_KEY = exports.AWS_ACCESS_KEY_ID = exports.COOKIE_DOMAIN = exports.FRONTEND_ORIGIN = exports.ORIGINS = exports.APPLICATION_NAME = exports.APP_EMAIL = exports.APP_PASSWORD = exports.REFRESH_USER_TOKEN_SIGNATURE = exports.REFRESH_TOKEN_EXPIRES_IN = exports.ACCESS_USER_TOKEN_SIGNATURE = exports.ACCESS_TOKEN_EXPIRES_IN = exports.IV_LENGTH = exports.ENC_KEY = exports.ENABLE_REDIS = exports.REDIS_URI = exports.DB_NAME = exports.DB_URI = exports.PORT = exports.NODE_ENV = void 0;
exports.validateEnvironment = validateEnvironment;
const node_path_1 = require("node:path");
const dotenv_1 = require("dotenv");
exports.NODE_ENV = process.env.NODE_ENV ?? "development";
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(`.env.${exports.NODE_ENV}`) });
(0, dotenv_1.config)({ path: (0, node_path_1.resolve)(`.env`) });
if (exports.NODE_ENV !== "production") {
    (0, dotenv_1.config)({ path: (0, node_path_1.resolve)(`.env.development`) });
}
exports.PORT = parseInt(process.env.PORT ?? "3000", 10);
exports.DB_URI = process.env.DB_URI || "mongodb://127.0.0.1:27017/TrozianaERP";
exports.DB_NAME = process.env.DB_NAME || "TrozianaERP";
exports.REDIS_URI = process.env.REDIS_URI || "redis://127.0.0.1:6379";
exports.ENABLE_REDIS = process.env.ENABLE_REDIS === "true";
exports.ENC_KEY = process.env.ENC_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
exports.IV_LENGTH = parseInt(process.env.IV_LENGTH ?? "16", 10);
exports.ACCESS_TOKEN_EXPIRES_IN = parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN ?? process.env.ACCESS_TOKEN_EXPIRY ?? "900", 10);
exports.ACCESS_USER_TOKEN_SIGNATURE = process.env.ACCESS_USER_TOKEN_SIGNATURE || "troziana-dev-access-secret-key-2026";
exports.REFRESH_TOKEN_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN ?? process.env.REFRESH_TOKEN_EXPIRY ?? "30758400", 10);
exports.REFRESH_USER_TOKEN_SIGNATURE = process.env.REFRESH_USER_TOKEN_SIGNATURE || "troziana-dev-refresh-secret-key-2026";
exports.APP_PASSWORD = process.env.APP_PASSWORD;
exports.APP_EMAIL = process.env.APP_EMAIL;
exports.APPLICATION_NAME = process.env.APPLICATION_NAME;
exports.ORIGINS = process.env.ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000";
exports.FRONTEND_ORIGIN = exports.ORIGINS;
exports.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "localhost";
exports.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
exports.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
exports.AWS_REGION = process.env.AWS_REGION || "eu-north-1";
exports.AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME || "troziana-erp-assets";
exports.FILE_STORAGE_PROVIDER = process.env.FILE_STORAGE_PROVIDER || process.env.ATTACHMENT_STORAGE || "LOCAL";
exports.ATTACHMENT_STORAGE = exports.FILE_STORAGE_PROVIDER;
exports.ATTACHMENT_STORAGE_URL = `https://${exports.AWS_BUCKET_NAME}.s3.${exports.AWS_REGION}.amazonaws.com/`;
exports.LOG_LEVEL = process.env.LOG_LEVEL || (exports.NODE_ENV === "production" ? "info" : "debug");
exports.JOB_QUEUE_INTERVAL_MS = parseInt(process.env.JOB_QUEUE_INTERVAL_MS ?? "60000", 10);
exports.PASSPORT_MIN_VALIDITY_MONTHS = parseInt(process.env.PASSPORT_MIN_VALIDITY_MONTHS ?? "6", 10);
exports.PASSPORT_POLICY_MODE = process.env.PASSPORT_POLICY_MODE === "WARN" ? "WARN" : "REJECT";
exports.BOOKING_HOLD_DEFAULT_MINUTES = parseInt(process.env.BOOKING_HOLD_DEFAULT_MINUTES ?? "30", 10);
function validateEnvironment() {
    if (exports.NODE_ENV === "production") {
        const requiredVars = ["DB_URI", "ENC_KEY", "ACCESS_USER_TOKEN_SIGNATURE", "REFRESH_USER_TOKEN_SIGNATURE"];
        const missing = requiredVars.filter((key) => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
        }
    }
}
