"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSessionSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    isRevoked: { type: Boolean, default: false, index: true },
    revokedReason: { type: String },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    lastUsedAt: { type: Date, default: Date.now },
}, { timestamps: true, strict: true });
userSessionSchema.index({ userId: 1, isRevoked: 1 });
exports.UserSessionModel = mongoose_1.default.models.UserSession ||
    mongoose_1.default.model("UserSession", userSessionSchema);
